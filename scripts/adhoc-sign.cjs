/**
 * afterPack 钩子：对 macOS 产物做 ad-hoc 签名（无需开发者证书）。
 *
 * electron-builder 在无证书环境下会跳过签名，产物完全无签名。
 * 用户从浏览器下载后会带 quarantine 隔离属性，macOS 13+ 对
 * 「无签名 + 隔离」直接报「已损坏，无法打开」；ad-hoc 签名后
 * 只降级为「无法验证开发者」，右键 → 打开即可。
 */
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return

  const appPath = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`
  )
  console.log(`Ad-hoc signing: ${appPath}`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], {
    stdio: 'inherit'
  })
}
