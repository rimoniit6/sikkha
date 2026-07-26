'use client'

import { useEffect, useState } from 'react'
import { X, ZoomIn, ZoomOut, ChevronLeft, ChevronRight } from 'lucide-react'
import SafeImage from '@/components/ui/safe-image'

interface ImageLightboxProps {
  images: { src: string; alt: string }[]
  initialIndex: number
  onClose: () => void
}

export default function ImageLightbox({ images, initialIndex, onClose }: ImageLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex)
  const [zoom, setZoom] = useState(1)

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowLeft' && currentIndex > 0) setCurrentIndex((i) => i - 1)
      if (e.key === 'ArrowRight' && currentIndex < images.length - 1) setCurrentIndex((i) => i + 1)
    }
    document.addEventListener('keydown', handleKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [onClose, currentIndex, images.length])

  const handleWheel = (e: React.WheelEvent) => {
    if (e.deltaY < 0) setZoom((z) => Math.min(z + 0.25, 3))
    else setZoom((z) => Math.max(z - 0.25, 0.5))
  }

  const toggleZoom = () => {
    setZoom((z) => (z === 1 ? 2 : z === 2 ? 3 : 1))
  }

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col animate-fade-in"
      onClick={() => onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="ছবি পূর্ণ পর্দা"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); toggleZoom() }}
            className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="জুম"
          >
            {zoom > 1 ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
          </button>
          <span className="text-xs text-white/50">
            {currentIndex + 1} / {images.length}
          </span>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onClose() }}
          className="p-2 rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="বন্ধ করুন"
        >
          <X className="size-5" />
        </button>
      </div>

      {/* Image area */}
      <div
        className="flex-1 flex items-center justify-center px-4 py-2 min-h-0"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
      >
        <div
          className="relative transition-transform duration-200 ease-out"
          style={{ transform: `scale(${zoom})`, cursor: zoom > 1 ? 'grab' : 'zoom-in' }}
          onClick={toggleZoom}
        >
          <SafeImage
            src={images[currentIndex].src}
            alt={images[currentIndex].alt}
            className="max-w-full max-h-[85vh] object-contain rounded-lg"
          />
        </div>
      </div>

      {/* Navigation arrows */}
      {images.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => i - 1) }}
              className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="পূর্ববর্তী ছবি"
            >
              <ChevronLeft className="size-6" />
            </button>
          )}
          {currentIndex < images.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setCurrentIndex((i) => i + 1) }}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
              aria-label="পরবর্তী ছবি"
            >
              <ChevronRight className="size-6" />
            </button>
          )}
        </>
      )}

      {/* Image caption */}
      {images[currentIndex]?.alt && (
        <div className="shrink-0 text-center py-3 px-4" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-white/60">{images[currentIndex].alt}</p>
        </div>
      )}
    </div>
  )
}
