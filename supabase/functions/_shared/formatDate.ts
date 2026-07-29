// Long-form Russian date for user-facing notification text, e.g.
// "31 июля 2026 г., 08:40" — distinct from the frontend's abbreviated
// "31 июл. 2026 г." used in the UI itself.
export function formatRuDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
