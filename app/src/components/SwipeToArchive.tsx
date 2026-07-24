import { ReactNode, useRef, useState } from "react";

const REVEAL_WIDTH = 96;
const FULL_SWIPE = 220;

// Pointer Events (not touch-only) so this works with a real finger in
// Telegram AND with a mouse drag during dev/testing — both surface as
// pointer events, no separate handling needed.
export default function SwipeToArchive({
  children,
  onArchive,
  disabled,
}: {
  children: ReactNode;
  onArchive: () => void;
  disabled?: boolean;
}) {
  const [dragX, setDragX] = useState(0);
  const startX = useRef<number | null>(null);
  const dragging = useRef(false);

  function onPointerDown(e: React.PointerEvent) {
    if (disabled) return;
    startX.current = e.clientX;
    dragging.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (disabled || !dragging.current || startX.current === null) return;
    const delta = e.clientX - startX.current;
    setDragX(Math.min(0, Math.max(delta, -FULL_SWIPE)));
  }

  function finishDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    if (dragX <= -FULL_SWIPE + 10) {
      setDragX(0);
      onArchive();
    } else if (dragX < -REVEAL_WIDTH / 2) {
      setDragX(-REVEAL_WIDTH);
    } else {
      setDragX(0);
    }
  }

  function handleActionClick() {
    setDragX(0);
    onArchive();
  }

  return (
    <div className="swipe-wrap">
      <button type="button" className="swipe-action" onClick={handleActionClick} disabled={disabled}>
        В архив
      </button>
      <div
        className="swipe-content"
        style={{ transform: `translateX(${dragX}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={finishDrag}
        onPointerCancel={finishDrag}
      >
        {children}
      </div>
    </div>
  );
}
