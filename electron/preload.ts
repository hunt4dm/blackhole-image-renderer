import { contextBridge, ipcRenderer } from 'electron'

const COMMAND_CHANNEL = 'blackhole:command'

contextBridge.exposeInMainWorld('blackholeWindow', {
  onCommand(listener: (command: string) => void) {
    const wrapped = (_event: Electron.IpcRendererEvent, command: string) => listener(command)
    ipcRenderer.on(COMMAND_CHANNEL, wrapped)

    return () => {
      ipcRenderer.off(COMMAND_CHANNEL, wrapped)
    }
  },
})
