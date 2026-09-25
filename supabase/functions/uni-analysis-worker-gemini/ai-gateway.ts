export type GatewayErrorClass =
  | "ai_gateway_auth_missing"
  | "ai_gateway_timeout"
  | "ai_gateway_rate_limited"
  | `ai_gateway_http_${number}`
  | "ai_gateway_empty_response"
  | "ai_gateway_invalid_response";

export class GatewayError extends Error {
  constructor(
    public readonly errorClass: GatewayErrorClass,
    public readonly retryable: boolean,
    public readonly ambiguous: boolean,
    public readonly status?: number,
  ) {
    super(errorClass);
    this.name = "GatewayError";
  }
}

export type GatewayResult = {
  parsed: Record<string, unknown>;
  requestId: string | null;
  modelRequested: string;
  modelActual: string | null;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  providerMetadata: unknown;
};

const DEFAULT_TIMEOUT_MS = 45_000;
const GATEWAY_URL = "https://ai-gateway.vercel.sh/v1/chat/completions";

function envInt(name: string, fallback: number) {
  const parsed = Number(Deno.env.get(name));
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export function classifyGatewayStatus(status: number): GatewayError {
  if (status === 401 || status === 403) {
    return new GatewayError(`ai_gateway_http_${status}`, false, false, status);
  }
  if (status === 429) {
    return new GatewayError("ai_gateway_rate_limited", true, false, status);
  }
  if (status >= 500) {
    return new GatewayError(`ai_gateway_http_${status}`, true, false, status);
  }
  return new GatewayError(`ai_gateway_http_${status}`, false, false, status);
}

export function gatewayRetryDelaySeconds(error: unknown): number | null {
  if (!(error instanceof GatewayError)) return null;
  // A timeout is ambiguous: the upstream may have processed/billed the request.
  // Do not automatically enqueue another paid inference.
  if (error.ambiguous || !error.retryable) return null;
  if (error.errorClass === "ai_gateway_rate_limited") return 120;
  if (error.status && error.status >= 500) return 60;
  return null;
}

export async function callAiGateway(messages: unknown[]): Promise<GatewayResult> {
  const key = Deno.env.get("AI_GATEWAY_API_KEY") || Deno.env.get("VERCEL_OIDC_TOKEN");
  if (!key) throw new GatewayError("ai_gateway_auth_missing", false, false);

  const model = Deno.env.get("VEENCE_AI_MODEL")?.trim();
  if (!model) throw new GatewayError("ai_gateway_invalid_response", false, false);

  const fallbacks = (Deno.env.get("VEENCE_AI_FALLBACK_MODELS") || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  const timeoutMs = envInt("VEENCE_AI_TIMEOUT_MS", DEFAULT_TIMEOUT_MS);
  const maxTokens = envInt("VEENCE_AI_MAX_OUTPUT_TOKENS", 900);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        ...(fallbacks.length ? { models: fallbacks } : {}),
        messages,
        stream: false,
        temperature: 0.1,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    if (!response.ok) throw classifyGatewayStatus(response.status);
    const body = await response.json().catch(() => null) as any;
    const text = body?.choices?.[0]?.message?.content;
    if (typeof text !== "string" || !text.trim()) {
      throw new GatewayError("ai_gateway_empty_response", false, false);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(text.replace(/^```json\s*/i, "").replace(/```$/i, "").trim());
    } catch {
      throw new GatewayError("ai_gateway_invalid_response", false, false);
    }

    return {
      parsed,
      requestId: response.headers.get("x-request-id") || body?.id || null,
      modelRequested: model,
      modelActual: typeof body?.model === "string" ? body.model : null,
      usage: {
        inputTokens: Number.isFinite(body?.usage?.prompt_tokens) ? body.usage.prompt_tokens : null,
        outputTokens: Number.isFinite(body?.usage?.completion_tokens) ? body.usage.completion_tokens : null,
        totalTokens: Number.isFinite(body?.usage?.total_tokens) ? body.usage.total_tokens : null,
      },
      providerMetadata: body?.choices?.[0]?.message?.provider_metadata?.gateway ?? null,
    };
  } catch (error) {
    if (error instanceof GatewayError) throw error;
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new GatewayError("ai_gateway_timeout", false, true);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
