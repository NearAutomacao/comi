import { jwtVerify, SignJWT } from 'jose'

const secret = new TextEncoder().encode(
  process.env.AUTH_SESSION_SECRET || process.env.MESA_SESSION_SECRET || 'auth-session-secret-comi'
)

export interface AdminSessionPayload {
  userId: string
  email: string
  name: string
  role: 'manager' | 'customer'
  restaurantId: string | null
  iat?: number
  exp?: number
}

export async function createAdminSessionToken(payload: Omit<AdminSessionPayload, 'iat' | 'exp'>) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret)
}

export async function verifyAdminSessionToken(token: string): Promise<AdminSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as AdminSessionPayload
  } catch {
    return null
  }
}
