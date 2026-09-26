/** 统一错误类型：code 供前端区分展示，message 面向使用者 */
export class DemoError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "DemoError";
    this.code = code;
  }
}

export function isAbortError(error) {
  return (
    error?.name === "AbortError" ||
    error?.code === "ABORT_ERR" ||
    error?.code === "UND_ERR_ABORTED" ||
    error?.message === "aborted"
  );
}
