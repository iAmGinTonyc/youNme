import { useEffect, useRef, useState } from "react";

export default function ChipScroller({
  options,
  value,
  onChange,
  format,
  orientation = "horizontal",
}: {
  options: number[];
  value: number;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  orientation?: "horizontal" | "vertical";
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollBack, setCanScrollBack] = useState(false);
  const [canScrollForward, setCanScrollForward] = useState(false);
  const vertical = orientation === "vertical";

  function updateArrows() {
    const el = scrollRef.current;
    if (!el) return;
    if (vertical) {
      setCanScrollBack(el.scrollTop > 4);
      setCanScrollForward(el.scrollTop < el.scrollHeight - el.clientHeight - 4);
    } else {
      setCanScrollBack(el.scrollLeft > 4);
      setCanScrollForward(el.scrollLeft < el.scrollWidth - el.clientWidth - 4);
    }
  }

  useEffect(() => {
    scrollRef.current
      ?.querySelector(".chip.selected")
      ?.scrollIntoView(vertical ? { block: "center", inline: "nearest" } : { inline: "center", block: "nearest" });
    updateArrows();
    window.addEventListener("resize", updateArrows);
    return () => window.removeEventListener("resize", updateArrows);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.length]);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy(vertical ? { top: delta, behavior: "smooth" } : { left: delta, behavior: "smooth" });
  }

  return (
    <div className={"chip-scroller" + (vertical ? " vertical" : "")}>
      {canScrollBack && (
        <button
          type="button"
          className={"chip-arrow " + (vertical ? "up" : "left")}
          onClick={() => scrollBy(-120)}
          aria-label="Назад"
        >
          {vertical ? "▲" : "‹"}
        </button>
      )}
      <div className={"chip-row" + (vertical ? " vertical" : "")} ref={scrollRef} onScroll={updateArrows}>
        {options.map((opt) => (
          <button
            type="button"
            key={opt}
            className={"chip" + (vertical ? " vertical" : "") + (opt === value ? " selected" : "")}
            onClick={() => onChange(opt)}
          >
            {format ? format(opt) : opt}
          </button>
        ))}
      </div>
      {canScrollForward && (
        <button
          type="button"
          className={"chip-arrow " + (vertical ? "down" : "right")}
          onClick={() => scrollBy(120)}
          aria-label="Вперёд"
        >
          {vertical ? "▼" : "›"}
        </button>
      )}
    </div>
  );
}
