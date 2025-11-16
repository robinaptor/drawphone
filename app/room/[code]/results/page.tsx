'use client'

import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import toast, { Toaster } from 'react-hot-toast'

type RoomRow = { id: string; code: string; status: string }
type PlayerRow = { id: string; room_id: string; name: string; color?: string | null }
type VoteRow = { voted_for_id: string; round_number: number }
type RoundRow = { round_number: number }

type RankEntry = { playerId: string; name: string; color?: string | null; votes: number }

export default function ResultsPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = params.code as string

  const [room, setRoom] = useState<RoomRow | null>(null)
  const [players, setPlayers] = useState<PlayerRow[]>([])
  const [roundNumber, setRoundNumber] = useState<number | null>(null)
  const [ranking, setRanking] = useState<RankEntry[]>([])
  const [loading, setLoading] = useState(true)

  const nameMap = useMemo(() => {
    const m = new Map<string, { name: string; color?: string | null }>()
    players.forEach(p => m.set(String(p.id), { name: p.name, color: p.color }))
    return m
  }, [players])

  useEffect(() => {
    loadResults().catch(err => {
      console.error(err)
      toast.error('Failed to load results')
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadResults = async () => {
    setLoading(true)
    try {
      // 1) Room
      const { data: roomData, error: roomErr } = await supabase
        .from('rooms')
        .select('id, code, status')
        .eq('code', roomCode.toUpperCase())
        .single()
      if (roomErr) throw roomErr
      setRoom(roomData)

      // 2) Players
      const { data: playersData, error: pErr } = await supabase
        .from('players')
        .select('id, room_id, name, color')
        .eq('room_id', roomData.id)
        .order('created_at', { ascending: true })
      if (pErr) throw pErr
      const plist = (playersData as PlayerRow[]) || []
      setPlayers(plist)

      // 3) Trouver le dernier round_number pertinent
      let latestRound: number | null = null

      // essai via rounds (type = draw)
      const { data: roundsData } = await supabase
        .from('rounds')
        .select('round_number')
        .eq('room_id', roomData.id)
        .eq('type', 'draw')

      const roundNums = ((roundsData as RoundRow[] | null) || [])
        .map(r => r.round_number)
        .filter((n): n is number => typeof n === 'number')
      if (roundNums.length) {
        latestRound = Math.max(...roundNums)
      }

      // fallback via votes si besoin
      if (latestRound === null) {
        const { data: votesForRounds } = await supabase
          .from('votes')
          .select('round_number')
          .eq('room_id', roomData.id)
        const nums = ((votesForRounds as VoteRow[] | null) || [])
          .map(v => v.round_number)
          .filter((n): n is number => typeof n === 'number')
        if (nums.length) latestRound = Math.max(...nums)
      }

      setRoundNumber(latestRound)

      // 4) Votes du round
      const vq = supabase
        .from('votes')
        .select('voted_for_id, round_number')
        .eq('room_id', roomData.id)
      if (typeof latestRound === 'number') vq.eq('round_number', latestRound)
      const { data: votesData, error: vErr } = await vq
      if (vErr) throw vErr
      const votes = (votesData as VoteRow[] | null) || []

      // 5) Comptage
      const counts = new Map<string, number>()
      for (const p of plist) counts.set(String(p.id), 0) // inclut ceux à 0
      for (const v of votes) {
        const id = String(v.voted_for_id)
        counts.set(id, (counts.get(id) || 0) + 1)
      }

      const table: RankEntry[] = plist
        .map(p => ({
          playerId: String(p.id),
          name: p.name,
          color: p.color,
          votes: counts.get(String(p.id)) || 0,
        }))
        .sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name))

      setRanking(table)
    } finally {
      setLoading(false)
    }
  }

  const top1 = ranking[0]
  const top2 = ranking[1]
  const top3 = ranking[2]

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-white text-2xl">Loading results…</div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center">
        <div className="text-white text-2xl">Room not found</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 p-4 md:p-8">
      <Toaster position="top-center" />
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black text-white mb-2">🏆 Podium</h1>
          {typeof roundNumber === 'number' && (
            <p className="text-white/80">Round {roundNumber}</p>
          )}
        </div>

        {/* Podium top 3 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {/* 2nd */}
          <div className="bg-white/90 rounded-3xl p-6 shadow-xl flex flex-col items-center justify-end md:order-1">
            <div className="text-4xl">🥈</div>
            <div className="text-xl font-bold mt-2">{top2 ? top2.name : '—'}</div>
            <div className="text-gray-600">{top2 ? `${top2.votes} vote(s)` : ''}</div>
          </div>
          {/* 1st */}
          <div className="bg-white rounded-3xl p-8 shadow-2xl flex flex-col items-center justify-end md:order-2">
            <div className="text-6xl">🥇</div>
            <div className="text-2xl font-extrabold mt-2">{top1 ? top1.name : '—'}</div>
            <div className="text-gray-700">{top1 ? `${top1.votes} vote(s)` : ''}</div>
          </div>
          {/* 3rd */}
          <div className="bg-white/90 rounded-3xl p-6 shadow-xl flex flex-col items-center justify-end md:order-3">
            <div className="text-4xl">🥉</div>
            <div className="text-xl font-bold mt-2">{top3 ? top3.name : '—'}</div>
            <div className="text-gray-600">{top3 ? `${top3.votes} vote(s)` : ''}</div>
          </div>
        </div>

        {/* Classement complet */}
        <div className="bg-white/95 rounded-3xl shadow-xl p-6">
          <h2 className="text-2xl font-bold mb-4">Classement</h2>
          <ul className="divide-y">
            {ranking.map((r, idx) => (
              <li key={r.playerId} className="py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full"
                    style={{ backgroundColor: r.color || '#888' }}
                    title={r.name}
                  />
                  <span className="font-semibold">{idx + 1}. {r.name}</span>
                </div>
                <span className="text-gray-600">{r.votes} vote(s)</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-8 flex justify-center gap-3">
          <button
            onClick={() => router.push(`/room/${roomCode}`)}
            className="px-6 py-3 bg-white/20 border border-white/40 text-white rounded-xl hover:bg-white/30"
          >
            Back to room
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-6 py-3 bg-white text-purple-600 font-bold rounded-xl hover:bg-gray-100"
          >
            Home
          </button>
        </div>
      </div>
    </div>
  )
}