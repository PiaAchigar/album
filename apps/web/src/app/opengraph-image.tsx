import { ImageResponse } from 'next/og'

// Preview image shown when a link to Album is shared (WhatsApp, Instagram,
// etc). Applies to every route that doesn't define its own.
export const alt = 'Album — Todas las fotos de tu fiesta, en un solo álbum'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const NAVY = '#1E293B'
const GOLD = '#D4AF37'
const PINK = '#FBCFE8'

// lucide-react BookOpen, same icon as the app's top bar.
function BookOpenIcon({ size: s }: { size: number }) {
  return (
    <svg
      width={s}
      height={s}
      viewBox="0 0 24 24"
      fill="none"
      stroke="white"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 7v14" />
      <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
    </svg>
  )
}

function Polaroid({
  top,
  left,
  rotate,
  color,
}: {
  top: number
  left: number
  rotate: number
  color: string
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left,
        width: 220,
        height: 260,
        display: 'flex',
        flexDirection: 'column',
        padding: 14,
        paddingBottom: 46,
        background: 'white',
        borderRadius: 10,
        transform: `rotate(${rotate}deg)`,
        boxShadow: '0 20px 40px rgba(0,0,0,0.35)',
      }}
    >
      <div style={{ flex: 1, display: 'flex', background: color, borderRadius: 4 }} />
    </div>
  )
}

// Inter (the app font) in bold; Google Fonts serves TTF when no browser
// User-Agent is sent, which is what Satori needs. Falls back to the
// built-in font if the fetch fails, so the image never breaks.
async function loadInter(weight: number): Promise<ArrayBuffer | null> {
  try {
    const css = await (
      await fetch(`https://fonts.googleapis.com/css2?family=Inter:wght@${weight}`)
    ).text()
    const url = css.match(/src: url\((.+?)\) format\('(?:truetype|opentype)'\)/)?.[1]
    if (!url) return null
    return await (await fetch(url)).arrayBuffer()
  } catch {
    return null
  }
}

export default async function OpengraphImage() {
  const [regular, bold] = await Promise.all([loadInter(400), loadInter(700)])
  const fonts = [
    ...(regular ? [{ name: 'Inter', data: regular, weight: 400 as const }] : []),
    ...(bold ? [{ name: 'Inter', data: bold, weight: 700 as const }] : []),
  ]

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          position: 'relative',
          background: NAVY,
          color: 'white',
          fontFamily: fonts.length ? 'Inter' : 'sans-serif',
          overflow: 'hidden',
        }}
      >
        {/* Photo stack on the right */}
        <Polaroid top={120} left={830} rotate={10} color={PINK} />
        <Polaroid top={190} left={700} rotate={-8} color={GOLD} />
        <Polaroid top={300} left={880} rotate={-3} color="#94A3B8" />

        {/* Text block */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            padding: '0 80px',
            width: 700,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 22 }}>
            <BookOpenIcon size={84} />
            <span style={{ fontSize: 92, fontWeight: 700, letterSpacing: -2 }}>Album</span>
          </div>
          <div style={{ width: 90, height: 6, background: GOLD, borderRadius: 3, marginTop: 34 }} />
          <div style={{ fontSize: 50, fontWeight: 700, lineHeight: 1.15, marginTop: 34 }}>
            Todas las fotos de tu fiesta, en un solo álbum.
          </div>
          <div style={{ fontSize: 28, color: '#CBD5E1', marginTop: 22, lineHeight: 1.35 }}>
            Tus invitados escanean un QR y suben lo que vivieron.
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  )
}
