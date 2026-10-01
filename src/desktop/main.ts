import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {app, BrowserWindow, clipboard, dialog, ipcMain, nativeTheme, shell} from 'electron'
import {addToHistory, loadHistory} from '../lib/history.js'
import {detectPlatform, isProbablyUrl} from '../lib/platforms.js'
import {
  buildChoices,
  download,
  ensureYtDlp,
  findFfmpeg,
  probe,
  selfUpdateYtDlp,
  type DownloadChoice,
  type DownloadProgress,
} from '../lib/ytdlp.js'
import {isThemeMode} from '../theme-mode.js'
import type {AppInit, PaletteColors, ProbeResponse, Settings} from './api.js'

const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json')
const MANAGED_YTDLP_DIR = path.join(os.homedir(), '.yoinks', 'bin')
const UPDATE_STAMP = path.join(MANAGED_YTDLP_DIR, '.last-update')
const UPDATE_EVERY_MS = 24 * 60 * 60 * 1000
const TITLEBAR_HEIGHT = 36

// ffmpeg.exe ships next to app.asar (see "extraResources" in package.json)
const BUNDLED_FFMPEG = app.isPackaged
  ? path.join(process.resourcesPath, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg')
  : undefined

function loadSettings(): Settings {
  const defaults: Settings = {outDir: app.getPath('downloads'), themeMode: 'auto'}
  try {
    const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8')) as Partial<Settings>
    return {
      outDir: typeof parsed.outDir === 'string' && parsed.outDir ? parsed.outDir : defaults.outDir,
      themeMode: isThemeMode(parsed.themeMode) ? parsed.themeMode : defaults.themeMode,
    }
  } catch {
    return defaults
  }
}

function saveSettings(next: Settings): void {
  try {
    fs.mkdirSync(path.dirname(SETTINGS_FILE), {recursive: true})
    fs.writeFileSync(SETTINGS_FILE, `${JSON.stringify(next, null, 2)}\n`)
  } catch {
    // settings are a nicety — never let them break the app
  }
}

const urlFromArgv = (argv: string[]) => argv.slice(1).find(arg => isProbablyUrl(arg))

let settings = loadSettings()
let win: BrowserWindow | undefined
let pendingUrl = urlFromArgv(process.argv)

// one session at a time — the ui has a single probe/download slot
let ytdlp = ''
let session: {url: string; choices: DownloadChoice[]; infoJsonPath: string} | undefined
let abort: AbortController | undefined

// The window can be torn down while a download is still running (the user
// closes it, or the app is quitting). Touching a destroyed BrowserWindow (or
// its webContents) throws "Object has been destroyed", and during the native
// teardown `isDestroyed()` can still report false for a brief moment — so
// every native touch is guarded *and* wrapped in try/catch.
const send = (channel: string, ...args: unknown[]) => {
  if (!win || win.isDestroyed()) return
  try {
    win.webContents.send(channel, ...args)
  } catch {
    // the renderer is gone — nothing to deliver
  }
}
const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error))

function setProgress(value: number, mode?: 'error'): void {
  if (!win || win.isDestroyed()) return
  try {
    if (mode) win.setProgressBar(value, {mode})
    else win.setProgressBar(value)
  } catch {
    // taskbar progress is cosmetic — never let a closing window crash the app
  }
}

function flashFrame(): void {
  if (!win || win.isDestroyed()) return
  try {
    win.flashFrame(true)
  } catch {
    // window already gone
  }
}

function cancelActive(): void {
  abort?.abort()
  abort = undefined
  setProgress(-1)
}

/**
 * yt-dlp extractors go stale fast. When yoinks manages its own copy, run
 * `yt-dlp -U` at most once a day in the background so the next probe uses
 * a fresh binary. A system-wide install is the user's business.
 */
async function maybeUpdateYtDlp(binary: string): Promise<void> {
  if (!binary.startsWith(MANAGED_YTDLP_DIR)) return
  try {
    const last = Number(fs.readFileSync(UPDATE_STAMP, 'utf8'))
    if (Date.now() - last < UPDATE_EVERY_MS) return
  } catch {
    // no stamp yet
  }
  fs.writeFileSync(UPDATE_STAMP, String(Date.now()))
  await selfUpdateYtDlp(binary)
}

ipcMain.handle('app:init', (): AppInit => {
  const initialUrl = pendingUrl
  pendingUrl = undefined
  return {
    version: app.getVersion(),
    settings,
    history: loadHistory(),
    initialUrl,
    homedir: os.homedir(),
  }
})

ipcMain.handle('clipboard:read', async () => (await clipboard.readText()).trim())

ipcMain.handle('probe', async (_event, url: string): Promise<ProbeResponse> => {
  cancelActive()
  const controller = new AbortController()
  abort = controller
  try {
    if (!ytdlp) {
      ytdlp = await ensureYtDlp(status => send('probe:status', status), controller.signal)
      void maybeUpdateYtDlp(ytdlp)
    }
    if (controller.signal.aborted) return {ok: false, cancelled: true}
    send('probe:status', 'fetching video info…')
    const {info, infoJsonPath} = await probe(ytdlp, url, controller.signal)
    if (controller.signal.aborted) return {ok: false, cancelled: true}
    const choices = buildChoices(info)
    session = {url, choices, infoJsonPath}
    return {
      ok: true,
      platform: detectPlatform(url),
      info: {title: info.title, uploader: info.uploader, duration: info.duration, thumbnail: info.thumbnail},
      choices: choices.map(({label, kind}) => ({label, kind})),
    }
  } catch (error) {
    if (controller.signal.aborted) return {ok: false, cancelled: true}
    return {ok: false, error: errorMessage(error)}
  } finally {
    if (abort === controller) abort = undefined
  }
})

