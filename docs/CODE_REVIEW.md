# 代码审查报告 · 代码片段管理器（snippets）

审查范围：`src/main`（Electron 主进程 / SQLite 层）、`src/preload`、`src/renderer/src`（React + React Router + zustand）
审查方式：静态阅读 + 关键依赖行为核对（React Router 6.22 的 hash 路由与相对 redirect 解析、better-sqlite3 命名参数绑定）
结论：**存在 3 个会直接导致功能不可用 / 数据错位的问题**，另有若干事务、资源与体验层面的缺陷。

---

## 一、严重（建议优先修）

### 1. 在 render 函数体里发 IPC，导致数据库目录被反复重置
`src/renderer/src/layouts/Home/index.tsx:14-16`

```tsx
const config = useStore((s) => s.config)
window.api.shortCut(config.shortCut)
window.api.setDatabaseDirectory(config.databaseDirectory)
window.api.initTable()
```

- 这三行在**每次渲染**都会执行（StrictMode 下首屏就执行两次），且早于任何 `useEffect`。
- `config` 来自 zustand 的 localStorage 持久化，首次安装时是 `{ databaseDirectory: '', shortCut: '' }`，于是主进程 `config.databaseDirectory` 被置空，`db()` 回落到 `~/Desktop/hd.db`。
- 用户在设置页换过数据库目录后，只要 localStorage 丢失（清缓存、换机器、卸载重装），应用就会**静默切换到桌面上的另一个空库**，表现为"片段全没了"。
- 设置页的 loader（`SettingLoader`）在 `router/index.tsx:30-31` 被注释掉，配置从不从 SQLite 读回，DB 里的 `config` 表形同虚设，localStorage 成了唯一真源。

建议：把初始化收敛成一个 `useEffect(() => {...}, [])`；配置以 SQLite 的 `config` 表为准，渲染进程启动时读取后写入 store；`setDatabaseDirectory` 只在值真正变化时下发。

### 2. 首次启动时主进程在"表还没建"时就查配置，异常打断后续初始化
`src/main/shortCut.ts:27-32`、`src/main/db/tables.ts`、`src/main/index.ts:12-32`

- `initTable()` 只由渲染进程通过 IPC 触发；主进程 `app.whenReady()` 里直接 `registerAppGlobShortcut()` → `config()` → `select * from config` → 首次启动抛 `no such table: config`。
- 这个异常发生在 `app.whenReady().then(...)` 回调内，**后面注册 `browser-window-created`、`activate` 的代码全部被跳过**；默认快捷键 `Alt+Space` 也没注册，用户会觉得"装完按热键没反应"。
- 再次启动才正常（此时库已建好），属于典型的"只在第一次坏"的偶发问题。

建议：把 `initTable()` 移到主进程 `app.whenReady()` 里、`registerAppGlobShortcut()` 之前；`config()` 加"表不存在/无记录"兜底返回默认值。

### 3. 每次查询都新建一个 SQLite 连接且从不关闭
`src/main/db/connect.ts:7-15`、`src/main/db/query.ts:3-21`

```ts
const db = () => { ...; const db = new Database(dir + '/hd.db', {}); db.pragma('journal_mode = WAL'); return db }
```

`findAll / findOne / insert / update / del` 每个都调用 `db()`，等于**一次查询开一个连接**：文件句柄持续增长、每次重新执行 pragma、写操作之间容易 `SQLITE_BUSY`。建议改成模块级单例（首次使用时打开，切库时显式 close 后重开），并顺手用 `path.join(dir, 'hd.db')` 替代字符串拼接。

---

## 二、功能性 Bug

### 4. 回车选中片段后调用不存在的方法
`src/renderer/src/hooks/useSelect.ts:42` → `window.api.hideWindow()`

preload（`src/preload/index.ts`）与 `index.d.ts` 都没有 `hideWindow`，等于 `undefined()` → 抛 `TypeError`（在 async 函数里变成未处理的 Promise rejection）。实际隐藏靠的是同一分支里的 `closeWindow('search')`，所以"还能用"，但控制台一直报错、后续逻辑有隐患。

