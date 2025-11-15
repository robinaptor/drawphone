'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GameMode, GAME_MODE_CONFIGS } from '@/types/game'

interface ModeSelectorProps {
  selectedMode: GameMode
  onSelectMode: (mode: GameMode) => void
}

export function ModeSelector({ selectedMode, onSelectMode }: ModeSelectorProps) {
  const [hoveredMode, setHoveredMode] = useState<GameMode | null>(null)
  
  const modes = Object.values(GAME_MODE_CONFIGS)
  const selected = GAME_MODE_CONFIGS[selectedMode]

  return (
    <div className="space-y-6">
      {/* Mode Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {modes.map((mode, index) => (
          <motion.button
            key={mode.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.05 }}
            whileHover={{ scale: 1.05, y: -5 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onSelectMode(mode.id)}
            onHoverStart={() => setHoveredMode(mode.id)}
            onHoverEnd={() => setHoveredMode(null)}
            className={`relative p-4 rounded-xl transition-all ${
              selectedMode === mode.id
                ? 'ring-4 ring-blue-500 shadow-xl bg-blue-50'
                : 'ring-2 ring-gray-200 hover:ring-blue-300 bg-white'
            }`}
          >
            {/* Selected Check */}
            <AnimatePresence>
              {selectedMode === mode.id && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center shadow-lg"
                >
                  <span className="text-white text-sm">✓</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Icon */}
            <div className="text-4xl mb-2">{mode.emoji}</div>

            {/* Name */}
            <h3 className="text-sm font-bold text-gray-800 mb-1">
              {mode.name}
            </h3>
            
            {/* Players */}
            <div className="text-xs text-gray-500">
              {mode.minPlayers}-{mode.maxPlayers} players
            </div>
          </motion.button>
        ))}
      </div>

      {/* Selected Mode Details */}
      <AnimatePresence mode="wait">
        {selected && (
          <motion.div
            key={selected.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-white rounded-xl shadow-lg p-6 border-2 border-gray-200"
          >
            <div className="flex items-start gap-4">
              <span className="text-5xl">{selected.emoji}</span>
              <div className="flex-1">
                <h2 className="text-2xl font-black text-gray-800 mb-2">
                  {selected.name}
                </h2>
                <p className="text-gray-600 mb-4">{selected.description}</p>
                
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Players</div>
                    <div className="text-lg font-bold text-gray-800">
                      {selected.minPlayers}-{selected.maxPlayers}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">Time/Round</div>
                    <div className="text-lg font-bold text-gray-800">
                      {selected.defaultRoundTime}s
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}