import { normalizeGatewayPayload } from './normalize.mjs';

export class AgentGatewayError extends Error {
  constructor(errorClass, { ambiguous = false, status = null, diagnostic = null } = {}) {
    super(diagnostic ? `${errorClass}:${JSON.stringify(diagnostic)}` : errorClass);
    this.name = 'AgentGatewayError';
    this.errorClass = errorClass;
    this.ambiguous = ambiguous;
    this.status = status;
    this.diagnostic = diagnostic;
  }
}

export async function callAgentGateway({ model, instructions, content, maxOutputTokens, timeoutMs }) {
  const key = Deno.env.get('AI_GATEWAY_API_KEY') || Deno.env.get('VERCEL_OIDC_TOKEN');
  if (!key) throw new AgentGatewayError('ai_gateway_auth_missing');
  const controller = new AbortController();
  const timeout = Math.max(1000, Math.min(Number(timeoutMs) || 120000, 120000));
  const maxTokens = Math.max(1, Math.min(Number(maxOutputTokens) || 1024, 4096));
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: instructions },
          { role: 'user', content: typeof content === 'string' ? content : JSON.stringify(content) },
        ],
        stream: false,
        reasoning: { effort: 'low' },
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });
    if (!response.ok) throw new AgentGatewayError(`ai_gateway_http_${response.status}`, { status: response.status });
    const body = await response.json().catch(() => null);
    const text = body?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || !text.trim()) {
      throw new AgentGatewayError('ai_gateway_empty_response', { diagnostic: { requestId: response.headers.get('x-request-id') || body?.id || null } });
    }
    let parsed;
    try {
      parsed = normalizeGatewayPayload(JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()));
    } catch {
      throw new AgentGatewayError('ai_gateway_invalid_response', { diagnostic: { requestId: response.headers.get('x-request-id') || body?.id || null } });
    }
    const metadata = body?.choices?.[0]?.message?.provider_metadata?.gateway ?? null;
    const reportedCost = Number(metadata?.cost ?? metadata?.gatewayCost ?? metadata?.inferenceCost);
    return {
      parsed,
      requestId: response.headers.get('x-request-id') || body?.id || null,
      modelActual: typeof body?.model === 'string' ? body.model : model,
      inputTokens: Number.isFinite(body?.usage?.prompt_tokens) ? body.usage.prompt_tokens : null,
      outputTokens: Number.isFinite(body?.usage?.completion_tokens) ? body.usage.completion_tokens : null,
      totalTokens: Number.isFinite(body?.usage?.total_tokens) ? body.usage.total_tokens : null,
      reportedCostUsd: Number.isFinite(reportedCost) ? reportedCost : null,
      providerMetadata: metadata,
    };
  } catch (error) {
    if (error instanceof AgentGatewayError) throw error;
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new AgentGatewayError('ai_gateway_timeout', { ambiguous: true });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
