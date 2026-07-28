import { Fragment, FormEvent, useEffect, useState } from "react";
import { getInitData, shareToTelegram } from "../lib/telegram";
import DateTimePicker from "../components/DateTimePicker";
import DurationPicker from "../components/DurationPicker";
import SwipeToArchive from "../components/SwipeToArchive";
import {
  Slot,
  masterArchiveSlot,
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

const BOOKING_STATUS_LABEL: Record<string, string> = {
  confirmed: "подтверждено",
  cancelled_by_model: "отменено клиентом",
  cancelled_by_master: "отменено вами",
  no_show: "неявка",
  completed: "завершено",
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
}

// Update if the bot is ever renamed in BotFather.
const BOT_USERNAME = "youNme_service_bot";
function slotShareLink(slotId: string) {
  return `https://t.me/${BOT_USERNAME}?start=slot_${slotId}`;
}

// Every slot is link-only for now — the "Личная запись" choice is parked,
// not removed, in case general public discovery comes back later.
const PUBLIC_SLOTS_ENABLED = false;

export default function MasterView({ identity }: { identity: { name: string } }) {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startsAt, setStartsAt] = useState("");
  const [duration, setDuration] = useState(60);
  const [location, setLocation] = useState("");
  const [note, setNote] = useState("");
  const [depositStars, setDepositStars] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newSlotId, setNewSlotId] = useState<string | null>(null);

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
    const deposit = Math.max(0, Number(depositStars) || 0);
    withBusy(async () => {
      const { slot } = await masterCreateSlot(initData, {
        starts_at: new Date(startsAt).toISOString(),
        duration_minutes: duration,
        location: location || undefined,
        note: note || undefined,
        is_paid: deposit > 0,
        price_stars: deposit > 0 ? deposit : undefined,
        is_private: PUBLIC_SLOTS_ENABLED ? isPrivate : true,
      });
      setStartsAt("");
      setLocation("");
      setNote("");
      setDepositStars("");
      setNewSlotId(slot.id);
    });
  }

  async function handleCopyLink(slotId: string) {
    const link = slotShareLink(slotId);
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(slotId);
      setTimeout(() => setCopiedId((c) => (c === slotId ? null : c)), 1500);
    } catch {
      setError(`Не удалось скопировать автоматически — вот ссылка: ${link}`);
    }
  }

  return (
    <div>
      <h1>Привет, {identity.name}</h1>

      <h2>Новая запись</h2>
      <form className="card" onSubmit={handleCreateSlot}>
        <DateTimePicker value={startsAt} onChange={setStartsAt} />
        <DurationPicker value={duration} onChange={setDuration} />
        <input
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Место (необязательно)"
        />
        <input
          type="number"
          min={0}
          value={depositStars}
          onChange={(e) => setDepositStars(e.target.value)}
          placeholder="Депозит (необязательно)"
        />
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Примечание (необязательно)"
          rows={2}
        />
        {PUBLIC_SLOTS_ENABLED && (
          <label className="checkbox-row">
            <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
            Личная запись (только по ссылке)
          </label>
        )}
        <button type="submit" disabled={busy}>Подтвердить</button>
      </form>

      {error && <p className="error">{error}</p>}

      {newSlotId && (
        <div className="modal-overlay" onClick={() => setNewSlotId(null)}>
          <div className="modal-card card" onClick={(e) => e.stopPropagation()}>
            <h2>Запись создана</h2>
            <p>Отправьте эту ссылку модели — по ней откроется именно эта запись.</p>
            <div className="link-row">
              <input readOnly value={slotShareLink(newSlotId)} onFocus={(e) => e.target.select()} />
            </div>
            <div className="modal-actions">
              <button type="button" onClick={() => handleCopyLink(newSlotId)}>
                {copiedId === newSlotId ? "Скопировано" : "Копировать"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => shareToTelegram(slotShareLink(newSlotId), "Запись у мастера")}
              >
                Отправить в Telegram
              </button>
            </div>
            <button type="button" className="secondary" onClick={() => setNewSlotId(null)}>
              Закрыть
            </button>
          </div>
        </div>
      )}

      <h2>Мои слоты</h2>
      {slots.length === 0 && <p>Пока нет слотов.</p>}
      {slots.map((slot) => {
        const activeBooking = slot.bookings?.find((b) => b.status === "confirmed");
        const pastBooking = slot.bookings?.find((b) => b.status !== "confirmed");
        const card = (
          <div className="card">
            <span className="status">{STATUS_LABEL[slot.status]}</span>
            {slot.is_private && <span className="badge-private">Личная запись</span>}
            {slot.is_paid && <span className="badge-paid">Депозит{slot.price_stars ? ` · ${slot.price_stars}` : ""}</span>}
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
                {pastBooking.model_name ?? pastBooking.model_telegram_id} — {BOOKING_STATUS_LABEL[pastBooking.status] ?? pastBooking.status}
                {pastBooking.cancel_reason ? `: ${pastBooking.cancel_reason}` : ""}
              </div>
            )}
            {pastBooking?.status === "no_show" && slot.is_paid && (
              <div className="meta">Депозит удержан{slot.price_stars ? ` · ${slot.price_stars}` : ""}</div>
            )}

            {slot.status === "open" && slot.is_private && (
              <div className="link-row">
                <input readOnly value={slotShareLink(slot.id)} onFocus={(e) => e.target.select()} />
                <button type="button" className="secondary" onClick={() => handleCopyLink(slot.id)}>
                  {copiedId === slot.id ? "Скопировано" : "Копировать"}
                </button>
              </div>
            )}
            {slot.status === "open" && (
              <button className="secondary" disabled={busy} onClick={() => withBusy(() => masterCancelSlot(initData, slot.id))}>
                Отменить слот
              </button>
            )}
            {slot.status === "booked" && activeBooking && (
              <>
                {slot.is_paid && activeBooking.master_confirmed_at ? (
                  <p className="meta">Вы подтвердили. Ждём подтверждения от клиента — депозит вернётся автоматически.</p>
                ) : (
                  <button disabled={busy} onClick={() => withBusy(() => masterMarkCompleted(initData, activeBooking.id))}>
                    Состоялось
                  </button>
                )}
                <button className="secondary" disabled={busy} onClick={() => withBusy(() => masterMarkNoShow(initData, activeBooking.id))}>
                  Не пришли
                </button>
                {slot.is_paid && <p className="meta">При отмене вами депозит вернётся клиенту.</p>}
                <button className="secondary" disabled={busy} onClick={() => withBusy(() => masterCancelBooking(initData, activeBooking.id))}>
                  Отменить бронь
                </button>
              </>
            )}
          </div>
        );

        if (slot.status === "cancelled") {
          return (
            <SwipeToArchive key={slot.id} disabled={busy} onArchive={() => withBusy(() => masterArchiveSlot(initData, slot.id))}>
              {card}
            </SwipeToArchive>
          );
        }
        return <Fragment key={slot.id}>{card}</Fragment>;
      })}
    </div>
  );
}
