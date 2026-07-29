// Long-form Russian date for user-facing notification text, e.g.
// "31 июля 2026 г., 08:40" — distinct from the frontend's abbreviated
// "31 июл. 2026 г." used in the UI itself.
//
// Explicit timeZone matters here: this runs server-side (Edge Function,
// UTC), whereas the frontend's equivalent formatter runs in the viewer's
// browser and implicitly renders in whatever timezone their device is
// set to. Without pinning one here, a slot stored as 22:30 MSK would
// show as 19:30 in a bot message — three hours off from what the app
// itself displays for the exact same booking.
export function formatRuDateTime(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Moscow",
  });
}
