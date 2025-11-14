'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { Round, Player, Room, Vote } from '@/types/game'
import { organizeIntoBooks } from '@/lib/game-logic'
import { ResultsCarousel } from '@/components/ResultsCarousel'
import { DrawingDisplay } from '@/components/DrawingDisplay'
import toast, { Toaster } from 'react-hot-toast'
import { motion } from 'framer-motion'

interface Book {
  id: string
  rounds: Round[]
  startPlayerName: string
}

interface TopDrawing {
  round: Round
  votes: number
  playerName: string
  rank: number
}

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()
  
  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null)
  const [books, setBooks] = useState<Book[]>([])
  const [topDrawings, setTopDrawings] = useState<TopDrawing[]>([])
  const [showPodium, setShowPodium] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  
  const roomCode = params.code as string
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null
  
  useEffect(() => {
    if (!playerId) {
      router.push('/')
      return
    }
    
    loadResults()
  }, [playerId])
  
  const loadResults = async () => {
    try {
      // Load room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode.toUpperCase())
        .single()
      
      if (roomError) throw roomError
      setRoom(roomData)
      
      // Load players
      const { data: playersData } = await supabase
        .from('players')
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })
      
      setPlayers(playersData || [])
      
      const current = playersData?.find(p => p.id === playerId)
      if (current) {
        setCurrentPlayer(current)
      }
      
      // Load rounds
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })
      
      // Organize into books
      const booksMap = organizeIntoBooks(roundsData || [], playersData || [])
      
      const booksArray: Book[] = []
      booksMap.forEach((rounds, bookId) => {
        const startPlayerId = bookId.replace('book-', '')
        const startPlayer = playersData?.find(p => p.id === startPlayerId)
        
        booksArray.push({
          id: bookId,
          rounds,
          startPlayerName: startPlayer?.name || 'Unknown'
        })
      })
      
      setBooks(booksArray)
      
      // Load votes and calculate top drawings
      const { data: votesData } = await supabase
        .from('votes')
        .select('*')
        .eq('room_id', roomData.id)
      
      calculateTopDrawings(roundsData || [], votesData || [], playersData || [])
      
      // Mark as finished
      if (roomData.status !== 'finished' && current?.is_host) {
        await supabase
          .from('rooms')
          .update({ status: 'finished' })
          .eq('id', roomData.id)
      }
      
      setIsLoading(false)
      
    } catch (error) {
      console.error('Error loading results:', error)
      toast.error('Failed to load results')
    }
  }
  
  const calculateTopDrawings = (rounds: Round[], votes: Vote[], players: Player[]) => {
    // Filter only drawings
    const drawings = rounds.filter(r => r.type === 'draw')
    
    // Count votes per drawing
    const voteCounts = new Map<string, number>()
    votes.forEach(vote => {
      voteCounts.set(vote.round_id, (voteCounts.get(vote.round_id) || 0) + 1)
    })
    
    // Create array with vote counts
    const drawingsWithVotes = drawings.map(drawing => ({
      round: drawing,
      votes: voteCounts.get(drawing.id) || 0,
      playerName: players.find(p => p.id === drawing.player_id)?.name || 'Unknown',
      rank: 0
    }))
    
    // Sort by votes (descending)
    drawingsWithVotes.sort((a, b) => b.votes - a.votes)
    
    // Assign ranks
    const top3 = drawingsWithVotes.slice(0, 3).map((item, index) => ({
      ...item,
      rank: index + 1
    }))
    
    setTopDrawings(top3)
  }
  
  const playAgain = async () => {
    if (!currentPlayer?.is_host || !room) {
      toast.error('Only the host can start a new game')
      return
    }
    
    try {
      // Delete votes
      await supabase
        .from('votes')
        .delete()
        .eq('room_id', room.id)
      
      // Delete rounds
      await supabase
        .from('rounds')
        .delete()
        .eq('room_id', room.id)
      
      // Reset room
      await supabase
        .from('rooms')
        .update({ 
          status: 'lobby',
          current_round: 0
        })
        .eq('id', room.id)
      
      // Reset players
      await supabase
        .from('players')
        .update({ is_ready: false })
        .eq('room_id', room.id)
      
      router.push(`/room/${roomCode}/lobby`)
      toast.success('Starting new game!')
    } catch (error) {
      console.error('Error restarting game:', error)
      toast.error('Failed to restart game')
    }
  }
  
  const leaveGame = () => {
    sessionStorage.clear()
    router.push('/')
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-white text-2xl">Loading results...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 p-4 md:p-8">
      <Toaster position="top-center" />
      
      <div className="max-w-6xl mx-auto">
        {showPodium && topDrawings.length > 0 ? (
          <div>
            {/* Podium */}
            <div className="text-center mb-12">
              <motion.h1 
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', duration: 0.8 }}
                className="text-6xl font-black mb-4 bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent"
              >
                🏆 WINNERS! 🏆
              </motion.h1>
              <p className="text-white text-2xl">The best drawings!</p>
            </div>
            
            {/* Podium display */}
            <div className="flex items-end justify-center gap-8 mb-12">
              {/* 2nd place */}
              {topDrawings[1] && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.2, type: 'spring' }}
                  className="flex flex-col items-center"
                >
                  <div className="bg-white rounded-2xl shadow-2xl p-6 mb-4 transform hover:scale-105 transition">
                    <div className="w-48 h-48 border-4 border-gray-300 rounded-xl overflow-hidden mb-4">
                      <DrawingDisplay data={topDrawings[1].round.content as any} />
                    </div>
                    <div className="text-center">
                      <div className="text-6xl mb-2">🥈</div>
                      <div className="font-bold text-xl text-gray-800">{topDrawings[1].playerName}</div>
                      <div className="text-gray-600">{topDrawings[1].votes} votes</div>
                    </div>
                  </div>
                  <div className="bg-gray-300 w-32 h-24 rounded-t-xl flex items-center justify-center">
                    <span className="text-4xl font-black text-gray-700">2</span>
                  </div>
                </motion.div>
              )}
              
              {/* 1st place */}
              {topDrawings[0] && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0.4, type: 'spring' }}
                  className="flex flex-col items-center"
                >
                  <div className="bg-gradient-to-br from-yellow-200 to-yellow-400 rounded-2xl shadow-2xl p-8 mb-4 transform hover:scale-105 transition ring-4 ring-yellow-500">
                    <div className="w-64 h-64 border-4 border-yellow-600 rounded-xl overflow-hidden mb-4">
                      <DrawingDisplay data={topDrawings[0].round.content as any} />
                    </div>
                    <div className="text-center">
                      <div className="text-8xl mb-2">👑</div>
                      <div className="font-black text-2xl text-gray-800">{topDrawings[0].playerName}</div>
                      <div className="text-gray-700 font-bold text-xl">{topDrawings[0].votes} votes</div>
                    </div>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-400 to-yellow-600 w-40 h-32 rounded-t-xl flex items-center justify-center shadow-xl">
                    <span className="text-5xl font-black text-white">1</span>
                  </div>
                </motion.div>
              )}
              
              {/* 3rd place */}
              {topDrawings[2] && (
                <motion.div
                  initial={{ y: 100, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: 0, type: 'spring' }}
                  className="flex flex-col items-center"
                >
                  <div className="bg-white rounded-2xl shadow-2xl p-6 mb-4 transform hover:scale-105 transition">
                    <div className="w-48 h-48 border-4 border-orange-300 rounded-xl overflow-hidden mb-4">
                      <DrawingDisplay data={topDrawings[2].round.content as any} />
                    </div>
                    <div className="text-center">
                      <div className="text-6xl mb-2">🥉</div>
                      <div className="font-bold text-xl text-gray-800">{topDrawings[2].playerName}</div>
                      <div className="text-gray-600">{topDrawings[2].votes} votes</div>
                    </div>
                  </div>
                  <div className="bg-orange-300 w-32 h-16 rounded-t-xl flex items-center justify-center">
                    <span className="text-3xl font-black text-orange-700">3</span>
                  </div>
                </motion.div>
              )}
            </div>
            
            {/* Button to see all results */}
            <div className="text-center mb-8">
              <button
                onClick={() => setShowPodium(false)}
                className="px-8 py-4 bg-white text-purple-600 rounded-xl font-bold text-lg hover:bg-gray-100 shadow-lg transition transform hover:scale-105"
              >
                📖 See All Results
              </button>
            </div>
          </div>
        ) : (
          <div>
            {/* Carousel */}
            {books.length > 0 ? (
              <>
                <ResultsCarousel books={books} players={players} />
                
                {/* Button to go back to podium */}
                {topDrawings.length > 0 && (
                  <div className="text-center mt-8">
                    <button
                      onClick={() => setShowPodium(true)}
                      className="px-8 py-4 bg-yellow-400 text-gray-800 rounded-xl font-bold text-lg hover:bg-yellow-500 shadow-lg transition transform hover:scale-105"
                    >
                      🏆 Back to Podium
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center text-white">
                <h1 className="text-4xl font-bold">No results yet!</h1>
              </div>
            )}
          </div>
        )}
        
        {/* Actions */}
        <div className="flex gap-4 justify-center mt-12">
          {currentPlayer?.is_host && (
            <button
              onClick={playAgain}
              className="px-8 py-4 bg-green-500 text-white rounded-xl font-bold text-lg hover:bg-green-600 shadow-lg transition transform hover:scale-105"
            >
              🔄 Play Again
            </button>
          )}
          
          <button
            onClick={leaveGame}
            className="px-8 py-4 bg-gray-800 text-white rounded-xl font-bold text-lg hover:bg-gray-900 shadow-lg transition transform hover:scale-105"
          >
            🏠 Leave Game
          </button>
        </div>
        
        <div className="text-center mt-8">
          <p className="text-white text-sm opacity-75">
            💡 Tip: Take screenshots of the funniest moments!
          </p>
        </div>
      </div>
    </div>
  )
}