import { useEffect, useState } from "react";
import { getInitData } from "../lib/telegram";
import { Booking, Slot, clientBookSlot, clientCancelBooking, clientList } from "../lib/api";

const STATUS_LABEL: Record<string, string> = {
  confirmed: "подтверждено",
  cancelled_by_model: "отменено вами",
  cancelled_by_master: "отменено мастером",
  no_show: "неявка",
  completed: "завершено",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

export default function ClientView({ identity }: { identity: { name: string } }) {
  const [openSlots, setOpenSlots] = useState<Slot[]>([]);
  const [myBookings, setMyBookings] = useState<Booking[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initData = getInitData();

  async function refresh() {
    const { open_slots, my_bookings } = await clientList(initData);
    setOpenSlots(open_slots);
    setMyBookings(my_bookings);
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  async function withBusy(fn: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <h1>Привет, {identity.name}</h1>

      {error && <p className="error">{error}</p>}

      <h2>Мои брони</h2>
      {myBookings.length === 0 && <p>Пока нет броней.</p>}
      {myBookings.map((booking) => (
        <div className="card" key={booking.id}>
          <span className="status">{STATUS_LABEL[booking.status] ?? booking.status}</span>
          {booking.slots && <time>{formatDateTime(booking.slots.starts_at)}</time>}
          {booking.slots?.location && <div className="meta">{booking.slots.location}</div>}
          {booking.status === "confirmed" && (
            <button className="secondary" disabled={busy} onClick={() => withBusy(() => clientCancelBooking(initData, booking.id))}>
              Отменить бронь
            </button>
          )}
        </div>
      ))}

      <h2>Свободные слоты</h2>
      {openSlots.length === 0 && <p>Пока нет свободных слотов.</p>}
      {openSlots.map((slot) => (
        <div className="card" key={slot.id}>
          {slot.is_paid && <span className="badge-paid">Платно</span>}
          <time>{formatDateTime(slot.starts_at)}</time>
          <div className="meta">
            {slot.duration_minutes} мин
            {slot.location ? ` · ${slot.location}` : ""}
          </div>
          {slot.note && <div className="meta">{slot.note}</div>}
          {slot.is_paid ? (
            <>
              <p className="meta">Оплата звёздами скоро будет доступна — пока бронь недоступна.</p>
              <button disabled>Забронировать</button>
            </>
          ) : (
            <button disabled={busy} onClick={() => withBusy(() => clientBookSlot(initData, slot.id))}>
              Забронировать
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
