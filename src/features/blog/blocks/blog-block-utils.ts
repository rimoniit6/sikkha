import type { BlogContentBlock } from './blog-block-types'

/** Extract h2/h3 headings from blocks for TableOfContents */
export function headingsFromBlogBlocks(blocks: BlogContentBlock[]): { id: string; text: string; level: number }[] {
  const items: { id: string; text: string; level: number }[] = []
  for (const block of blocks) {
    if (block.type === 'heading' && block.level >= 2 && block.level <= 3 && block.content) {
      const text = block.content.replace(/<[^>]*>/g, '').trim()
      if (!text) continue
      const id = text
        .toLowerCase()
        .replace(/[^\w\u0980-\u09FF\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') || 'heading'
      const existing = items.filter((i) => i.id === id).length
      const uniqueId = existing > 0 ? `${id}-${existing + 1}` : id
      items.push({ id: uniqueId, text, level: block.level })
    }
  }
  return items
}
