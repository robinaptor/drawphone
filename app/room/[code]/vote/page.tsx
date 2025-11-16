'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'
import { Room, Player, Round } from '@/types/game'

type Book = {
  ownerId: string
  ownerName: string
  ownerAvatar: string
  prompt: string
  chain: Round[]
}

export default function VotePage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = (params.code as string)?.toUpperCase()
  const playerId = typeof window !== 'undefined' ? sessionStorage.getItem('playerId') : null

  const [room, setRoom] = useState<Room | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [books, setBooks] = useState<Book[]>([])
  const [hasVoted, setHasVoted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!playerId) {
      router.replace('/')
      return
    }
    loadVoteData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerId])

  const loadVoteData = async () => {
    try {
      // Room
      const { data: roomData, error: roomError } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', roomCode)
        .single()
      if (roomError || !roomData) {
        toast.error('Room not found')
        setIsLoading(false)
        return
      }
      setRoom(roomData)

      // Players (par room_code)
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('*')
        .eq('room_code', roomCode)
        .order('joined_at', { ascending: true })
      if (playersError) {
        toast.error('Failed to load players')
        setIsLoading(false)
        return
      }
      setPlayers(playersData || [])

      // Rounds (par room_id)
      const { data: roundsData, error: roundsError } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', roomData.id)
        .order('round_number', { ascending: true })
      if (roundsError) {
        toast.error('Failed to load rounds')
        setIsLoading(false)
        return
      }
      setRounds(roundsData || [])

      // Construire les "books" à partir des prompts (round 0)
      const prompts = (roundsData || []).filter(r => r.round_number === 0 && r.type === 'prompt')
      const booksBuilt: Book[] = prompts.map(promptRound => {
        const owner = (playersData || []).find(p => p.id === promptRound.book_id) // book_id = ownerId au round 0
        const chain = (roundsData || []).filter(r => r.book_id === promptRound.book_id)
        return {
          ownerId: promptRound.book_id,
          ownerName: owner?.name || 'Joueur',
          ownerAvatar: owner?.avatar || '👤',
          prompt: (promptRound.content as any)?.text || '...',
          chain
        }
      })
      setBooks(booksBuilt)

      // Vérifier si j'ai déjà voté
      const { data: myVote } = await supabase
        .from('votes')
        .select('id')
        .eq('room_id', roomData.id)      // Option A (room_id)
        .eq('voter_id', playerId)
        .maybeSingle()

      setHasVoted(!!myVote)
      setIsLoading(false)
    } catch (e: any) {
      console.error('Vote load error:', e)
      toast.error('Failed to load vote')
      setIsLoading(false)
    }
  }

  const submitVote = async (targetBookId: string) => {
    if (!room || !playerId) return

    // Interdire voter pour son propre book
    if (targetBookId === playerId) {
      toast.error('Tu ne peux pas voter pour ton propre livre.')
      return
    }

    try {
      const { error } = await supabase
        .from('votes')
        .insert({
          room_id: room.id,       // Option A (room_id)
          voter_id: playerId,
          target_book_id: targetBookId
        })

      if (error) {
        console.error('Vote insert error:', error)
        toast.error(`Failed to vote: ${error.message}`)
        return
      }

      setHasVoted(true)
      toast.success('Vote pris en compte ✅')
      checkAllVotes()
    } catch (e: any) {
      console.error('Vote submit exception:', e)
      toast.error('Failed to vote')
    }
  }

  const checkAllVotes = async () => {
    if (!room) return
    try {
      const { data: votesCountData, count } = await supabase
        .from('votes')
        .select('*', { count: 'exact', head: true })
        .eq('room_id', room.id)   // Option A
      const needed = players.length

      if ((count ?? 0) >= needed) {
        // Tout le monde a voté => passer en results
        const { error } = await supabase
          .from('rooms')
          .update({ status: 'results' })
          .eq('id', room.id)

        if (!error) {
          router.replace(`/room/${roomCode}/results`)
        } else {
          console.error('Room update to results error:', error)
        }
      }
    } catch (e) {
      console.error('checkAllVotes error:', e)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
        <Toaster />
        <div className="text-white text-2xl">Chargement du vote...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 p-8">
      <Toaster position="top-center" />

      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold text-white mb-2">🗳️ Vote</h1>
          <p className="text-gray-300">
            Choisis le “livre” que tu as préféré (tu ne peux pas voter pour le tien).
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {books.map((book) => {
            const isMine = book.ownerId === playerId
            return (
              <div key={book.ownerId} className={`p-6 rounded-2xl border-2 ${isMine ? 'border-blue-500 bg-blue-900/20' : 'border-white/20 bg-white/10'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="text-white font-bold text-lg">
                    {book.ownerAvatar} {book.ownerName}
                  </div>
                  <div className="text-sm text-gray-300">
                    Prompt: “{book.prompt}”
                  </div>
                </div>

                <div className="text-right">
                  <button
                    disabled={hasVoted || isMine}
                    onClick={() => submitVote(book.ownerId)}
                    className={`px-4 py-2 rounded-full font-bold ${
                      hasVoted || isMine
                        ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                        : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:scale-105 transition'
                    }`}
                  >
                    {isMine ? 'Ton livre' : hasVoted ? 'Vote envoyé' : '👍 Voter pour ce livre'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        <div className="text-center mt-10 text-gray-300">
          {hasVoted ? 'En attente des autres votes...' : 'Tu peux voter une seule fois.'}
        </div>
      </div>
    </div>
  )
}