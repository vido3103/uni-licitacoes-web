function losslessText(value, fallback = '') {
  if (value === null || value === undefined) return fallback;
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  try {
    const serialized = JSON.stringify(value);
    return serialized === undefined ? fallback : serialized;
  } catch {
    return fallback;
  }
}

export function normalizeGatewayPayload(input) {
  const normalized = { ...input };
  for (const key of ['blockers', 'warnings']) {
    const value = input[key];
    normalized[key] = Array.isArray(value)
      ? value.slice(0, 100).map((item) => losslessText(item)).filter((item) => item.length > 0)
      : [];
  }
  const evidence = input.evidence;
  normalized.evidence = Array.isArray(evidence)
    ? evidence.slice(0, 50).map((item) => {
        if (!item || typeof item !== 'object' || Array.isArray(item)) return { source: 'AI', locator: null, finding: losslessText(item) };
        return {
          ...item,
          source: losslessText(item.source, 'AI') || 'AI',
          locator: item.locator === null || item.locator === undefined ? null : losslessText(item.locator),
          finding: losslessText(item.finding ?? item.description ?? item.message ?? item.text ?? item),
        };
      })
    : [];
  return normalized;
}
