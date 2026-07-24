import DataTable, { type BulkAction, type ColumnDef } from '@/components/shared/DataTable'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Archive,
  Edit,
  Eye,
  LayoutGrid,
  List,
  MoreVertical,
  Newspaper,
  Plus,
  RotateCcw,
  Search,
  Send,
  Trash2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import React from 'react'
import type { BlogPostRecord } from './types'
import { statusLabels, statusColors } from './types'

interface BlogListViewProps {
  loading: boolean
  blogs: BlogPostRecord[]
  total: number
  search: string
  setSearch: (v: string) => void
  page: number
  setPage: (v: number) => void
  perPage: number
  viewStyle: 'grid' | 'list'
  setViewStyle: (v: 'grid' | 'list') => void
  selection: {
    selectedIds: string[]
    toggleOne: (id: string) => void
    toggleAll: () => void
    allVisibleSelected: boolean
    someVisibleSelected: boolean
  }
  openEdit: (post: BlogPostRecord) => void
  openCreate: () => void
  setDeleteId: (id: string) => void
  handleBulkDelete: (ids: string[]) => Promise<void>
  handlePublish: (id: string) => void
  handleArchive: (id: string) => void
  handleRestore: (id: string) => void
}

export default function BlogListView({
  loading,
  blogs,
  total,
  search,
  setSearch,
  page,
  setPage,
  perPage,
  viewStyle,
  setViewStyle,
  selection,
  openEdit,
  openCreate,
  setDeleteId,
  handleBulkDelete,
  handlePublish,
  handleArchive,
  handleRestore,
}: BlogListViewProps) {
  if (loading && blogs.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-10 w-44" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  const columns: ColumnDef<BlogPostRecord>[] = [
    {
      key: 'title',
      header: 'শিরোনাম',
      render: (post) => <span className="font-medium">{post.title}</span>,
      cellClass: 'max-w-[220px] truncate',
    },
    {
      key: 'category',
      header: 'ক্যাটাগরি',
      render: (post) =>
        post.category ? (
          <Badge variant="outline" style={{ borderColor: post.category.color || undefined }}>
            {post.category.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground">-</span>
        ),
      cellClass: 'hidden sm:table-cell',
    },
    {
      key: 'status',
      header: 'স্ট্যাটাস',
      render: (post) => (
        <Badge className={statusColors[post.status]} variant="secondary">
          {statusLabels[post.status]}
        </Badge>
      ),
    },
    {
      key: 'date',
      header: 'তারিখ',
      render: (post) => (
        <span className="text-sm text-muted-foreground">
          {post.publishedAt
            ? new Date(post.publishedAt).toLocaleDateString('bn-BD')
            : '-'}
        </span>
      ),
      cellClass: 'hidden md:table-cell',
    },
    {
      key: 'views',
      header: 'দেখা',
      render: (post) => <span className="text-sm text-muted-foreground">{post.viewCount}</span>,
      cellClass: 'hidden lg:table-cell',
    },
    {
      key: 'actions',
      header: 'অ্যাকশন',
      cellClass: 'w-20',
      render: (post) => (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(post)}>
            <Edit className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(post.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ),
    },
  ]

  const bulkActions: BulkAction[] = [
    { label: 'মুছুন', variant: 'destructive', handler: handleBulkDelete },
  ]

  const filters = (
    <div className="flex items-center gap-3">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="পোস্ট খুঁজুন..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1) }}
          className="pl-9 h-10 bg-card border-border/50"
        />
      </div>
      <div className="flex items-center bg-card border border-border/50 rounded-lg p-0.5">
        <Button
          variant={viewStyle === 'grid' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setViewStyle('grid')}
        >
          <LayoutGrid className="h-4 w-4" />
        </Button>
        <Button
          variant={viewStyle === 'list' ? 'secondary' : 'ghost'}
          size="icon"
          className="h-8 w-8"
          onClick={() => setViewStyle('list')}
        >
          <List className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20">
              <Newspaper className="h-5 w-5" />
            </div>
            ব্লগ ব্যবস্থাপনা
          </h1>
          <p className="text-muted-foreground text-sm mt-2 ml-12">মোট {total}টি পোস্ট</p>
        </div>
        <Button
          className="gap-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 shadow-lg shadow-emerald-600/20 transition-all hover:shadow-xl hover:shadow-emerald-600/30"
          onClick={openCreate}
        >
          <Plus className="h-4 w-4" /> নতুন পোস্ট যোগ করুন
        </Button>
      </div>

      {viewStyle === 'grid' ? (
        <>
          {filters}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {blogs.map((post) => (
              <div key={post.id} className="group">
                <Card className="hover:shadow-lg hover:shadow-emerald-500/5 transition-all duration-300 border-border/50 h-full overflow-hidden">
                  {post.featuredImage ? (
                    <div className="relative h-36 overflow-hidden">
                      <Image src={post.featuredImage} alt={post.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" unoptimized />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 left-3 right-3">
                        <h3 className="font-semibold text-white text-sm line-clamp-1 drop-shadow-md">{post.title}</h3>
                      </div>
                      <Badge className={cn("absolute top-2 right-2 text-[10px] border-0", statusColors[post.status])} variant="secondary">
                        {statusLabels[post.status]}
                      </Badge>
                    </div>
                  ) : (
                    <div className={cn(
                      'h-28 relative flex items-center justify-center',
                      'bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/40 dark:to-teal-950/40',
                    )}>
                      <div className="p-4 rounded-2xl bg-white/60 dark:bg-white/10 backdrop-blur-sm">
                        <Newspaper className="h-8 w-8 text-emerald-600/60" />
                      </div>
                      <Badge className={cn("absolute top-2 right-2 text-[10px] border-0", statusColors[post.status])} variant="secondary">
                        {statusLabels[post.status]}
                      </Badge>
                    </div>
                  )}

                  <CardContent className="p-4">
                    {!post.featuredImage && (
                      <h3 className="font-semibold text-sm line-clamp-1 mb-2">{post.title}</h3>
                    )}

                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2 min-h-[2rem]">
                      {post.excerpt || 'কোনো সারসংক্ষেপ নেই'}
                    </p>

                    <div className="flex flex-wrap gap-1 mb-3">
                      {post.category && (
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5">
                          {post.category.name}
                        </Badge>
                      )}
                      {post.tags?.slice(0, 3).map((t) => (
                        <Badge key={t.tag.id} variant="secondary" className="text-[10px] h-5 px-1.5 bg-muted/80">
                          {t.tag.name}
                        </Badge>
                      ))}
                      {post.readingTime && <span className="text-[11px] text-muted-foreground">{post.readingTime} মিনিট</span>}
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="flex items-center gap-1.5">
                        {post.isFeatured && (
                          <Badge className="text-[10px] h-5 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                            ফিচার্ড
                          </Badge>
                        )}
                        {post.isPinned && (
                          <Badge className="text-[10px] h-5 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800">
                            পিন
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5">
                        <Button variant="ghost" size="icon" className="h-7 w-7 hover:bg-emerald-50 dark:hover:bg-emerald-950/30" onClick={() => openEdit(post)} title="সম্পাদনা">
                          <Edit className="h-3.5 w-3.5 text-emerald-600" />
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="আরো অ্যাকশন">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEdit(post)}>
                              <Edit className="h-4 w-4 mr-2" /> সম্পাদনা
                            </DropdownMenuItem>
                            {post.status === 'DRAFT' && (
                              <DropdownMenuItem onClick={() => handlePublish(post.id)}>
                                <Send className="h-4 w-4 mr-2" /> প্রকাশ
                              </DropdownMenuItem>
                            )}
                            {post.status === 'PUBLISHED' && (
                              <DropdownMenuItem onClick={() => handleArchive(post.id)}>
                                <Archive className="h-4 w-4 mr-2" /> আর্কাইভ
                              </DropdownMenuItem>
                            )}
                            {post.status === 'ARCHIVED' && (
                              <DropdownMenuItem onClick={() => handleRestore(post.id)}>
                                <RotateCcw className="h-4 w-4 mr-2" /> পুনরুদ্ধার
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => window.open(`/blog/${post.slug}`, '_blank')}>
                              <Eye className="h-4 w-4 mr-2" /> দেখুন
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={() => setDeleteId(post.id)}>
                              <Trash2 className="h-4 w-4 mr-2" /> মুছুন
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
            {blogs.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-16 text-muted-foreground">
                <Newspaper className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-lg font-medium">কোনো ব্লগ পোস্ট পাওয়া যায়নি</p>
                <p className="text-sm mt-1">নতুন পোস্ট তৈরি করতে উপরের বাটনে ক্লিক করুন</p>
              </div>
            )}
          </div>
        </>
      ) : (
        <DataTable
          columns={columns}
          data={blogs}
          total={total}
          page={page}
          pageSize={perPage}
          onPageChange={setPage}
          loading={loading}
          selectable
          selectedIds={selection.selectedIds}
          onToggleOne={selection.toggleOne}
          onToggleAll={selection.toggleAll}
          allVisibleSelected={selection.allVisibleSelected}
          someVisibleSelected={selection.someVisibleSelected}
          bulkActions={bulkActions}
          emptyMessage="কোনো ব্লগ পোস্ট পাওয়া যায়নি"
          filters={filters}
        />
      )}
    </div>
  )
}
