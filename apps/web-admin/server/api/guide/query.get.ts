import type { ApiResponse } from '~~/app/types/api'
import type { GuideResponse, GuideResponseListTotalPageResult } from '~~/app/types/guide'
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend'

export default defineEventHandler(async (event): Promise<GuideResponseListTotalPageResult> => {
  const query = getQuery(event)
  const pageIndex = Math.max(1, Number(query.pageIndex || query.PageIndex || 1) || 1)
  const pageSize = Math.max(1, Number(query.pageSize || query.PageSize || 10) || 10)
  const keyword = String(query.keyword || query.Keyword || '').trim()
  const statusRaw = query.status ?? query.Status
  const voiceStatusRaw = query.voiceStatus ?? query.VoiceStatus

  const response = await backendFetch<ApiResponse<GuideResponseListTotalPageResult>>(
    event,
    '/Guide/list',
    {
      query: {
        Keyword: keyword || undefined,
        Status:
          statusRaw === null || statusRaw === undefined || statusRaw === '' || Number(statusRaw) === 0
            ? undefined
            : Number(statusRaw),
        VoiceStatus:
          voiceStatusRaw === null
          || voiceStatusRaw === undefined
          || voiceStatusRaw === ''
          || Number(voiceStatusRaw) === 0
            ? undefined
            : Number(voiceStatusRaw),
        PageIndex: pageIndex,
        PageSize: pageSize,
      },
    },
  )

  const data = unwrapApiResponse(response)
  return {
    list: (data?.list ?? []) as GuideResponse[],
    pageIndex: data?.pageIndex ?? pageIndex,
    pageSize: data?.pageSize ?? pageSize,
    total: data?.total ?? 0,
    totalPages: data?.totalPages ?? 0,
  }
})
