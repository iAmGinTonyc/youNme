import { useState } from "react";
import ChipScroller from "./ChipScroller";

const OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15); // 15..240 in 15-min steps

export default function DurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [revealed, setRevealed] = useState(false);

  if (!revealed) {
    return (
      <button type="button" className="datepicker-trigger" onClick={() => setRevealed(true)}>
        Выбери длительность сеанса
      </button>
    );
  }

  return <ChipScroller options={OPTIONS} value={value} onChange={onChange} />;
}
