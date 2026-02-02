export function renderWaffleImage({
  data,
  colours = {},
  size = 300,
  monochrome = false,
}) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  const cells = 10;
  const gap = 4;
  const dot = (size - gap * (cells - 1)) / cells;

  const total = data.reduce((s, d) => s + (d.points || 0), 0);
  const filled = [];

  if (total > 0) {
    data.forEach((d) => {
      const pct = Math.round(((d.points || 0) / total) * 100);
      for (let i = 0; i < pct; i += 1) filled.push(d.category);
    });
  }

  while (filled.length < 100) filled.push(null);

  filled.slice(0, 100).forEach((cat, i) => {
    const row = Math.floor(i / cells);
    const col = i % cells;

    ctx.beginPath();
    ctx.arc(
      col * (dot + gap) + dot / 2,
      row * (dot + gap) + dot / 2,
      dot / 2,
      0,
      Math.PI * 2
    );

    ctx.fillStyle = cat
      ? monochrome
        ? "#111"
        : colours[cat] || "#888"
      : "#e5e7eb";

    ctx.fill();
  });

  return canvas.toDataURL("image/png");
}
