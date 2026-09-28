export function normalizeDocumentName(value) {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function isEditalFilename(value) {
  const name = normalizeDocumentName(value);
  return /(^|[^a-z])edital([^a-z]|$)/.test(name);
}

export function selectTrustedPdfRows(rows, { maxPdfBytes, maxTotalBytes, maxFiles = 5 } = {}) {
  const source = Array.isArray(rows) ? rows : [];
  const pdfLimit = Number(maxPdfBytes) || 12 * 1024 * 1024;
  const totalLimit = Number(maxTotalBytes) || 25 * 1024 * 1024;
  const fileLimit = Math.max(1, Number(maxFiles) || 5);
  const availablePdfs = source.filter((row) => String(row?.mime_type ?? '').toLowerCase() === 'application/pdf' && String(row?.validation_status ?? '') === 'available');
  const editalRows = availablePdfs.filter((row) => isEditalFilename(row?.original_filename));
  if (editalRows.length === 0) return { ok: false, error: 'mandatory_edital_attachment_missing', eligible: [], expectedFilenames: [] };
  const eligible = [];
  let total = 0;
  for (const row of availablePdfs) {
    const size = Number(row?.file_size_bytes ?? 0);
    if (!row?.storage_bucket || !row?.storage_path || size <= 0 || size > pdfLimit) continue;
    if (eligible.length >= fileLimit || total + size > totalLimit) continue;
    total += size;
    eligible.push(row);
  }
  const eligibleEdital = eligible.some((row) => isEditalFilename(row?.original_filename));
  if (!eligibleEdital) return { ok: false, error: 'mandatory_edital_attachment_not_eligible', eligible, expectedFilenames: eligible.map((row) => String(row.original_filename || 'documento.pdf')) };
  return { ok: true, error: null, eligible, expectedFilenames: eligible.map((row) => String(row.original_filename || 'documento.pdf')) };
}

export function assessDocumentRead(result, expectedFilenames = []) {
  if (!result || typeof result !== 'object') return { ok: false, incomplete: ['document_read_confirmation_missing'] };
  const expected = expectedFilenames.map((name) => String(name));
  const incompleteRaw = Array.isArray(result.document_read_incomplete) ? result.document_read_incomplete : [];
  const incomplete = incompleteRaw.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).filter(Boolean);
  if (result.document_read_complete !== true) incomplete.push('document_read_complete_not_confirmed');
  const manifest = Array.isArray(result.document_read_manifest) ? result.document_read_manifest : [];
  for (const filename of expected) {
    const entry = manifest.find((item) => item && typeof item === 'object' && String(item.filename ?? '') === filename);
    if (!entry || entry.status !== 'complete') incomplete.push(filename);
  }
  return { ok: incomplete.length === 0, incomplete: [...new Set(incomplete)].slice(0, 20) };
}
