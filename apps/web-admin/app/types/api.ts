export interface ApiResponse<T = void> {
  code: number;
  message: string | null;
  traceId: string | null;
  data?: T | null;
}
