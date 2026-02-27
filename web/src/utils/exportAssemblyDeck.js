import { renderWaffleImage } from "./renderWaffleImage";

const LOGO_URL = `${import.meta.env.BASE_URL}favicon.png`;

const MIME_BY_EXT = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
  bmp: "image/bmp",
  svg: "image/svg+xml",
};

function inferMimeFromUrl(url) {
  const clean = String(url || "").split("?")[0].split("#")[0];
  const ext = clean.includes(".") ? clean.split(".").pop().toLowerCase() : "";
  return MIME_BY_EXT[ext] || null;
}

function inferMimeFromBytes(bytes) {
  if (!bytes || bytes.length < 4) return null;
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes[0] === 0xff && bytes[1] === 0xd8) return "image/jpeg";
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (
    bytes.length > 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) return "image/webp";
  return null;
}

function uint8ToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function fetchBase64(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Image fetch failed: ${url} (${res.status})`);
  const bytes = new Uint8Array(await res.arrayBuffer());
  const headerMime = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const inferredMime = inferMimeFromBytes(bytes) || inferMimeFromUrl(url);
  const mime = headerMime.startsWith("image/") ? headerMime : (inferredMime || "image/png");
  return `data:${mime};base64,${uint8ToBase64(bytes)}`;
}

let pptxLoader = null;

// ── Brand palette ──────────────────────────────────────────────────────────────
const BRAND_BLUE  = "1F2AA6";
const ACCENT_GOLD = "F59E0B";
const BLUE_LIGHT  = "EEF2FF";
const BLUE_MID    = "C7D2FE";
const HDR_DIV     = "3B4BC4";
const TEXT_DARK   = "0F172A";
const TEXT_BODY   = "1E293B";
const TEXT_MUTED  = "64748B";
const CARD_BG     = "F8FAFC";
const CARD_BORDER = "E2E8F0";
const HOUSE_ICON_EMOJI = {
  shield: "🛡️",
  trophy: "🏆",
  star: "⭐",
  crown: "👑",
  heart: "❤️",
  zap: "⚡",
  ghost: "👻",
  bird: "🐦",
  cat: "🐱",
  dog: "🐶",
  tree: "🌳",
  cloud: "☁️",
  sun: "☀️",
  moon: "🌙",
  map: "🗺️",
  flag: "🚩",
  home: "🏠",
  user: "👤",
  earth: "🌍",
  droplets: "💧",
  flame: "🔥",
  wind: "💨",
  sparkles: "✨",
};

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
          script.onload = () => { URL.revokeObjectURL(blobUrl); resolve(); };
          script.onerror = () => { URL.revokeObjectURL(blobUrl); reject(new Error("Script load failed")); };
          document.head.appendChild(script);
        });
      };

      const loadUrl = async (url) => {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Fetch failed: ${url}`);
        await loadScriptFromText(await res.text());
      };

      const zipUrls = [
        "https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js",
        "https://unpkg.com/jszip@3.10.1/dist/jszip.min.js",
      ];
      const tryUrls = [
        "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/dist/pptxgen.min.js",
        "https://unpkg.com/pptxgenjs@3.12.0/dist/pptxgen.min.js",
      ];

      if (!window.JSZip) {
        let zipLoaded = false;
        for (const url of zipUrls) {
          try { await loadUrl(url); zipLoaded = true; break; }
          catch (err) { console.warn("JSZip load failed", url, err); }
        }
        if (!zipLoaded && !window.JSZip) throw new Error("JSZip not available");
      }

      for (const url of tryUrls) {
        try { await loadUrl(url); if (window.PptxGenJS) return window.PptxGenJS; }
        catch (err) { console.warn("pptxgen load attempt failed", url, err); }
      }
      throw new Error("pptxgenjs not available");
    })();
  }
  return pptxLoader;
};

// ── Layout helpers ─────────────────────────────────────────────────────────────

function addCard(slide, x, y, w, h, { bg = CARD_BG, border = CARD_BORDER, rounded = true } = {}) {
  slide.addShape(rounded ? "roundRect" : "rect", {
    x, y, w, h,
    fill: { color: bg },
    line: { color: border, pt: 1 },
  });
}