ipcMain.handle('download', async (_event, index: number) => {
  const current = session
  const choice = current?.choices[index]
  if (!current || !choice) return {ok: false, error: 'Nothing to download — paste a link first.'}
  cancelActive()
  const controller = new AbortController()
  abort = controller

  const handlers = {
    onProgress: (progress: DownloadProgress) => {
      send('download:progress', progress)
      if (progress.totalBytes) {
        // one bar across every part, so the taskbar never jumps back to zero
        const within = Math.min(1, progress.downloadedBytes / progress.totalBytes)
        setProgress((progress.part + within) / Math.max(progress.totalParts, progress.part + 1))
      } else {
        setProgress(2) // >1 is indeterminate on Windows
      }
    },
    onProcessing: () => {
      send('download:processing')
      setProgress(2)
    },
  }

  try {
    fs.mkdirSync(settings.outDir, {recursive: true})
    const ffmpegLocation = await findFfmpeg(BUNDLED_FFMPEG)
    const base = {ytdlp, ffmpegLocation, url: current.url, choice, outDir: settings.outDir}
    let filepath: string
    try {
      // reuse the probe's metadata — starts immediately instead of re-extracting
      filepath = await download({...base, infoJsonPath: current.infoJsonPath}, handlers, controller.signal)
    } catch (error) {
      if (controller.signal.aborted) throw error
      // media urls in the cached info can expire — retry with a fresh extraction
      send('download:refreshing')
      filepath = await download(base, handlers, controller.signal)
    }
    const history = addToHistory(current.url)
    setProgress(-1)
    if (win && !win.isFocused()) flashFrame()
    return {ok: true, filepath, history}
  } catch (error) {
    if (controller.signal.aborted) return {ok: false, cancelled: true}
    setProgress(1, 'error')
    return {ok: false, error: errorMessage(error)}
  } finally {
    if (abort === controller) abort = undefined
  }
})

ipcMain.handle('cancel', () => cancelActive())

ipcMain.handle('settings:set', (_event, patch: Partial<Settings>) => {
  settings = {
    outDir: typeof patch.outDir === 'string' && patch.outDir ? patch.outDir : settings.outDir,
    themeMode: isThemeMode(patch.themeMode) ? patch.themeMode : settings.themeMode,
  }
  saveSettings(settings)
  return settings
})

ipcMain.handle('folder:pick', async () => {
  if (!win || win.isDestroyed()) return undefined
  const result = await dialog.showOpenDialog(win, {
    title: 'Save downloads to…',
    defaultPath: settings.outDir,
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.canceled ? undefined : result.filePaths[0]
})

ipcMain.handle('shell:show-item', (_event, filepath: string) => shell.showItemInFolder(filepath))
ipcMain.handle('shell:open-path', (_event, target: string) => shell.openPath(target))

ipcMain.handle('window:palette', (_event, palette: PaletteColors) => {
  if (!win || win.isDestroyed()) return
  try {
    win.setBackgroundColor(palette.background)
    if (process.platform === 'win32') {
      win.setTitleBarOverlay({color: palette.background, symbolColor: palette.primary, height: TITLEBAR_HEIGHT})
    }
  } catch {
    // window torn down mid-theme-change
  }
})

ipcMain.handle('app:quit', () => app.quit())

function createWindow(): void {
  const dark = settings.themeMode === 'dark' || (settings.themeMode === 'auto' && nativeTheme.shouldUseDarkColors)
  const background = dark ? '#18181b' : '#ffffff'
  win = new BrowserWindow({
    width: 960,
    height: 680,
    minWidth: 640,
    minHeight: 540,
    show: false,
    title: 'yoinks',
    backgroundColor: background,
    icon: path.join(__dirname, 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: {color: background, symbolColor: dark ? '#ffffff' : '#18181b', height: TITLEBAR_HEIGHT},
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      spellcheck: false,
    },
  })

  // the ui never navigates — a dropped link or a stray <a> must not replace it
  win.webContents.on('will-navigate', event => event.preventDefault())
  win.webContents.setWindowOpenHandler(({url}) => {
    if (isProbablyUrl(url)) void shell.openExternal(url)
    return {action: 'deny'}
  })
  win.on('focus', () => win?.flashFrame(false))
  win.once('ready-to-show', () => win?.show())
  win.on('closed', () => {
    // drop the reference FIRST: cancelActive() touches the (now destroyed)
    // window for its taskbar progress, and win.isDestroyed() is only true
    // once Electron has finished tearing the native object down
    win = undefined
    cancelActive()
  })

  void win.loadFile(path.join(__dirname, 'index.html'))

  // dev aid: YOINKS_CAPTURE=shot.png renders the window, saves a screenshot and quits
  const capture = process.env.YOINKS_CAPTURE
  if (capture) {
    const delay = Number(process.env.YOINKS_CAPTURE_DELAY ?? 2500)
    win.webContents.once('did-finish-load', () => {
      setTimeout(async () => {
        const image = await win!.webContents.capturePage()
        fs.writeFileSync(capture, image.toPNG())
        app.quit()
      }, delay)
    })
  }
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  // `yoinks.exe <url>` while already open: hand the link to the running window
  app.on('second-instance', (_event, argv) => {
    if (!win || win.isDestroyed()) return
    if (win.isMinimized()) win.restore()
    win.focus()
    const url = urlFromArgv(argv)
    if (url) send('open-url', url)
  })

  app.setAppUserModelId('com.yoinks.desktop')
  void app.whenReady().then(createWindow)
  app.on('window-all-closed', () => app.quit())
  app.on('before-quit', () => cancelActive())
}
