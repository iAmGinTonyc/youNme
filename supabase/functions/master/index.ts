// All master-side actions in one function: list own slots, create a
// slot, cancel a slot that has no booking, cancel an active booking,
// and record the terminal outcome of a session (completed / no-show).
//
// Every action re-verifies initData and re-checks that the caller is a
// master AND owns the slot/booking being touched — the frontend's idea
// of "who am I" is never trusted for authorization, only for display.
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
  await supabase.from("events").insert({ ...fields, actor_role: "master" });
}

Deno.serve(async (req) => {
  const optionsResponse = handleOptions(req);
  if (optionsResponse) return optionsResponse;

  const { initData, action, payload } = await req.json().catch(() => ({}));
  const user = await verifyInitData(initData, BOT_TOKEN);
  if (!user) return json({ error: "invalid_init_data" }, 401);

  const { data: master } = await supabase
    .from("masters")
    .select("telegram_id")
    .eq("telegram_id", user.id)
    .maybeSingle();
  if (!master) return json({ error: "not_a_master" }, 403);

  const masterId = master.telegram_id;

  switch (action) {
    case "list": {
      const { data: slots, error } = await supabase
        .from("slots")
        .select("*, bookings(*)")
        .eq("master_id", masterId)
        .order("starts_at", { ascending: true });
      if (error) return json({ error: error.message }, 500);
      return json({ slots });
    }

    case "create_slot": {
      const { starts_at, duration_minutes, location, note, is_paid } = payload ?? {};
      if (!starts_at || !duration_minutes) {
        return json({ error: "starts_at and duration_minutes are required" }, 400);
      }
      const { data: slot, error } = await supabase
        .from("slots")
        .insert({ master_id: masterId, starts_at, duration_minutes, location, note, is_paid: Boolean(is_paid) })
        .select()
        .single();
      if (error) return json({ error: error.message }, 500);
      await logEvent({ slot_id: slot.id, actor_telegram_id: masterId, action: "slot_created" });
      return json({ slot });
    }

    case "cancel_slot": {
      const { slot_id } = payload ?? {};
      const { data: slot } = await supabase
        .from("slots")
        .select("id, status")
        .eq("id", slot_id)
        .eq("master_id", masterId)
        .maybeSingle();
      if (!slot) return json({ error: "not_found" }, 404);
      if (slot.status !== "open") {
        return json({ error: "only an open (unbooked) slot can be cancelled directly" }, 409);
      }
      await supabase.from("slots").update({ status: "cancelled" }).eq("id", slot_id);
      await logEvent({ slot_id, actor_telegram_id: masterId, action: "slot_cancelled" });
      return json({ ok: true });
    }

    case "cancel_booking": {
      const { booking_id, reason } = payload ?? {};
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, slot_id, status, slots!inner(master_id)")
        .eq("id", booking_id)
        .eq("slots.master_id", masterId)
        .maybeSingle();
      if (!booking) return json({ error: "not_found" }, 404);
      if (booking.status !== "confirmed") return json({ error: "booking_not_active" }, 409);

      await supabase.from("bookings").update({
        status: "cancelled_by_master",
        cancel_reason: reason ?? null,
        cancelled_at: new Date().toISOString(),
      }).eq("id", booking_id);
      await supabase.from("slots").update({ status: "open" }).eq("id", booking.slot_id);
      await logEvent({
        slot_id: booking.slot_id,
        booking_id,
        actor_telegram_id: masterId,
        action: "booking_cancelled_by_master",
        details: { reason: reason ?? null },
      });
      return json({ ok: true });
    }

    case "mark_no_show":
    case "mark_completed": {
      const finalStatus = action === "mark_no_show" ? "no_show" : "completed";
      const { booking_id } = payload ?? {};
      const { data: booking } = await supabase
        .from("bookings")
        .select("id, slot_id, status, slots!inner(master_id)")
        .eq("id", booking_id)
        .eq("slots.master_id", masterId)
        .maybeSingle();
      if (!booking) return json({ error: "not_found" }, 404);
      if (booking.status !== "confirmed") return json({ error: "booking_not_active" }, 409);

      await supabase.from("bookings").update({ status: finalStatus }).eq("id", booking_id);
      await supabase.from("slots").update({ status: "completed" }).eq("id", booking.slot_id);
      await logEvent({
        slot_id: booking.slot_id,
        booking_id,
        actor_telegram_id: masterId,
        action: finalStatus === "no_show" ? "booking_marked_no_show" : "booking_marked_completed",
      });
      return json({ ok: true });
    }

    default:
      return json({ error: "unknown_action" }, 400);
  }
});
