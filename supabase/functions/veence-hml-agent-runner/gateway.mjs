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

function compactInstruction(instructions) {
  return `${instructions}\n\nProduza JSON compacto e objetivo. Evite repetir o contexto de entrada; registre apenas conclusões, evidências necessárias, incertezas, bloqueios e próximos passos do seu papel. Não repita pendências pertencentes a outros agentes salvo quando forem dependência direta do seu próprio resultado.`;
}

function responseOutputText(body) {
  if (typeof body?.output_text === 'string' && body.output_text.trim()) return body.output_text;
  const parts = [];
  for (const item of Array.isArray(body?.output) ? body.output : []) {
    if (item?.type !== 'message') continue;
    for (const content of Array.isArray(item?.content) ? item.content : []) {
      if (content?.type === 'output_text' && typeof content.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('');
}

function gatewayMetadata(body) {
  return body?.provider_metadata?.gateway
    ?? body?.providerMetadata?.gateway
    ?? body?.choices?.[0]?.message?.provider_metadata?.gateway
    ?? null;
}

function pdfDetail(file) {
  const filename = String(file?.filename ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return /(^|[^a-z])edital([^a-z]|$)/.test(filename) ? 'high' : 'low';
}

export async function callAgentGateway({ model, instructions, content, files = [], maxOutputTokens, timeoutMs }) {
  const key = Deno.env.get('AI_GATEWAY_API_KEY') || Deno.env.get('VERCEL_OIDC_TOKEN');
  if (!key) throw new AgentGatewayError('ai_gateway_auth_missing');
  const controller = new AbortController();
  const timeout = Math.max(1000, Math.min(Number(timeoutMs) || 120000, 120000));
  const requestedTokens = Number(maxOutputTokens);
  const maxTokens = Math.max(1024, Math.min(Number.isFinite(requestedTokens) ? requestedTokens : 4096, 4096));
  const timer = setTimeout(() => controller.abort(), timeout);
  const normalizedFiles = Array.isArray(files)
    ? files.filter((file) => file && typeof file.url === 'string' && /^https:\/\//i.test(file.url) && file.mimeType === 'application/pdf').slice(0, 5)
    : [];
  const useResponses = normalizedFiles.length > 0;
  try {
    const textContent = typeof content === 'string' ? content : JSON.stringify(content);
    const endpoint = useResponses
      ? 'https://ai-gateway.vercel.sh/v1/responses'
      : 'https://ai-gateway.vercel.sh/v1/chat/completions';
    const requestBody = useResponses
      ? {
          model,
          instructions: compactInstruction(instructions),
          input: [{
            role: 'user',
            content: [
              { type: 'input_text', text: textContent },
              ...normalizedFiles.map((file) => ({ type: 'input_file', file_url: file.url, detail: pdfDetail(file) })),
            ],
          }],
          stream: false,
          store: false,
          reasoning: { effort: 'low' },
          max_output_tokens: maxTokens,
          text: { format: { type: 'json_object' } },
        }
      : {
          model,
          messages: [
            { role: 'system', content: compactInstruction(instructions) },
            { role: 'user', content: textContent },
          ],
          stream: false,
          reasoning: { effort: 'low' },
          max_tokens: maxTokens,
          response_format: { type: 'json_object' },
        };
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
    if (!response.ok) throw new AgentGatewayError(`ai_gateway_http_${response.status}`, { status: response.status });
    const body = await response.json().catch(() => null);
    const text = useResponses ? responseOutputText(body) : body?.choices?.[0]?.message?.content;
    const diagnostic = {
      requestId: response.headers.get('x-request-id') || body?.id || null,
      modelActual: typeof body?.model === 'string' ? body.model : null,
      finishReason: useResponses ? (body?.incomplete_details?.reason ?? body?.status ?? null) : (body?.choices?.[0]?.finish_reason ?? null),
      promptTokens: Number.isFinite(body?.usage?.input_tokens) ? body.usage.input_tokens : (Number.isFinite(body?.usage?.prompt_tokens) ? body.usage.prompt_tokens : null),
      completionTokens: Number.isFinite(body?.usage?.output_tokens) ? body.usage.output_tokens : (Number.isFinite(body?.usage?.completion_tokens) ? body.usage.completion_tokens : null),
      reasoningTokens: Number.isFinite(body?.usage?.output_tokens_details?.reasoning_tokens)
        ? body.usage.output_tokens_details.reasoning_tokens
        : (Number.isFinite(body?.usage?.completion_tokens_details?.reasoning_tokens) ? body.usage.completion_tokens_details.reasoning_tokens : null),
      maxOutputTokens: maxTokens,
      transport: useResponses ? 'responses_file_input' : 'chat_completions',
      attachedPdfCount: normalizedFiles.length,
      pdfDetails: normalizedFiles.map((file) => ({ filename: file.filename ?? null, detail: pdfDetail(file) })),
    };
    if (typeof text !== 'string' || !text.trim()) {
      throw new AgentGatewayError('ai_gateway_empty_response', { diagnostic });
    }
    let parsed;
    try {
      parsed = normalizeGatewayPayload(JSON.parse(text.replace(/^```json\s*/i, '').replace(/```$/i, '').trim()));
    } catch {
      throw new AgentGatewayError('ai_gateway_invalid_response', { diagnostic });
    }
    const metadata = gatewayMetadata(body);
    const reportedCost = Number(metadata?.cost ?? metadata?.gatewayCost ?? metadata?.inferenceCost);
    const inputTokens = Number.isFinite(body?.usage?.input_tokens) ? body.usage.input_tokens : (Number.isFinite(body?.usage?.prompt_tokens) ? body.usage.prompt_tokens : null);
    const outputTokens = Number.isFinite(body?.usage?.output_tokens) ? body.usage.output_tokens : (Number.isFinite(body?.usage?.completion_tokens) ? body.usage.completion_tokens : null);
    return {
      parsed,
      requestId: response.headers.get('x-request-id') || body?.id || null,
      modelActual: typeof body?.model === 'string' ? body.model : model,
      inputTokens,
      outputTokens,
      totalTokens: Number.isFinite(body?.usage?.total_tokens) ? body.usage.total_tokens : null,
      reportedCostUsd: Number.isFinite(reportedCost) ? reportedCost : null,
      providerMetadata: metadata,
      transport: diagnostic.transport,
      attachedPdfCount: normalizedFiles.length,
      pdfDetails: diagnostic.pdfDetails,
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
