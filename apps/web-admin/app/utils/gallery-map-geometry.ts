import type { GalleryMapCoordinate } from '@/types/gallery-map';

const PERCENT_MIN = 0;
const PERCENT_MAX = 100;

export const clampPercent = (value: number) => Math.min(Math.max(value, PERCENT_MIN), PERCENT_MAX);

export const normalizePercent = (value: number) => Number(clampPercent(value).toFixed(6));

export const pointToPercent = (
  clientX: number,
  clientY: number,
  rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
): GalleryMapCoordinate | null => {
  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    xPercent: normalizePercent(((clientX - rect.left) / rect.width) * 100),
    yPercent: normalizePercent(((clientY - rect.top) / rect.height) * 100),
  };
};
