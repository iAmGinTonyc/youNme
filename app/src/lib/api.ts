const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export type SlotStatus = "open" | "booked" | "cancelled" | "completed";
export type BookingStatus =
  | "confirmed"
  | "cancelled_by_model"
  | "cancelled_by_master"
  | "no_show"
  | "completed";

export interface Booking {
  id: string;
  slot_id: string;
  model_telegram_id: number;
  model_name: string | null;
  status: BookingStatus;
  cancel_reason: string | null;
  cancelled_at: string | null;
  created_at: string;
  slots?: Slot;
}

export interface Slot {
  id: string;
  master_id: number;
  starts_at: string;
  duration_minutes: number;
  location: string | null;
  note: string | null;
  status: SlotStatus;
  created_at: string;
  bookings?: Booking[];
  masters?: { name: string | null };
}

async function callFunction<T>(name: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `request_failed_${res.status}`);
  return data as T;
}

export function verify(initData: string) {
  return callFunction<{ telegram_id: number; name: string; role: "master" | "model" }>("verify", { initData });
}

export function masterList(initData: string) {
  return callFunction<{ slots: Slot[] }>("master", { initData, action: "list" });
}

export function masterCreateSlot(
  initData: string,
  payload: { starts_at: string; duration_minutes: number; location?: string; note?: string },
) {
  return callFunction<{ slot: Slot }>("master", { initData, action: "create_slot", payload });
}

export function masterCancelSlot(initData: string, slot_id: string) {
  return callFunction<{ ok: true }>("master", { initData, action: "cancel_slot", payload: { slot_id } });
}

export function masterCancelBooking(initData: string, booking_id: string, reason?: string) {
  return callFunction<{ ok: true }>("master", { initData, action: "cancel_booking", payload: { booking_id, reason } });
}

export function masterMarkNoShow(initData: string, booking_id: string) {
  return callFunction<{ ok: true }>("master", { initData, action: "mark_no_show", payload: { booking_id } });
}

export function masterMarkCompleted(initData: string, booking_id: string) {
  return callFunction<{ ok: true }>("master", { initData, action: "mark_completed", payload: { booking_id } });
}

export function clientList(initData: string) {
  return callFunction<{ open_slots: Slot[]; my_bookings: Booking[] }>("client", { initData, action: "list" });
}

export function clientBookSlot(initData: string, slot_id: string) {
  return callFunction<{ booking: Booking }>("client", { initData, action: "book_slot", payload: { slot_id } });
}

export function clientCancelBooking(initData: string, booking_id: string, reason?: string) {
  return callFunction<{ ok: true }>("client", { initData, action: "cancel_booking", payload: { booking_id, reason } });
}
