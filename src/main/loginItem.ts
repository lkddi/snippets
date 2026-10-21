import { app, ipcMain } from 'electron'

/** 读取系统登录项状态（开机启动是否已开启） */
export const isLaunchAtLogin = (): boolean => {
  try {
    return app.getLoginItemSettings().openAtLogin
  } catch (error) {
    console.error('读取开机启动状态失败', error)
    return false
  }
}

/** 设置开机启动；openAsHidden 让登录后只驻留托盘、不弹窗口 */
export const setLaunchAtLogin = (enabled: boolean): boolean => {
  try {
    app.setLoginItemSettings({ openAtLogin: enabled, openAsHidden: true })
    // 回读校验，部分环境（未打包 dev）会静默失败
    return app.getLoginItemSettings().openAtLogin === enabled
  } catch (error) {
    console.error('设置开机启动失败', error)
    return false
  }
}

ipcMain.handle('loginItem:get', () => isLaunchAtLogin())

ipcMain.handle('loginItem:set', (_event, enabled: unknown) => setLaunchAtLogin(Boolean(enabled)))
