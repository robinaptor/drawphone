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
}

// types/game.ts - REMPLACER GAME_MODE_CONFIGS

export const GAME_MODE_CONFIGS: Record<GameMode, GameModeConfig> = {
  'classic': {
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
  },
  
  'cadavre-exquis': {
    id: 'cadavre-exquis',
    name: 'Cadavre Exquis',
    emoji: '🎭',
    description: 'Crée des créatures folles ! Chacun dessine une partie sans voir le reste.',
    minPlayers: 3,
    maxPlayers: 6,
    defaultRoundTime: 60,
    roundTimeOptions: [45, 60, 90],
    calculateRounds: (playerCount) => 3, // Toujours 3 parties (tête/corps/jambes)
    supportsVoting: true,
    allowsSpectators: false,
  },
  
  'combo-chain': {
    id: 'combo-chain',
    name: 'Combo Chain',
    emoji: '🤝',
    description: 'Dessinez tous ensemble sur le même canvas en même temps !',
    minPlayers: 2,
    maxPlayers: 8,
    defaultRoundTime: 90,
    roundTimeOptions: [60, 90, 120],
    calculateRounds: (playerCount) => 1,
    supportsVoting: false,
    allowsSpectators: true,
  },
  
  'pixel-perfect': {
    id: 'pixel-perfect',
    name: 'Pixel Perfect',
    emoji: '🎯',
    description: 'Mémorise et reproduis le pixel art ! Test ta mémoire visuelle.',
    minPlayers: 2,
    maxPlayers: 12,
    defaultRoundTime: 60,
    roundTimeOptions: [45, 60, 90],
    calculateRounds: (playerCount) => playerCount,
    supportsVoting: true,
    allowsSpectators: false,
  },
  
  'morph-mode': {
    id: 'morph-mode',
    name: 'Morph Mode',
    emoji: '🔄',
    description: 'Transforme progressivement un objet en un autre, étape par étape !',
    minPlayers: 4,
    maxPlayers: 8,
    defaultRoundTime: 60,
    roundTimeOptions: [45, 60, 90],
    calculateRounds: (playerCount) => playerCount,
    supportsVoting: true,
    allowsSpectators: false,
  },
  
  'battle-royale': {
    id: 'battle-royale',
    name: 'Battle Royale',
    emoji: '🏆',
    description: 'Survie du meilleur dessinateur ! Les pires dessins sont éliminés.',
    minPlayers: 4,
    maxPlayers: 16,
    defaultRoundTime: 45,
    roundTimeOptions: [30, 45, 60],
    calculateRounds: (playerCount) => {
      let rounds = 0
      let remaining = playerCount
      // Éliminer 2 joueurs par round jusqu'à ce qu'il en reste 2
      while (remaining > 2) {
        remaining -= 2
        rounds++
      }
      return rounds + 1 // +1 pour la finale
    },
    supportsVoting: true,
    allowsSpectators: true,
  },
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