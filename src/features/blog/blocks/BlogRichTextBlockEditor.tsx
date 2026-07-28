'use client'

import React, { useEffect, useRef, useState } from 'react'
import type { BlogContentBlock } from './blog-block-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { sanitizeHtml } from '@/lib/sanitize'
import ImageExt from '@tiptap/extension-image'
import LinkExt from '@tiptap/extension-link'
import PlaceholderExt from '@tiptap/extension-placeholder'
import SubscriptExt from '@tiptap/extension-subscript'
import SuperscriptExt from '@tiptap/extension-superscript'
import { Table as TableExt } from '@tiptap/extension-table'
import { TableRow as TableRowExt } from '@tiptap/extension-table-row'
import { TableCell as TableCellExt } from '@tiptap/extension-table-cell'
import { TableHeader as TableHeaderExt } from '@tiptap/extension-table-header'
import TaskItemExt from '@tiptap/extension-task-item'
import TaskListExt from '@tiptap/extension-task-list'
import TextAlignExt from '@tiptap/extension-text-align'
import { TextStyle as TextStyleExt } from '@tiptap/extension-text-style'
import UnderlineExt from '@tiptap/extension-underline'
import { Color } from '@tiptap/extension-color'
import HighlightExt from '@tiptap/extension-highlight'
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, ReactNodeViewRenderer, useEditor } from '@tiptap/react'
import type { NodeViewRenderer } from '@tiptap/core'
import ImageResizeNodeView from '@/components/ui/image-resize-node-view'
import { useUploadThing } from '@/lib/upload/client'
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  Code,
  Eye,
  FileCode,
  Heading,
  Heading1,
  Heading2,
  ImageIcon,
  Italic,
  Link,
  List,
  ListChecks,
  ListOrdered,
  Loader2,
  Quote,
  Redo2,
  Strikethrough,
  Subscript as SubscriptIcon,
  Superscript as SuperscriptIcon,
  Table,
  Trash2,
  Type,
  Underline,
  Undo2,
} from 'lucide-react'

// ─── Toolbar Button ───────────────────────────────────────────

export function BlogToolbarButton({
  onClick,
  active,
  icon: Icon,
  title,
}: {
  onClick: () => void
  active?: boolean
  icon: React.ElementType
  title: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded-md transition-colors',
        active
          ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

// ─── Horizontal Rule Button ───────────────────────────────────

function BlogHrButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title="বিভাজক রেখা"
      className="p-1.5 rounded-md transition-colors text-muted-foreground hover:bg-muted/60 hover:text-foreground"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <line x1="3" y1="12" x2="21" y2="12" />
      </svg>
    </button>
  )
}

// ─── Color Picker ─────────────────────────────────────────────

const TEXT_COLORS = [
  { label: 'ডিফল্ট', value: '' },
  { label: 'লাল', value: '#ef4444' },
  { label: 'কমলা', value: '#f97316' },
  { label: 'হলুদ', value: '#eab308' },
  { label: 'সবুজ', value: '#22c55e' },
  { label: 'নীল', value: '#3b82f6' },
  { label: 'বেগুনি', value: '#a855f7' },
  { label: 'গোলাপী', value: '#ec4899' },
  { label: 'ধূসর', value: '#6b7280' },
]

const HIGHLIGHT_COLORS = [
  { label: 'কোনটি না', value: '' },
  { label: 'হলুদ', value: '#fef08a' },
  { label: 'সবুজ', value: '#bbf7d0' },
  { label: 'নীল', value: '#bfdbfe' },
  { label: 'গোলাপী', value: '#fbcfe8' },
  { label: 'কমলা', value: '#fed7aa' },
]

