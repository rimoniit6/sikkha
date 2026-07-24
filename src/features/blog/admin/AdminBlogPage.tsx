'use client'

import { useCallback, useState } from 'react'
import { useAdminBlogs } from '@/features/blog/hooks/use-admin-blogs'
import { blogService } from '@/features/blog/services/blog.service'
import { useRouterStore } from '@/store/router'
import { useTableSelection } from '@/hooks/use-table-selection'
import { useToast } from '@/hooks/use-toast'
import type { BlogPostRecord } from '@/features/blog/types/blog'
import BlogListView from '@/components/admin/blog/BlogListView'
import BlogDeleteConfirm from '@/components/admin/blog/BlogDeleteConfirm'

export default function AdminBlogPage() {
  const navigate = useRouterStore((s) => s.navigate)
  const { toast } = useToast()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [viewStyle, setViewStyle] = useState<'grid' | 'list'>('grid')
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const perPage = 50

  const { blogs, isLoading, total, invalidate } = useAdminBlogs({ page, search: search || undefined })
  const selection = useTableSelection(blogs)

  const openCreate = useCallback(() => {
    navigate('admin-blog-editor')
  }, [navigate])

  const openEdit = useCallback((post: BlogPostRecord) => {
    navigate('admin-blog-editor', { postId: post.id })
  }, [navigate])

  const handleDelete = useCallback(async () => {
    if (!deleteId) return
    try {
      await blogService.admin.remove(deleteId)
      toast({ title: 'ব্লগ পোস্ট মুছে ফেলা হয়েছে' })
      setDeleteId(null)
      invalidate()
    } catch {
      toast({ title: 'ত্রুটি', description: 'পোস্ট মুছতে সমস্যা হয়েছে', variant: 'destructive' })
    }
  }, [deleteId, invalidate, toast])

  const handleBulkDelete = useCallback(async (ids: string[]) => {
    try {
      await Promise.all(ids.map(id => blogService.admin.remove(id)))
      toast({ title: 'মুছে ফেলা হয়েছে' })
      selection.clearSelection()
      invalidate()
    } catch {
      toast({ title: 'ত্রুটি', description: 'নেটওয়ার্ক সমস্যা', variant: 'destructive' })
    }
  }, [selection, invalidate, toast])

  const handlePublish = useCallback(async (id: string) => {
    try {
      await blogService.admin.publish(id)
      toast({ title: 'পোস্ট প্রকাশিত হয়েছে' })
      invalidate()
    } catch {
      toast({ title: 'ত্রুটি', description: 'প্রকাশ করতে সমস্যা হয়েছে', variant: 'destructive' })
    }
  }, [invalidate, toast])

  const handleArchive = useCallback(async (id: string) => {
    try {
      await blogService.admin.archive(id)
      toast({ title: 'পোস্ট আর্কাইভ হয়েছে' })
      invalidate()
    } catch {
      toast({ title: 'ত্রুটি', description: 'আর্কাইভ করতে সমস্যা হয়েছে', variant: 'destructive' })
    }
  }, [invalidate, toast])

  const handleRestore = useCallback(async (id: string) => {
    try {
      await blogService.admin.restore(id)
      toast({ title: 'পোস্ট পুনরুদ্ধার হয়েছে' })
      invalidate()
    } catch {
      toast({ title: 'ত্রুটি', description: 'পুনরুদ্ধার করতে সমস্যা হয়েছে', variant: 'destructive' })
    }
  }, [invalidate, toast])

  return (
    <>
      <BlogListView
        loading={isLoading}
        blogs={blogs}
        total={total}
        search={search}
        setSearch={setSearch}
        page={page}
        setPage={setPage}
        perPage={perPage}
        viewStyle={viewStyle}
        setViewStyle={setViewStyle}
        selection={selection}
        openEdit={openEdit}
        openCreate={openCreate}
        setDeleteId={setDeleteId}
        handleBulkDelete={handleBulkDelete}
        handlePublish={handlePublish}
        handleArchive={handleArchive}
        handleRestore={handleRestore}
      />
      <BlogDeleteConfirm
        deleteId={deleteId}
        setDeleteId={setDeleteId}
        handleDelete={handleDelete}
      />
    </>
  )
}
