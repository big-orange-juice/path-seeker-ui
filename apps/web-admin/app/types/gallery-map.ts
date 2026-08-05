export interface GalleryMapPageRequest {
  pageIndex: number;
  pageSize: number;
  galleryId?: string | null;
  sourceArticleCode?: string | null;
  crawlStatus?: number | null;
}

export interface GalleryMapPointExhibitItemRequest {
  exhibitId?: string | null;
  sourceExhibitCode: string;
  sourceExhibitName: string;
  sourceDetailUrl?: string | null;
  sourceImageUrl?: string | null;
  matchStatus: number;
  matchMethod?: string | null;
  sortOrder: number;
}

export interface CreateGalleryMapAnnotationRequest {
  galleryMapId: string;
  sourcePointCode: string;
  markerType: number;
  xPercent: number;
  yPercent: number;
  title: string | null;
  description: string | null;
  sourcePayload: string | null;
  sortOrder: number;
  exhibits: GalleryMapPointExhibitItemRequest[];
}

export interface UpdateGalleryMapAnnotationRequest extends CreateGalleryMapAnnotationRequest {
  id: string;
}

export type GalleryMapAnnotationRequest =
  | CreateGalleryMapAnnotationRequest
  | UpdateGalleryMapAnnotationRequest;

export interface DeleteGalleryMapPointRequest {
  id: string;
}

export interface GalleryMapPointExhibitResponse {
  id: string | null;
  mapPointId: string | null;
  exhibitId: string | null;
  exhibitName: string | null;
  sourceExhibitCode: string | null;
  sourceExhibitName: string | null;
  sourceNameNormalized: string | null;
  sourceDetailUrl: string | null;
  sourceImageUrl: string | null;
  matchStatus: number;
  matchMethod: string | null;
  sortOrder: number;
}

export interface GalleryMapPointResponse {
  id: string | null;
  galleryMapId: string | null;
  sourcePointCode: string | null;
  markerType: number;
  xPercent: number;
  yPercent: number;
  title: string | null;
  description: string | null;
  sourcePayload: string | null;
  sortOrder: number;
  exhibitCount: number;
  exhibits: GalleryMapPointExhibitResponse[] | null;
}

export interface GalleryMapResponse {
  id: string | null;
  galleryId: string | null;
  galleryName: string | null;
  sourceArticleCode: string | null;
  sourcePageUrl: string | null;
  mapIndex: number;
  sourceImageUrl: string | null;
  imageAttachmentId: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  coordinateType: number;
  contentHash: string | null;
  crawlStatus: number;
  lastCrawledAt: string | null;
  sortOrder: number;
  pointCount: number;
  points: GalleryMapPointResponse[] | null;
}

export interface GalleryMapResponseListTotalPageResult<T> {
  list: T[] | null;
  pageIndex: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface GalleryMapGalleryOption {
  value: string;
  label: string;
  name: string;
  code: string;
}

export interface GalleryMapSummary {
  id: string;
  galleryId: string | null;
  galleryName: string;
  sourceArticleCode: string;
  sourcePageUrl: string | null;
  mapIndex: number;
  sourceImageUrl: string | null;
  imageAttachmentId: string | null;
  imageUrl: string | null;
  imageWidth: number | null;
  imageHeight: number | null;
  coordinateType: number;
  contentHash: string | null;
  crawlStatus: number;
  lastCrawledAt: string | null;
  sortOrder: number;
  pointCount: number;
}

export interface GalleryMapPointExhibitRecord {
  id: string | null;
  mapPointId: string | null;
  exhibitId: string | null;
  exhibitName: string;
  sourceExhibitCode: string;
  sourceExhibitName: string;
  sourceNameNormalized: string;
  sourceDetailUrl: string | null;
  sourceImageUrl: string | null;
  matchStatus: number;
  matchMethod: string;
  sortOrder: number;
}

export interface GalleryMapPointRecord {
  id: string;
  galleryMapId: string | null;
  sourcePointCode: string;
  markerType: number;
  xPercent: number;
  yPercent: number;
  title: string;
  description: string;
  sourcePayload: string | null;
  sortOrder: number;
  exhibitCount: number;
  exhibits: GalleryMapPointExhibitRecord[];
}

export interface GalleryMapRecord extends GalleryMapSummary {
  points: GalleryMapPointRecord[];
}

export interface GalleryMapCoordinate {
  xPercent: number;
  yPercent: number;
}

export interface GalleryMapExhibitSelection {
  id: string;
  exhibitId: string | null;
  name: string;
  exhibitCode: string;
  imageUrl: string | null;
  galleryId: string | null;
  sourceExhibitName?: string;
  sourceDetailUrl?: string | null;
  sourceImageUrl?: string | null;
  matchStatus?: number;
  matchMethod?: string | null;
  relationId?: string | null;
}