function BlogColorPickerPopover({
  onColor,
  onHighlight,
}: {
  onColor: (color: string) => void
  onHighlight: (color: string | undefined) => void
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'p-1.5 rounded-md transition-colors',
            'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
          title="টেক্সট রঙ / হাইলাইট"
        >
          <Baseline className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 p-3" sideOffset={6}>
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">টেক্সট রঙ</p>
            <div className="flex flex-wrap gap-1">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className="h-6 w-6 rounded-full border border-border/40 transition-transform hover:scale-110"
                  style={{ backgroundColor: c.value || 'var(--card)', border: c.value ? `2px solid ${c.value}` : '2px dashed var(--border)' }}
                  title={c.label}
                  onClick={() => onColor(c.value)}
                />
              ))}
            </div>
          </div>
          <Separator />
          <div>
            <p className="text-[11px] font-semibold text-muted-foreground mb-1.5">হাইলাইট</p>
            <div className="flex flex-wrap gap-1">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  className="h-6 w-6 rounded-full border border-border/40 transition-transform hover:scale-110"
                  style={{ backgroundColor: c.value || 'transparent', border: c.value ? `2px solid ${c.value}` : '2px dashed var(--border)' }}
                  title={c.label}
                  onClick={() => onHighlight(c.value || undefined)}
                />
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ─── Image Upload Dialog ──────────────────────────────────────

function BlogImageUploadDialog({
  editor,
  onClose,
}: {
  editor: { chain: () => { focus: () => { setImage: (attrs: { src: string }) => { run: () => void } } } }
  onClose: () => void
}) {
  const [uploading, setUploading] = useState(false)
  const [url, setUrl] = useState('')
  const [altText, setAltText] = useState('')
  const [caption, setCaption] = useState('')
  const [mode, setMode] = useState<'upload' | 'url'>('upload')

  const insertImage = (src: string) => {
    ;(editor as any).chain().focus().setImage({
      src,
      alt: altText.trim() || undefined,
      title: caption.trim() || undefined,
    }).run()
  }

  const { startUpload } = useUploadThing('imageUploader', {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url) {
        insertImage(res[0].url)
      }
      setUploading(false)
      onClose()
    },
    onUploadError: () => {
      setUploading(false)
    },
  })

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    await startUpload([file])
    e.target.value = ''
  }

  const handleUrlInsert = () => {
    if (url.trim()) {
      insertImage(url.trim())
      onClose()
    }
  }

  const handleClose = () => {
    setAltText('')
    setCaption('')
    onClose()
  }

  return (
    <div className="p-3 space-y-3 rounded-lg border border-indigo-200/50 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-800/30">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', mode === 'upload' ? 'bg-indigo-600 text-white' : 'bg-muted/60 text-muted-foreground')}
          onClick={() => setMode('upload')}
        >
          আপলোড
        </button>
        <button
          type="button"
          className={cn('px-3 py-1 rounded-md text-xs font-medium transition-colors', mode === 'url' ? 'bg-indigo-600 text-white' : 'bg-muted/60 text-muted-foreground')}
          onClick={() => setMode('url')}
        >
          URL
        </button>
      </div>

      {mode === 'upload' ? (
        <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-lg border-2 border-dashed border-border hover:border-indigo-400 cursor-pointer transition-colors">
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
              <span className="text-xs text-muted-foreground">আপলোড হচ্ছে...</span>
            </>
          ) : (
            <>
              <ImageIcon className="h-6 w-6 text-muted-foreground/60" />
              <span className="text-xs text-muted-foreground">ছবি নির্বাচন করুন (png, jpg, webp)</span>
            </>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploading} />
        </label>
      ) : (
        <div className="flex items-center gap-2">
          <Input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="h-8 text-xs flex-1 border-0 bg-white dark:bg-background"
            onKeyDown={(e) => { if (e.key === 'Enter') handleUrlInsert() }}
          />
          <Button type="button" size="sm" className="h-7 text-xs" onClick={handleUrlInsert}>যোগ</Button>
        </div>
      )}

      <div className="space-y-2">
        <Input
          value={altText}
          onChange={(e) => setAltText(e.target.value)}
          placeholder="ALT টেক্সট (অ্যাক্সেসিবিলিটির জন্য)"
          className="h-7 text-xs border-0 bg-white dark:bg-background/50"
        />
        <Input
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="ক্যাপশন (ছবির নিচে দেখাবে)"
          className="h-7 text-xs border-0 bg-white dark:bg-background/50"
        />
      </div>

      <button
        type="button"
        className="text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full text-center"
        onClick={handleClose}
      >
        বাতিল
      </button>
    </div>
  )
}

