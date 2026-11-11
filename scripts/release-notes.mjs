#!/usr/bin/env node
/**
 * 根据「上一个 tag → 当前 tag」之间的提交信息生成 Release 说明。
 *
 * GitHub 自带的 generate_release_notes 只认 PR 和它自己拼的提交列表，
 * 本项目是直接往 main 推提交，自动生成出来几乎是空的，所以自己按
 * Conventional Commits 的类型前缀分组，输出人话版更新说明。
 *
 * 用法：node scripts/release-notes.mjs <tag> [输出文件]
 */
import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const tag = process.argv[2] || 'HEAD'
const outFile = process.argv[3] || ''

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

// 上一个 tag：相对 <tag>^ 找最近的一个；仓库只有一个 tag 时退回全部历史
let prev = ''
try {
  prev = git('describe', '--tags', '--abbrev=0', `${tag}^`)
} catch {
  prev = ''
}

const range = prev ? `${prev}..${tag}` : tag
const subjects = git('log', '--no-merges', '--pretty=format:%s', range)
  .split('\n')
  .map((line) => line.trim())
  .filter(Boolean)

/** 分组顺序即输出顺序 */
const SECTIONS = [
  { title: '新功能', types: ['feat'] },
  { title: '修复', types: ['fix', 'hotfix'] },
  { title: '改进', types: ['perf', 'refactor', 'style'] },
  { title: '其他', types: ['ci', 'build', 'docs', 'test', 'chore', 'revert'] }
]

/** `fix(apps): 说明` → { type:'fix', scope:'apps', desc:'说明' } */
const parse = (subject) => {
  const matched = /^(\w+)(?:\(([^)]+)\))?!?:\s*(.+)$/.exec(subject)
  if (!matched) return { type: '', scope: '', desc: subject }
  return { type: matched[1].toLowerCase(), scope: matched[2] || '', desc: matched[3] }
}

const buckets = new Map(SECTIONS.map((section) => [section.title, []]))
const others = buckets.get('其他')

for (const subject of subjects) {
  const { type, scope, desc } = parse(subject)
  // 版本号提升这类提交对用户没意义，直接略过
  if (/^chore\(release\)/i.test(subject) || /^\d+\.\d+\.\d+$/.test(desc)) continue

  const section = SECTIONS.find((item) => item.types.includes(type))
  const line = scope ? `- **${scope}**：${desc}` : `- ${desc}`
  ;(section ? buckets.get(section.title) : others).push(line)
}

const lines = []
for (const section of SECTIONS) {
  const items = buckets.get(section.title)
  if (!items.length) continue
  lines.push(`### ${section.title}`, '', ...items, '')
}

if (!lines.length) lines.push('本次发布没有面向用户的改动。', '')

// 固定的安装说明：应用是 ad-hoc 签名（无付费开发者证书），
// macOS 首次打开必经 Gatekeeper 提示，写清楚两种放行方式
lines.push(
  '### 安装说明',
  '',
  '**macOS**：首次打开提示「Apple 无法验证灵犀」属正常现象（应用无付费开发者签名）。两种放行方式任选：',
  '',
  '- **方式一**：打开「系统设置 → 隐私与安全性」，拉到底部点「仍要打开」',
  '- **方式二**：终端执行 `xattr -dr com.apple.quarantine /Applications/灵犀.app` 后直接打开',
  '',
  '**Windows**：SmartScreen 拦截时点「更多信息 → 仍要运行」。',
  ''
)

const repo = process.env.GITHUB_REPOSITORY || 'lkddi/snippets'
if (prev) {
  lines.push(
    `**完整对比**：[${prev}...${tag}](https://github.com/${repo}/compare/${prev}...${tag})`
  )
} else {
  lines.push(`**完整对比**：[${tag}](https://github.com/${repo}/releases/tag/${tag})`)
}

const body = lines.join('\n')
if (outFile) {
  writeFileSync(outFile, body + '\n', 'utf8')
  console.log(`写入 ${outFile}`)
} else {
  console.log(body)
}
