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

export const Setting = () => {
  const config = useLoaderData() as ConfigDataType
  const actionData = useActionData() as ActionData

  const [shortCut, setShortCut] = useState(config.shortCut)
  const [databaseDirectory, setDatabaseDirectory] = useState(config.databaseDirectory)
  const keysRef = useRef<string[]>([])
  const formRef = useRef<HTMLFormElement>(null)

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
    if (!/^([A-Z]|Space|F\d{1,2}|Arrow(Up|Down|Left|Right)|Enter|Tab|Backspace|Delete|Escape|\d)$/.test(code)) {
      return
    }

    const accelerator = [...keysRef.current, code].map(acceleratorName).join('+')
    keysRef.current = []
    setShortCut(accelerator)
    // 直接提交，由 action 负责注册并把失败原因回显
    requestAnimationFrame(() => formRef.current?.requestSubmit())
  }

  const chooseDirectory = async (): Promise<void> => {
    const path = await window.api.selectDatabaseDirectory()
    if (!path) return
    window.api.setDatabaseDirectory(path)
    setDatabaseDirectory(path)
    requestAnimationFrame(() => formRef.current?.requestSubmit())
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
