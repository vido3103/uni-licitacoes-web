# VEENCE-HML: PE 18/2026 fixture manifest

Only project `tabuualydbcqnsdsgega` (VEENCE-HML). Production project `oaakuckvzxeekyqmvsza` was not changed.

- Queue: `484a62e7-05ca-4c55-9d30-f657f136b1b5`; opportunity: `0ba06560-da03-4f87-815d-5f04c917680b`; client: `6644432d-fa86-45f1-ae0b-b3bca39e1092`; single-shot test: `656a36ff-54c5-4d4b-b137-002019d03657`.
- Queue starts `pending`, `attempt_count=0`, `max_attempts=1`. The test ID is configured only in HML.
- Buyer: 1º Batalhão de Engenharia de Construção, UASG 160339. Object: Aquisição de Pneus e Baterias.
- The controlled test scope selects item 67, battery 150 Ah, quantity ceiling 15, R$ 980.00 per unit and R$ 14,700.00 total, as printed in Termo de Referência 18/2026. Selection here does not assert eligibility. The complete administrative process number was truncated in the available PDF and remains null.
- The independent HML copies comprise only Luvi client identity, the official versioned Luvi profile v1.0, Playbook Luvi v1.2, and canonical Prompt Mestre Veence v1.17. No production queue, opportunity or document row was copied. The profile, playbook and prompt contents were copied as selective snapshot values from versioned production rows without copying credentials. The actual fixture opportunity and item were reconstructed from the three source PDFs below. The SQL data migration in HML is `hml_pe18_independent_fixture`.
- Private Storage bucket: `veence-hml-pe18`. The source PDFs are separate HML uploads with ASCII storage names:
  - `edital-pe18-2026.pdf` SHA256 `484dba2971e93c5a5e5b34676bb49cc4e90509a7c5a1544b77331b738e027c0f`
  - `tr-pe18-2026.pdf` SHA256 `02bf960ada2e100c005af93cf4b253ecb8cbb3d8c76b436f38c7d665817ac083`
  - `etp-pe18-2026.pdf` SHA256 `642833ad8058c1fc79b25cc9b9fba50ef6b036a15b9e1ee8e30541b76faf68f0`
- No provider call was made. `VEENCE_AI_ENABLED=false` throughout setup; the gate returns HTTP 503 `ai_disabled` even with an accepted project JWT.
