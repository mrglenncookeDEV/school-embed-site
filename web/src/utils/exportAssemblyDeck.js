const logo = `${import.meta.env.BASE_URL}favicon.png`;
import { renderWaffleImage } from "./renderWaffleImage";
let pptxLoader = null;

const ensurePptx = () => {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.PptxGenJS) return Promise.resolve(window.PptxGenJS);

  if (!pptxLoader) {
    pptxLoader = (async () => {
      const loadScriptFromText = async (text) => {
        const blobUrl = URL.createObjectURL(new Blob([text], { type: "text/javascript" }));
        await new Promise((resolve, reject) => {
          const script = document.createElement("script");
          script.src = blobUrl;
          script.async = true;
          script.onload = () => {
            URL.revokeObjectURL(blobUrl);
            resolve();
          };
          script.onerror = () => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error("Script load failed"));
          };
          document.head.appendChild(script);
        });
      };

      const loadUrl = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch failed: ${url}`);
        const text = await res.text();
        await loadScriptFromText(text);
      };

      const zipUrls = [
        "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
        "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js",
      ];

      const tryUrls = [
        "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.min.js",
        "https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.min.js",
      ];

      // Ensure JSZip present
      if (!window.JSZip) {
        let zipLoaded = false;
        for (const url of zipUrls) {
          try {
            await loadUrl(url);
            zipLoaded = true;
            break;
          } catch (err) {
            console.warn("JSZip load failed", url, err);
          }
        }
        if (!zipLoaded && !window.JSZip) {
          throw new Error("JSZip not available");
        }
      }

      for (const url of tryUrls) {
        try {
          await loadUrl(url);
          if (window.PptxGenJS) return window.PptxGenJS;
        } catch (err) {
          console.warn("pptxgen load attempt failed", url, err);
        }
      }

      throw new Error("pptxgenjs not available");
    })();
  }

  return pptxLoader;
};

function addLogo(slide) {
  slide.addImage({
    data: logo,
    x: 0.3,
    y: 0.3,
    w: 0.8,
    h: 0.8,
  });
}

export async function exportAssemblyDeck({
  view,
  periodLabel,
  updatedLabel,
  summaryLine,
  leader,
  chartData,
  deltas,
  totalValues,
  houses,
  colours,
}) {
  const PptxGenJS = await ensurePptx().catch((err) => {
    console.error("pptxgenjs load failed", err);
    return null;
  });
  if (!PptxGenJS) {
    throw new Error("Unable to load pptx generator");
  }

  const pptx = new PptxGenJS();

  /* TITLE */
  const title = pptx.addSlide();
  addLogo(title);
  title.addText("House Competition Update", {
    x: 1,
    y: 1.5,
    fontSize: 36,
    bold: true,
  });
  title.addText(`${periodLabel === "term" ? "Term" : "Week"} · Updated ${updatedLabel || ""}`, {
    x: 1,
    y: 2.5,
    fontSize: 20,
  });
  if (summaryLine) {
    title.addText(summaryLine, {
      x: 1,
      y: 3.2,
      fontSize: 14,
      color: "606060",
    });
  }

  /* WHOLE SCHOOL */
  const totalSlide = pptx.addSlide();
  addLogo(totalSlide);
  totalSlide.addText("Whole school", {
    x: 0.5,
    y: 0.3,
    fontSize: 24,
    bold: true,
  });
  totalSlide.addImage({
    data: renderWaffleImage({ data: totalValues, colours }),
    x: 1,
    y: 1,
    w: 5,
    h: 5,
  });

  /* HOUSES */
  const leaderSlide = pptx.addSlide();
  addLogo(leaderSlide);
  leaderSlide.addText("Current leader", {
    x: 0.5,
    y: 0.3,
    fontSize: 20,
    bold: true,
  });
  leaderSlide.addText(leader?.name || "–", {
    x: 0.5,
    y: 1.0,
    fontSize: 36,
    bold: true,
    color: leader?.color || "000000",
  });
  leaderSlide.addShape(pptx.ShapeType.rect, {
    x: 0.5,
    y: 1.8,
    w: 8,
    h: 0.35,
    fill: { color: leader?.color || "666666" },
    line: { type: "none" },
  });
  const bullets = [
    `Lead margin: ${leader?.margin ?? 0} pts`,
    leader?.prevLeader && leader?.prevLeader !== leader?.name ? "New leader this period" : "Holding the lead",
  ];
  leaderSlide.addText(
    bullets.join("\n"),
    { x: 0.5, y: 2.4, fontSize: 16, bullet: true, color: "404040" }
  );

  /* BAR CHART SLIDE */
  const chartSlide = pptx.addSlide();
  addLogo(chartSlide);
  chartSlide.addText("House points", {
    x: 0.5,
    y: 0.3,
    fontSize: 20,
    bold: true,
  });
  const barData = chartData.map((d) => ({
    name: d.name,
    labels: ["Points"],
    values: [d.points || 0],
    color: d.color,
  }));
  chartSlide.addChart(pptx.ChartType.bar, barData, {
    x: 0.8,
    y: 0.9,
    w: 8,
    h: 4.5,
    barDir: "col",
    dataLabelPosition: "outEnd",
    dataLabelFormatCode: "0",
    valAxisLabelFormatCode: "0",
  });
  chartSlide.addText("Momentum shows how competition is evolving this period.", {
    x: 0.8,
    y: 5.6,
    fontSize: 14,
    color: "606060",
  });

  /* MOMENTUM SLIDE */
  const momentumSlide = pptx.addSlide();
  addLogo(momentumSlide);
  momentumSlide.addText("Momentum & chasers", {
    x: 0.5,
    y: 0.3,
    fontSize: 20,
    bold: true,
  });
  const deltaEntries = Object.entries(deltas || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 3);
  deltaEntries.forEach(([houseId, delta], idx) => {
    const house = houses.find((h) => h.id === houseId || h.name === houseId || h.houseKey === houseId) || {};
    const state = Math.abs(delta) < 0.02 ? "Stable" : delta > 0 ? "Improving" : "Falling behind";
    const arrow = Math.abs(delta) < 0.02 ? "▬" : delta > 0 ? "▲" : "▼";
    momentumSlide.addText(
      `${arrow} ${house.name || houseId}: ${state}`,
      {
        x: 0.6,
        y: 0.9 + idx * 0.8,
        fontSize: 16,
        color: house.color || "404040",
      }
    );
  });

  /* CLOSING SLIDE */
  const close = pptx.addSlide();
  addLogo(close);
  close.addText("Well done to all houses", {
    x: 0.5,
    y: 1.2,
    fontSize: 30,
    bold: true,
  });
  close.addText("Celebrating effort, kindness, and responsibility.", {
    x: 0.5,
    y: 2.0,
    fontSize: 16,
    color: "404040",
  });
  close.addImage({
    data: logo,
    x: 8.5,
    y: 5.5,
    w: 1.2,
    h: 1.2,
  });

  await pptx.writeFile(`Values-${view}.pptx`);
}
