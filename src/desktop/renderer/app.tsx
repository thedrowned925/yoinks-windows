import React, {useCallback, useEffect, useRef, useState} from 'react'
import {formatBytes, formatDuration, formatEta, formatSpeed, shortenPath, truncate} from '../../lib/format.js'
import {detectPlatform, isProbablyUrl} from '../../lib/platforms.js'
import {nextThemeMode, type ThemeMode} from '../../theme-mode.js'
import type {AppInit, ChoiceSummary, DownloadProgress, InfoSummary, Platform, YoinksApi} from '../api.js'
import {Logo} from './logo.js'

declare global {
  interface Window {
    yoinks: YoinksApi
  }
}

const api = window.yoinks

const TAGLINE = 'yoink any video. paste. yoink. done.'
const SITES = 'youtube · x · instagram · threads · tiktok · +1800 more'
const BAR_CELLS = 36

// matches the terminal palettes in src/theme.ts
const PALETTES = {
  light: {background: '#ffffff', primary: '#18181b'},
  dark: {background: '#18181b', primary: '#ffffff'},
}

type Phase =
  | {name: 'input'; warning?: string}
  | {name: 'probing'; status: string}
  | {name: 'picking'}
  | {name: 'downloading'; choice: ChoiceSummary; progress?: DownloadProgress; processing: boolean; refreshing?: boolean}
  | {name: 'done'; filepath: string}
  | {name: 'error'; message: string}

type Hint = {key: string; label: string; action?: () => void}

const choiceLabel = (choice: ChoiceSummary) => `${choice.kind === 'audio' ? '♪' : '▶'} ${choice.label}`

/** A url worth offering from the clipboard: one line, http(s). */
const offerable = (text: string) => Boolean(text) && !/\s/.test(text) && isProbablyUrl(text)

function useSystemDark(): boolean {
  const [dark, setDark] = useState(() => matchMedia('(prefers-color-scheme: dark)').matches)
  useEffect(() => {
    const query = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setDark(query.matches)
    query.addEventListener('change', update)
    return () => query.removeEventListener('change', update)
  }, [])
  return dark
}

const SPINNER = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

function Spinner() {
  const [frame, setFrame] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setFrame(f => (f + 1) % SPINNER.length), 80)
    return () => clearInterval(id)
  }, [])
  return <span className="primary">{SPINNER[frame]}</span>
}

function ProgressBar({percent}: {percent: number}) {
  const clamped = Math.max(0, Math.min(1, percent))
  const filled = Math.round(clamped * BAR_CELLS)
  return (
    <div className="bar" role="progressbar" aria-valuenow={Math.round(clamped * 100)} aria-valuemin={0} aria-valuemax={100}>
      <span className="primary">{'█'.repeat(filled)}</span>
      <span className="muted">{'░'.repeat(BAR_CELLS - filled)}</span>
      <span className="primary"> {`${Math.round(clamped * 100)}%`.padStart(4, ' ')}</span>
    </div>
  )
}

function partLabel(progress: DownloadProgress): string {
  return progress.totalParts > 1 ? `part ${progress.part + 1}/${progress.totalParts}  ·  ` : ''
}

function downloadMeta(progress: DownloadProgress): string {
  const parts = [
    progress.totalBytes ? `${formatBytes(progress.downloadedBytes)} / ${formatBytes(progress.totalBytes)}` : '',
    progress.speed ? formatSpeed(progress.speed) : '',
    progress.eta ? `${formatEta(progress.eta)} left` : '',
  ].filter(Boolean)
  return `${partLabel(progress)}${parts.join('  ·  ')}`
}

function Hints({items, leading}: {items: Hint[]; leading?: React.ReactNode}) {
  return (
    <div className="hints">
      {leading ? <span className="hint-leading">{leading}</span> : null}
      {items.map(item =>
        item.action ? (
          <button key={item.key} type="button" className="hint" onClick={item.action}>
            <span className="primary">{item.key}</span> <span className="muted">{item.label}</span>
          </button>
        ) : (
          <span key={item.key} className="hint">
            <span className="primary">{item.key}</span> <span className="muted">{item.label}</span>
          </span>
        ),
      )}
    </div>
  )
}

