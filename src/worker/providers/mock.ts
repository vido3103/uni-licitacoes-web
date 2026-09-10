import type {
  AiProvider,
  WorkerAnalysisInput,
  WorkerAnalysisOutput,
} from "../contracts";

export class MockAiProvider implements AiProvider {
  readonly name = "mock";
  readonly model = "uni-worker-mock-v1";

  async analyze(input: WorkerAnalysisInput): Promise<WorkerAnalysisOutput> {
    if (!input.queueId || !input.clientId || !input.opportunityId) {
      throw new Error("invalid_worker_input");
    }

    const evidence = input.documents.slice(0, 10).map((document) => ({
      documentId: document.id,
      source: document.name,
      locator: document.sha256 ?? undefined,
      metadata: { mock: true },
    }));

    return {
      schemaVersion: "1.0",
      recommendation: "REVISAO_MANUAL",
      summary:
        "Execução simulada do Worker UNI. Nenhuma inferência externa foi realizada; o resultado serve apenas para validar o pipeline técnico.",
      gateResults: {
        worker_contract: "validated",
        external_inference: "not_executed",
        document_count: input.documents.length,
      },
      evidence,
      analysisPayload: {
        mock: true,
        queueId: input.queueId,
        versions: input.versions,
        deterministicContext: input.deterministicContext,
      },
      provider: {
        name: this.name,
        model: this.model,
        requestId: `mock:${input.queueId}`,
      },
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        estimatedCost: 0,
        currency: "BRL",
      },
    };
  }
}
