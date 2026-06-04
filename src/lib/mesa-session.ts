import { jwtVerify, SignJWT } from 'jose'

const secret = new TextEncoder().encode(
  process.env.MESA_SESSION_SECRET || 'fallback-secret-change-in-production'
)

export interface MesaSessionPayload {
  tableId: string
  sessionId: string
  guestName: string
  guestPhone: string
  restaurantId: string
  iat?: number
  exp?: number
}

/**
 * Cria um JWT criptografado para a sessão de mesa.
 * Válido por 8 horas.
 */
export async function createMesaSessionToken(payload: Omit<MesaSessionPayload, 'iat' | 'exp'>) {
  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret)
  return token
}

/**
 * Valida e descriptografa o JWT da sessão de mesa.
 */
export async function verifyMesaSessionToken(token: string): Promise<MesaSessionPayload | null> {
  try {
    const verified = await jwtVerify(token, secret)
    return verified.payload as unknown as MesaSessionPayload
  } catch {
    return null
  }
}
