export type WorkerJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "retry_wait"
  | "manual_review";

export type AnalysisRecommendation =
  | "APROVADO"
  | "APROVADO_COM_RESSALVA"
  | "NAO_APROVADO"
  | "REVISAO_MANUAL";

export type WorkerEvidence = {
  documentId?: string;
  source: string;
  locator?: string;
  excerpt?: string;
  metadata?: Record<string, unknown>;
};

export type WorkerAnalysisInput = {
  schemaVersion: "1.0";
  queueId: string;
  clientId: string;
  capabilityId: string;
  opportunityId: string;
  triageRunId: string;
  versions: {
    promptMaster: string;
    profile?: string | null;
    playbook?: string | null;
  };
  opportunity: Record<string, unknown>;
  clientProfile: Record<string, unknown>;
  playbook: Record<string, unknown>;
  documents: Array<{
    id: string;
    name: string;
    mimeType?: string | null;
    sha256?: string | null;
    text?: string | null;
    metadata?: Record<string, unknown>;
  }>;
  deterministicContext: Record<string, unknown>;
};

export type WorkerAnalysisOutput = {
  schemaVersion: "1.0";
  recommendation: AnalysisRecommendation;
  summary: string;
  gateResults: Record<string, unknown>;
  evidence: WorkerEvidence[];
  analysisPayload: Record<string, unknown>;
  provider: {
    name: string;
    model: string;
    requestId?: string;
  };
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    estimatedCost?: number;
    currency?: string;
  };
};

export interface AiProvider {
  readonly name: string;
  readonly model: string;
  analyze(input: WorkerAnalysisInput): Promise<WorkerAnalysisOutput>;
}
