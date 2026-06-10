import { jwtVerify, SignJWT } from 'jose'

const secret = new TextEncoder().encode(
  process.env.AUTH_SESSION_SECRET || 'auth-session-secret-comi'
)

export interface DeliverySessionPayload {
  restaurantId: string
  restaurantSlug: string
  guestName: string
  guestPhone: string
  orderId?: string | null
  iat?: number
  exp?: number
}

export async function createDeliverySessionToken(payload: Omit<DeliverySessionPayload, 'iat' | 'exp'>) {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('4h')
    .sign(secret)
}

export async function verifyDeliverySessionToken(token: string): Promise<DeliverySessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret)
    return payload as unknown as DeliverySessionPayload
  } catch {
    return null
  }
}
