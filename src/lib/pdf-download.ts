import { triggerDownload } from '@/lib/dom-utils'

/**
 * Download a PDF file via server-side proxy to bypass CORS restrictions.
 * The proxy fetches the PDF and serves it with Content-Disposition: attachment header.
 *
 * @param url - The external PDF URL to download
 * @param filename - The filename to save as (default: 'document.pdf')
 */
export async function downloadPdf(url: string, filename: string = 'document.pdf') {
  if (!url) return

  try {
    // Use the server-side proxy to force download
    const proxyUrl = `/api/pdf?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`

    const response = await fetch(proxyUrl)

    if (!response.ok) {
      // Fallback: open in new tab if proxy fails
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }

    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)

    // Trigger download with safe cleanup
    triggerDownload(blobUrl, filename)
    URL.revokeObjectURL(blobUrl)
  } catch (error) {
    console.error('PDF download error:', error)
    // Fallback: open in new tab
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

/**
 * Get filename from URL
 */
export function getFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname
    const parts = pathname.split('/')
    const lastPart = parts[parts.length - 1]
    if (lastPart && lastPart.endsWith('.pdf')) {
      return decodeURIComponent(lastPart)
    }
  } catch {
    // ignore
  }
  return 'document.pdf'
}
