import { SignJWT, jwtVerify } from 'jose'

function getSecret(): Uint8Array {
  const secret = process.env.INVITADO_JWT_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('INVITADO_JWT_SECRET must be set and at least 32 characters')
  }
  return new TextEncoder().encode(secret)
}

export interface InvitadoJWTPayload {
  invitado_id: string
  evento_id: string
}

export async function signInvitadoToken(
  payload: InvitadoJWTPayload,
): Promise<string> {
  const secret = getSecret()
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret)
}

export async function verifyInvitadoToken(
  token: string,
): Promise<InvitadoJWTPayload> {
  const secret = getSecret()
  const { payload } = await jwtVerify(token, secret)

  const invitado_id = payload['invitado_id']
  const evento_id = payload['evento_id']

  if (typeof invitado_id !== 'string' || typeof evento_id !== 'string') {
    throw new Error('Token payload inválido')
  }

  return { invitado_id, evento_id }
}
