// 🎮 TYPES DE BASE

export type GameMode = 
  | 'classic'           // Mode actuel (Gartic Phone)
  | 'cadavre-exquis'    // Cadavre Exquis
  | 'combo-chain'       // Dessin collaboratif
  | 'pixel-perfect'     // Pixel art
  | 'morph-mode'        // Transformation progressive
  | 'battle-royale'     // Élimination

export interface Room {
  id: string
  code: string
  host_id: string
  status: 'lobby' | 'playing' | 'voting' | 'results' | 'finished'
  max_players: number
  round_time: number
  current_round: number
  max_rounds: number
  game_mode: GameMode  // ← NOUVEAU
  created_at: string
}

// types/game.ts - STRUCTURE ADAPTÉE

export interface Player {
  id: string
  room_code: string      // ← Changé de room_id
  name: string
  avatar: string         // ← Changé de color
  is_host: boolean
  is_ready?: boolean     // ← Optionnel si pas dans la DB
  is_eliminated?: boolean // ← Optionnel si pas dans la DB
  joined_at: string      // ← Changé de created_at
  color?: string         // ← Optionnel, pour compatibilité
}

export interface Round {
  id: string
  room_id: string
  book_id: string
  round_number: number
  player_id: string
  type: 'prompt' | 'draw' | 'describe'
  content: PromptContent | DrawingContent | CadavreExquisContent | PixelArtContent | MorphContent
  created_at: string
}

export interface PromptContent {
  text: string
}

export interface DrawingContent {
  strokes: Stroke[]
  width: number
  height: number
}

export interface Stroke {
  points: Point[]
  color: string
  width: number
  tool: 'pen' | 'eraser'
}

export interface Point {
  x: number
  y: number
}

export interface Vote {
  id: string
  room_id: string
  voter_id: string
  round_id: string
  created_at: string
}

export interface Message {
  id: string
  room_id: string
  player_id: string
  player_name: string
  player_color: string
  message: string
  created_at: string
}

// ============================================
// TYPES SPÉCIFIQUES PAR MODE
// ============================================

// CADAVRE EXQUIS
export type CadavreExquisPart = 'head' | 'body' | 'legs'

export interface CadavreExquisContent {
  part: CadavreExquisPart
  strokes: Stroke[]
  width: number
  height: number
  junctionLines: {
    top?: { y: number }
    bottom?: { y: number }
  }
}

// COMBO CHAIN
export interface ComboChainContent {
  strokes: Stroke[]
  width: number
  height: number
  zone: 'left' | 'center' | 'right' | 'full'
  contributions: {
    playerId: string
    playerName: string
    strokeCount: number
  }[]
}

// PIXEL PERFECT
export interface PixelArtContent {
  pixels: PixelGrid
  gridSize: { width: number; height: number }
  colorPalette: string[]
}

export interface PixelGrid {
  [key: string]: string  // key = "x,y", value = color
}

// MORPH MODE
export interface MorphContent {
  strokes: Stroke[]
  width: number
  height: number
  morphProgress: number  // 0 à 100
  originalPrompt: string
  targetPrompt: string
}

// BATTLE ROYALE
export interface BattleRoyaleRound {
  roundNumber: number
  playersRemaining: string[]
  eliminatedThisRound: string[]
  votes: BattleRoyaleVote[]
}

export interface BattleRoyaleVote {
  voterId: string
  targetRoundId: string
  created_at: string
}

// ============================================
// CONFIGURATION PAR MODE
// ============================================

// Assure-toi que l'interface a bien difficulty
export interface GameModeConfig {
  id: GameMode
  name: string
  emoji: string
  description: string
  minPlayers: number
  maxPlayers: number
  defaultRoundTime: number
  roundTimeOptions: number[]
  calculateRounds: (playerCount: number) => number
  supportsVoting: boolean
  allowsSpectators: boolean
  difficulty: 'easy' | 'medium' | 'hard' // requis
}

export const GAME_MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  classic: {
    id: 'classic',
    name: 'Classic',
    emoji: '🎨',
    description: 'The original Gartic Phone experience',
    minPlayers: 3,
    maxPlayers: 12,
    defaultRoundTime: 60,
    roundTimeOptions: [30, 45, 60, 90, 120],
    calculateRounds: (playerCount) => playerCount,
    supportsVoting: true,
    allowsSpectators: false,
    difficulty: 'easy'
  },

  'cadavre-exquis': {
    id: 'cadavre-exquis',
    name: 'Cadavre Exquis',
    emoji: '🎭',
    description: 'Draw different parts without seeing the full picture!',
    minPlayers: 3,
    maxPlayers: 12,
    defaultRoundTime: 45,
    roundTimeOptions: [30, 45, 60],
    calculateRounds: () => 3,
    supportsVoting: true,
    allowsSpectators: false,
    difficulty: 'easy'
  },

  'combo-chain': {
    id: 'combo-chain',
    name: 'Combo Chain',
    emoji: '🤝',
    description: 'Everyone draws on the same canvas simultaneously!',
    minPlayers: 2,
    maxPlayers: 8,
    defaultRoundTime: 90,
    roundTimeOptions: [60, 90, 120],
    calculateRounds: () => 1,
    supportsVoting: false,
    allowsSpectators: true,
    difficulty: 'medium'
  },

  'pixel-perfect': {
    id: 'pixel-perfect',
    name: 'Pixel Perfect',
    emoji: '🎮',
    description: 'Classic mode but in glorious pixel art!',
    minPlayers: 2,
    maxPlayers: 12,
    defaultRoundTime: 60,
    roundTimeOptions: [45, 60, 90],
    calculateRounds: (playerCount) => playerCount,
    supportsVoting: true,
    allowsSpectators: false,
    difficulty: 'medium'
  },

  'morph-mode': {
    id: 'morph-mode',
    name: 'Morph Mode',
    emoji: '🔄',
    description: 'Transform one object into another, step by step!',
    minPlayers: 4,
    maxPlayers: 8,
    defaultRoundTime: 60,
    roundTimeOptions: [45, 60, 90],
    calculateRounds: (playerCount) => playerCount,
    supportsVoting: true,
    allowsSpectators: false,
    difficulty: 'hard'
  },

  'battle-royale': {
    id: 'battle-royale',
    name: 'Battle Royale',
    emoji: '🏆',
    description: 'Draw and survive! Worst drawings get eliminated!',
    minPlayers: 6,
    maxPlayers: 12,
    defaultRoundTime: 45,
    roundTimeOptions: [30, 45, 60],
    calculateRounds: (playerCount) => {
      let rounds = 0
      let remaining = playerCount
      while (remaining > 2) {
        remaining -= 2
        rounds++
      }
      return rounds + 1
    },
    supportsVoting: true,
    allowsSpectators: true,
    difficulty: 'hard'
  }
}

// ============================================
// HELPERS
// ============================================

export function getGameModeConfig(mode: GameMode): GameModeConfig {
  return GAME_MODE_CONFIGS[mode]
}

export function canStartGame(mode: GameMode, playerCount: number): boolean {
  const config = getGameModeConfig(mode)
  return playerCount >= config.minPlayers && playerCount <= config.maxPlayers
}

export function getMaxRounds(mode: GameMode, playerCount: number): number {
  const config = getGameModeConfig(mode)
  return config.calculateRounds(playerCount)
}