### 5. 在"所有片段"下新增片段会跳到不存在的路由
`src/renderer/src/pages/ContentList/ContentListAction.ts:10-15`

```ts
return redirect(`content/${id}`)
```

相对 redirect 以当前路由的 pathname 为基准：`/config/category/contentList` + `content/5` → `/config/category/contentList/content/5`，而路由表是 `contentList/:cid?` + `content/:id`，这段 URL 会被解析成 `cid="content"`、剩 `5` 无处匹配 → 匹配不到路由（空白 / 报错页）。带 `cid` 时（如 `/contentList/3`）拼出来的地址才是对的。建议改成绝对路径，显式带上 `params.cid ?? 0`。

### 6. 删除正在查看的片段会白屏
`src/renderer/src/pages/Content/ContentLoader.ts:2`、`src/renderer/src/pages/Content/index.tsx:12`

- 删除后 React Router 会重新执行仍在匹配中的 loader，`select * from contents where id=...` 返回 `undefined`；
- `Content` 组件直接 `content.id` → `Cannot read properties of undefined`；路由上**没有任何 `errorElement`**，整个配置窗口变成错误页。

建议：loader 里判断不存在就 `redirect` 回列表；同时给 `config` 路由加 `errorElement` 兜底。

### 7. 每次按键都写库并 redirect
`src/renderer/src/pages/Content/index.tsx:18-40`、`ContentAction.ts:6-11`

标题/正文的 `onChange` 直接 `submit(form)`，action 里 update + `redirect`。副作用：

- 打字即写入数据库（一句话 = 几十次 UPDATE），列表 loader 也随之重复执行；
- 每次提交都会触发一次导航（replace），**中文输入法组合过程可能被打断**，是全应用最影响手感的问题；
- 没有防抖/防并发，快速输入时多次 action 排队。

建议：改为 `onBlur` 或 300~500ms debounce 提交；列表 loader 的重新校验可延后。

### 8. 快捷键"占用检测"是死代码，注册失败也不提示
`src/main/shortCut.ts:10-20`

```ts
globalShortcut.unregisterAll()
if (shortCut && globalShortcut.isRegistered(shortCut)) { ... }   // 刚 unregisterAll，永远 false
return globalShortcut.register(shortCut, () => {...})
```

- 判断顺序反了，`showErrorBox('快捷键已被占用')` 永远不会执行；
- 系统占用时 `register` 返回 `false`，`SettingAction` 拿到 `false` 后只 `return {}`（`SettingAction.ts:5-10`），用户看到表单"保存成功"其实没生效；
- 首次启动 `shortCut` 为空字符串时还会用空 accelerator 去 `register('')`，直接抛错；
- `unregisterAll()` 会清掉应用所有全局快捷键，后续再加别的快捷键会被误杀。

建议：先 `isRegistered` 再 `unregister` 旧键；`register` 的返回值原样报给渲染进程并 `setError` 提示；空值直接跳过。

### 9. 删除分类没有事务
`src/renderer/src/pages/Category/CategoryAction.ts:13-25`

先 `delete from categories`，再 `update contents set category_id=0`，两条语句之间失败（进程崩溃/库锁）就会留下 `category_id` 指向已删分类的孤儿数据（这些片段在列表里既不属分类也不属"未分类"，实际查不出来）。建议包在 `db.transaction()` 里执行（需要 query 层暴露事务能力）。

---

## 三、中低优先级 / 代码质量

