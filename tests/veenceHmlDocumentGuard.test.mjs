import assert from 'node:assert/strict';
import test from 'node:test';
import { assessDocumentRead, isEditalFilename, selectTrustedPdfRows } from '../supabase/functions/veence-hml-agent-runner/document-guard.mjs';

test('identifica edital por nome sem depender de acentos ou caixa', () => {
  assert.equal(isEditalFilename('01. EDITAL Pregão 18-2026.pdf'), true);
  assert.equal(isEditalFilename('02. Termo de referência.pdf'), false);
});

test('bloqueia antes da inferência quando edital anexado não existe', () => {
  const selected = selectTrustedPdfRows([{ original_filename: 'TR.pdf', mime_type: 'application/pdf', validation_status: 'available', file_size_bytes: 100, storage_bucket: 'b', storage_path: 'tr.pdf' }]);
  assert.equal(selected.ok, false);
  assert.equal(selected.error, 'mandatory_edital_attachment_missing');
});

test('bloqueia quando edital existe mas não pode ser anexado ao gateway', () => {
  const selected = selectTrustedPdfRows([{ original_filename: 'Edital.pdf', mime_type: 'application/pdf', validation_status: 'available', file_size_bytes: 13 * 1024 * 1024, storage_bucket: 'b', storage_path: 'edital.pdf' }], { maxPdfBytes: 12 * 1024 * 1024 });
  assert.equal(selected.ok, false);
  assert.equal(selected.error, 'mandatory_edital_attachment_not_eligible');
});

test('confirma leitura somente com manifest completo de todos os anexos', () => {
  const expected = ['Edital.pdf', 'TR.pdf'];
  assert.deepEqual(assessDocumentRead({ document_read_complete: true, document_read_manifest: [{ filename: 'Edital.pdf', status: 'complete' }, { filename: 'TR.pdf', status: 'complete' }], document_read_incomplete: [] }, expected), { ok: true, incomplete: [] });
});

test('OCR textual pode falhar sem invalidar leitura visual integral confirmada', () => {
  const assessed = assessDocumentRead({ document_read_complete: true, document_read_manifest: [{ filename: 'Edital.pdf', status: 'complete', read_mode: 'visual' }], document_read_incomplete: [], traceability: { note: 'initial OCR failed for that file; visual page reading completed' } }, ['Edital.pdf']);
  assert.deepEqual(assessed, { ok: true, incomplete: [] });
});

test('falha fechado quando o manifest ou a confirmação integral indicam leitura incompleta', () => {
  const assessed = assessDocumentRead({ document_read_complete: false, document_read_manifest: [{ filename: 'Edital.pdf', status: 'incomplete', reason: 'page_unavailable' }], document_read_incomplete: ['Edital.pdf:page_unavailable'] }, ['Edital.pdf']);
  assert.equal(assessed.ok, false);
  assert.ok(assessed.incomplete.includes('document_read_complete_not_confirmed'));
  assert.ok(assessed.incomplete.includes('Edital.pdf'));
});
