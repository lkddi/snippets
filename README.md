# Snippets

一个 Alfred 风格的 macOS 桌面启动器，基于 Electron + React + TypeScript 构建。

全局热键一键唤起，聚合搜索本机应用、文件与网页，内置剪贴板历史与代码片段管理。

## 功能特性

- **聚合搜索**：一个输入框同时检索本机应用、扫描目录下的文件与内置代码片段
- **拼音与中文名匹配**：输入 `wx` 即可命中「微信」，基于 `pinyin-pro` 实现全拼/首字母匹配
- **网页搜索直达**：支持百度 / Google / Bing / DuckDuckGo，未命中的关键词一键跳转搜索引擎
- **全局快捷键**：自定义唤起热键，注册失败时设置页会给出占用原因提示
- **剪贴板历史**：双击 `Option` 呼出面板（参考 Maccy 的交互），失焦自动隐藏
- **代码片段管理**：目录分类 + 内容高亮，数据存于本地 SQLite
- **托盘常驻 / 开机启动 / 隐藏程序坞图标**：纯后台驻留，不占 Dock 位
- **多桌面支持**：启动器窗口悬浮于所有 Space 与全屏应用之上

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | Electron 28 + electron-vite |
| 渲染层 | React 18 + TypeScript + react-router |
| UI | antd + Mantine + Tailwind CSS + @icon-park/react |
| 存储 | better-sqlite3（主进程封装 IPC 数据层） |
| 其它 | uiohook-napi（全局监听）、zustand、pinyin-pro |

## 快速开始

```bash
# 安装依赖（需要 pnpm）
pnpm install

# 开发模式
pnpm dev

# 构建
pnpm build:mac    # macOS (Apple Silicon dmg)
pnpm build:win    # Windows
pnpm build:linux  # Linux (AppImage / snap / deb)
```

> macOS 首次运行需在「系统设置 → 隐私与安全性」中允许应用运行；
> 若快捷键与系统冲突（如 `Command+Space`），需在键盘快捷键设置中先释放。

## 项目结构

```
src/
├── main/          # 主进程：窗口注册表、全局快捷键、剪贴板监听、
│                  # 应用/文件搜索、托盘、开机启动、SQLite 数据层
├── preload/       # 预加载脚本与类型声明
└── renderer/      # 渲染层：搜索窗、设置页、片段管理、剪贴板面板
```

## License

[MIT](./LICENSE)
