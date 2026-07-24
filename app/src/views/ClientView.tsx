import { useEffect, useState } from "react";
import { getInitData } from "../lib/telegram";
import { Booking, Slot, clientBookSlot, clientCancelBooking, clientConfirmCompleted, clientList } from "../lib/api";
import { payForSlot } from "../lib/payment";

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

  async function handlePay(slot: Slot) {
    setBusy(true);
    setError(null);
    try {
      const status = await payForSlot(initData, slot.id);
      if (status === "paid") await refresh();
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
          {booking.slots?.is_paid && (
            <span className="badge-paid">Оплачено⭐️{booking.slots.price_stars ? ` · ${booking.slots.price_stars}` : ""}</span>
          )}
          {booking.slots && <time>{formatDateTime(booking.slots.starts_at)}</time>}
          {booking.slots?.location && <div className="meta">{booking.slots.location}</div>}
          {booking.status === "confirmed" && booking.slots?.is_paid && (
            booking.client_confirmed_at ? (
              <p className="meta">Вы подтвердили. Ждём подтверждения от мастера — депозит вернётся автоматически.</p>
            ) : new Date(booking.slots.starts_at) <= new Date() ? (
              <button disabled={busy} onClick={() => withBusy(() => clientConfirmCompleted(initData, booking.id))}>
                Подтвердить, что всё прошло
              </button>
            ) : null
          )}
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
          {slot.is_paid && <span className="badge-paid">Платная бронь⭐️{slot.price_stars ? ` · ${slot.price_stars}` : ""}</span>}
          <time>{formatDateTime(slot.starts_at)}</time>
          <div className="meta">
            {slot.duration_minutes} мин
            {slot.location ? ` · ${slot.location}` : ""}
          </div>
          {slot.note && <div className="meta">{slot.note}</div>}
          {slot.is_paid ? (
            <button disabled={busy} onClick={() => handlePay(slot)}>
              Оплатить {slot.price_stars} ⭐
            </button>
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
