'use client'

import { GameMode, GAME_MODE_CONFIGS } from '@/types/game'

interface GameModeInfoProps {
  gameMode: GameMode
  currentRound: number
}

export function GameModeInfo({ gameMode, currentRound }: GameModeInfoProps) {
  const config = GAME_MODE_CONFIGS[gameMode]
  
  const getInstructions = () => {
    switch (gameMode) {
      case 'cadavre-exquis':
        if (currentRound === 0) return '🎭 Draw the HEAD only (top third)'
        if (currentRound === 1) return '🎭 Draw the BODY (middle third)'
        return '🎭 Draw the LEGS (bottom third)'
        
      case 'combo-chain':
        return '🤝 Draw in your assigned zone - work together!'
        
      case 'pixel-perfect':
        return '🎮 Draw in pixel art style!'
        
      case 'morph-mode':
        return '🔄 Transform the object progressively!'
        
      case 'battle-royale':
        return '🏆 Draw your best - worst drawings get eliminated!'
        
      default:
        return '🎨 Draw or describe!'
    }
  }
  
  return (
    <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-full font-bold inline-flex items-center gap-3 shadow-lg">
      <span className="text-2xl">{config.emoji}</span>
      <span>{getInstructions()}</span>
    </div>
  )
}