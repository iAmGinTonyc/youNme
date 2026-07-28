import { useState } from "react";
import ChipScroller from "./ChipScroller";

const OPTIONS = [30, 60, 90, 120];

function formatDuration(mins: number) {
  const hours = mins / 60;
  return `${hours % 1 === 0 ? hours : String(hours).replace(".", ",")}ч`;
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

  return <ChipScroller options={OPTIONS} value={value} onChange={onChange} format={formatDuration} stretch />;
}
