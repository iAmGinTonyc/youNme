// Dev-only sample data so both cabinets can be previewed and designed
// against outside Telegram, without a live backend. Stripped from the
// production bundle: every call site is gated behind import.meta.env.DEV,
// which Vite replaces with `false` and dead-code-eliminates on build.
import type { Booking, Slot } from "./api";

export let mockActive = false;
export function setMockActive(v: boolean) {
  mockActive = v;
}

const MASTER_ID = 1;
const MODEL_ID = 777;
const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

let nextId = 100;
const newId = () => String(nextId++);

let slots: Slot[] = [
  {
    id: "s1", master_id: MASTER_ID, starts_at: inHours(26), duration_minutes: 90,
    location: "Студия на Тверской", note: "Портфолио, вечерний образ", status: "open", is_paid: false, price_stars: null,
    created_at: inHours(-2), bookings: [],
  },
  {
    id: "s2", master_id: MASTER_ID, starts_at: inHours(50), duration_minutes: 60,
    location: "Студия на Тверской", note: null, status: "booked", is_paid: false, price_stars: null, created_at: inHours(-5),
    bookings: [{ id: "b1", slot_id: "s2", model_telegram_id: 222, model_name: "Алина", status: "confirmed", cancel_reason: null, cancelled_at: null, telegram_payment_charge_id: null, master_confirmed_at: null, client_confirmed_at: null, created_at: inHours(-4) }],
  },
  {
    id: "s3", master_id: MASTER_ID, starts_at: inHours(-20), duration_minutes: 60,
    location: null, note: null, status: "completed", is_paid: false, price_stars: null, created_at: inHours(-40),
    bookings: [{ id: "b2", slot_id: "s3", model_telegram_id: 333, model_name: "Мария", status: "completed", cancel_reason: null, cancelled_at: null, telegram_payment_charge_id: null, master_confirmed_at: null, client_confirmed_at: null, created_at: inHours(-39) }],
  },
  {
    id: "s4", master_id: MASTER_ID, starts_at: inHours(-5), duration_minutes: 60,
    location: "Выезд", note: null, status: "cancelled", is_paid: false, price_stars: null, created_at: inHours(-30), bookings: [],
  },
  {
    id: "s5", master_id: MASTER_ID, starts_at: inHours(72), duration_minutes: 120,
    location: "Студия на Тверской", note: "Тестовая съёмка для портфолио", status: "open", is_paid: true, price_stars: 300,
    created_at: inHours(-1), bookings: [],
  },
  {
    id: "s6", master_id: MASTER_ID, starts_at: inHours(-3), duration_minutes: 60,
    location: "Студия на Тверской", note: null, status: "booked", is_paid: true, price_stars: 150,
    created_at: inHours(-30),
    bookings: [{
      id: "b3", slot_id: "s6", model_telegram_id: MODEL_ID, model_name: "Ты", status: "confirmed",
      cancel_reason: null, cancelled_at: null, telegram_payment_charge_id: "mock_charge_1",
      master_confirmed_at: null, client_confirmed_at: null, created_at: inHours(-29),
    }],
  },
];

function withBookings(s: Slot): Slot {
  return { ...s, bookings: slots.find((x) => x.id === s.id)?.bookings ?? [] };
}

function setBookingStatus(bookingId: string, status: Booking["status"], reopenSlot: boolean) {
  slots = slots.map((s) => {
    const hasBooking = s.bookings?.some((b) => b.id === bookingId);
    if (!hasBooking) return s;
    return {
      ...s,
      status: reopenSlot ? "open" : "completed",
      bookings: s.bookings?.map((b) => (b.id === bookingId ? { ...b, status, cancelled_at: new Date().toISOString() } : b)),
    };
  });
}

// Mirrors finalizeIfBothConfirmed on the backend: only flips to
// "completed" (and would refund, in the real backend) once both sides
// have confirmed.
function maybeFinalize(bookingId: string) {
  slots = slots.map((s) => {
    const booking = s.bookings?.find((b) => b.id === bookingId);
    if (!booking || !booking.master_confirmed_at || !booking.client_confirmed_at) return s;
    return {
      ...s,
      status: "completed" as const,
      bookings: s.bookings?.map((b) => (b.id === bookingId ? { ...b, status: "completed" as const } : b)),
    };
  });
}

