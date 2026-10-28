import { request } from '@/services/http'
import { getAccessToken } from '@/services/authSession'
import type { NodeExperience, Postcard } from '@/types/postcard'

const base = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '')
export const fetchNodeExperiences = (routeId: string) => request<NodeExperience[]>('/Postcard/Route', { query: { routeId } })
export const fetchPostcards = (page = 1) => request<{ list: Postcard[]; total: number; page: number }>('/Postcard/History', { query: { page } })
export const fetchPostcard = (id: string) => request<Postcard>('/Postcard/Detail', { query: { id } })
export const generatePostcard = (data: { stageId: string; visitId: string; templateId: string; caption: string; sourceAttachmentId: string | null; idempotencyKey: string }) => request<Postcard>('/Postcard/Generate', { method: 'POST', data: { ...data, client: 'h5' } })

export async function uploadPostcardPhoto(file: File) {
  if (!file.type.startsWith('image/') || file.size > 10 * 1024 * 1024) throw new Error('请选择 10 MB 以内的图片')
  const form = new FormData()
  form.append('file', file)
  const response = await fetch(`${base}/Upload/UploadImage`, { method: 'POST', headers: { Authorization: `Bearer ${getAccessToken()}` }, body: form })
  const body = await response.json()
  if (!response.ok || body.code !== 0 || typeof body.data?.fileId !== 'string') throw new Error(body.message || '图片上传失败')
  return body.data as { fileId: string; fileUrl: string }
}

export async function postcardImage(id: string) {
  const response = await fetch(`${base}/Postcard/Image?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } })
  if (!response.ok) throw new Error('图片加载失败，请重试')
  return URL.createObjectURL(await response.blob())
}