// ─── Custom Image Extension ───────────────────────────────────

const BlogCustomImage = ImageExt.configure({ inline: false, allowBase64: false }).extend({
  addAttributes() {
    return {
      ...(this.parent?.() as Record<string, unknown>),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const w = el.getAttribute('width')
          return w ? parseInt(w, 10) : null
        },
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.width) return {}
          return { width: String(attrs.width) }
        },
      },
      dataAlign: {
        default: 'center',
        parseHTML: (el: HTMLElement) => {
          const da = el.getAttribute('data-align')
          if (da) return da
          const style = el.getAttribute('style') || ''
          if (style.includes('float:left')) return 'left'
          if (style.includes('float:right')) return 'right'
          return 'center'
        },
        renderHTML: (attrs: Record<string, unknown>) => {
          if (!attrs.dataAlign || attrs.dataAlign === 'center') return {}
          const style =
            attrs.dataAlign === 'left'
              ? 'float:left;margin-right:1em;margin-bottom:0.5em'
              : 'float:right;margin-left:1em;margin-bottom:0.5em'
          return { style }
        },
      },
    }
  },
  addNodeView() {
    return ReactNodeViewRenderer(ImageResizeNodeView) as unknown as NodeViewRenderer
  },
})

// ─── Main Editor ──────────────────────────────────────────────