| # | 位置 | 问题 |
|---|---|---|
| 10 | `src/main/index.ts:30` | `activate` 里调用了未导入的 `createWindow`，macOS 下窗口全关后点 Dock 图标会 `ReferenceError`（`typecheck` 也会报） |
| 11 | `src/main/db/query.ts:7,11` | `findOne(sql)`、`insert(sql)` 不接受 params，`findAll` 又默认 `{}`，接口不一致；调用方（`SettingLoader.ts:2`）传的 `{}` 被静默丢弃 |
| 12 | `src/main/db/query.ts:23-26` | `config()` 里 `res.content` 在无 `id=1` 记录时是 `undefined.content` → TypeError |
| 13 | `src/main/db/ipc.ts:7-12` | `query[type](sql, params)`：`type`、SQL 全由渲染进程提供，等于把裸 SQL 执行权交给前端；`type` 非法时是 `query[undefined] is not a function`。建议白名单校验 + 强制参数化 |
| 14 | `src/renderer/src/pages/Content/ContentLoader.ts:2`、`ContentListAction.ts:11,17` | SQL 用模板字符串拼接 URL 参数（`${params.id}`、`${cid}`、`${data.id}`），存在注入面，且 `cid` 非数字时直接语法错误 |
| 15 | `src/main/windows.ts:39-46` | 没有监听 `closed` 复位 `config[name].id`；`BrowserWindow` id 会被复用，`fromId` 可能命中另一个窗口 |
| 16 | `src/main/shortCut.ts:16-19` | 闭包里持有 `win`，窗口销毁后 `win.isVisible()` 抛 "Object has been destroyed" |
| 17 | `src/renderer/src/hooks/useIgnoreMouseEvents.ts:5-13` | 每次调用都给 `document.body` 加 `mouseover` 监听且不清理，StrictMode 下叠加两份；应返回 cleanup 并在 `useEffect` 里调用 |
| 18 | `src/renderer/src/components/CategoryItem/index.tsx:21-35` | 双击进入编辑后只有 `Enter` 能提交，没有 `onBlur`/`Escape` → 只能回车或刷新才能退出；`onContextMenu={contextMenu()}` 每次渲染都调用 `showContextMenu`（仅是构造闭包，可接受但语义不对） |
| 19 | `src/renderer/src/pages/Setting/index.tsx:20-33` | `keys.push(code); setKeys(keys)` 直接改同一数组引用（不触发更新），且 `keys` 是闭包旧值；连续按键组合可能丢键；`/^(\w\|Space)$/gi` 无法匹配 `F1`、`Arrow*` 等 |
| 20 | `src/renderer/src/pages/ContentList/ContentListLoader.ts:6-9` | 搜索分支直接 return，忽略 `cid`，在分类内搜索会变成全局搜索（看是否预期）；`searchWord` 未转义 `%`/`_` |
| 21 | `src/renderer/src/hooks/useSearch.ts` | 无防抖；`useStore((s) => s)` 整表订阅，任意 state 变化都重渲染；只搜 `title` 不搜 `content` |
| 22 | `src/renderer/src/components/CategoryItem/index.tsx:42`、`ContentItem/index.tsx:15` | 组件内部给 `NavLink` 加 `key`（无效，`key` 应在父级 map 处传入） |
| 23 | `useSelect.ts:8`、`ContentItem/index.tsx:21`、`ContentListAction.ts:7`、`CategoryItem/index.tsx:28` | `console.log` 调试残留 |
| 24 | `electron.vite.config.1710940922578.mjs`、`electron.vite.config.1716131513253.mjs` | 两个历史备份文件混在根目录，建议删除或写入 `.gitignore` |
| 25 | `src/preload/index.ts:13-15` | `openConfigWindow` 在主进程没有任何 handler（死代码） |
| 26 | `src/main/createWindow.ts:26` | 搜索窗 `alwaysOnTop: false` + `transparent: true`，热键唤起后可能被其他窗口压住，通常应设为 `true` |
| 27 | `src/renderer/src/assets/global.scss:4-6` | `* { opacity: 0.995 }` 给所有元素加透明度，会让文本呈现轻微发灰，且关闭子像素抗锯齿，建议删掉 |
| 28 | DB schema | `contents.category_id` 无索引；删除分类/片段均无外键约束，数据一致性全靠代码 |

---

## 四、建议的修复顺序

1. 主进程 ready 时先 `initTable()`，`config()` 加兜底（问题 2）
2. 数据库连接改单例（问题 3）
3. `Home` 初始化收敛到 `useEffect`，配置以 SQLite 为准（问题 1）
4. `redirect` 改绝对路径 + `Content` loader 兜底 + `errorElement`（问题 5、6）
5. 编辑器提交加防抖（问题 7）
6. 快捷键注册逻辑与失败提示（问题 8）
7. 删除分类加事务（问题 9）

其余为代码质量项，可随相关文件改动一并清理。
