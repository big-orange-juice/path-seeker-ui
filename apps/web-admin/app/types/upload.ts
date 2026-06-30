export interface UploadAttachment {
  fileId: string | null;
  fileUrl: string | null;
}

export type UploadTarget = 'image' | 'file';
