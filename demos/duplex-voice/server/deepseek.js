/**
 * DeepSeek 流式对话（OpenAI 兼容协议）。
 * 只向调用方吐增量文本，不做任何缓冲，方便上层尽快切句送 TTS。
 */
import { DemoError } from "./errors.js";
import { joinUrl, readSseJson } from "./sse.js";

export async function* streamChat({ config, messages, signal }) {
  const url = joinUrl(config.deepseek.baseUrl, "/chat/completions");

  // thinking 字段属于新参数，老账号可能不认；400 时自动降级重试一次
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const body = {
      model: config.deepseek.model,
      messages,
      stream: true,
      temperature: config.deepseek.temperature,
      max_tokens: config.deepseek.maxTokens,
    };
    if (attempt === 0) {
      body.thinking = { type: config.deepseek.thinking ? "enabled" : "disabled" };
    }

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.deepseek.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      if (attempt === 0 && response.status === 400 && /thinking/i.test(detail)) continue;
      throw new DemoError("llm_failed", `DeepSeek 返回 ${response.status}：${detail.slice(0, 300)}`);
    }

    let yielded = false;
    for await (const payload of readSseJson(response.body)) {
      if (payload?.error) {
        throw new DemoError("llm_failed", `DeepSeek 错误：${payload.error.message || "unknown"}`);
      }
      const delta = payload?.choices?.[0]?.delta;
      const content = typeof delta?.content === "string" ? delta.content : "";
      if (content) {
        yielded = true;
        yield content;
      }
    }
    if (!yielded) throw new DemoError("llm_empty", "DeepSeek 没有返回内容，请检查模型名与配额");
    return;
  }
}
