import { headers } from 'next/headers'
import { eq } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { user } from '@/lib/db/schema'
import { canAccessAdmin } from '@/lib/roles'

export async function getSupportSessionUser() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) return null
  const [row] = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    })
    .from(user)
    .where(eq(user.id, session.user.id))
    .limit(1)
  if (!row) return null
  return { ...row, isAdmin: canAccessAdmin(row.role) }
}
