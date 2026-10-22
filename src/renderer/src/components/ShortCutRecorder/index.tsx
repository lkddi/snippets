import classNames from 'classnames'
import { useRef, type KeyboardEvent } from 'react'
import {
  MODIFIER_BY_CODE,
  acceleratorName,
  capLabel,
  hasStrongModifier,
  isValidKey,
  keyCaps,
  normalizeCode
} from '@renderer/utils/accelerator'

type Props = {
  /** 当前快捷键（Electron accelerator），空字符串显示占位文案 */
  value: string
  placeholder?: string
  className?: string
  /** 录到完整组合键时回调；由调用方决定保存还是提示占用 */
  onChange: (accelerator: string) => void
  /** 开始录制（拿到焦点）时回调，用于清掉上一次的错误提示 */
  onRecordStart?: () => void
}

/**
 * 快捷键录制方框：点击后按下组合键即可录入。
 * 至少要一个 Command / Control / Option，避免录出会抢走正常输入的裸字母。
 */
export const ShortCutRecorder = ({
  value,
  placeholder = '点击后按下组合键',
  className,
  onChange,
  onRecordStart
}: Props) => {
  const keysRef = useRef<string[]>([])

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>): void => {
    event.preventDefault()
    event.stopPropagation()

    // 修饰键按方位命名（AltLeft 等），必须先归一成 Alt 再记录
    const modifier = MODIFIER_BY_CODE[event.code]
    if (modifier) {
      if (!keysRef.current.includes(modifier)) {
        keysRef.current = [...keysRef.current, modifier]
      }
      return
    }

    const code = normalizeCode(event.code)
    if (!isValidKey(code)) return
    if (!hasStrongModifier(keysRef.current)) return

    const accelerator = [...keysRef.current, code].map(acceleratorName).join('+')
    keysRef.current = []
    onChange(accelerator)
  }

  return (
    <div
      className={classNames('shortcut-box', className)}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={() => {
        keysRef.current = []
        onRecordStart?.()
      }}
      onBlur={() => {
        keysRef.current = []
      }}
      data-empty={!value}
    >
      {value ? (
        keyCaps(value).map((cap, index) => <kbd key={`${cap}-${index}`}>{capLabel(cap)}</kbd>)
      ) : (
        <span className="shortcut-placeholder">{placeholder}</span>
      )}
    </div>
  )
}

export default ShortCutRecorder
