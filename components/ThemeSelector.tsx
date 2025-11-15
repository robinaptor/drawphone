'use client'

import { useState } from 'react'
import { useTheme } from '@/lib/ThemeContext'
import { motion, AnimatePresence } from 'framer-motion'

export function ThemeSelector() {
  const { currentTheme, setTheme, availableThemes } = useTheme()
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Button to open */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-6 right-6 w-14 h-14 rounded-full shadow-2xl hover:scale-110 transition transform flex items-center justify-center text-2xl z-40"
        style={{
          background: `linear-gradient(135deg, ${currentTheme.colors.primary}, ${currentTheme.colors.secondary})`
        }}
      >
        {currentTheme.emoji}
      </button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black bg-opacity-50 z-50"
            />

            {/* Theme Selector Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl p-4 z-50"
            >
              <div
                className="rounded-3xl shadow-2xl p-8"
                style={{
                  backgroundColor: currentTheme.colors.cardBg,
                  color: currentTheme.colors.text
                }}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-3xl font-black">🎨 Choose Theme</h2>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="text-3xl hover:opacity-70 transition"
                  >
                    ✕
                  </button>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 max-h-96 overflow-y-auto">
                  {availableThemes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => {
                        setTheme(theme.id)
                        setIsOpen(false)
                      }}
                      className={`p-6 rounded-2xl transition transform hover:scale-105 ${
                        currentTheme.id === theme.id
                          ? 'ring-4 ring-offset-2 scale-105'
                          : 'hover:ring-2'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${theme.colors.gradientFrom}, ${theme.colors.gradientVia}, ${theme.colors.gradientTo})`,
                        boxShadow: currentTheme.id === theme.id 
                          ? `0 0 0 4px ${theme.colors.primary}40`
                          : 'none'
                      }}
                    >
                      <div className="text-5xl mb-3">{theme.emoji}</div>
                      <div className="text-white font-bold text-sm drop-shadow-lg">
                        {theme.name}
                      </div>
                      {currentTheme.id === theme.id && (
                        <div className="mt-2 text-2xl">✓</div>
                      )}
                    </button>
                  ))}
                </div>

                <div className="mt-6 text-center text-sm opacity-70">
                  💡 Your theme is saved automatically
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}