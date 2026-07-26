'use client'

import Image from 'next/image'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getFileUrl, getImagePlaceholder } from '@/lib/file-url'
import { cn } from '@/lib/utils'
import { useImageViewer } from '@/providers/ImageViewerProvider'

interface SafeImageProps {
  src: string | null | undefined
  alt: string
  fallback?: string
  className?: string
  width?: number
  height?: number
  priority?: boolean
  loading?: 'lazy' | 'eager'
  sizes?: string
  /** object-fit: 'cover' (default) or 'contain' */
  objectFit?: 'cover' | 'contain'
  style?: React.CSSProperties
  onClick?: React.MouseEventHandler<HTMLDivElement | HTMLImageElement>
  /** When true, clicking the image opens the global image viewer. Default: true */
  clickable?: boolean
  /** Fade-in effect on image load. Default: true */
  fadeIn?: boolean
}

export default function SafeImage({
  src,
  alt,
  fallback,
  className,
  width,
  height,
  priority,
  loading,
  sizes,
  objectFit,
  style,
  onClick,
  clickable = true,
  fadeIn = true,
}: SafeImageProps) {
  const [error, setError] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const mountedRef = useRef(true)
  const imgRef = useRef<HTMLImageElement | null>(null)
  const resolvedSrc = src ? getFileUrl(src) : ''
  const imgSrc = !resolvedSrc
    ? (fallback || getImagePlaceholder())
    : error
      ? (fallback || getImagePlaceholder())
      : resolvedSrc

  const viewer = useImageViewer()

  useEffect(() => {
    return () => { mountedRef.current = false }
  }, [])

  // Check if image is already cached (avoids invisible image on fast connections)
  useEffect(() => {
    if (imgRef.current?.complete && !loaded) {
      setLoaded(true)
    }
  }, [resolvedSrc, loaded])

  const handleLoad = useCallback(() => {
    if (mountedRef.current) setLoaded(true)
  }, [])

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement | HTMLImageElement>) => {
      onClick?.(e)

      if (clickable && resolvedSrc && !error && viewer) {
        viewer.openViewer([{ src: resolvedSrc, alt }], 0)
      }
    },
    [onClick, clickable, resolvedSrc, error, viewer, alt],
  )

  const imgClasses = cn(
    clickable && resolvedSrc && !error ? 'cursor-pointer' : '',
    objectFit === 'contain' ? 'object-contain' : 'object-cover',
    fadeIn && 'motion-safe:transition-opacity motion-safe:duration-300',
    fadeIn && !loaded && 'opacity-0',
    fadeIn && loaded && 'opacity-100',
  )

  const hasExplicitDimensions = width !== undefined || height !== undefined

  if (hasExplicitDimensions) {
    return (
      <Image
        src={imgSrc}
        alt={alt}
        className={cn(imgClasses, className)}
        width={width || 400}
        height={height || 300}
        priority={priority}
        loading={loading}
        sizes={sizes || "(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"}
        style={style}
        onClick={handleClick}
        onError={() => { setError(true); setLoaded(true) }}
        onLoad={handleLoad}
        ref={imgRef}
      />
    )
  }

  return (
    <div
      className={cn(
        'relative overflow-hidden',
        clickable && resolvedSrc && !error ? 'cursor-pointer' : '',
        className,
      )}
      style={style}
      onClick={handleClick}
    >
      <Image
        src={imgSrc}
        alt={alt}
        fill
        className={imgClasses}
        priority={priority}
        loading={loading}
        sizes={sizes || "(max-width: 768px) 100vw, 33vw"}
        onError={() => { setError(true); setLoaded(true) }}
        onLoad={handleLoad}
        ref={imgRef}
      />
    </div>
  )
}
