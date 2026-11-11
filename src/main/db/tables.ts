import { Random } from 'mockjs'
import { db } from './connect'
import { getMainConfig } from './config'

const SCHEMA = `
create table if not exists categories (
  id integer primary key autoincrement not null,
  name text not null,
  created_at text not null
);

create table if not exists contents (
  id integer primary key autoincrement not null,
  title text not null,
  content text not null,
  category_id integer,
  created_at text not null
);

create table if not exists config (
  id integer primary key autoincrement not null,
  content text not null
);

create table if not exists clipboard_items (
  id integer primary key autoincrement not null,
  content text not null,
  created_at text not null,
  /* text / image / file：面板按类型显示图标与预览 */
  kind text not null default 'text',
  /* image / file 的磁盘路径（图片落盘到 userData/clipboard-images） */
  path text,
  /* 类型附加信息：图片为 "1528x806|4851234"，文件为扩展名 */
  meta text
);

create index if not exists idx_contents_category_id on contents (category_id);
create index if not exists idx_contents_title on contents (title);
create index if not exists idx_clipboard_items_created_at on clipboard_items (created_at);
`

/**
 * 老库补列：clipboard_items 早期只有 content/created_at，
 * 直接 create table if not exists 不会改动已有表，必须显式 alter。
 */
function migrateClipboardColumns(database: SqliteDatabase): void {
  const columns = database.prepare('pragma table_info(clipboard_items)').all() as { name: string }[]
  const names = new Set(columns.map((column) => column.name))
  if (!names.has('kind')) {
    database.exec("alter table clipboard_items add column kind text not null default 'text'")
  }
  if (!names.has('path')) database.exec('alter table clipboard_items add column path text')
  if (!names.has('meta')) database.exec('alter table clipboard_items add column meta text')
}

export function initTable(): void {
  const database = db()
  database.exec(SCHEMA)
  migrateClipboardColumns(database)
  initData(database)
}

type SqliteDatabase = ReturnType<typeof db>

function initData(database: SqliteDatabase): void {
  // 用 config 表判断是否初始化过：之前用 contents 判断，用户删空片段后重启会被重新灌入演示数据
  const initialized = database.prepare('select id from config where id = 1').get()
  if (initialized) return

  const isFirstRun = !getMainConfig().initialized

  const insertConfig = database.prepare('insert into config (id, content) values (1, @content)')
  const insertCategory = database.prepare(
    'insert into categories (name, created_at) values (@name, datetime())'
  )
  const insertContent = database.prepare(
    'insert into contents (title, content, category_id, created_at) values (@title, @content, @category_id, datetime())'
  )

  const seed = database.transaction(() => {
    insertConfig.run({
      content: JSON.stringify({
        shortCut: 'Alt+Space',
        databaseDirectory: getMainConfig().databaseDirectory || '',
        // 剪贴板默认用连按两次 Option 唤起
        clipboardShortCut: 'doubleOption',
        // 剪贴板记录默认保存 7 天，0 表示永久
        clipboardRetentionDays: 7
      })
    })

    // 演示数据只在全新安装时灌一次，切换到新的空目录不会再塞入假数据
    if (!isFirstRun) return
    const { total } = database.prepare('select count(*) as total from contents').get() as {
      total: number
    }
    if (total > 0) return

    for (let i = 1; i <= 10; i++) {
      const name = Random.title(5, 10)
      const { lastInsertRowid } = insertCategory.run({ name })
      for (let j = 1; j < 20; j++) {
        insertContent.run({
          title: Random.title(5, 10),
          content: Random.paragraph(5, 10),
          category_id: Number(lastInsertRowid)
        })
      }
    }
  })

  seed()
}
