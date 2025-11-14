import { create } from 'zustand'
import { Player, Room } from '@/types/game'

interface GameStore {
  currentPlayer: Player | null
  room: Room | null
  players: Player[]
  setCurrentPlayer: (player: Player) => void
  setRoom: (room: Room) => void
  setPlayers: (players: Player[]) => void
  addPlayer: (player: Player) => void
  removePlayer: (playerId: string) => void
  updatePlayer: (playerId: string, updates: Partial<Player>) => void
}

export const useGameStore = create<GameStore>((set) => ({
  currentPlayer: null,
  room: null,
  players: [],
  
  setCurrentPlayer: (player) => set({ currentPlayer: player }),
  
  setRoom: (room) => set({ room }),
  
  setPlayers: (players) => set({ players }),
  
  addPlayer: (player) => set((state) => ({
    players: [...state.players, player]
  })),
  
  removePlayer: (playerId) => set((state) => ({
    players: state.players.filter(p => p.id !== playerId)
  })),
  
  updatePlayer: (playerId, updates) => set((state) => ({
    players: state.players.map(p => 
      p.id === playerId ? { ...p, ...updates } : p
    )
  }))
}))