function hRule(slide, x, y, w, color = CARD_BORDER) {
  slide.addShape("rect", { x, y, w, h: 0.03, fill: { color }, line: { type: "none" } });
}

function getHouseIconGlyph(iconName, houseName) {
  const key = String(iconName || "").toLowerCase();
  if (key && HOUSE_ICON_EMOJI[key]) return HOUSE_ICON_EMOJI[key];
  return String(houseName || "?").trim().slice(0, 1).toUpperCase() || "?";
}

function addHouseIconBadge(slide, { x, y, color, iconName, houseName, size = 0.19 }) {
  slide.addShape("roundRect", {
    x,
    y,
    w: size,
    h: size,
    fill: { color: (color || BRAND_BLUE).replace("#", "") },
    line: { type: "none" },
  });
  slide.addText(getHouseIconGlyph(iconName, houseName), {
    x: x + 0.004,
    y: y - 0.02,
    w: size,
    h: size + 0.04,
    align: "center",
    valign: "middle",
    fontSize: 10,
    color: "FFFFFF",
  });
}

function createHeaderWordmarkData() {
  const canvas = document.createElement("canvas");
  canvas.width = 900;
  canvas.height = 180;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Unable to create header wordmark canvas");

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textBaseline = "middle";

  ctx.font = '700 110px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';
  ctx.fillStyle = "#0EA5E9";
  ctx.fillText("🏠", 10, 92);

  ctx.font = '700 84px "Permanent Marker", "Marker Felt", "Kalam", "Comic Sans MS", cursive';
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText("House Points", 155, 98);

  return canvas.toDataURL("image/png");
}

// ── Slide chrome ───────────────────────────────────────────────────────────────

function addSlideFooter(slide, pageNum) {
  slide.addShape("rect", {
    x: 0, y: 7.22, w: 13.33, h: 0.28,
    fill: { color: "F1F5F9" },
    line: { color: CARD_BORDER, pt: 1 },
  });
  slide.addText("House Points — Staff Briefing Deck", {
    x: 0.38, y: 7.26, w: 5, h: 0.18,
    fontSize: 8, color: "94A3B8",
  });
  slide.addText("FOR STAFF USE ONLY", {
    x: 4.2, y: 7.26, w: 4.9, h: 0.18,
    fontSize: 8, color: "B0BAE4", align: "center",
  });
  if (pageNum != null) {
    slide.addText(String(pageNum), {
      x: 12.52, y: 7.26, w: 0.6, h: 0.18,
      fontSize: 8, color: "94A3B8", align: "right",
    });
  }
}

function addSiteHeader(slide, periodLabel, updatedLabel, logoData, headerWordmarkData) {
  // Main blue bar
  slide.addShape("rect", {
    x: 0, y: 0, w: 13.33, h: 1.1,
    fill: { color: BRAND_BLUE }, line: { type: "none" },
  });
  // Gold accent strip along the bottom of the header
  slide.addShape("rect", {
    x: 0, y: 1.04, w: 13.33, h: 0.06,
    fill: { color: ACCENT_GOLD }, line: { type: "none" },
  });

  // School logo (left)
  slide.addImage({ data: logoData, x: 0.22, y: 0.13, w: 0.84, h: 0.84 });

  // Emoji + title wordmark (site-style lockup) immediately after the logo
  slide.addImage({ data: headerWordmarkData, x: 1.12, y: 0.2, w: 3.7, h: 0.7 });

  // Vertical divider — after title
  slide.addShape("rect", {
    x: 5.0, y: 0.24, w: 0.025, h: 0.62,
    fill: { color: HDR_DIV }, line: { type: "none" },
  });

  const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  slide.addText(
    `${periodLabel === "term" ? "Term" : "Week"} update  •  Updated ${todayLabel}`,
    {
      x: 5.18, y: 0.36, w: 6.2, h: 0.3,
      fontSize: 11, bold: true, color: "C7D2FE",
    }
  );
}

