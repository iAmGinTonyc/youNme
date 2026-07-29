// Model-side actions: browse open slots, see my own bookings, book a
// slot, cancel my own booking. No masters-only checks here — anyone
// with valid initData can call this, which is fine since "model" is
// just "not in the masters table", not a separate identity to protect.
import { createClient } from "npm:@supabase/supabase-js@2";
import { verifyInitData } from "../_shared/verifyInitData.ts";
import { handleOptions, json } from "../_shared/http.ts";
import { finalizeIfBothConfirmed } from "../_shared/finalizeBooking.ts";

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
      const { slot_id } = payload ?? {};

      // Public browsing of open slots is parked for now — every booking
      // is meant to be created and shared as a private link by the
      // master. Left in place (not deleted) in case general discovery
      // comes back later.
      const PUBLIC_SLOTS_ENABLED = false;

      let slots: Record<string, unknown>[] = [];
      if (PUBLIC_SLOTS_ENABLED) {
        const { data: openSlots, error: openError } = await supabase
          .from("slots")
          .select("*, masters(name)")
          .eq("status", "open")
          .eq("is_private", false)
          .order("starts_at", { ascending: true });
        if (openError) return json({ error: openError.message }, 500);
        slots = openSlots ?? [];
      }

      // A private slot is only ever surfaced when its own id is asked
      // for explicitly — i.e. by whoever opened the deep link the
      // master shared. It's excluded from the query above on purpose.
      if (slot_id && !slots.some((s) => s.id === slot_id)) {
        const { data: privateSlot } = await supabase
          .from("slots")
          .select("*, masters(name)")
          .eq("id", slot_id)
          .eq("status", "open")
          .maybeSingle();
        if (privateSlot) slots = [privateSlot, ...slots];
      }

      const { data: myBookings, error: bookingsError } = await supabase
        .from("bookings")
        .select("*, slots(*)")
        .eq("model_telegram_id", user.id)
        .order("created_at", { ascending: false });
      if (bookingsError) return json({ error: bookingsError.message }, 500);

      return json({ open_slots: slots, my_bookings: myBookings });
    }

    case "book_slot": {
      const { slot_id } = payload ?? {};
      if (!slot_id) return json({ error: "slot_id is required" }, 400);

      const { data: slotCheck } = await supabase.from("slots").select("id").eq("id", slot_id).maybeSingle();
      if (!slotCheck) return json({ error: "not_found" }, 404);

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
          model_username: user.username ?? null,
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

    case "confirm_completed": {
      const { booking_id } = payload ?? {};
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, slot_id, status, slots!inner(is_paid, starts_at)")
        .eq("id", booking_id)
        .eq("model_telegram_id", user.id)
        .maybeSingle();
      if (!booking) return json({ error: "not_found" }, 404);
      if (booking.status !== "confirmed") return json({ error: "booking_not_active" }, 409);

      const slotInfo = booking.slots as unknown as { is_paid: boolean; starts_at: string };
      if (!slotInfo.is_paid) return json({ error: "not_a_paid_booking" }, 400);
      if (new Date(slotInfo.starts_at) > new Date()) return json({ error: "too_early" }, 409);

      await supabase.from("bookings").update({ client_confirmed_at: new Date().toISOString() })
        .eq("id", booking_id).is("client_confirmed_at", null);
      await logEvent({ slot_id: booking.slot_id, booking_id, actor_telegram_id: user.id, action: "client_confirmed_completed" });

      await finalizeIfBothConfirmed(supabase, BOT_TOKEN, booking_id, booking.slot_id);
      return json({ ok: true });
    }

    case "cancel_booking": {
      const { booking_id, reason } = payload ?? {};
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, slot_id, status, slots!inner(is_paid)")
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
      // Unlike a master-initiated cancel, the slot does NOT reopen for
      // rebooking automatically — the master decides whether to offer
      // that time again (by creating a new slot), rather than it
      // silently becoming available again right after a client backs out.
      await supabase.from("slots").update({ status: "cancelled" }).eq("id", booking.slot_id);
      await logEvent({
        slot_id: booking.slot_id,
        booking_id,
        actor_telegram_id: user.id,
        action: "booking_cancelled_by_model",
        details: { reason: reason ?? null },
      });

      const slotInfo = booking.slots as unknown as { is_paid: boolean };
      if (slotInfo.is_paid) {
        // Client's own choice to back out — deposit obligation stays in
        // place, same as a no-show. Just make it an explicit, logged
        // fact rather than silence.
        await logEvent({
          slot_id: booking.slot_id,
          booking_id,
          actor_telegram_id: user.id,
          action: "deposit_forfeited_client_cancel",
        });
      }
      return json({ ok: true });
    }

    default:
      return json({ error: "unknown_action" }, 400);
  }
});
