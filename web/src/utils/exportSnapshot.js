let html2canvasLoader = null;

export const ensureHtml2Canvas = () => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.html2canvas) return Promise.resolve(window.html2canvas);

  if (!html2canvasLoader) {
    html2canvasLoader = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js";
      script.async = true;
      script.onload = () => resolve(window.html2canvas);
      script.onerror = () => reject(new Error("Failed to load html2canvas"));
      document.head.appendChild(script);
    });
  }

  return html2canvasLoader;
};

export async function exportSnapshot(ref, filename = "values.png", options = {}) {
  const el = ref?.current;
  if (!el) return;

  const html2canvas = await ensureHtml2Canvas().catch(() => null);
  if (!html2canvas) return;

  const cleanup = [];

  // Temporarily hide elements matching selectors
  const hidden = [];
  if (options.hideSelectors) {
    const nodes = Array.from(document.querySelectorAll(options.hideSelectors));
    nodes.forEach((node) => {
      const prev = node.style.visibility;
      node.style.visibility = "hidden";
      hidden.push({ node, prev });
    });
    cleanup.push(() => hidden.forEach(({ node, prev }) => (node.style.visibility = prev)));
  }

  if (options.monochrome) {
    const prevFilter = el.style.filter;
    const prevColor = el.style.color;
    el.style.filter = "grayscale(1) contrast(1.3) brightness(1.05) saturate(0)";
    el.style.color = "#0f172a";
    cleanup.push(() => {
      el.style.filter = prevFilter;
      el.style.color = prevColor;
    });
  }

  const canvas = await html2canvas(el, {
    backgroundColor: "#ffffff",
    scale: 2,
  });

  cleanup.forEach((fn) => fn());

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  link.click();
}
