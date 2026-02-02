export function WaffleChart({
  data = [],
  colours = {},
  size = "md", // "xl" | "lg" | "md" | "sm"
}) {
  const dimension =
    size === "xl" ? 180 :
    size === "lg" ? 150 :
    size === "sm" ? 90 :
    120;

  const total = data.reduce((sum, d) => sum + Number(d.points || 0), 0);

  const cells = [];

  if (total > 0) {
    data.forEach(({ category, points }) => {
      const pct = Math.round((Number(points || 0) / total) * 100);
      for (let i = 0; i < pct; i++) {
        cells.push(category);
      }
    });
  }

  while (cells.length < 100) {
    cells.push(null);
  }

  const finalCells = cells.slice(0, 100);

  return (
    <div
      className="grid gap-1"
      style={{
        width: dimension,
        height: dimension,
        gridTemplateColumns: "repeat(10, 1fr)",
        gridTemplateRows: "repeat(10, 1fr)",
      }}
    >
      {finalCells.map((cat, i) => (
        <div
          key={i}
          className="rounded-full"
          style={{
            backgroundColor: cat
              ? colours[cat] || "#94a3b8"
              : "#e5e7eb",
          }}
        />
      ))}
    </div>
  );
}
