import { Alert } from 'antd'
import { useRef, useState, type KeyboardEvent } from 'react'
import { Form, useActionData, useLoaderData } from 'react-router-dom'
import './styles.scss'

type ActionData = { error?: string; ok?: boolean } | undefined

const isMac = (): boolean => {
  const platform = window.electron?.process?.platform
  if (platform) return platform === 'darwin'
  return navigator.userAgent.includes('Mac')
}

/** e.code 与 Electron accelerator 名称的映射，直接拼 e.code 会出现 Meta 这种非法键名 */
const normalizeCode = (code: string): string =>
  code.replace(/^Left|^Right/, '').replace(/^Key/, '').replace(/^Digit/, '')

const acceleratorName = (code: string): string => {
  switch (code) {
    case 'Meta':
      return isMac() ? 'Command' : 'Super'
    case 'Control':
      return 'Control'
    case 'Alt':
      return 'Alt'
    case 'Shift':
      return 'Shift'
    default:
      return code
  }
}

const isModifier = (code: string): boolean =>
  ['Meta', 'Control', 'Alt', 'Shift'].includes(code)

const isValidKey = (code: string): boolean =>
  /^([A-Z]|Space|F\d{1,2}|Arrow(Up|Down|Left|Right)|Enter|Tab|Backspace|Delete|Escape|\d)$/.test(
    code
  )

export const Setting = () => {
  const config = useLoaderData() as ConfigDataType
  const actionData = useActionData() as ActionData

  const [shortCut, setShortCut] = useState(config.shortCut)
  // 剪贴板快捷键：'doubleOption' 为默认的双击 Option 模式
  const [clipShortCut, setClipShortCut] = useState(config.clipboardShortCut || 'doubleOption')
  const [databaseDirectory, setDatabaseDirectory] = useState(config.databaseDirectory)
  const keysRef = useRef<string[]>([])
  const clipKeysRef = useRef<string[]>([])
  const formRef = useRef<HTMLFormElement>(null)

  const submitForm = (): void => {
    // 直接提交，由 action 负责注册并把失败原因回显
    requestAnimationFrame(() => formRef.current?.requestSubmit())
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    e.preventDefault()
    const code = normalizeCode(e.code)
    if (!code) return

    if (isModifier(code)) {
      // 用 ref 保存已按下的修饰键，避免依赖 state 闭包丢键
      if (!keysRef.current.includes(code)) keysRef.current = [...keysRef.current, code]
      return
    }

    if (!keysRef.current.length) return
    if (!isValidKey(code)) return

    const accelerator = [...keysRef.current, code].map(acceleratorName).join('+')
    keysRef.current = []
    setShortCut(accelerator)
    submitForm()
  }

  // 剪贴板快捷键的按键采集逻辑与搜索快捷键一致，只是写入不同的 state / 隐藏域
  const handleClipKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    e.preventDefault()
    const code = normalizeCode(e.code)
    if (!code) return

    if (isModifier(code)) {
      if (!clipKeysRef.current.includes(code)) clipKeysRef.current = [...clipKeysRef.current, code]
      return
    }

    if (!clipKeysRef.current.length) return
    if (!isValidKey(code)) return

    const accelerator = [...clipKeysRef.current, code].map(acceleratorName).join('+')
    clipKeysRef.current = []
    setClipShortCut(accelerator)
    submitForm()
  }

  // 恢复默认的"连按两次 Option"模式（不占用全局快捷键）
  const resetClipShortCut = (): void => {
    clipKeysRef.current = []
    setClipShortCut('doubleOption')
    submitForm()
  }

  const chooseDirectory = async (): Promise<void> => {
    const path = await window.api.selectDatabaseDirectory()
    if (!path) return
    window.api.setDatabaseDirectory(path)
    setDatabaseDirectory(path)
    submitForm()
  }

  return (
    <Form method="POST" ref={formRef}>
      <main className="setting-page">
        <h1>软件配置</h1>
        {actionData?.error && (
          <Alert type="error" showIcon message={actionData.error} className="mb-3" />
        )}
        <section>
          <h5>快捷键定义</h5>
          <input
            type="text"
            value={shortCut}
            placeholder="点击后按下快捷键"
            readOnly
            onKeyDown={handleKeyDown}
          />
          <input type="hidden" name="shortCut" value={shortCut} readOnly />
        </section>
        <section>
          <h5>剪贴板快捷键</h5>
          <input
            type="text"
            value={clipShortCut === 'doubleOption' ? '连按两次 Option' : clipShortCut}
            placeholder="点击后按下快捷键"
            readOnly
            onKeyDown={handleClipKeyDown}
          />
          <input type="hidden" name="clipboardShortCut" value={clipShortCut} readOnly />
          <p className="clip-hint">
            默认连按两次 Option 唤起剪贴板；在此输入框按下组合键可改为标准快捷键。
            <span className="clip-reset" onClick={resetClipShortCut}>
              恢复默认
            </span>
          </p>
        </section>
        <section>
          <h5>数据库</h5>
          <input
            type="text"
            value={databaseDirectory}
            placeholder="默认存于桌面"
            readOnly
            onClick={() => void chooseDirectory()}
          />
          <input type="hidden" name="databaseDirectory" value={databaseDirectory} readOnly />
        </section>
      </main>
    </Form>
  )
}
