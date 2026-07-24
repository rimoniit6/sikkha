'use client'

import React from 'react'
import type { BlogContentBlock } from './blog-block-types'
import ImageUploader from '@/components/ui/image-uploader'
import { Input } from '@/components/ui/input'

export function BlogImageBlockEditor({
  block,
  onChange,
}: {
  block: BlogContentBlock & { type: 'image' }
  onChange: (b: BlogContentBlock) => void
}) {
  return (
    <div className="space-y-3">
      <ImageUploader
        value={block.url}
        onChange={(url) => onChange({ ...block, url })}
        label="ছবি"
        placeholder="ছবি আপলোড করুন বা টেনে আনুন"
      />
      <Input
        placeholder="ছবির ক্যাপশন (ঐচ্ছিক)..."
        value={block.caption}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        className="border-0 bg-muted/30 focus:bg-muted/50 text-sm"
      />
    </div>
  )
}