export function App() {
  const [init, setInit] = useState<AppInit>()
  const [themeMode, setThemeMode] = useState<ThemeMode>('auto')
  const [outDir, setOutDir] = useState('')
  const systemDark = useSystemDark()
  const resolved = themeMode === 'auto' ? (systemDark ? 'dark' : 'light') : themeMode

  const [phase, setPhase] = useState<Phase>({name: 'input'})
  const [url, setUrl] = useState('')
  const [urlInput, setUrlInput] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const [historyPos, setHistoryPos] = useState<number | null>(null)
  const draftRef = useRef('')
  const [clipboardUrl, setClipboardUrl] = useState<string>()
  const [platform, setPlatform] = useState<Platform>()
  const [info, setInfo] = useState<InfoSummary>()
  const [choices, setChoices] = useState<ChoiceSummary[]>([])
  const [highlight, setHighlight] = useState(0)
  const [thumbFailed, setThumbFailed] = useState(false)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // bumps on every probe/cancel — a late answer from an abandoned run is ignored
  const runRef = useRef(0)

  useEffect(() => {
    document.documentElement.dataset.theme = resolved
    void api.setPalette(PALETTES[resolved])
  }, [resolved])

  const refreshClipboard = useCallback(async () => {
    const text = await api.readClipboard()
    setClipboardUrl(offerable(text) ? text : undefined)
  }, [])

  const startProbe = useCallback(async (target: string) => {
    const run = ++runRef.current
    setUrl(target)
    setPlatform(detectPlatform(target))
    setThumbFailed(false)
    setPhase({name: 'probing', status: 'warming up…'})
    const result = await api.probe(target)
    if (run !== runRef.current) return
    if (result.ok) {
      setInfo(result.info)
      setChoices(result.choices)
      setPlatform(result.platform)
      setHighlight(0)
      setPhase({name: 'picking'})
    } else if (!result.cancelled) {
      setPhase({name: 'error', message: result.error ?? 'Something went wrong.'})
    }
  }, [])

  const submitUrl = useCallback(
    (value: string) => {
      const trimmed = value.trim()
      if (!isProbablyUrl(trimmed)) {
        setPhase({name: 'input', warning: 'that doesn’t look like a link — paste a full url'})
        return
      }
      void startProbe(trimmed)
    },
    [startProbe],
  )

  const resetToInput = useCallback(() => {
    runRef.current++
    setUrl('')
    setUrlInput('')
    setHistoryPos(null)
    setPlatform(undefined)
    setInfo(undefined)
    setChoices([])
    setPhase({name: 'input'})
    void refreshClipboard()
  }, [refreshClipboard])

  const cancelRun = useCallback(() => {
    void api.cancel()
    resetToInput()
    setUrlInput(url) // keep the link around so a cancel isn't destructive
  }, [resetToInput, url])

  const pick = useCallback(
    async (index: number) => {
      const choice = choices[index]
      if (!choice) return
      const run = ++runRef.current
      setPhase({name: 'downloading', choice, processing: false})
      const result = await api.download(index)
      if (run !== runRef.current) return
      if (result.ok) {
        setHistory(result.history)
        setPhase({name: 'done', filepath: result.filepath})
      } else if (!result.cancelled) {
        setPhase({name: 'error', message: result.error ?? 'Download failed.'})
      }
    },
    [choices],
  )

  const cycleTheme = useCallback(() => {
    setThemeMode(mode => {
      const next = nextThemeMode(mode)
      void api.setSettings({themeMode: next})
      return next
    })
  }, [])

  const changeFolder = useCallback(async () => {
    const picked = await api.pickFolder()
    if (!picked) return
    const next = await api.setSettings({outDir: picked})
    setOutDir(next.outDir)
  }, [])

  // boot: settings, history, and a url from the command line
  useEffect(() => {
    void api.init().then(data => {
      setInit(data)
      setThemeMode(data.settings.themeMode)
      setOutDir(data.settings.outDir)
      setHistory(data.history)
      if (data.initialUrl) void startProbe(data.initialUrl)
      else void refreshClipboard()
    })
  }, [startProbe, refreshClipboard])

  useEffect(() => {
    const unsubscribers = [
      api.onProbeStatus(status => setPhase(prev => (prev.name === 'probing' ? {...prev, status} : prev))),
      api.onProgress(progress =>
        setPhase(prev => (prev.name === 'downloading' ? {...prev, progress, processing: false} : prev)),
      ),
      api.onProcessing(() => setPhase(prev => (prev.name === 'downloading' ? {...prev, processing: true} : prev))),
      api.onRefreshing(() =>
        setPhase(prev => (prev.name === 'downloading' ? {...prev, progress: undefined, refreshing: true} : prev)),
      ),
    ]
    return () => unsubscribers.forEach(unsubscribe => unsubscribe())
  }, [])

  // `yoinks.exe <url>` while the window is already open
  useEffect(
    () =>
      api.onOpenUrl(target => {
        if (phase.name === 'probing' || phase.name === 'downloading') void api.cancel()
        void startProbe(target)
      }),
    [phase.name, startProbe],
  )

  // offer whatever was copied while the window was in the background
  useEffect(() => {
    const onFocus = () => {
      if (phase.name === 'input') void refreshClipboard()
      if (phase.name === 'input') inputRef.current?.focus()
    }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [phase.name, refreshClipboard])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey && event.key.toLowerCase() === 't') {
        event.preventDefault()
        cycleTheme()
        return
      }
      if (event.key === 'Escape') {
        if (phase.name === 'probing' || phase.name === 'downloading') cancelRun()
        else if (phase.name !== 'input') resetToInput()
        return
      }
      // a focused button handles its own Enter — acting here too would fire twice
      const onControl = event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement
      if (phase.name === 'picking') {
        const last = choices.length - 1
        if (event.key === 'ArrowDown' || event.key === 'j') {
          event.preventDefault()
          setHighlight(h => (h >= last ? 0 : h + 1))
        } else if (event.key === 'ArrowUp' || event.key === 'k') {
          event.preventDefault()
          setHighlight(h => (h <= 0 ? last : h - 1))
        } else if (event.key === 'Home') {
          setHighlight(0)
        } else if (event.key === 'End') {
          setHighlight(last)
        } else if (/^[1-9]$/.test(event.key) && Number(event.key) <= choices.length) {
          void pick(Number(event.key) - 1)
        } else if (event.key === 'Enter' && !onControl) {
          event.preventDefault()
          void pick(highlight)
        }
        return
      }
      if (event.key === 'Enter' && !onControl && (phase.name === 'error' || phase.name === 'done')) {
        event.preventDefault()
        resetToInput()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [phase.name, choices.length, highlight, cycleTheme, cancelRun, resetToInput, pick])

  // dropping a link anywhere on the window yoinks it
  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    if (phase.name === 'input') setDragging(true)
  }
  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragging(false)
    if (phase.name !== 'input') return
    const text = (event.dataTransfer.getData('text/uri-list') || event.dataTransfer.getData('text/plain'))
      .split(/\r?\n/)
      .find(line => line && !line.startsWith('#'))
      ?.trim()
    if (text && isProbablyUrl(text)) {
      setUrlInput(text)
      submitUrl(text)
    } else {
      setPhase({name: 'input', warning: 'drop a link — files and text don’t work here'})
    }
  }

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Tab' && clipboardOffered) {
      event.preventDefault()
      setUrlInput(clipboardUrl!)
      return
    }
    if ((event.key === 'ArrowUp' || event.key === 'ArrowDown') && history.length > 0) {
      event.preventDefault()
      if (event.key === 'ArrowUp') {
        if (historyPos === null) draftRef.current = urlInput
        const next = historyPos === null ? 0 : Math.min(historyPos + 1, history.length - 1)
        setHistoryPos(next)
        setUrlInput(history[next]!)
      } else if (historyPos !== null) {
        const next = historyPos - 1
        setHistoryPos(next < 0 ? null : next)
        setUrlInput(next < 0 ? draftRef.current : history[next]!)
      }
    }
  }

  const onPaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData('text').trim()
    // pasting a link into an empty box is the whole point — go straight to it
    if (urlInput === '' && isProbablyUrl(pasted)) {
      event.preventDefault()
      setUrlInput(pasted)
      submitUrl(pasted)
    }
  }

  const clipboardOffered = Boolean(clipboardUrl) && urlInput === ''
  const clipboardAccepted = Boolean(clipboardUrl) && urlInput === clipboardUrl
  const homedir = init?.homedir ?? ''

  const goHome = () => {
    if (phase.name === 'probing' || phase.name === 'downloading') cancelRun()
    else if (phase.name !== 'input') resetToInput()
  }

  const hints: Hint[] = []
  switch (phase.name) {
    case 'input':
      hints.push({key: '↵', label: 'yoink', action: () => submitUrl(urlInput)})
      if (history.length > 0) hints.push({key: '↑', label: 'history'})
      break
    case 'probing':
    case 'downloading':
      hints.push({key: 'esc', label: 'cancel', action: cancelRun})
      break
    case 'picking':
      hints.push({key: '↑↓', label: 'choose'}, {key: '↵', label: 'yoink', action: () => void pick(highlight)})
      hints.push({key: 'esc', label: 'back', action: resetToInput})
      break
    case 'done':
    case 'error':
      hints.push({key: 'esc', label: 'start over', action: resetToInput})
      break
  }
  hints.push({key: '^t', label: `theme:${themeMode}`, action: cycleTheme})

  return (
    <div
      className={`app${dragging ? ' dragging' : ''}`}
      onDragOver={onDragOver}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <header className="titlebar">
        <span className="muted">yoinks</span>
      </header>

      <main className="stage">
        <Logo onClick={goHome} title={phase.name === 'input' ? 'yoinks' : 'back to start'} />
        <p className="tagline primary">{TAGLINE}</p>
        <p className="muted">{SITES}</p>

        <section className="phase">
          {phase.name === 'input' && (
            <div className="column">
              <form
                className="framed"
                onSubmit={event => {
                  event.preventDefault()
                  submitUrl(urlInput)
                }}
              >
                <fieldset>
                  <legend className="primary">Paste a link</legend>
                  <span className="prompt primary">❯</span>
                  <input
                    ref={inputRef}
                    autoFocus
                    spellCheck={false}
                    value={urlInput}
                    placeholder="https://youtube.com/watch?v=…"
                    onChange={event => {
                      setUrlInput(event.target.value)
                      setHistoryPos(null)
                    }}
                    onKeyDown={onInputKeyDown}
                    onPaste={onPaste}
                    aria-label="Video link"
                  />
                </fieldset>
                <button type="submit" className="yoink">
                  yoink
                </button>
              </form>
              <p className="note muted">
                {phase.warning ? (
                  <>✗ {phase.warning}</>
                ) : dragging ? (
                  <>drop it — we’ll yoink it</>
                ) : clipboardOffered ? (
                  <button type="button" className="link" onClick={() => setUrlInput(clipboardUrl!)}>
                    link in your clipboard — ⇥ to paste it
                  </button>
                ) : clipboardAccepted ? (
                  <>from your clipboard — ↵ to yoink it</>
                ) : (
                  <>or drag a link onto this window</>
                )}
              </p>
            </div>
          )}

          {phase.name === 'probing' && (
            <div className="column">
              <div className="framed busy">
                <fieldset>
                  <legend className="primary">{platform ? platform.label : 'Paste a link'}</legend>
                  <span className="prompt primary">❯</span>
                  <span className="url muted">{url}</span>
                </fieldset>
                <button type="button" className="yoink" disabled>
                  yoink
                </button>
              </div>
              <p className="note muted">
                <Spinner /> {phase.status}
              </p>
            </div>
          )}

          {phase.name === 'picking' && (
            <div className="picker">
              <div className="details">
                {info?.thumbnail && !thumbFailed ? (
                  <img className="thumb" src={info.thumbnail} alt="" onError={() => setThumbFailed(true)} />
                ) : null}
                <h1 className="title primary">{info?.title}</h1>
                <p className="muted">
                  ▸ {platform?.label}
                  {info?.duration ? ` · ${formatDuration(info.duration)}` : ''}
                  {info?.uploader ? ` · ${info.uploader}` : ''}
                </p>
              </div>
              <fieldset className="panel">
                <legend className="primary">Download</legend>
                <ul role="listbox" aria-label="Formats">
                  {choices.map((choice, index) => (
                    <li key={choice.label} role="option" aria-selected={index === highlight}>
                      <button
                        type="button"
                        className={`choice${index === highlight ? ' active' : ''}`}
                        // mousemove, not mouseenter: a list appearing under a resting cursor must not steal the highlight
                        onMouseMove={() => index !== highlight && setHighlight(index)}
                        onClick={() => void pick(index)}
                      >
                        <span className="cursor">{index === highlight ? '❯' : ' '}</span>
                        {choiceLabel(choice)}
                      </button>
                    </li>
                  ))}
                </ul>
              </fieldset>
            </div>
          )}

          {phase.name === 'downloading' && (
            <div className="column">
              <p className="muted">
                {info?.title ? `${truncate(info.title, 48)} · ` : ''}
                {phase.choice.label}
              </p>
              {phase.processing ? (
                <>
                  <ProgressBar percent={1} />
                  <p className="muted">
                    <Spinner /> processing…
                  </p>
                </>
              ) : phase.progress?.totalBytes ? (
                <>
                  <ProgressBar percent={phase.progress.downloadedBytes / phase.progress.totalBytes} />
                  <p className="muted">{downloadMeta(phase.progress)}</p>
                </>
              ) : phase.progress ? (
                <>
                  <ProgressBar percent={0} />
                  <p className="muted">
                    <Spinner /> downloading… {partLabel(phase.progress)}
                    {formatBytes(phase.progress.downloadedBytes)}
                    {phase.progress.speed ? `  ·  ${formatSpeed(phase.progress.speed)}` : ''}
                  </p>
                </>
              ) : (
                <>
                  <ProgressBar percent={0} />
                  <p className="muted">
                    <Spinner /> {phase.refreshing ? 'link expired — grabbing a fresh one…' : 'starting download…'}
                  </p>
                </>
              )}
            </div>
          )}

          {phase.name === 'done' && (
            <div className="column">
              <p>
                <strong className="primary">✓ yoinked!</strong> <span className="primary">find your file in:</span>
              </p>
              <p className="muted path" title={phase.filepath}>
                {shortenPath(phase.filepath, homedir, 72)}
              </p>
              <div className="actions">
                <button type="button" className="outline" onClick={() => void api.openPath(phase.filepath)}>
                  ▶ open
                </button>
                <button type="button" className="outline" onClick={() => void api.showItem(phase.filepath)}>
                  ⌂ show in folder
                </button>
                <button type="button" className="solid" onClick={resetToInput} autoFocus>
                  ↵ yoink another
                </button>
              </div>
            </div>
          )}

          {phase.name === 'error' && (
            <div className="column">
              <p className="error primary">✗ {phase.message}</p>
              <div className="actions">
                <button type="button" className="solid" onClick={resetToInput} autoFocus>
                  ↵ try again
                </button>
              </div>
            </div>
          )}
        </section>

        <Hints items={hints} />
      </main>

      <footer className="statusbar">
        <button type="button" className="hint" onClick={() => void changeFolder()} title="Change download folder">
          <span className="muted">saving to</span> <span className="primary">{shortenPath(outDir, homedir, 48)}</span>{' '}
          <span className="muted">· change</span>
        </button>
        <button type="button" className="hint" onClick={() => void api.openPath(outDir)} title="Open download folder">
          <span className="muted">open folder</span>
        </button>
        <span className="spacer" />
        <span className="muted">v{init?.version}</span>
      </footer>
    </div>
  )
}
