'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { ChevronLeft, ChevronRight, Pause, Play, X } from 'lucide-react'
import type { ArchivoConInvitado } from '@/app/(organizador)/actions/archivos.actions'

const R2_PUBLIC_URL = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
const SLIDE_DURATION_MS = 5000
const VIDEO_SAFETY_TIMEOUT_MS = 15000
const TICK_MS = 100

interface Props {
  archivos: ArchivoConInvitado[]
  onClose: () => void
}

export function ReproduccionModal({ archivos, onClose }: Props) {
  const [index, setIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [progress, setProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const archivo = archivos[index]

  const goNext = useCallback(() => {
    setProgress(0)
    setIndex((i) => (i + 1) % archivos.length)
  }, [archivos.length])

  const goPrev = useCallback(() => {
    setProgress(0)
    setIndex((i) => (i - 1 + archivos.length) % archivos.length)
  }, [archivos.length])

  const togglePlay = useCallback(() => {
    setIsPlaying((p) => !p)
  }, [])

  // Avance automático para fotos: progreso lineal cada 100ms.
  useEffect(() => {
    if (!isPlaying || !archivo || archivo.tipo === 'video') return

    const timer = setInterval(() => {
      setProgress((p) => {
        const next = p + (TICK_MS / SLIDE_DURATION_MS) * 100
        if (next >= 100) {
          goNext()
          return 0
        }
        return next
      })
    }, TICK_MS)

    return () => clearInterval(timer)
  }, [isPlaying, archivo, goNext])

  // Videos: autoplay/muted, avanzan en 'ended'. Timeout de seguridad para
  // que el carrusel nunca quede trabado si el video no dispara 'ended'.
  useEffect(() => {
    if (!archivo || archivo.tipo !== 'video') return

    const videoEl = videoRef.current
    if (isPlaying) {
      videoEl?.play().catch(() => {})
    } else {
      videoEl?.pause()
    }

    const safetyTimeout = setTimeout(() => {
      if (isPlaying) goNext()
    }, VIDEO_SAFETY_TIMEOUT_MS)

    return () => clearTimeout(safetyTimeout)
  }, [archivo, isPlaying, goNext])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowRight') goNext()
      if (e.key === 'ArrowLeft') goPrev()
      if (e.key === ' ') {
        e.preventDefault()
        togglePlay()
      }
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [goNext, goPrev, togglePlay, onClose])

  if (!archivo) return null

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      <div className="fixed left-0 top-0 z-50 h-1 w-full bg-white/10">
        <div
          className="h-full bg-white transition-[width] duration-100 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="flex justify-end p-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar reproducción"
          className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition-colors hover:bg-black/60"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4">
        {archivo.tipo === 'video' ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <video
            key={archivo.id}
            ref={videoRef}
            src={`${R2_PUBLIC_URL}/${archivo.r2_key}`}
            muted
            autoPlay
            playsInline
            onEnded={goNext}
            onTimeUpdate={(e) => {
              const v = e.currentTarget
              if (v.duration) setProgress((v.currentTime / v.duration) * 100)
            }}
            className="max-h-[85vh] max-w-full rounded-lg object-contain shadow-2xl"
          />
        ) : (
          <div className="relative h-[85vh] w-full">
            <Image
              key={archivo.id}
              src={`${R2_PUBLIC_URL}/${archivo.r2_key}`}
              alt={`Foto de ${archivo.invitado_nombre} ${archivo.invitado_apellido}`}
              fill
              className="rounded-lg object-contain shadow-2xl"
              sizes="100vw"
              priority
            />
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-4 bg-gradient-to-t from-black/80 to-transparent px-4 pb-10 pt-20">
        <div className="text-center">
          <p className="mb-1 text-xs font-semibold uppercase tracking-widest text-white/60">
            Compartido por
          </p>
          <h2 className="text-2xl font-bold text-white">
            {archivo.invitado_nombre} {archivo.invitado_apellido}
          </h2>
        </div>

        <div className="flex items-center gap-8">
          <button
            type="button"
            onClick={goPrev}
            aria-label="Anterior"
            className="text-white/80 transition-colors hover:text-white"
          >
            <ChevronLeft className="h-8 w-8" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={togglePlay}
            aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-white text-black shadow-xl transition-transform active:scale-90"
          >
            {isPlaying ? (
              <Pause className="h-8 w-8" aria-hidden="true" fill="currentColor" />
            ) : (
              <Play className="h-8 w-8" aria-hidden="true" fill="currentColor" />
            )}
          </button>
          <button
            type="button"
            onClick={goNext}
            aria-label="Siguiente"
            className="text-white/80 transition-colors hover:text-white"
          >
            <ChevronRight className="h-8 w-8" aria-hidden="true" />
          </button>
        </div>

        <div className="rounded-full border border-white/10 bg-white/10 px-4 py-1">
          <span className="text-xs font-semibold text-white/90">
            {index + 1} / {archivos.length}
          </span>
        </div>
      </div>
    </div>
  )
}
