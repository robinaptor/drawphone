'use client'

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { Theme, themes, getTheme } from './themes'

interface ThemeContextType {
  currentTheme: Theme
  setTheme: (themeId: string) => void
  availableThemes: Theme[]
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [currentTheme, setCurrentTheme] = useState<Theme>(themes[0])

  useEffect(() => {
    // Load theme from localStorage
    const savedThemeId = localStorage.getItem('drawphone-theme')
    if (savedThemeId) {
      setCurrentTheme(getTheme(savedThemeId))
    } else {
      // Auto-detect seasonal theme
      const month = new Date().getMonth()
      if (month === 11 || month === 0) { // December or January
        setCurrentTheme(getTheme('christmas'))
      } else if (month === 9) { // October
        setCurrentTheme(getTheme('halloween'))
      } else if (month === 1) { // February
        setCurrentTheme(getTheme('valentine'))
      }
    }
  }, [])

  const setTheme = (themeId: string) => {
    const theme = getTheme(themeId)
    setCurrentTheme(theme)
    localStorage.setItem('drawphone-theme', themeId)
  }

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme, availableThemes: themes }}>
      <div
        style={{
          background: currentTheme.colors.background,
          minHeight: '100vh',
          color: currentTheme.colors.text
        }}
      >
        {children}
      </div>
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider')
  }
  return context
}