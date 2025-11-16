// app/api/rooms/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  hostName?: string
  color?: string
  codeLength?: number
  gameMode?: string
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! // même projet que le client

function randomCode(len = 4) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}
function randomColor() {
  const palette = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#fd79a8','#6c5ce7','#16a085']
  return palette[Math.floor(Math.random() * palette.length)]
}

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      console.error('Env missing:', { SUPABASE_URL: !!SUPABASE_URL, SUPABASE_KEY: !!SUPABASE_KEY })
      return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } })

    const ct = req.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
    }

    const body = (await req.json()) as Body
    const hostName = (body.hostName || 'Host').toString().trim().slice(0, 24) || 'Host'
    const hostColor = body.color || randomColor()
    const codeLen = Math.max(3, Math.min(8, Number(body.codeLength) || 4))
    const gameMode = (body.gameMode || 'classic').toString()

    // Génère un code unique
    let code = ''
    for (let i = 0; i < 12; i++) {
      code = randomCode(codeLen)
      const { data: exists, error: exErr } = await supabase
        .from('rooms')
        .select('id')
        .eq('code', code)
        .maybeSingle()
      if (exErr) {
        console.error('Check code error:', exErr)
        return NextResponse.json({ error: 'DB error checking code', details: exErr.message }, { status: 500 })
      }
      if (!exists) break
      if (i === 11) {
        return NextResponse.json({ error: 'Could not generate unique room code' }, { status: 409 })
      }
    }

    // Crée la room (game_mode ignoré si la colonne n’existe pas)
    const { data: roomIns, error: roomErr } = await supabase
      .from('rooms')
      .insert({ code, status: 'lobby', game_mode: gameMode } as any)
      .select('id, code, status, created_at')
      .maybeSingle()

    if (roomErr) {
      console.error('Create room error:', roomErr)
      return NextResponse.json({ error: 'DB error creating room', details: roomErr.message }, { status: 500 })
    }
    const room = roomIns!

    // Crée le host
    const { data: player, error: playerErr } = await supabase
      .from('players')
      .insert({ room_id: room.id, name: hostName, color: hostColor, is_host: true })
      .select('id, room_id, name, color, is_host, created_at')
      .maybeSingle()

    if (playerErr) {
      console.error('Create host error:', playerErr)
      // rollback
      await supabase.from('rooms').delete().eq('id', room.id)
      return NextResponse.json({ error: 'DB error creating host', details: playerErr.message }, { status: 500 })
    }

    return NextResponse.json({ room, player }, { status: 201 })
  } catch (err: any) {
    console.error('Rooms API crash:', err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}