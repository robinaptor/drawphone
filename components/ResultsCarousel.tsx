'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Round, Player } from '@/types/game'
import { DrawingDisplay } from './DrawingDisplay'

interface Book {
  id: string
  rounds: Round[]
  startPlayerName: string
}

interface ResultsCarouselProps {
  books: Book[]
  players: Player[]
}

export function ResultsCarousel({ books, players }: ResultsCarouselProps) {
  const [currentBookIndex, setCurrentBookIndex] = useState(0)
  const [currentRoundIndex, setCurrentRoundIndex] = useState(0)
  const [isAutoPlaying, setIsAutoPlaying] = useState(false)
  
  const currentBook = books[currentBookIndex]
  const currentRound = currentBook?.rounds[currentRoundIndex]
  
  useEffect(() => {
    if (!isAutoPlaying) return
    
    const interval = setInterval(() => {
      if (currentRoundIndex < currentBook.rounds.length - 1) {
        setCurrentRoundIndex(prev => prev + 1)
      } else if (currentBookIndex < books.length - 1) {
        setCurrentBookIndex(prev => prev + 1)
        setCurrentRoundIndex(0)
      } else {
        setIsAutoPlaying(false)
      }
    }, 3000)
    
    return () => clearInterval(interval)
  }, [isAutoPlaying, currentBookIndex, currentRoundIndex, currentBook, books.length])
  
  const getPlayerName = (playerId: string) => {
    return players.find(p => p.id === playerId)?.name || 'Unknown'
  }
  
  const nextRound = () => {
    if (currentRoundIndex < currentBook.rounds.length - 1) {
      setCurrentRoundIndex(prev => prev + 1)
    } else if (currentBookIndex < books.length - 1) {
      setCurrentBookIndex(prev => prev + 1)
      setCurrentRoundIndex(0)
    }
  }
  
  const prevRound = () => {
    if (currentRoundIndex > 0) {
      setCurrentRoundIndex(prev => prev - 1)
    } else if (currentBookIndex > 0) {
      setCurrentBookIndex(prev => prev - 1)
      const prevBook = books[currentBookIndex - 1]
      setCurrentRoundIndex(prevBook.rounds.length - 1)
    }
  }
  
  if (!currentBook || !currentRound) {
    return <div>No results to show</div>
  }
  
  const isFirstRound = currentBookIndex === 0 && currentRoundIndex === 0
  const isLastRound = currentBookIndex === books.length - 1 && 
                      currentRoundIndex === currentBook.rounds.length - 1
  
  return (
    <div className="max-w-5xl mx-auto p-4">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-black mb-4 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          📖 The Results!
        </h1>
        <div className="flex items-center justify-center gap-4">
          <div className="text-xl font-bold text-gray-700">
            Book {currentBookIndex + 1} of {books.length}
          </div>
          <div className="text-gray-500">
            Started by: <span className="font-bold">{currentBook.startPlayerName}</span>
          </div>
        </div>
      </div>
      
      <AnimatePresence mode="wait">
        <motion.div
          key={`${currentBookIndex}-${currentRoundIndex}`}
          initial={{ opacity: 0, x: 100 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -100 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-2xl p-8 min-h-[600px] flex flex-col items-center justify-center"
        >
          <div className="text-center mb-6">
            <div className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-full font-bold text-lg mb-2">
              Round {currentRoundIndex + 1}
            </div>
            <div className="text-gray-600">
              by <span className="font-bold">{getPlayerName(currentRound.player_id)}</span>
            </div>
          </div>
          
          <div className="w-full flex items-center justify-center">
            {currentRound.type === 'prompt' || currentRound.type === 'describe' ? (
              <div className="text-4xl font-bold text-center p-12 max-w-2xl">
                &quot;{(currentRound.content as any).text}&quot;
              </div>
            ) : (
              <div className="border-4 border-gray-800 rounded-xl overflow-hidden">
                <DrawingDisplay 
                  data={currentRound.content as any}
                  className="max-w-full h-auto"
                />
              </div>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
      
      <div className="flex gap-4 justify-center mt-8">
        <button
          onClick={prevRound}
          disabled={isFirstRound}
          className="px-8 py-4 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition"
        >
          ← Previous
        </button>
        
        <button
          onClick={() => setIsAutoPlaying(!isAutoPlaying)}
          className={`px-10 py-4 rounded-xl font-bold transition ${
            isAutoPlaying
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : 'bg-green-500 hover:bg-green-600 text-white'
          }`}
        >
          {isAutoPlaying ? '⏸ Pause' : '▶ Auto Play'}
        </button>
        
        <button
          onClick={nextRound}
          disabled={isLastRound}
          className="px-8 py-4 bg-gray-200 text-gray-800 rounded-xl hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed font-bold transition"
        >
          Next →
        </button>
      </div>
      
      <div className="flex gap-2 justify-center mt-8 flex-wrap">
        {currentBook.rounds.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrentRoundIndex(i)}
            className={`h-3 w-3 rounded-full transition ${
              i === currentRoundIndex
                ? 'bg-blue-500 w-8'
                : 'bg-gray-300 hover:bg-gray-400'
            }`}
          />
        ))}
      </div>
      
      <div className="flex gap-2 justify-center mt-4">
        {books.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setCurrentBookIndex(i)
              setCurrentRoundIndex(0)
            }}
            className={`px-4 py-2 rounded-lg font-bold transition ${
              i === currentBookIndex
                ? 'bg-purple-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Book {i + 1}
          </button>
        ))}
      </div>
    </div>
  )
}