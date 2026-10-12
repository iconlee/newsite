// myframe8 站点函数：留言板（list / post）与运行状态（status）
// 浏览器统一通过同源 /functions/v1/app?action=... 调用。
const json = (body, status = 200, headers = {}) => Response.json(body, {
  status,
  headers: { "cache-control": "no-store", ...headers },
});

const PAGE_SIZE = 20;
const MAX_NAME = 24;
const MAX_TEXT = 300;
const MAX_BODY = 4096;

// 去除控制字符，保留常规文本
const stripControl = (value) => value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "");

export async function handleApp({ request, supabase }) {
  const params = new URL(request.url).searchParams;
  const action = params.get("action");
  if (action === "list") return handleList(request, supabase, params);
  if (action === "post") return handlePost(request, supabase);
  if (action === "status") return handleStatus(request, supabase);
  return json({ error: "not_found" }, 404);
}

async function handleList(request, supabase, params) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
  const rawOffset = params.get("offset") ?? "0";
  if (!/^(0|[1-9][0-9]{0,5})$/.test(rawOffset)) return json({ error: "invalid_offset" }, 400);
  const offset = Number(rawOffset);
  try {
    // 多取一条用于判断是否还有下一页；双列排序保证分页顺序稳定
    const { data, error } = await supabase.from("messages")
      .select("id,name,text,created_at")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + PAGE_SIZE);
    if (error || !Array.isArray(data)) return json({ error: "database_request_failed" }, 503);
    const hasMore = data.length > PAGE_SIZE;
    return json({ items: data.slice(0, PAGE_SIZE), hasMore, nextOffset: hasMore ? offset + PAGE_SIZE : null });
  } catch {
    return json({ error: "database_request_failed" }, 503);
  }
}

async function handlePost(request, supabase) {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405, { allow: "POST" });
  let raw = "";
  try {
    raw = await request.text();
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  if (raw.length > MAX_BODY) return json({ error: "payload_too_large" }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return json({ error: "invalid_payload" }, 400);
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "invalid_payload" }, 400);

  const name = typeof body.name === "string" ? stripControl(body.name).trim() : "";
  const text = typeof body.text === "string" ? stripControl(body.text).trim() : "";
  if (name.length > MAX_NAME) return json({ error: "invalid_name" }, 400);
  if (text.length < 1 || text.length > MAX_TEXT) return json({ error: "invalid_text" }, 400);

  const row = { id: crypto.randomUUID(), name, text, created_at: new Date().toISOString() };
  try {
    const { data, error } = await supabase.from("messages").insert(row)
      .select("id,name,text,created_at").single();
    if (error || !data) return json({ error: "write_rejected" }, 503);
    return json({ ok: true, item: data });
  } catch {
    // 传输异常无法确认是否写入成功，交由页面提示用户核对
    return json({ error: "write_result_unknown" }, 503);
  }
}

async function handleStatus(request, supabase) {
  if (request.method !== "GET") return json({ error: "method_not_allowed" }, 405, { allow: "GET" });
  let db = "ok";
  try {
    const { error } = await supabase.from("messages").select("id").limit(1);
    if (error) db = "unavailable";
  } catch {
    db = "unavailable";
  }
  return json({ ok: true, db, time: new Date().toISOString() });
}
