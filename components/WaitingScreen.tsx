'use client'

import { Player } from '@/types/game'

interface WaitingScreenProps {
  players: Player[]
  waitingFor: string[]
}

export function WaitingScreen({ players, waitingFor }: WaitingScreenProps) {
  const waitingPlayers = players.filter(p => waitingFor.includes(p.id))
  const donePlayers = players.filter(p => !waitingFor.includes(p.id))
  
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-bounce">⏳</div>
        <h2 className="text-3xl font-bold text-gray-800 mb-2">
          Waiting for players...
        </h2>
        <p className="text-gray-600">
          {donePlayers.length} / {players.length} players finished
        </p>
      </div>
      
      <div className="w-full max-w-md">
        <div className="h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all duration-500"
            style={{ width: `${(donePlayers.length / players.length) * 100}%` }}
          />
        </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-2xl">
        {players.map(player => {
          const isDone = !waitingFor.includes(player.id)
          
          return (
            <div
              key={player.id}
              className={`p-4 rounded-xl text-center transition ${
                isDone
                  ? 'bg-green-100 border-2 border-green-500'
                  : 'bg-gray-100 border-2 border-gray-300'
              }`}
            >
              <div
                className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: player.color }}
              >
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div className="font-medium text-sm truncate">
                {player.name}
              </div>
              <div className="text-2xl mt-1">
                {isDone ? '✓' : '...'}
              </div>
            </div>
          )
        })}
      </div>
      
      <div className="text-center text-gray-500 italic animate-pulse">
        {waitingPlayers.length === 1 ? (
          <p>Come on {waitingPlayers[0].name}! 😅</p>
        ) : waitingPlayers.length === players.length ? (
          <p>Everyone&apos;s still working hard! 🎨</p>
        ) : (
          <p>Almost there! 🚀</p>
        )}
      </div>
    </div>
  )
}