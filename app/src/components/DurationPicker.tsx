import { useEffect, useRef, useState } from "react";

const OPTIONS = Array.from({ length: 16 }, (_, i) => (i + 1) * 15); // 15..240 in 15-min steps

export default function DurationPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
  }

  useEffect(() => {
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
  }, []);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  return (
    <div className="duration-picker">
      {canScrollLeft && (
        <button type="button" className="duration-arrow left" onClick={() => scrollBy(-140)} aria-label="Раньше">
          ‹
        </button>
      )}
      <div className="duration-row" ref={scrollRef} onScroll={updateArrows}>
        {OPTIONS.map((m) => (
          <button
            type="button"
            key={m}
            className={"duration-chip" + (m === value ? " selected" : "")}
            onClick={() => onChange(m)}
          >
            {m}
          </button>
        ))}
      </div>
      {canScrollRight && (
        <button type="button" className="duration-arrow right" onClick={() => scrollBy(140)} aria-label="Позже">
          ›
        </button>
      )}
    </div>
  );
}
