// Shared by the master and client functions: whichever side confirms
// second is the one that actually triggers this. The deposit only ever
// moves once — the WHERE clause (status still 'confirmed') makes the
// completion itself the race guard, same pattern as claiming a slot.
import { callTelegramApi } from "./telegram.ts";

// deno-lint-ignore no-explicit-any
export async function finalizeIfBothConfirmed(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  botToken: string,
  bookingId: string,
  slotId: string,
) {
  const { data: finalized } = await supabase
    .from("bookings")
    .update({ status: "completed" })
    .eq("id", bookingId)
    .eq("status", "confirmed")
    .not("master_confirmed_at", "is", null)
    .not("client_confirmed_at", "is", null)
    .select()
    .maybeSingle();

  if (!finalized) return;

  await supabase.from("slots").update({ status: "completed" }).eq("id", slotId);

  if (finalized.telegram_payment_charge_id) {
    await callTelegramApi(botToken, "refundStarPayment", {
      user_id: finalized.model_telegram_id,
      telegram_payment_charge_id: finalized.telegram_payment_charge_id,
    }).catch(() => {});
    await callTelegramApi(botToken, "sendMessage", {
      chat_id: finalized.model_telegram_id,
      text: "Обе стороны подтвердили, что запись состоялась — депозит возвращён ⭐",
    }).catch(() => {});
  }

  await supabase.from("events").insert({
    slot_id: slotId,
    booking_id: bookingId,
    actor_telegram_id: finalized.model_telegram_id,
    actor_role: "system",
    action: "deposit_refunded",
  });
}
