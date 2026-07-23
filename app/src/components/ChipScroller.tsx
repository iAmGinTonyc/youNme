import { useEffect, useRef, useState } from "react";

export default function ChipScroller({
  options,
  value,
  onChange,
  format,
}: {
  options: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
}) {
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
    scrollRef.current
      ?.querySelector(".chip.selected")
      ?.scrollIntoView({ inline: "center", block: "nearest" });
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  return (
    <div className="chip-scroller">
      {canScrollLeft && (
        <button type="button" className="chip-arrow left" onClick={() => scrollBy(-160)} aria-label="Назад">
          ‹
        </button>
      )}
      <div className="chip-row" ref={scrollRef} onScroll={updateArrows}>
        {options.map((opt) => (
          <button
            type="button"
            key={opt}
            className={"chip" + (opt === value ? " selected" : "")}
            onClick={() => onChange(opt)}
          >
            {format ? format(opt) : opt}
          </button>
        ))}
      </div>
      {canScrollRight && (
        <button type="button" className="chip-arrow right" onClick={() => scrollBy(160)} aria-label="Вперёд">
          ›
        </button>
      )}
    </div>
  );
}