export function BlogRichTextBlockEditor({
  block,
  onChange,
}: {
  block: BlogContentBlock & { type: 'richtext' }
  onChange: (b: BlogContentBlock) => void
}) {
  const prevContentRef = useRef(block.content)
  const [imageDialogOpen, setImageDialogOpen] = useState(false)
  const [linkDialogOpen, setLinkDialogOpen] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [htmlMode, setHtmlMode] = useState(false)
  const editorRef = useRef<any>(null)

  const { startUpload: uploadImage } = useUploadThing('imageUploader', {
    onClientUploadComplete: (res) => {
      if (res?.[0]?.url && editorRef.current) {
        editorRef.current.chain().focus().setImage({ src: res[0].url }).run()
      }
    },
  })

  const editor = useEditor({
    onCreate: ({ editor: ed }: { editor: any }) => {
      editorRef.current = ed
    },
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: { HTMLAttributes: { class: 'rounded-lg bg-zinc-950 text-zinc-100 p-4 text-sm font-mono overflow-x-auto' } },
      }),
      UnderlineExt,
      LinkExt.configure({ openOnClick: false, autolink: true }),
      BlogCustomImage,
      TextAlignExt.configure({ types: ['heading', 'paragraph'] as any }),
      TextStyleExt,
      Color,
      HighlightExt.configure({ multicolor: true }),
      SubscriptExt,
      SuperscriptExt,
      TaskListExt,
      TaskItemExt.configure({ nested: true }),
      TableExt.configure({ resizable: true }),
      TableRowExt,
      TableCellExt,
      TableHeaderExt,
      PlaceholderExt.configure({ placeholder: 'লিখুন... (টেক্সট, টেবিল, কোড, ম্যাথ)' }),
    ],
    content: block.content,
    onUpdate: ({ editor: ed }: { editor: { getHTML: () => string } }) => {
      onChange({ ...block, content: ed.getHTML() })
    },
    editorProps: {
      attributes: {
        class:
          'prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[200px] px-3 py-2 text-sm leading-relaxed',
      },
      handleDrop: (_view: unknown, event: DragEvent) => {
        const files = event.dataTransfer?.files
        if (files && files.length > 0 && files[0].type.startsWith('image/')) {
          event.preventDefault()
          uploadImage([files[0]])
          return true
        }
        return false
      },
      handlePaste: (_view: unknown, event: ClipboardEvent) => {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of Array.from(items)) {
          if (item.type.startsWith('image/')) {
            event.preventDefault()
            const file = item.getAsFile()
            if (file) uploadImage([file])
            return true
          }
        }
        return false
      },
    },
  })

  const handleSetLink = () => {
    if (!editor) return
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run()
    } else {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
    }
    setLinkDialogOpen(false)
    setLinkUrl('')
  }

  const insertTable = () => {
    if (!editor) return
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
  }

  useEffect(() => {
    if (!editor) return
    if (block.content !== prevContentRef.current) {
      prevContentRef.current = block.content
      editor.commands.setContent(block.content, { emitUpdate: false })
    }
  }, [block.content, editor])

  if (!editor) {
    return (
      <div className="space-y-3">
        <div className="h-40 rounded-xl bg-muted/20 animate-pulse" />
      </div>
    )
  }

  const imageAttrs = (editor as any).isActive('image') ? (editor as any).getAttributes('image') : null
  const currentAlign = imageAttrs?.dataAlign || 'center'

  // Toggle HTML source mode
  const toggleHtmlMode = () => {
    if (htmlMode) {
      setHtmlMode(false)
      if (editor) {
        editor.commands.setContent(block.content, { emitUpdate: false })
      }
    } else {
      setHtmlMode(true)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 rounded-lg border border-border/30 bg-muted/20">
        <BlogToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} icon={Bold} title="বোল্ড (Ctrl+B)" />
        <BlogToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} icon={Italic} title="ইটালিক (Ctrl+I)" />
        <BlogToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} icon={Underline} title="আন্ডারলাইন (Ctrl+U)" />
        <BlogToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} icon={Strikethrough} title="স্ট্রাইকথ্রু" />
        <BlogToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} icon={Code} title="ইনলাইন কোড" />
        <BlogColorPickerPopover
          onColor={(color) => {
            if (color) {
              (editor as any).chain().focus().setColor(color).run()
            } else {
              (editor as any).chain().focus().unsetColor().run()
            }
          }}
          onHighlight={(color) => {
            if (color) {
              (editor as any).chain().focus().toggleHighlight({ color }).run()
            } else {
              (editor as any).chain().focus().toggleHighlight().run()
            }
          }}
        />

        <span className="w-px h-5 bg-border/40 mx-1" />

        <BlogToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} icon={Heading1} title="শিরোনাম ১" />
        <BlogToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} icon={Heading} title="শিরোনাম ২" />
        <BlogToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} icon={Heading2} title="শিরোনাম ৩" />

        <span className="w-px h-5 bg-border/40 mx-1" />

        <BlogToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} icon={List} title="বুলেট তালিকা" />
        <BlogToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} icon={ListOrdered} title="নম্বর তালিকা" />
        <BlogToolbarButton onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} icon={ListChecks} title="চেকলিস্ট" />

        <span className="w-px h-5 bg-border/40 mx-1" />

        <BlogToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} icon={Quote} title="উদ্ধৃতি" />
        <BlogHrButton onClick={() => editor.chain().focus().setHorizontalRule().run()} />

        <span className="w-px h-5 bg-border/40 mx-1" />

        <BlogToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} active={((editor as any).isActive({ textAlign: 'left' }))} icon={AlignLeft} title="বামে" />
        <BlogToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} active={((editor as any).isActive({ textAlign: 'center' }))} icon={AlignCenter} title="মাঝে" />
        <BlogToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} active={((editor as any).isActive({ textAlign: 'right' }))} icon={AlignRight} title="ডানে" />

        <span className="w-px h-5 bg-border/40 mx-1" />

        <BlogToolbarButton onClick={insertTable} icon={Table} title="টেবিল" />
        {(editor as any).isActive('table') && (
          <BlogToolbarButton onClick={() => editor.chain().focus().deleteTable().run()} icon={Trash2} title="টেবিল মুছুন" />
        )}

        <span className="w-px h-5 bg-border/40 mx-1" />

        <BlogToolbarButton onClick={() => setImageDialogOpen(true)} icon={ImageIcon} title="ছবি" />

        {(editor as any).isActive('image') && (
          <>
            <span className="w-px h-5 bg-border/40 mx-1" />
            <BlogToolbarButton onClick={() => (editor as any).chain().focus().updateAttributes('image', { dataAlign: 'left' }).run()} active={currentAlign === 'left'} icon={AlignLeft} title="ছবি বামে" />
            <BlogToolbarButton onClick={() => (editor as any).chain().focus().updateAttributes('image', { dataAlign: 'center' }).run()} active={currentAlign === 'center'} icon={AlignCenter} title="ছবি মাঝে" />
            <BlogToolbarButton onClick={() => (editor as any).chain().focus().updateAttributes('image', { dataAlign: 'right' }).run()} active={currentAlign === 'right'} icon={AlignRight} title="ছবি ডানে" />
          </>
        )}

        <span className="w-px h-5 bg-border/40 mx-1" />

        <BlogToolbarButton onClick={() => editor.chain().focus().toggleSuperscript().run()} active={editor.isActive('superscript')} icon={SuperscriptIcon} title="সুপারস্ক্রিপ্ট" />
        <BlogToolbarButton onClick={() => editor.chain().focus().toggleSubscript().run()} active={editor.isActive('subscript')} icon={SubscriptIcon} title="সাবস্ক্রিপ্ট" />

        <span className="w-px h-5 bg-border/40 mx-1" />

        <BlogToolbarButton
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run()
            } else {
              const previousUrl = editor.getAttributes('link').href
              setLinkUrl(previousUrl || 'https://')
              setLinkDialogOpen(true)
            }
          }}
          active={editor.isActive('link')}
          icon={Link}
          title="লিংক"
        />

        <span className="w-px h-5 bg-border/40 mx-1" />

        {/* HTML Source Mode Toggle */}
        <BlogToolbarButton
          onClick={toggleHtmlMode}
          active={htmlMode}
          icon={FileCode}
          title="HTML সোর্স"
        />

        <span className="w-px h-5 bg-border/40 mx-1" />

        <BlogToolbarButton onClick={() => editor.chain().focus().undo().run()} icon={Undo2} title="পূর্বাবস্থা (Ctrl+Z)" />
        <BlogToolbarButton onClick={() => editor.chain().focus().redo().run()} icon={Redo2} title="পুনরায় (Ctrl+Y)" />
      </div>

      {imageDialogOpen && (
        <BlogImageUploadDialog editor={editor as any} onClose={() => setImageDialogOpen(false)} />
      )}

      {linkDialogOpen && (
        <div className="flex items-center gap-2 p-2 rounded-lg border border-indigo-200/50 bg-indigo-50/50 dark:bg-indigo-950/20 dark:border-indigo-800/30">
          <Input
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="https://..."
            className="h-8 text-xs flex-1 border-0 bg-white dark:bg-background"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSetLink()
              if (e.key === 'Escape') setLinkDialogOpen(false)
            }}
          />
          <Button type="button" size="sm" className="h-7 text-xs" onClick={handleSetLink}>সেট</Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setLinkDialogOpen(false)}>বাতিল</Button>
        </div>
      )}

      {htmlMode ? (
        /* HTML Source Mode — textarea for raw HTML editing */
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] text-amber-600 dark:text-amber-400">
            <FileCode className="h-3 w-3" />
            <span>HTML সোর্স মোড — সরাসরি HTML + CSS লিখুন</span>
          </div>
          <Textarea
            value={block.content}
            onChange={(e) => onChange({ ...block, content: e.target.value })}
            rows={10}
            className="font-mono text-sm border-0 bg-zinc-950 text-zinc-100 focus:bg-zinc-900 transition-colors rounded-xl resize-y min-h-[200px]"
            spellCheck={false}
          />
          <div className="text-[10px] text-muted-foreground">
            <span>HTML ভিজুয়াল মোডে ফিরতে <strong>HTML সোর্স</strong> বাটনে আবার ক্লিক করুন</span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/40 bg-card overflow-hidden focus-within:border-indigo-300/50 focus-within:ring-1 focus-within:ring-indigo-300/30 transition-all">
          <EditorContent editor={editor} />
        </div>
      )}
    </div>
  )
}
