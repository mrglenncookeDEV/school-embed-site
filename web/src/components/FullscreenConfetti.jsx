import { useEffect } from "react";
import confetti from "canvas-confetti";

export default function FullscreenConfetti({ fire, origin = { x: 0.5, y: 0.2 }, colors = [] }) {
  const x = origin?.x ?? 0.5;
  const y = origin?.y ?? 0.2;
  const colorsKey = colors.join(",");

  useEffect(() => {
    if (!fire) return;

    const defaults = {
      startVelocity: 45,
      spread: 360,
      ticks: 180,
      gravity: 0.9,
      decay: 0.92,
      scalar: 1,
      zIndex: 9999,
      colors,
      origin: { x, y },
    };

    confetti({ ...defaults, particleCount: 80 });
    const first = setTimeout(() => confetti({ ...defaults, particleCount: 60 }), 200);
    const second = setTimeout(() => confetti({ ...defaults, particleCount: 40 }), 400);

    return () => {
      clearTimeout(first);
      clearTimeout(second);
    };
  }, [fire, x, y, colorsKey]);

  return null;
}
