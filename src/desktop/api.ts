import type {Platform} from '../lib/platforms.js'
import type {DownloadProgress} from '../lib/ytdlp.js'
import type {ThemeMode} from '../theme-mode.js'

export type {DownloadProgress, Platform, ThemeMode}

export type Settings = {outDir: string; themeMode: ThemeMode}

export type AppInit = {
  version: string
  settings: Settings
  history: string[]
  /** a url passed on the command line (`yoinks.exe <url>`) */
  initialUrl?: string
  homedir: string
}

export type ChoiceSummary = {label: string; kind: 'video' | 'audio'}

export type InfoSummary = {title: string; uploader?: string; duration?: number; thumbnail?: string}

type Failure = {ok: false; cancelled?: boolean; error?: string}

export type ProbeResponse = {ok: true; platform: Platform; info: InfoSummary; choices: ChoiceSummary[]} | Failure

export type DownloadResponse = {ok: true; filepath: string; history: string[]} | Failure

export type PaletteColors = {background: string; primary: string}

/** Everything the renderer may ask of the main process — exposed as `window.yoinks`. */
export type YoinksApi = {
  init(): Promise<AppInit>
  readClipboard(): Promise<string>
  probe(url: string): Promise<ProbeResponse>
  download(choiceIndex: number): Promise<DownloadResponse>
  cancel(): Promise<void>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  pickFolder(): Promise<string | undefined>
  showItem(filepath: string): Promise<void>
  openPath(target: string): Promise<string>
  setPalette(palette: PaletteColors): Promise<void>
  quit(): Promise<void>
  /** Subscriptions return an unsubscribe function. */
  onProbeStatus(listener: (status: string) => void): () => void
  onProgress(listener: (progress: DownloadProgress) => void): () => void
  onProcessing(listener: () => void): () => void
  onRefreshing(listener: () => void): () => void
  onOpenUrl(listener: (url: string) => void): () => void
}
