import { useState } from "react";

const OPTIONS = Array.from({ length: 24 }, (_, i) => (i + 1) * 30); // 0,5ч..12ч in 0,5ч steps

function formatDuration(mins: number) {
  const hours = mins / 60;
  const label = hours % 1 === 0 ? String(hours) : String(hours).replace(".", ",");
  return `${label} ч`;
}

export default function DurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <button type="button" className="datepicker-trigger" onClick={() => setRevealed(true)}>
        Выберите время длительности
      </button>
    );
  }

  return (
    <div className="duration-grid">
      {OPTIONS.map((opt) => (
        <button
          type="button"
          key={opt}
          className={"chip duration-chip" + (opt === value ? " selected" : "")}
          onClick={() => onChange(opt)}
        >
          {formatDuration(opt)}
        </button>
      ))}
    </div>
  );
}