export const mockIdentity = {
  master: { telegram_id: MASTER_ID, name: "Ты", role: "master" as const },
  model: { telegram_id: MODEL_ID, name: "Ты", role: "model" as const },
};

export const mockApi = {
  async masterList() {
    return { slots: slots.map(withBookings) };
  },
  async masterCreateSlot(payload: {
    starts_at: string; duration_minutes: number; location?: string; note?: string; is_paid?: boolean; price_stars?: number;
  }) {
    const slot: Slot = {
      id: newId(), master_id: MASTER_ID, status: "open", created_at: new Date().toISOString(), bookings: [],
      location: payload.location ?? null, note: payload.note ?? null, is_paid: Boolean(payload.is_paid),
      price_stars: payload.is_paid ? payload.price_stars ?? null : null,
      starts_at: payload.starts_at, duration_minutes: payload.duration_minutes,
    };
    slots = [...slots, slot].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    return { slot };
  },
  async masterCancelSlot(slotId: string) {
    slots = slots.map((s) => (s.id === slotId ? { ...s, status: "cancelled" } : s));
    return { ok: true as const };
  },
  async masterCancelBooking(bookingId: string) {
    setBookingStatus(bookingId, "cancelled_by_master", true);
    return { ok: true as const };
  },
  async masterMarkNoShow(bookingId: string) {
    setBookingStatus(bookingId, "no_show", false);
    return { ok: true as const };
  },
  async masterMarkCompleted(bookingId: string) {
    const slot = slots.find((s) => s.bookings?.some((b) => b.id === bookingId));
    if (!slot?.is_paid) {
      setBookingStatus(bookingId, "completed", false);
      return { ok: true as const };
    }
    slots = slots.map((s) => ({
      ...s,
      bookings: s.bookings?.map((b) =>
        b.id === bookingId ? { ...b, master_confirmed_at: new Date().toISOString() } : b
      ),
    }));
    maybeFinalize(bookingId);
    return { ok: true as const };
  },

  async clientList() {
    const open_slots = slots.filter((s) => s.status === "open").map(withBookings);
    const my_bookings: Booking[] = slots.flatMap((s) =>
      (s.bookings ?? [])
        .filter((b) => b.model_telegram_id === MODEL_ID)
        .map((b) => ({ ...b, slots: s })),
    );
    return { open_slots, my_bookings };
  },
  async clientBookSlot(slotId: string) {
    const slot = slots.find((s) => s.id === slotId);
    if (slot?.is_paid) throw new Error("payment_required");
    const booking: Booking = {
      id: newId(), slot_id: slotId, model_telegram_id: MODEL_ID, model_name: "Ты",
      status: "confirmed", cancel_reason: null, cancelled_at: null, telegram_payment_charge_id: null,
      master_confirmed_at: null, client_confirmed_at: null,
      created_at: new Date().toISOString(),
    };
    slots = slots.map((s) => (s.id === slotId ? { ...s, status: "booked", bookings: [...(s.bookings ?? []), booking] } : s));
    return { booking };
  },
  async clientPaySlot(slotId: string) {
    const booking: Booking = {
      id: newId(), slot_id: slotId, model_telegram_id: MODEL_ID, model_name: "Ты",
      status: "confirmed", cancel_reason: null, cancelled_at: null,
      telegram_payment_charge_id: "mock_charge_" + newId(),
      master_confirmed_at: null, client_confirmed_at: null,
      created_at: new Date().toISOString(),
    };
    slots = slots.map((s) => (s.id === slotId ? { ...s, status: "booked", bookings: [...(s.bookings ?? []), booking] } : s));
    return { booking };
  },
  async clientConfirmCompleted(bookingId: string) {
    slots = slots.map((s) => ({
      ...s,
      bookings: s.bookings?.map((b) =>
        b.id === bookingId ? { ...b, client_confirmed_at: new Date().toISOString() } : b
      ),
    }));
    maybeFinalize(bookingId);
    return { ok: true as const };
  },
  async clientCancelBooking(bookingId: string) {
    setBookingStatus(bookingId, "cancelled_by_model", true);
    return { ok: true as const };
  },
};
