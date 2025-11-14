'use client'

import { Player } from '@/types/game'

interface PlayerListProps {
  players: Player[]
  currentPlayerId?: string
}

export function PlayerList({ players, currentPlayerId }: PlayerListProps) {
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="text-xl font-bold mb-4 text-gray-800">
        Players ({players.length})
      </h3>
      
      <div className="space-y-3">
        {players.map((player) => (
          <div
            key={player.id}
            className={`flex items-center gap-3 p-3 rounded-lg transition ${
              player.id === currentPlayerId
                ? 'bg-blue-50 border-2 border-blue-500'
                : 'bg-gray-50'
            }`}
          >
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg"
              style={{ backgroundColor: player.color }}
            >
              {player.name.charAt(0).toUpperCase()}
            </div>
            
            <div className="flex-1">
              <div className="font-bold text-gray-800">
                {player.name}
                {player.is_host && (
                  <span className="ml-2 text-xs bg-yellow-400 text-yellow-900 px-2 py-1 rounded-full">
                    👑 Host
                  </span>
                )}
                {player.id === currentPlayerId && (
                  <span className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded-full">
                    You
                  </span>
                )}
              </div>
            </div>
            
            <div>
              {player.is_ready ? (
                <span className="text-green-500 text-2xl">✓</span>
              ) : (
                <span className="text-gray-300 text-2xl">○</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}