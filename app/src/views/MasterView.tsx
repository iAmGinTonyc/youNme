import { FormEvent, useEffect, useState } from "react";
import { getInitData } from "../lib/telegram";
import DateTimePicker from "../components/DateTimePicker";
import {
  Slot,
  masterCancelBooking,
  masterCancelSlot,
  masterCreateSlot,
  masterList,
  masterMarkCompleted,
  masterMarkNoShow,
} from "../lib/api";

const STATUS_LABEL: Record<string, string> = {
  open: "свободно",
  booked: "забронировано",
  cancelled: "отменено",
  completed: "завершено",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

export default function MasterView({ identity }: { identity: { name: string } }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");

  const initData = getInitData();

  async function refresh() {
    const { slots } = await masterList(initData);
    setSlots(slots);
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

  function handleCreateSlot(e: FormEvent) {
    e.preventDefault();
    if (!startsAt) return;
    withBusy(async () => {
      await masterCreateSlot(initData, {
        starts_at: new Date(startsAt).toISOString(),
        duration_minutes: duration,
        location: location || undefined,
        note: note || undefined,
      });
      setStartsAt("");
      setLocation("");
      setNote("");
    });
  }

  return (
    <div>
      <h1>Привет, {identity.name}</h1>

      <h2>Новый слот</h2>
      <form className="card" onSubmit={handleCreateSlot}>
        <DateTimePicker value={startsAt} onChange={setStartsAt} />
        <input
          type="number"
          min={15}
          step={15}
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          placeholder="Длительность, мин"
          required
        />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Место (необязательно)"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Заметка (необязательно)"
          rows={2}
        />
        <button type="submit" disabled={busy}>Создать слот</button>
      </form>

      {error && <p className="error">{error}</p>}

      <h2>Мои слоты</h2>
      {slots.length === 0 && <p>Пока нет слотов.</p>}
      {slots.map((slot) => {
        const activeBooking = slot.bookings?.find((b) => b.status === "confirmed");
        const pastBooking = slot.bookings?.find((b) => b.status !== "confirmed");
        return (
          <div className="card" key={slot.id}>
            <span className="status">{STATUS_LABEL[slot.status]}</span>
            <time>{formatDateTime(slot.starts_at)}</time>
            <div className="meta">
              {slot.duration_minutes} мин
              {slot.location ? ` · ${slot.location}` : ""}
            </div>
            {slot.note && <div className="meta">{slot.note}</div>}

            {activeBooking && (
              <div className="meta">Забронировала: {activeBooking.model_name ?? activeBooking.model_telegram_id}</div>
            )}
            {pastBooking && (
              <div className="meta">
                {pastBooking.model_name ?? pastBooking.model_telegram_id} — {STATUS_LABEL[pastBooking.status] ?? pastBooking.status}
                {pastBooking.cancel_reason ? `: ${pastBooking.cancel_reason}` : ""}
              </div>
            )}

            {slot.status === "open" && (
              <button className="secondary" disabled={busy} onClick={() => withBusy(() => masterCancelSlot(initData, slot.id))}>
                Отменить слот
              </button>
            )}
            {slot.status === "booked" && activeBooking && (
              <>
                <button disabled={busy} onClick={() => withBusy(() => masterMarkCompleted(initData, activeBooking.id))}>
                  Состоялось
                </button>
                <button className="secondary" disabled={busy} onClick={() => withBusy(() => masterMarkNoShow(initData, activeBooking.id))}>
                  Не пришли
                </button>
                <button className="secondary" disabled={busy} onClick={() => withBusy(() => masterCancelBooking(initData, activeBooking.id))}>
                  Отменить бронь
                </button>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
