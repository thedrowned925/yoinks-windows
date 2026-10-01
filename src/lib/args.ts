import {t} from '../i18n.js'
import {isThemeMode, type ThemeMode} from '../theme.js'

export type CliArgs = {
  help: boolean
  version: boolean
  initialUrl?: string
  themeMode?: ThemeMode
  error?: string
}

export function parseArgs(args: string[]): CliArgs {
  const result: CliArgs = {help: false, version: false}
  const positional: string[] = []

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]!
    if (arg === '-h' || arg === '--help') {
      result.help = true
    } else if (arg === '-v' || arg === '--version') {
      result.version = true
    } else if (arg === '--theme') {
      const value = args[++index]
      if (!value) return {...result, error: t.themeNeedsValue}
      if (!isThemeMode(value)) return {...result, error: t.unknownTheme(value)}
      result.themeMode = value
    } else if (arg.startsWith('--theme=')) {
      const value = arg.slice('--theme='.length)
      if (!isThemeMode(value)) return {...result, error: t.unknownTheme(value)}
      result.themeMode = value
    } else if (arg.startsWith('-')) {
      return {...result, error: t.unknownOption(arg)}
    } else {
      positional.push(arg)
    }
  }

  if (positional.length > 1) return {...result, error: t.expectedSingleUrl}
  result.initialUrl = positional[0]
  return result
}
