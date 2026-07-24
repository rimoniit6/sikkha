'use client'

import React, { useState, useRef } from 'react'
import type { BlogContentBlock } from './blog-block-types'
import { blogGenerateId } from './blog-block-types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { safeParseExcelClient } from '@/lib/excel-parse'
import { Plus, Trash2, Upload, X, Loader2 } from 'lucide-react'

export function BlogDataBlockEditor({
  block,
  onChange,
}: {
  block: BlogContentBlock & { type: 'data' }
  onChange: (b: BlogContentBlock) => void
}) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importLoading, setImportLoading] = useState(false)
  const [importError, setImportError] = useState('')

  const addColumn = () => {
    onChange({
      ...block,
      headers: [...block.headers, `কলাম ${block.headers.length + 1}`],
      rows: block.rows.map((row) => [...row, '']),
    })
  }

  const removeColumn = (idx: number) => {
    if (block.headers.length <= 1) return
    onChange({
      ...block,
      headers: block.headers.filter((_, i) => i !== idx),
      rows: block.rows.map((row) => row.filter((_, i) => i !== idx)),
    })
  }

  const addRow = () => {
    onChange({ ...block, rows: [...block.rows, Array(block.headers.length).fill('')] })
  }

  const removeRow = (idx: number) => {
    if (block.rows.length <= 1) return
    onChange({ ...block, rows: block.rows.filter((_, i) => i !== idx) })
  }

  const updateHeader = (idx: number, value: string) => {
    const newHeaders = [...block.headers]
    newHeaders[idx] = value
    onChange({ ...block, headers: newHeaders })
  }

  const updateCell = (rowIdx: number, colIdx: number, value: string) => {
    const newRows = block.rows.map((row, ri) =>
      ri === rowIdx ? row.map((cell, ci) => (ci === colIdx ? value : cell)) : row
    )
    onChange({ ...block, rows: newRows })
  }

  const handleExcelImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportLoading(true)
    setImportError('')

    try {
      const result = await safeParseExcelClient(file)
      const rows = result.rows

      if (!rows || rows.length === 0) {
        setImportError('ফাইলে কোনো ডাটা নেই')
        setImportLoading(false)
        return
      }

      const keys = Object.keys(rows[0])
      if (keys.length === 0) {
        setImportError('ফাইলে কোনো কলাম পাওয়া যায়নি')
        setImportLoading(false)
        return
      }

      const headers = keys.map((_, i) => `কলাম ${i + 1}`)
      const dataRows = rows.map((row) =>
        keys.map((key) => String(row[key] ?? ''))
      )

      onChange({
        ...block,
        headers,
        rows: dataRows.length > 0 ? dataRows : [Array(keys.length).fill('')],
      })
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'ফাইল পার্স করতে সমস্যা হয়েছে')
    } finally {
      setImportLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        className="hidden"
        onChange={handleExcelImport}
      />

      <div className="overflow-x-auto rounded-xl border border-border/40">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/40">
              {block.headers.map((h, i) => (
                <th key={i} className="border-b border-r border-border/30 p-1.5">
                  <Input
                    value={h}
                    onChange={(e) => updateHeader(i, e.target.value)}
                    className="h-7 text-xs font-semibold border-0 bg-transparent p-1 focus:bg-background"
                  />
                </th>
              ))}
              <th className="w-8 border-b border-border/30 p-1">
                <Button type="button" variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/10" onClick={() => removeColumn(block.headers.length - 1)}>
                  <X className="h-3 w-3 text-destructive" />
                </Button>
              </th>
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-muted/20 transition-colors">
                {row.map((cell, ci) => (
                  <td key={ci} className="border-r border-b border-border/20 p-1.5">
                    <Input
                      value={cell}
                      onChange={(e) => updateCell(ri, ci, e.target.value)}
                      className="h-7 text-xs border-0 bg-transparent p-1 focus:bg-background"
                      placeholder="..."
                    />
                  </td>
                ))}
                <td className="w-8 border-b border-border/20 p-1 text-center">
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive/10" onClick={() => removeRow(ri)}>
                    <X className="h-3 w-3 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button type="button" variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={addRow}>
          <Plus className="h-3 w-3" /> সারি যোগ
        </Button>
        <Button type="button" variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={addColumn}>
          <Plus className="h-3 w-3" /> কলাম যোগ
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs h-7 border-teal-300/50 text-teal-700 hover:bg-teal-50 hover:text-teal-800 dark:text-teal-400 dark:hover:bg-teal-950/30"
          disabled={importLoading}
          onClick={() => fileInputRef.current?.click()}
        >
          {importLoading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Upload className="h-3 w-3" />
          )}
          {importLoading ? 'পার্স হচ্ছে...' : 'Excel ইম্পোর্ট'}
        </Button>
      </div>

      {importError && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <X className="h-3 w-3" /> {importError}
        </p>
      )}

      <Input
        placeholder="টেবিলের ক্যাপশন (ঐচ্ছিক)..."
        value={block.caption}
        onChange={(e) => onChange({ ...block, caption: e.target.value })}
        className="text-xs border-0 bg-muted/30 focus:bg-muted/50"
      />
    </div>
  )
}
