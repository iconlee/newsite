// 浏览器与站点函数通信的请求助手
// 由官方 requestJson 样例（TypeScript）移植为纯 JS，保留错误分类与安全处理逻辑。
export class ApiError extends Error {
  constructor(message, code, status = 0) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
  }
}

// 只渲染应用自有、按已知错误码映射的中文提示；绝不透出服务器原始信息。
export async function requestJson(url, init = {}, messages = {}) {
  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  let response;
  try {
    response = await fetch(url, { ...init, headers, credentials: "same-origin" });
  } catch (error) {
    if (init.signal && init.signal.aborted) throw error;
    throw new ApiError("网络请求未完成，请检查当前状态后再重试。", "network_error");
  }
  if (response.status === 401 || response.status === 403) {
    throw new ApiError("访问被拒绝，请确认站点访问权限或重新登录。", "access_denied", response.status);
  }
  if (response.redirected || !(response.headers.get("content-type") || "").includes("application/json")) {
    throw new ApiError("站点服务返回了异常响应，请确认访问方式。", "invalid_response", response.status);
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new ApiError("站点服务返回了无法解析的数据。", "invalid_response", response.status);
  }
  const body = data && typeof data === "object" ? data : null;
  // 网关错误通常带 code 字段；成功负载也可能把 code 用作业务数据。
  const code = body && typeof body.error === "string" ? body.error
    : (!response.ok || (body && body.ok === false)) && body && typeof body.code === "string" ? body.code
    : response.ok ? null : "request_failed";
  if (!response.ok || (body && body.ok === false) || code) {
    const resolved = code || "request_failed";
    const message = Object.prototype.hasOwnProperty.call(messages, resolved)
      ? messages[resolved]
      : "请求失败，请检查当前状态后再重试。";
    throw new ApiError(message, resolved, response.status);
  }
  return data;
}

// 响应丢失无法判断写入是否已经生效；调用方不得自动重放写操作。
export function isWriteOutcomeUnknown(error) {
  if (!(error instanceof ApiError) || error.status === 401 || error.status === 403) return false;
  // 函数在明确拒绝写入时也使用 HTTP 503，但错误码是 write_rejected。
  if (error.code === "write_rejected") return false;
  return ["network_error", "invalid_response", "write_result_unknown"].includes(error.code)
    || (error.status >= 500 && error.status < 600);
}

// ISO 时间 → 本地可读格式
export function fmtTime(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso ?? "");
  return date.toLocaleString("zh-CN", { hour12: false });
}
