import { api } from '@/lib/api-client'
import { triggerDownload } from '@/lib/dom-utils'

export interface UserRecord {
  id: string
  name: string | null
  email: string
  role: string
  isPremium: boolean
  createdAt: string
}

export type UserListParams = {
  page?: number
  limit?: number
  search?: string
  role?: string
  isPremium?: boolean
}

export interface UserListResponse {
  data: UserRecord[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export interface UserUpdateInput {
  id?: string
  ids?: string[]
  name?: string
  role?: string
  phone?: string
  institute?: string
  classLevel?: string
  board?: string
  isVerified?: boolean
  isPremium?: boolean
  premiumExpiry?: string | null
}

export const userService = {
  list: (params?: UserListParams) =>
    api.get<UserListResponse>('admin/users', params as Record<string, string | number | boolean | undefined | null>),
  update: (data: UserUpdateInput) => api.patch<{ id: string }>('admin/users', data),
  remove: (id: string) => api.delete<{ id: string }>('admin/users', { id }),
  bulkRemove: (ids: string[]) => api.delete<{ deleted: number }>('admin/users', { ids: ids.join(',') }),
  export: async (params?: UserListParams): Promise<void> => {
    const queryParams = new URLSearchParams()
    if (params?.search) queryParams.set('search', params.search)
    if (params?.role) queryParams.set('role', params.role)
    if (params?.isPremium !== undefined) queryParams.set('isPremium', String(params.isPremium))
    queryParams.set('limit', '100000')

    const res = await fetch(`/api/admin/users/export?${queryParams.toString()}`)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'এক্সপোর্ট ব্যর্থ হয়েছে' }))
      throw new Error(err.error || 'এক্সপোর্ট ব্যর্থ হয়েছে')
    }

    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    triggerDownload(url, `users-${new Date().toISOString().split('T')[0]}.csv`)
    URL.revokeObjectURL(url)
  },
}
