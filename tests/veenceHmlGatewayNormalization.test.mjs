import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeGatewayPayload } from '../supabase/functions/veence-hml-single-shot/normalize.mjs';

test('structured blockers and warnings never collapse to [object Object]', () => {
  const normalized = normalizeGatewayPayload({
    blockers: [{ code: 'DOC-01', message: 'Documento obrigatório ausente', page: 4 }, 'bloqueio textual'],
    warnings: [{ reason: 'Prazo precisa de conferência', severity: 'medium' }],
  });

  assert.deepEqual(normalized.blockers, [
    '{"code":"DOC-01","message":"Documento obrigatório ausente","page":4}',
    'bloqueio textual',
  ]);
  assert.deepEqual(normalized.warnings, [
    '{"reason":"Prazo precisa de conferência","severity":"medium"}',
  ]);
  assert.equal(JSON.stringify(normalized).includes('[object Object]'), false);
});

test('structured evidence is losslessly serialized into scalar fields expected by persistence', () => {
  const normalized = normalizeGatewayPayload({
    evidence: [{
      source: { document: 'Edital.pdf', type: 'edital' },
      locator: { page: 12, section: '4.2' },
      finding: { message: 'Exigência de qualificação técnica', confidence: 0.97 },
      category: 'habilitacao',
    }],
  });

  assert.deepEqual(normalized.evidence, [{
    source: '{"document":"Edital.pdf","type":"edital"}',
    locator: '{"page":12,"section":"4.2"}',
    finding: '{"message":"Exigência de qualificação técnica","confidence":0.97}',
    category: 'habilitacao',
  }]);
});

test('malformed evidence values are normalized without inventing findings', () => {
  const normalized = normalizeGatewayPayload({
    blockers: null,
    warnings: 'not-an-array',
    evidence: [null, 'observação livre'],
  });

  assert.deepEqual(normalized.blockers, []);
  assert.deepEqual(normalized.warnings, []);
  assert.deepEqual(normalized.evidence, [
    { source: 'AI', locator: null, finding: '' },
    { source: 'AI', locator: null, finding: 'observação livre' },
  ]);
});
