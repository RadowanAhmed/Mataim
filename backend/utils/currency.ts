export type CurrencyCode = "UGX";

export const APP_CURRENCY: CurrencyCode = "UGX";
export const DEFAULT_CURRENCY: CurrencyCode = APP_CURRENCY;
export const SUPPORTED_CURRENCIES = [
  {
    code: "UGX",
    label: "Ugandan shilling",
    locale: "en-UG",
  },
] as const;

export function toUGX(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return 0;

  const cleaned =
    typeof value === "number"
      ? value
      : Number(
          String(value)
            .replace(/UGX/gi, "")
            .replace(/AED/gi, "")
            .replace(/[,\s]/g, "")
            .trim(),
        );

  if (!Number.isFinite(cleaned)) return 0;

  const rounded = Math.round(cleaned);

  // Your app prices are stored as thousands:
  // 49 = 49,000 UGX, 6 = 6,000 UGX, 57 = 57,000 UGX
  if (rounded > 0 && rounded < 1000) {
    return rounded * 1000;
  }

  return rounded;
}

export function formatUGX(value?: number | string | null) {
  return `UGX ${toUGX(value).toLocaleString("en-UG")}`;
}

export function formatMoney(value?: number | string | null, currency: CurrencyCode = DEFAULT_CURRENCY) {
  if (currency === "UGX") return formatUGX(value);
  return formatUGX(value);
}
