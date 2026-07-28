import ChipScroller from "./ChipScroller";

const OPTIONS = [30, 60, 90, 120];

function formatDuration(mins: number) {
  const hours = mins / 60;
  return `${hours % 1 === 0 ? hours : String(hours).replace(".", ",")}ч`;
}

export default function DurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <span className="time-label">Выберите время длительности</span>
      <ChipScroller options={OPTIONS} value={value} onChange={onChange} format={formatDuration} stretch />
    </div>
  );
}
