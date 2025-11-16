// app/api/rooms/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { randomUUID } from 'crypto'

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
    // const gameMode = (body.gameMode || 'classic').toString() // si tu as une colonne, tu pourras la stocker

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
        return NextResponse.json({ error: 'DB error checking code', details: exErr.message }, { status: 500 })
      }
      if (!exists) break
      if (i === 11) {
        return NextResponse.json({ error: 'Could not generate unique room code' }, { status: 409 })
      }
    }

    // Crée la room
    const { data: room, error: roomErr } = await supabase
      .from('rooms')
      .insert({ code, status: 'lobby' } as any)
      .select('id, code, status')
      .maybeSingle()
    if (roomErr || !room) {
      return NextResponse.json({ error: 'DB error creating room', details: roomErr?.message }, { status: 500 })
    }

    // Génère l’ID du host ici pour éviter le NOT NULL
    const playerId = randomUUID()

    // Crée le host (note: on fournit id nous-mêmes)
    const { data: player, error: playerErr } = await supabase
      .from('players')
      .insert({ id: playerId, room_id: room.id, name: hostName, color: hostColor, is_host: true })
      .select('id, room_id, name, color, is_host')
      .maybeSingle()

    if (playerErr || !player) {
      // rollback si host KO
      await supabase.from('rooms').delete().eq('id', room.id)
      return NextResponse.json({ error: 'DB error creating host', details: playerErr?.message }, { status: 500 })
    }

    return NextResponse.json({ room, player }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}