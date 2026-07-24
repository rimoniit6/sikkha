'use client'

import React from 'react'
import type { BlogContentBlock } from './blog-block-types'
import ImageUploader from '@/components/ui/image-uploader'
import { Input } from '@/components/ui/input'

export function BlogPdfBlockEditor({
  block,
  onChange,
}: {
  block: BlogContentBlock & { type: 'pdf' }
  onChange: (b: BlogContentBlock) => void
}) {
  return (
    <div className="space-y-3">
      <ImageUploader
        value={block.url}
        onChange={(url) => onChange({ ...block, url })}
        label="পিডিএফ"
        placeholder="পিডিএফ আপলোড করুন বা URL দিন"
      />
      <Input
        placeholder="পিডিএফ শিরোনাম (ঐচ্ছিক)..."
        value={block.title}
        onChange={(e) => onChange({ ...block, title: e.target.value })}
        className="border-0 bg-muted/30 focus:bg-muted/50 text-sm"
      />
    </div>
  )
}
