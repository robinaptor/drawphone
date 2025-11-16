import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Body = {
  hostName?: string
  color?: string
  codeLength?: number
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function randomCode(len = 4) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sans O/I/0/1
  let out = ''
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)]
  return out
}
function randomColor() {
  const palette = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#1abc9c','#fd79a8','#6c5ce7','#16a085']
  return palette[Math.floor(Math.random() * palette.length)]
}

export async function OPTIONS() {
  return NextResponse.json({ ok: true })
}

export async function POST(req: Request) {
  try {
    if (!SUPABASE_URL || !SERVICE_KEY) {
      console.error('Env missing:', { SUPABASE_URL: !!SUPABASE_URL, SERVICE_KEY: !!SERVICE_KEY })
      return NextResponse.json({ error: 'Supabase env vars missing' }, { status: 500 })
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

    const ct = req.headers.get('content-type') || ''
    if (!ct.includes('application/json')) {
      return NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 415 })
    }

    const body = (await req.json()) as Body
    const hostName = (body.hostName || 'Host').toString().trim().slice(0, 24) || 'Host'
    const hostColor = body.color || randomColor()
    const codeLen = Math.max(3, Math.min(8, Number(body.codeLength) || 4))

    // Générer un code unique (max 12 essais)
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

    // Insérer la room
    const { data: roomIns, error: roomErr } = await supabase
      .from('rooms')
      .insert({ code, status: 'lobby' })
      .select('id, code, status, created_at')
      .maybeSingle()

    if (roomErr) {
      console.error('Create room error:', roomErr)
      return NextResponse.json({ error: 'DB error creating room', details: roomErr.message }, { status: 500 })
    }
    if (!roomIns) {
      // Cas RLS: insert ok mais returning bloqué → refetch par code
      const { data: roomFetch, error: rfErr } = await supabase
        .from('rooms')
        .select('id, code, status, created_at')
        .eq('code', code)
        .single()
      if (rfErr) {
        console.error('Fetch room after insert error:', rfErr)
        return NextResponse.json({ error: 'Room created but cannot read it', details: rfErr.message }, { status: 500 })
      }
      // Crée le host avec roomFetch
      const { data: host2, error: hostErr2 } = await supabase
        .from('players')
        .insert({ room_id: roomFetch.id, name: hostName, color: hostColor, is_host: true })
        .select('id, room_id, name, color, is_host, created_at')
        .maybeSingle()
      if (hostErr2) {
        console.error('Create host error (fallback):', hostErr2)
        await supabase.from('rooms').delete().eq('id', roomFetch.id)
        return NextResponse.json({ error: 'DB error creating host', details: hostErr2.message }, { status: 500 })
      }
      return NextResponse.json({ room: roomFetch, host: host2 }, { status: 201 })
    }

    // Insérer le host
    const { data: player, error: playerErr } = await supabase
      .from('players')
      .insert({ room_id: roomIns.id, name: hostName, color: hostColor, is_host: true })
      .select('id, room_id, name, color, is_host, created_at')
      .maybeSingle()

    if (playerErr) {
      console.error('Create host error:', playerErr)
      await supabase.from('rooms').delete().eq('id', roomIns.id) // rollback
      return NextResponse.json({ error: 'DB error creating host', details: playerErr.message }, { status: 500 })
    }

    return NextResponse.json({ room: roomIns, host: player }, { status: 201 })
  } catch (err: any) {
    console.error('Rooms API crash:', err)
    return NextResponse.json({ error: err?.message ?? 'Internal error' }, { status: 500 })
  }
}