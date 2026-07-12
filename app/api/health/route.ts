import { sql } from 'drizzle-orm'
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getObjectStorage } from '@/lib/storage'

export const dynamic = 'force-dynamic'

async function checkDatabase() {
  try {
    await db.execute(sql`select 1`)
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

async function checkStorage() {
  try {
    return await getObjectStorage().healthCheck()
  } catch (error) {
    return {
      ok: false,
      driver: process.env.STORAGE_DRIVER ?? 'unconfigured',
      configured: false,
      message: error instanceof Error ? error.message : 'storage_unavailable',
    }
  }
}

function checkAi() {
  const provider = process.env.AI_PROVIDER ?? 'openai-compatible'
  const configured =
    provider === 'mock'
      ? process.env.NODE_ENV !== 'production'
      : Boolean(process.env.AI_API_KEY && process.env.AI_MODEL_ID)

  return {
    ok: configured,
    provider,
    configured,
    status: configured ? 'ready' : 'degraded',
  }
}

export async function GET() {
  const [database, storage] = await Promise.all([
    checkDatabase(),
    checkStorage(),
  ])
  const ai = checkAi()
  const healthy = database.ok && storage.ok

  return NextResponse.json(
    {
      ok: healthy,
      application: { ok: true },
      database,
      storage,
      ai,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  )
}
