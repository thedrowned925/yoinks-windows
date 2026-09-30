import React, {createContext, type ReactNode, useContext} from 'react'
import type {ThemeMode} from './theme-mode.js'

export {isThemeMode, nextThemeMode, THEME_MODES, type ThemeMode} from './theme-mode.js'

export type Theme = {
  mode: ThemeMode
  /** Undefined means “use the terminal's own foreground/background”. */
  primary?: string
  gray?: string
  dark?: string
  background?: string
  dimSecondary: boolean
  inverseButton: boolean
}

const themes: Record<ThemeMode, Theme> = {
  auto: {
    mode: 'auto',
    // Leaving colors unset is more reliable than trying to detect whether a
    // terminal is light or dark. ANSI defaults already follow its theme.
    primary: undefined,
    gray: undefined,
    dark: undefined,
    background: undefined,
    dimSecondary: true,
    inverseButton: true,
  },
  light: {
    mode: 'light',
    primary: '#18181b',
    gray: '#52525b',
    dark: '#ffffff',
    background: '#ffffff',
    dimSecondary: false,
    inverseButton: false,
  },
  dark: {
    mode: 'dark',
    primary: '#ffffff',
    gray: '#a1a1aa',
    dark: '#18181b',
    background: '#18181b',
    dimSecondary: false,
    inverseButton: false,
  },
}

const ThemeContext = createContext<Theme>(themes.auto)

export function themeFor(mode: ThemeMode): Theme {
  return themes[mode]
}

export function ThemeProvider({mode, children}: {mode: ThemeMode; children: ReactNode}) {
  return React.createElement(ThemeContext.Provider, {value: themeFor(mode)}, children)
}

export function useTheme(): Theme {
  return useContext(ThemeContext)
}
