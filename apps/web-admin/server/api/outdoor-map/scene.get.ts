import type { ApiResponse } from '~~/app/types/api';
import { backendFetch, unwrapApiResponse } from '~~/server/utils/backend';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const response = await backendFetch<ApiResponse<unknown>>(event, '/Map/Scene', {
    query: {
      museumId: String(query.museumId ?? '').trim(),
      minLongitude: query.minLongitude == null ? undefined : Number(query.minLongitude),
      minLatitude: query.minLatitude == null ? undefined : Number(query.minLatitude),
      maxLongitude: query.maxLongitude == null ? undefined : Number(query.maxLongitude),
      maxLatitude: query.maxLatitude == null ? undefined : Number(query.maxLatitude),
      assetType: query.assetType == null ? undefined : Number(query.assetType),
      siteAreaId: query.siteAreaId == null ? undefined : String(query.siteAreaId),
      includeGeometry: query.includeGeometry === 'true',
    },
  });
  return unwrapApiResponse(response) ?? { museum: null, areas: [], assets: [] };
});
