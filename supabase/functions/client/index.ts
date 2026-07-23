// Model-side actions: browse open slots, see my own bookings, book a
// slot, cancel my own booking. No masters-only checks here — anyone
// with valid initData can call this, which is fine since "model" is
// just "not in the masters table", not a separate identity to protect.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyInitData } from "../_shared/verifyInitData.ts";
import { handleOptions, json } from "../_shared/http.ts";

const BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function logEvent(
  fields: { slot_id?: string; booking_id?: string; actor_telegram_id: number; action: string; details?: unknown },
) {
  await supabase.from("events").insert({ ...fields, actor_role: "model" });
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const { initData, action, payload } = await req.json().catch(() => ({}));
  const user = await verifyInitData(initData, BOT_TOKEN);
  if (!user) return json({ error: "invalid_init_data" }, 401);

  switch (action) {
    case "list": {
      const { data: openSlots, error: openError } = await supabase
        .from("slots")
        .select("*, masters(name)")
        .eq("status", "open")
        .order("starts_at", { ascending: true });
      if (openError) return json({ error: openError.message }, 500);

      const { data: myBookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("*, slots(*)")
        .eq("model_telegram_id", user.id)
        .order("created_at", { ascending: false });
      if (bookingsError) return json({ error: bookingsError.message }, 500);

      return json({ open_slots: openSlots, my_bookings: myBookings });
    }

    case "book_slot": {
      const { slot_id } = payload ?? {};
      if (!slot_id) return json({ error: "slot_id is required" }, 400);

      // Paid slots aren't bookable yet — Stars checkout isn't wired up,
      // so this is rejected server-side, not just hidden in the UI.
      const { data: slotCheck } = await supabase.from("slots").select("is_paid").eq("id", slot_id).maybeSingle();
      if (!slotCheck) return json({ error: "not_found" }, 404);
      if (slotCheck.is_paid) return json({ error: "payment_required" }, 402);

      // Atomic claim: only succeeds if the slot is still open, so two
      // models racing for the same slot can't both win.
      const { data: claimed, error: claimError } = await supabase
        .from("slots")
        .update({ status: "booked" })
        .eq("id", slot_id)
        .eq("status", "open")
        .select()
        .maybeSingle();
      if (claimError) return json({ error: claimError.message }, 500);
      if (!claimed) return json({ error: "slot_no_longer_available" }, 409);

      const { data: booking, error: bookingError } = await supabase
        .from("bookings")
        .insert({
          slot_id,
          model_telegram_id: user.id,
          model_name: [user.first_name, user.last_name].filter(Boolean).join(" ") || user.username,
        })
        .select()
        .single();

      if (bookingError) {
        // Roll back the claim so the slot isn't stuck unbookable.
        await supabase.from("slots").update({ status: "open" }).eq("id", slot_id);
        return json({ error: bookingError.message }, 500);
      }

      await logEvent({ slot_id, booking_id: booking.id, actor_telegram_id: user.id, action: "booking_created" });
      return json({ booking });
    }

    case "cancel_booking": {
      const { booking_id, reason } = payload ?? {};
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, slot_id, status")
        .eq("id", booking_id)
        .eq("model_telegram_id", user.id)
        .maybeSingle();
      if (!booking) return json({ error: "not_found" }, 404);
      if (booking.status !== "confirmed") return json({ error: "booking_not_active" }, 409);

      await supabase.from("bookings").update({
        status: "cancelled_by_model",
        cancel_reason: reason ?? null,
        cancelled_at: new Date().toISOString(),
      }).eq("id", booking_id);
      await supabase.from("slots").update({ status: "open" }).eq("id", booking.slot_id);
      await logEvent({
        slot_id: booking.slot_id,
        booking_id,
        actor_telegram_id: user.id,
        action: "booking_cancelled_by_model",
        details: { reason: reason ?? null },
      });
      return json({ ok: true });
    }

    default:
      return json({ error: "unknown_action" }, 400);
  }
});
