import ChipScroller from "./ChipScroller";

const OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15); // 15..240 in 15-min steps

export default function DurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return <ChipScroller options={OPTIONS} value={value} onChange={onChange} />;
}
