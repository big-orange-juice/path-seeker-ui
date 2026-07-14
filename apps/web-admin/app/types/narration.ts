/** GET /api/Narration/detail 响应（ID 一律按 string 处理） */
export interface NarrationDetailResponse {
  stageId?: string | null;
  guideId?: string | null;
  guideName?: string | null;
  guideVersion?: number;
  resolvedStyle?: string | null;
  narrationText?: string | null;
  textHash?: string | null;
  textStatus?: number;
  textError?: string | null;
  ttsTaskId?: string | null;
  audioAttachmentId?: string | null;
  audioUrl?: string | null;
  audioStatus?: number;
  durationMs?: number | null;
  version?: number;
}
