export interface SiteAreaResponse {
  id: string | null;
  museumId: string | null;
  parentAreaId: string | null;
  areaCode: string | null;
  name: string | null;
  areaType: number;
  description: string | null;
  boundaryGeoJson: string | null;
  centerLongitude: number | null;
  centerLatitude: number | null;
  assetCount: number;
  sortOrder: number;
}

export interface SiteAreaPageResult<T> { list: T[]; pageIndex: number; pageSize: number; total: number; totalPages: number }
