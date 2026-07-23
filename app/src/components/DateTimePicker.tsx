import { useEffect, useRef, useState } from "react";
import ChipScroller from "./ChipScroller";

const MONTHS = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const HOURS = Array.from({ length: 24 }, (_, h) => h);
const MINUTE_STEPS = [0, 15, 30, 45];

const pad = (n: number) => String(n).padStart(2, "0");

function toLocalIso(date: Date, hour: number, minute: number) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(hour)}:${pad(minute)}`;
}

function parseValue(value: string) {
  if (!value) return { date: null as Date | null, hour: 12, minute: 0 };
  const [datePart, timePart] = value.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [h, mi] = (timePart ?? "12:00").split(":").map(Number);
  return { date: new Date(y, m - 1, d), hour: h, minute: mi };
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default function DateTimePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseValue(value);
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(parsed.date ?? new Date());
  const [hour, setHour] = useState(parsed.hour);
  const [minute, setMinute] = useState(parsed.minute);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const selected = parsed.date;

  function pickDay(day: Date) {
    onChange(toLocalIso(day, hour, minute));
    setViewDate(day);
  }

  function changeHour(h: number) {
    setHour(h);
    if (selected) onChange(toLocalIso(selected, h, minute));
  }

  function changeMinute(mi: number) {
    setMinute(mi);
    if (selected) onChange(toLocalIso(selected, hour, mi));
  }

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = (firstOfMonth.getDay() + 6) % 7; // Monday-first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const cells: { date: Date; outside: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) {
    cells.push({ date: new Date(year, month - 1, daysInPrevMonth - startWeekday + 1 + i), outside: true });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ date: new Date(year, month, d), outside: false });
  }
  while (cells.length < 42) {
    const last = cells[cells.length - 1].date;
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), outside: true });
  }

  const today = new Date();
  const label = selected
    ? `${selected.toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}, ${pad(hour)}:${pad(minute)}`
    : "Выбери дату и время";

  return (
    <div className="datepicker" ref={rootRef}>
      <button type="button" className="datepicker-trigger" onClick={() => setOpen((v) => !v)}>
        {label}
      </button>

      {open && (
        <div className="datepicker-panel">
          <div className="datepicker-header">
            <button type="button" className="datepicker-nav" onClick={() => setViewDate(new Date(year, month - 1, 1))}>
              ‹
            </button>
            <span>{MONTHS[month]} {year}</span>
            <button type="button" className="datepicker-nav" onClick={() => setViewDate(new Date(year, month + 1, 1))}>
              ›
            </button>
          </div>

          <div className="datepicker-weekdays">
            {WEEKDAYS.map((w) => <span key={w}>{w}</span>)}
          </div>

          <div className="datepicker-grid">
            {cells.map(({ date, outside }, i) => (
              <button
                type="button"
                key={i}
                className={
                  "datepicker-day" +
                  (outside ? " outside" : "") +
                  (selected && isSameDay(date, selected) ? " selected" : "") +
                  (isSameDay(date, today) ? " today" : "")
                }
                onClick={() => pickDay(date)}
              >
                {date.getDate()}
              </button>
            ))}
          </div>

          <div className="datepicker-time">
            <span className="time-label">Часы</span>
            <ChipScroller options={HOURS} value={hour} onChange={changeHour} format={pad} />
            <span className="time-label">Минуты</span>
            <ChipScroller options={MINUTE_STEPS} value={minute} onChange={changeMinute} format={pad} />
            <button type="button" className="secondary datepicker-done" onClick={() => setOpen(false)}>
              Готово
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
