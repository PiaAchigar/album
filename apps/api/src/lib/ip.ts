import type { Context } from 'hono'

// Same IP-extraction order everywhere: Cloudflare's header first (trusted,
// set by our own CF proxy), then the standard forwarded-for chain, then
// x-real-ip, then a fallback bucket for anything unidentifiable.
export function getIP(c: Context): string {
  return (
    c.req.header('cf-connecting-ip') ??
    c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
    c.req.header('x-real-ip') ??
    'unknown'
  )
}
