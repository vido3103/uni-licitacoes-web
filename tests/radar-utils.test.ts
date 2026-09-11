import assert from "node:assert/strict";
import test from "node:test";

import {
  canStartDetailedAnalysis,
  emptyAdvancedRadarFilters,
  errorMessage,
  toAdvancedRadarRpcParams,
} from "../src/modules/radar/radar-utils.ts";

test("serializa erros estruturados sem produzir [object Object]", () => {
  assert.equal(
    errorMessage({ message: "Falha", details: "Detalhe", code: "P0001" }),
    "Falha · Detalhe · P0001",
  );
  assert.equal(errorMessage({}), "Erro não identificado.");
});

test("normaliza e limita filtros enviados ao RPC", () => {
  const params = toAdvancedRadarRpcParams(
    "client-id",
    {
      ...emptyAdvancedRadarFilters,
      state: "sp",
      agencyCnpj: "12.345.678/0001-90",
      minValue: "10,50",
      excluded: "",
    },
    0,
    500,
  );

  assert.equal(params.p_state, "SP");
  assert.equal(params.p_agency_cnpj, "12345678000190");
  assert.equal(params.p_min_value, 10.5);
  assert.equal(params.p_excluded, null);
  assert.equal(params.p_page, 1);
  assert.equal(params.p_page_size, 100);
});

test("análise detalhada exige triagem aprovada e documento disponível", () => {
  assert.equal(
    canStartDetailedAnalysis({
      triage: { result: "queued_for_ai", match_status: "queued_for_analysis", stages: [] },
      documentCount: 1,
      analysisBusy: false,
      triageBusy: false,
    }),
    true,
  );
  assert.equal(
    canStartDetailedAnalysis({
      triage: { result: "filtered_out", stages: [] },
      documentCount: 1,
      analysisBusy: false,
      triageBusy: false,
    }),
    false,
  );
  assert.equal(
    canStartDetailedAnalysis({
      triage: { result: "queued_for_ai", match_status: "filtered_out", stages: [] },
      documentCount: 1,
      analysisBusy: false,
      triageBusy: false,
    }),
    false,
  );
  assert.equal(
    canStartDetailedAnalysis({
      triage: null,
      documentCount: 1,
      analysisBusy: false,
      triageBusy: false,
    }),
    false,
  );
});
