export const VEENCE_ADMIN_PERCENT = 4;
export const VEENCE_PRODUCT_TAX_PERCENT = 4;
export const VEENCE_TARGET_MARKUP_PERCENT = 30;
export const VEENCE_MIN_MARKUP_PERCENT = 25;
export const VEENCE_PROVISIONAL_FREIGHT_PERCENT = 15;

export type VeenceEconomicInput = {
  unitCost: number;
  freightCost?: number | null;
  markupPercent?: number;
  adminPercent?: number;
  taxPercent?: number;
};

export type VeenceEconomicResult = {
  unitCost: number;
  freightCost: number;
  provisionalFreight: boolean;
  adminPercent: number;
  taxPercent: number;
  markupPercent: number;
  finalUnitCost: number;
  suggestedUnitPrice: number;
};

export function calculateVeenceEconomic(input: VeenceEconomicInput): VeenceEconomicResult {
  const unitCost = Number(input.unitCost);
  if (!Number.isFinite(unitCost) || unitCost < 0) throw new Error("Custo unitário inválido.");

  const rawFreight = Number(input.freightCost ?? 0);
  const provisionalFreight = !Number.isFinite(rawFreight) || rawFreight <= 0;
  const freightCost = provisionalFreight
    ? unitCost * (VEENCE_PROVISIONAL_FREIGHT_PERCENT / 100)
    : rawFreight;

  const adminPercent = Number.isFinite(Number(input.adminPercent))
    ? Number(input.adminPercent)
    : VEENCE_ADMIN_PERCENT;
  const taxPercent = Number.isFinite(Number(input.taxPercent))
    ? Number(input.taxPercent)
    : VEENCE_PRODUCT_TAX_PERCENT;
  const markupPercent = Number.isFinite(Number(input.markupPercent))
    ? Number(input.markupPercent)
    : VEENCE_TARGET_MARKUP_PERCENT;

  if (markupPercent < VEENCE_MIN_MARKUP_PERCENT) throw new Error("Markup abaixo do piso Veence de 25%.");
  if (taxPercent < 0 || taxPercent >= 100) throw new Error("Alíquota de imposto inválida.");
  if (adminPercent < 0) throw new Error("Taxa de administração inválida.");

  const finalUnitCost = (unitCost + freightCost) * (1 + adminPercent / 100);
  const priceBeforeOutputFreight = finalUnitCost * (1 + markupPercent / 100) / (1 - taxPercent / 100);
  const suggestedUnitPrice = provisionalFreight
    ? priceBeforeOutputFreight * (1 + VEENCE_PROVISIONAL_FREIGHT_PERCENT / 100)
    : priceBeforeOutputFreight;

  return {
    unitCost,
    freightCost,
    provisionalFreight,
    adminPercent,
    taxPercent,
    markupPercent,
    finalUnitCost,
    suggestedUnitPrice,
  };
}