// Adds the section title block that sits just below the header on content slides.
// Uses a gold accent bar to the left of the title for a polished, editorial feel.
function addSectionTitle(slide, title, subtitle) {
  slide.addShape("rect", {
    x: 0.58, y: 1.22, w: 0.07, h: 0.44,
    fill: { color: ACCENT_GOLD }, line: { type: "none" },
  });
  slide.addText(title, {
    x: 0.76, y: 1.18, w: 11.9, h: 0.5,
    fontSize: 26, bold: true, color: TEXT_DARK,
  });
  if (subtitle) {
    slide.addText(subtitle, {
      x: 0.76, y: 1.72, w: 11.9, h: 0.32,
      fontSize: 13, color: TEXT_MUTED,
    });
  }
}

// ── Main export ────────────────────────────────────────────────────────────────

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
  const [PptxGenJS, logoData, headerWordmarkData] = await Promise.all([
    ensurePptx().catch((err) => { console.error("pptxgenjs load failed", err); return null; }),
    fetchBase64(LOGO_URL),
    Promise.resolve(createHeaderWordmarkData()),
  ]);
  if (!PptxGenJS) throw new Error("Unable to load pptx generator");

  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.author = "House Points";
  pptx.company = "School";
  pptx.subject = "House competition update";
  pptx.title = `House Points ${periodLabel === "term" ? "Term" : "Week"} Update`;

  // Convenience wrapper so every addSiteHeader call doesn't repeat the image args
  const header = (slide) => addSiteHeader(slide, periodLabel, updatedLabel, logoData, headerWordmarkData);
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const houseMetaByName = new Map(
    (houses || []).map((h) => [String(h.name || "").toLowerCase(), h])
  );
  const resolveHouseMeta = (entry) => {
    const direct = entry || {};
    const fromName = houseMetaByName.get(String(direct.name || "").toLowerCase()) || {};
    return {
      iconName: direct.iconName || fromName.iconName || "",
      color: direct.color || fromName.color || BRAND_BLUE,
      name: direct.name || fromName.name || "",
    };
  };

  // ── 1. TITLE SLIDE ──────────────────────────────────────────────────────────
  const titleSlide = pptx.addSlide();
  header(titleSlide);
  addSlideFooter(titleSlide, 1);

  // Eyebrow label
  titleSlide.addText("BRIEFING DECK", {
    x: 0.68, y: 1.48, w: 5, h: 0.26,
    fontSize: 10, bold: true, color: BRAND_BLUE,
  });

  // Single-line headline
  titleSlide.addText("House Competition Update", {
    x: 0.68, y: 2.04, w: 7.9, h: 0.62,
    fontFace: "Arial Narrow",
    fontSize: 42,
    bold: false,
    color: TEXT_DARK,
    fit: "shrink",
  });

  // Thin rule under headline
  titleSlide.addShape("rect", {
    x: 0.68, y: 2.86, w: 6.1, h: 0.055,
    fill: { color: BRAND_BLUE }, line: { type: "none" },
  });

  // Period / date
  titleSlide.addText(
    `${periodLabel === "term" ? "Term" : "Week"} · Updated ${todayLabel}`,
    { x: 0.68, y: 3.04, w: 7.1, h: 0.36, fontSize: 15, bold: true, color: TEXT_BODY }
  );

  // Summary line
  if (summaryLine) {
    titleSlide.addText(summaryLine, {
      x: 0.68, y: 3.46, w: 7.3, h: 1.0,
      fontSize: 14, color: TEXT_MUTED,
    });
  }

  // Right feature card (light blue)
  // house_gold.png is 900×710 px → aspect 1.268; at h=2.72 → w≈3.45
  addCard(titleSlide, 8.75, 1.36, 4.28, 5.68, { bg: BLUE_LIGHT, border: BLUE_MID });

  // Large 🏠 emoji centred in card
  titleSlide.addText("🏠", {
    x: 8.75, y: 1.52, w: 4.28, h: 2.72,
    fontSize: 160, align: "center", valign: "middle",
  });

  // Deck focus section
  titleSlide.addText("Deck focus", {
    x: 9.0, y: 4.42, w: 3.8, h: 0.32,
    fontSize: 13, bold: true, color: TEXT_BODY,
  });
  hRule(titleSlide, 9.0, 4.78, 3.8, BLUE_MID);
  titleSlide.addText(
    [
      { text: "Whole-school point distribution\n" },
      { text: "Leadership position and margin\n" },
      { text: "House ranking and momentum" },
    ],
    { x: 9.0, y: 4.92, w: 3.8, h: 1.75, fontSize: 12, bullet: true, color: TEXT_MUTED }
  );

  // ── 2. WHOLE-SCHOOL SLIDE ───────────────────────────────────────────────────
  const totalSlide = pptx.addSlide();
  header(totalSlide);
  addSectionTitle(totalSlide, "Whole-School Contribution", "Distribution of points across all houses");
  addSlideFooter(totalSlide, 2);

  totalSlide.addImage({
    data: renderWaffleImage({ data: totalValues, colours }),
    x: 0.82, y: 2.08, w: 5.6, h: 4.9,
  });

  const totalPoints = totalValues.reduce((sum, item) => sum + (item.points || 0), 0);
  addCard(totalSlide, 7.05, 2.08, 5.45, 4.9);

  totalSlide.addText("Whole-school total", {
    x: 7.4, y: 2.5, w: 3.5, h: 0.28,
    fontSize: 12, color: TEXT_MUTED,
  });
  totalSlide.addText(`${totalPoints.toLocaleString()} pts`, {
    x: 7.4, y: 2.78, w: 4.6, h: 0.64,
    fontSize: 34, bold: true, color: BRAND_BLUE,
  });

  hRule(totalSlide, 7.4, 3.58, 4.7, CARD_BORDER);

  totalSlide.addText("Top contributors", {
    x: 7.4, y: 3.7, w: 3.5, h: 0.3,
    fontSize: 12, bold: true, color: TEXT_BODY,
  });

  const topHouses = [...chartData].sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 3);
  topHouses.forEach((house, idx) => {
    const rowY = 4.08 + idx * 0.56;
    const meta = resolveHouseMeta(house);
    addHouseIconBadge(totalSlide, {
      x: 7.4,
      y: rowY + 0.05,
      color: meta.color,
      iconName: meta.iconName,
      houseName: meta.name,
      size: 0.16,
    });
    totalSlide.addText(`${idx + 1}. ${house.name}`, {
      x: 7.68, y: rowY, w: 2.9, h: 0.28,
      fontSize: 13, color: TEXT_BODY, bold: idx === 0,
    });
    totalSlide.addText(`${(house.points || 0).toLocaleString()} pts`, {
      x: 10.65, y: rowY, w: 1.5, h: 0.28,
      fontSize: 13, bold: true, align: "right",
      color: (house.color || TEXT_DARK).replace("#", ""),
    });
  });
  const legendRows = totalValues.filter((item) => Number(item.points || 0) > 0).slice(0, 8);
  if (legendRows.length > 0) {
    addCard(totalSlide, 7.32, 5.54, 4.9, 1.24, { bg: "FFFFFF", border: CARD_BORDER, rounded: true });
    totalSlide.addText("Waffle legend", {
      x: 7.5, y: 5.66, w: 2.3, h: 0.22,
      fontSize: 10, bold: true, color: TEXT_BODY,
    });
    const totalLegendPoints = legendRows.reduce((sum, row) => sum + Number(row.points || 0), 0);
    const maxRowsPerColumn = 4;
    const legendColumnWidth = 2.16;
    const legendColumnGap = 0.28;
    legendRows.forEach((row, idx) => {
      const colIdx = Math.floor(idx / maxRowsPerColumn);
      const rowIdx = idx % maxRowsPerColumn;
      const rowX = 7.5 + colIdx * (legendColumnWidth + legendColumnGap);
      const rowY = 5.93 + rowIdx * 0.2;
      const swatch = (colours?.[row.category] || BRAND_BLUE).replace("#", "");
      const pct = totalLegendPoints > 0 ? Math.round((Number(row.points || 0) / totalLegendPoints) * 100) : 0;
      totalSlide.addShape("roundRect", {
        x: rowX, y: rowY + 0.025, w: 0.11, h: 0.11,
        fill: { color: swatch }, line: { type: "none" },
      });
      totalSlide.addText(`${row.category} (${pct}%)`, {
        x: rowX + 0.18, y: rowY, w: legendColumnWidth - 0.2, h: 0.2,
        fontSize: 9, color: TEXT_MUTED,
      });
    });
  }

  // ── 3. LEADER SLIDE ─────────────────────────────────────────────────────────
  const leaderSlide = pptx.addSlide();
  header(leaderSlide);
  addSectionTitle(leaderSlide, "Current Leader", "Position at the end of this reporting window");
  addSlideFooter(leaderSlide, 3);

  // Coloured accent rule above the leader name
  leaderSlide.addShape("rect", {
    x: 0.58, y: 2.06, w: 7.3, h: 0.06,
    fill: { color: (leader?.color || ACCENT_GOLD).replace("#", "") },
    line: { type: "none" },
  });
  leaderSlide.addText(leader?.name || "–", {
    x: 0.58, y: 2.16, w: 7.0, h: 0.92,
    fontSize: 58, bold: true,
    color: (leader?.color || TEXT_DARK).replace("#", ""),
  });
  leaderSlide.addText("CURRENT LEADER", {
    x: 0.58, y: 3.12, w: 4, h: 0.26,
    fontSize: 9, bold: true, color: TEXT_MUTED,
  });
  leaderSlide.addText("Lead margin:", {
    x: 0.58, y: 3.48, w: 2.4, h: 0.3,
    fontSize: 13, color: TEXT_MUTED,
  });
  leaderSlide.addText(`${(leader?.margin ?? 0).toLocaleString()} points`, {
    x: 3.06, y: 3.48, w: 3.5, h: 0.3,
    fontSize: 16, bold: true,
    color: (leader?.color || BRAND_BLUE).replace("#", ""),
  });

  const bullets = [
    leader?.prevLeader && leader?.prevLeader !== leader?.name
      ? `${leader?.name || "This house"} moved into first place this period.`
      : `${leader?.name || "Current leader"} has retained first place.`,
    "Use this result to reinforce attendance, conduct, and contribution routines.",
  ];
  leaderSlide.addText(bullets.join("\n"), {
    x: 0.58, y: 3.94, w: 7.0, h: 1.9,
    fontSize: 14, bullet: true, color: TEXT_MUTED,
  });

  // Ranking card
  addCard(leaderSlide, 8.1, 2.0, 4.9, 5.08);
  leaderSlide.addText("Current ranking", {
    x: 8.45, y: 2.38, w: 3.8, h: 0.32,
    fontSize: 13, bold: true, color: TEXT_BODY,
  });
  hRule(leaderSlide, 8.45, 2.76, 4.18, CARD_BORDER);

  const orderedHouses = [...chartData].sort((a, b) => (b.points || 0) - (a.points || 0));
  orderedHouses.slice(0, 6).forEach((item, idx) => {
    const meta = resolveHouseMeta(item);
    const rowY = 2.9 + idx * 0.68;
    // Podium-style row tint for top 3
    if (idx === 0) {
      leaderSlide.addShape("rect", {
        x: 8.2, y: rowY - 0.06, w: 4.6, h: 0.54,
        fill: { color: "FEF3C7" }, line: { type: "none" },
      });
    } else if (idx < 3) {
      leaderSlide.addShape("rect", {
        x: 8.2, y: rowY - 0.06, w: 4.6, h: 0.54,
        fill: { color: BLUE_LIGHT }, line: { type: "none" },
      });
    }
    leaderSlide.addText(`${idx + 1}`, {
      x: 8.28, y: rowY + 0.02, w: 0.38, h: 0.34,
      fontSize: 12, bold: true, align: "center",
      color: idx === 0 ? ACCENT_GOLD : TEXT_MUTED,
    });
    addHouseIconBadge(leaderSlide, {
      x: 8.72,
      y: rowY + 0.08,
      color: meta.color,
      iconName: meta.iconName,
      houseName: item.name,
      size: 0.16,
    });
    leaderSlide.addText(item.name, {
      x: 8.95, y: rowY + 0.02, w: 2.47, h: 0.34,
      fontSize: 13, bold: idx === 0,
      color: (item.color || TEXT_BODY).replace("#", ""),
    });
    leaderSlide.addText(`${(item.points || 0).toLocaleString()}`, {
      x: 11.52, y: rowY + 0.02, w: 1.14, h: 0.34,
      fontSize: 13, bold: idx < 3, align: "right",
      color: (item.color || TEXT_DARK).replace("#", ""),
    });
  });

  // ── 4. BAR CHART SLIDE ──────────────────────────────────────────────────────
  const chartSlide = pptx.addSlide();
  header(chartSlide);
  addSectionTitle(chartSlide, "House Points Ranking", "Current totals, sorted highest to lowest");
  addSlideFooter(chartSlide, 4);

  // Subtle card frame behind the chart
  addCard(chartSlide, 0.52, 2.04, 12.3, 5.0, { rounded: false });

  const orderedChartData = [...chartData].sort((a, b) => (b.points || 0) - (a.points || 0));
  chartSlide.addChart(
    pptx.ChartType.bar,
    [{ name: "Points", labels: orderedChartData.map((d) => d.name), values: orderedChartData.map((d) => d.points || 0) }],
    {
      x: 0.68, y: 2.18, w: 11.95, h: 4.68,
      barDir: "bar",
      barGrouping: "clustered",
      dataLabelPosition: "inEnd",
      dataLabelColor: "FFFFFF",
      dataLabelSize: 11,
      dataLabelFormatCode: "0",
      valAxisLabelFormatCode: "0",
      valAxisMinVal: 0,
      catAxisLabelSize: 11,
      showLegend: false,
      chartColors: orderedChartData.map((d) => (d.color || BRAND_BLUE).replace("#", "")),
      showValue: true,
      valAxisTitle: "Points",
      valGridLine: { color: "E2E8F0", pt: 1 },
      plotArea: { fill: { color: "FFFFFF" }, line: { color: "E2E8F0", pt: 1 } },
    }
  );
  chartSlide.addText("Bars are sorted from highest to lowest total.", {
    x: 0.68, y: 7.08, w: 9, h: 0.18,
    fontSize: 9, color: TEXT_MUTED, italic: true,
  });

  // ── 5. MOMENTUM SLIDE ───────────────────────────────────────────────────────
  const momentumSlide = pptx.addSlide();
  header(momentumSlide);
  addSectionTitle(momentumSlide, "Momentum & Chasing Pack", "Change signals compared with the previous period");
  addSlideFooter(momentumSlide, 5);

  // Left card — movement
  addCard(momentumSlide, 0.58, 2.05, 5.92, 5.0);
  // Gold accent left bar
  momentumSlide.addShape("rect", {
    x: 0.58, y: 2.05, w: 0.07, h: 5.0,
    fill: { color: ACCENT_GOLD }, line: { type: "none" },
  });
  momentumSlide.addText("Top movement", {
    x: 0.85, y: 2.42, w: 4, h: 0.32,
    fontSize: 14, bold: true, color: TEXT_DARK,
  });
  hRule(momentumSlide, 0.85, 2.82, 5.35, CARD_BORDER);

  const deltaEntries = Object.entries(deltas || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0)).slice(0, 3);
  deltaEntries.forEach(([houseId, delta], idx) => {
    const house = houses.find((h) => h.id === houseId || h.name === houseId || h.houseKey === houseId) || {};
    const meta = resolveHouseMeta(house);
    const isNeutral = Math.abs(delta) < 0.02;
    const arrow = isNeutral ? "▬" : delta > 0 ? "▲" : "▼";
    const stateLabel = isNeutral ? "Stable trajectory" : delta > 0 ? "Improving trajectory" : "Declining trajectory";
    const entryY = 3.0 + idx * 1.3;

    addHouseIconBadge(momentumSlide, {
      x: 0.85,
      y: entryY + 0.08,
      color: meta.color,
      iconName: meta.iconName,
      houseName: house.name || houseId,
      size: 0.2,
    });
    momentumSlide.addText(`${arrow} ${house.name || houseId}`, {
      x: 1.12, y: entryY, w: 5.1, h: 0.4,
      fontSize: 18, bold: true,
      color: (house.color || TEXT_MUTED).replace("#", ""),
    });
    momentumSlide.addText(stateLabel, {
      x: 0.85, y: entryY + 0.42, w: 4.5, h: 0.26,
      fontSize: 13, color: TEXT_MUTED,
    });
    momentumSlide.addText(`Δ ${(delta || 0).toFixed(2)}`, {
      x: 0.85, y: entryY + 0.71, w: 4, h: 0.24,
      fontSize: 11, color: "94A3B8",
    });
    if (idx < 2) hRule(momentumSlide, 0.85, entryY + 1.18, 5.35, CARD_BORDER);
  });

  // Right card — neutral summary for distribution
  addCard(momentumSlide, 7.1, 2.05, 5.77, 5.0, { bg: BLUE_LIGHT, border: BLUE_MID });
  momentumSlide.addText("Momentum snapshot", {
    x: 7.45, y: 2.42, w: 4.5, h: 0.32,
    fontSize: 14, bold: true, color: "1E3A8A",
  });
  hRule(momentumSlide, 7.45, 2.82, 5.05, BLUE_MID);
  const sortedDeltas = Object.entries(deltas || {}).sort((a, b) => (b[1] || 0) - (a[1] || 0));
  const strongestGainer = sortedDeltas[0];
  const strongestDecliner = sortedDeltas[sortedDeltas.length - 1];
  const stableCount = sortedDeltas.filter(([, delta]) => Math.abs(delta || 0) < 0.02).length;
  const resolveHouseName = (key) =>
    houses.find((h) => h.id === key || h.name === key || h.houseKey === key)?.name || key;
  const neutralSummary = [
    `Strongest gain: ${strongestGainer ? `${resolveHouseName(strongestGainer[0])} (Δ ${Number(strongestGainer[1] || 0).toFixed(2)})` : "N/A"}`,
    `Steepest decline: ${strongestDecliner ? `${resolveHouseName(strongestDecliner[0])} (Δ ${Number(strongestDecliner[1] || 0).toFixed(2)})` : "N/A"}`,
    `Stable houses: ${stableCount}`,
    `Reporting period: ${periodLabel === "term" ? "Term" : "Week"}`,
  ];
  neutralSummary.forEach((line, idx) => {
    momentumSlide.addText(line, {
      x: 7.45, y: 3.02 + idx * 0.6, w: 5.05, h: 0.34,
      fontSize: 12.5, color: TEXT_BODY,
    });
  });

  // ── 6. CLOSING SLIDE ────────────────────────────────────────────────────────
  const closeSlide = pptx.addSlide();
  header(closeSlide);
  addSectionTitle(closeSlide, "Thank You", "Celebrating effort, kindness, and responsibility");
  addSlideFooter(closeSlide, 6);

  // Coloured accent strip
  closeSlide.addShape("rect", {
    x: 0.58, y: 2.06, w: 7.5, h: 0.06,
    fill: { color: ACCENT_GOLD }, line: { type: "none" },
  });
  closeSlide.addText("Well done to all houses", {
    x: 0.58, y: 2.18, w: 7.3, h: 0.8,
    fontSize: 40, bold: true, color: TEXT_DARK,
  });
  closeSlide.addText(
    "Let's carry this momentum into next week and keep standards high across every year group.",
    { x: 0.58, y: 3.06, w: 7.4, h: 1.0, fontSize: 17, color: TEXT_MUTED }
  );

  // Right checklist card
  addCard(closeSlide, 8.65, 2.0, 4.36, 5.08);

  // 🏠 emoji in the card
  const closeCardX = 8.65, closeCardW = 4.36;
  closeSlide.addText("🏠", {
    x: closeCardX, y: 2.1, w: closeCardW, h: 1.9,
    fontSize: 100, align: "center", valign: "middle",
  });

  closeSlide.addText("End-of-briefing check", {
    x: 9.0, y: 4.16, w: 3.72, h: 0.32,
    fontSize: 13, bold: true, color: TEXT_BODY,
  });
  hRule(closeSlide, 9.0, 4.52, 3.72, CARD_BORDER);
  closeSlide.addText(
    [
      { text: "Teachers - Remember to keep logging the points!\n" },
      { text: "Pupils - Keep up the awesome work!" },
    ],
    { x: 9.0, y: 4.66, w: 3.72, h: 2.2, fontSize: 13, bullet: true, color: TEXT_MUTED }
  );

  // School logo centred at the bottom of the closing card
  closeSlide.addImage({
    data: logoData,
    x: closeCardX + (closeCardW - 0.75) / 2,
    y: 6.24,
    w: 0.75,
    h: 0.75,
  });

  await pptx.writeFile(`Values-${view}.pptx`);
}
