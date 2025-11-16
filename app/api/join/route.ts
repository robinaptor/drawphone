// app/api/join/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  code?: string
  name?: string
  color?: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

function randomColor() {
  const palette = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#fd79a8','#6c5ce7','#16a085']
  return palette[Math.floor(Math.random() * palette.length)]
}

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })
    }

    // Crée un client Supabase côté serveur (ne pas importer depuis lib/supabase.ts !)
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

    const ct = req.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
    }

    const body = (await req.json()) as Body
    const roomCode = (body.code || '').toString().trim().toUpperCase()
    const playerName = (body.name || 'Player').toString().trim().slice(0, 24) || 'Player'
    const playerColor = body.color || randomColor()

    if (!roomCode) {
      return NextResponse.json({ error: 'Room code required' }, { status: 400 })
    }

    // Cherche la room
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .select('id, code, status')
      .eq('code', roomCode)
      .single()

    if (roomErr || !room) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Vérifie que la room est en lobby
    if (room.status !== 'lobby') {
      return NextResponse.json({ error: 'Room already started' }, { status: 400 })
    }

    // Crée le player
    const playerId = randomUUID()
    const { data: player, error: playerErr } = await supabase
      .from('players')
      .insert({
        id: playerId,
        room_id: room.id,
        room_code: room.code,
        name: playerName,
        color: playerColor,
        is_host: false
      })
      .select('id, room_id, room_code, name, color, is_host')
      .maybeSingle()

    if (playerErr || !player) {
      console.error('Create player error:', playerErr)
      return NextResponse.json({ error: 'DB error creating player', details: playerErr?.message }, { status: 500 })
    }

    console.log('✅ Player joined:', room.code, player.name, player.id)

    return NextResponse.json({ room, player }, { status: 201 })
  } catch (err: any) {
    console.error('Join API crash:', err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}