import {contextBridge, ipcRenderer, type IpcRendererEvent} from 'electron'
import type {YoinksApi} from './api.js'

function subscribe<T extends unknown[]>(channel: string, listener: (...args: T) => void): () => void {
  const wrapped = (_event: IpcRendererEvent, ...args: unknown[]) => listener(...(args as T))
  ipcRenderer.on(channel, wrapped)
  return () => ipcRenderer.removeListener(channel, wrapped)
}

const api: YoinksApi = {
  init: () => ipcRenderer.invoke('app:init'),
  readClipboard: () => ipcRenderer.invoke('clipboard:read'),
  probe: url => ipcRenderer.invoke('probe', url),
  download: index => ipcRenderer.invoke('download', index),
  cancel: () => ipcRenderer.invoke('cancel'),
  setSettings: patch => ipcRenderer.invoke('settings:set', patch),
  pickFolder: () => ipcRenderer.invoke('folder:pick'),
  showItem: filepath => ipcRenderer.invoke('shell:show-item', filepath),
  openPath: target => ipcRenderer.invoke('shell:open-path', target),
  setPalette: palette => ipcRenderer.invoke('window:palette', palette),
  quit: () => ipcRenderer.invoke('app:quit'),
  onProbeStatus: listener => subscribe('probe:status', listener),
  onProgress: listener => subscribe('download:progress', listener),
  onProcessing: listener => subscribe('download:processing', listener),
  onRefreshing: listener => subscribe('download:refreshing', listener),
  onOpenUrl: listener => subscribe('open-url', listener),
}

contextBridge.exposeInMainWorld('yoinks', api)
