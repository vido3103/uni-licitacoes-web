export type TriageSnapshot = {
  result: string;
  stages: Array<{ stage?: string; result?: string }>;
  created_at?: string;
  match_status?: string;
  deterministic_score?: number | null;
  deterministic_reasons?: unknown;
  participation_allowed?: boolean;
};

export type AdvancedRadarFilters = {
  query: string;
  processNumber: string;
  buyerName: string;
  city: string;
  state: string;
  source: string;
  lifecycle: string;
  participation: string;
  minValue: string;
  maxValue: string;
  publicationStart: string;
  publicationEnd: string;
  modalityCode: string;
  uasg: string;
  agencyCode: string;
  agencyCnpj: string;
  ibgeCode: string;
  pncpUpdatedAfter: string;
  legalBasisCode: string;
  excluded: string;
};

export const emptyAdvancedRadarFilters: AdvancedRadarFilters = {
  query: "",
  processNumber: "",
  buyerName: "",
  city: "",
  state: "",
  source: "",
  lifecycle: "",
  participation: "",
  minValue: "",
  maxValue: "",
  publicationStart: "",
  publicationEnd: "",
  modalityCode: "",
  uasg: "",
  agencyCode: "",
  agencyCnpj: "",
  ibgeCode: "",
  pncpUpdatedAfter: "",
  legalBasisCode: "",
  excluded: "false",
};

function compact(value: string) {
  const normalized = value.trim();
  return normalized === "" ? null : normalized;
}

function numeric(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function toAdvancedRadarRpcParams(
  clientId: string,
  filters: AdvancedRadarFilters,
  page: number,
  pageSize = 50,
) {
  return {
    p_client_id: clientId,
    p_query: compact(filters.query),
    p_process_number: compact(filters.processNumber),
    p_buyer_name: compact(filters.buyerName),
    p_city: compact(filters.city),
    p_state: compact(filters.state)?.toUpperCase() ?? null,
    p_source_code: compact(filters.source),
    p_lifecycle: compact(filters.lifecycle),
    p_participation_allowed:
      filters.participation === "released"
        ? true
        : filters.participation === "blocked"
          ? false
          : null,
    p_min_value: numeric(filters.minValue),
    p_max_value: numeric(filters.maxValue),
    p_publication_start: compact(filters.publicationStart),
    p_publication_end: compact(filters.publicationEnd),
    p_modality_code: numeric(filters.modalityCode),
    p_uasg: compact(filters.uasg),
    p_agency_code: numeric(filters.agencyCode),
    p_agency_cnpj: compact(filters.agencyCnpj)?.replace(/\D/g, "") ?? null,
    p_ibge_code: numeric(filters.ibgeCode),
    p_pncp_updated_after: compact(filters.pncpUpdatedAfter),
    p_legal_basis_code: numeric(filters.legalBasisCode),
    p_excluded:
      filters.excluded === "true"
        ? true
        : filters.excluded === "false"
          ? false
          : null,
    p_page: Math.max(1, Math.trunc(page)),
    p_page_size: Math.min(100, Math.max(1, Math.trunc(pageSize))),
  };
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (error === null || error === undefined) return "Erro não identificado.";
  if (typeof error !== "object") return String(error);

  const record = error as Record<string, unknown>;
  const parts = [record.message, record.details, record.hint, record.code, record.context]
    .filter((value) => value !== null && value !== undefined && value !== "")
    .map(String);
  if (parts.length > 0) return parts.join(" · ");

  try {
    const serialized = JSON.stringify(error);
    return serialized === "{}" ? "Erro não identificado." : serialized;
  } catch {
    return "Erro não identificado.";
  }
}

export function canStartDetailedAnalysis(input: {
  triage: TriageSnapshot | null;
  documentCount: number;
  analysisBusy: boolean;
  triageBusy: boolean;
}) {
  return (
    input.triage?.result === "queued_for_ai" &&
    input.triage.match_status === "queued_for_analysis" &&
    input.documentCount > 0 &&
    !input.analysisBusy &&
    !input.triageBusy
  );
}
