const responseHtml = (body) =>
  new Response(body, { headers: { "content-type": "text/html; charset=utf-8" } });

// ── CSS ────────────────────────────────────────────────────────────────────────

function buildCss(monochrome) {
  const base = `
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
      background: #f8fafc;
      color: #0f172a;
      line-height: 1.6;
      font-size: 15px;
    }

    /* ── Header ── */
    .rpt-header {
      background: #1f2aa6;
      color: white;
      padding: 22px 32px;
      display: flex;
      align-items: center;
      gap: 16px;
      border-bottom: 5px solid #f59e0b;
    }
    .rpt-header img { width: 52px; height: 52px; border-radius: 8px; flex-shrink: 0; }
    .rpt-header h1 { font-size: 20px; font-weight: 700; line-height: 1.25; }
    .rpt-header p  { font-size: 12px; color: #c7d2fe; margin-top: 3px; }
    .rpt-badge {
      margin-left: auto;
      background: #f59e0b;
      color: #78350f;
      font-size: 10px;
      font-weight: 700;
      padding: 5px 13px;
      border-radius: 999px;
      white-space: nowrap;
      letter-spacing: 0.08em;
      flex-shrink: 0;
    }

    /* ── Body container ── */
    .rpt-body { padding: 28px 32px; max-width: 860px; margin: 0 auto; }

    /* ── Print button ── */
    .rpt-print-btn {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #1f2aa6;
      color: white;
      border: none;
      padding: 9px 18px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      margin-bottom: 20px;
    }
    .rpt-print-btn:hover { background: #161d7a; }

    /* ── Card section ── */
    .rpt-section {
      background: white;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 22px 24px;
      margin-bottom: 18px;
    }
    .rpt-section-label {
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .rpt-section-label::before {
      content: "";
      display: inline-block;
      width: 4px;
      height: 14px;
      background: #f59e0b;
      border-radius: 2px;
      flex-shrink: 0;
    }

    /* ── Narrative ── */
    .rpt-para { font-size: 15px; line-height: 1.75; color: #1e293b; margin-bottom: 16px; }
    .rpt-bullets { list-style: none; }
    .rpt-bullets li {
      padding: 9px 0 9px 22px;
      position: relative;
      border-top: 1px solid #f1f5f9;
      font-size: 14px;
      color: #334155;
      line-height: 1.55;
    }
    .rpt-bullets li::before { content: "→"; position: absolute; left: 0; color: #1f2aa6; font-weight: 700; }

    /* ── Table ── */
    .rpt-table { width: 100%; border-collapse: collapse; font-size: 13px; margin-top: 2px; }
    .rpt-table thead th {
      text-align: left;
      font-size: 11px;
      font-weight: 600;
      color: #64748b;
      padding: 7px 10px;
      border-bottom: 2px solid #e2e8f0;
      white-space: nowrap;
    }
    .rpt-table thead th.num { text-align: right; }
    .rpt-table tbody tr:hover { background: #f8fafc; }
    .rpt-table tbody td { padding: 9px 10px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
    .rpt-table tbody tr:last-child td { border-bottom: none; }
    td.num { text-align: right; }
    .rpt-pts { font-weight: 700; color: #1f2aa6; }
    .rpt-rank { color: #94a3b8; font-size: 12px; text-align: center; width: 28px; }
    .rpt-up   { color: #16a34a; font-weight: 600; }
    .rpt-down { color: #dc2626; font-weight: 600; }
    .rpt-flat { color: #94a3b8; }
    .rpt-dot {
      display: inline-block;
      width: 10px; height: 10px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
      flex-shrink: 0;
    }

    /* ── Caption pills ── */
    .rpt-captions { margin-top: 14px; display: flex; flex-wrap: wrap; gap: 6px; }
    .rpt-pill {
      background: #eef2ff;
      color: #3730a3;
      border-radius: 6px;
      padding: 4px 10px;
      font-size: 12px;
      font-weight: 500;
    }

    /* ── Footer ── */
    .rpt-footer {
      border-top: 1px solid #e2e8f0;
      padding: 13px 32px;
      font-size: 11px;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f8fafc;
    }

    /* ── Print / PDF ── */
    @media print {
      body { background: white; font-size: 11pt; }
      .rpt-print-btn { display: none !important; }
      .rpt-header,
      .rpt-badge,
      .rpt-section-label::before,
      .rpt-dot,
      .rpt-pill,
      .rpt-pts { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .rpt-section { border: 1px solid #ccc; break-inside: avoid; box-shadow: none; }
      @page { margin: 0.75in; size: A4; }
    }`;

  const monochromeOverrides = `
    @media print {
      .rpt-header { background: #222 !important; border-bottom-color: #888 !important; }
      .rpt-badge  { background: #ddd !important; color: #111 !important; }
      .rpt-pts, .rpt-up, .rpt-down { color: #111 !important; }
      .rpt-pill   { background: #eee !important; color: #111 !important; }
      .rpt-dot    { background: #777 !important; }
    }`;

  return monochrome ? base + monochromeOverrides : base;
}

// ── HTML section builders ──────────────────────────────────────────────────────

function deltaClass(d) {
  if (d == null) return "rpt-flat";
  return d > 0 ? "rpt-up" : d < 0 ? "rpt-down" : "rpt-flat";
}
function deltaStr(d) {
  if (d == null || d === 0) return "—";
  return (d > 0 ? "+" : "") + d.toLocaleString("en-GB");
}
function pts(n) {
  return (n ?? 0).toLocaleString("en-GB");
}

function buildHousesSection(housesData, breakdown, captions, periodLabel) {
  if (!housesData.length) return "";

  const hasPrev    = Array.isArray(breakdown.previous?.houses) && breakdown.previous.houses.length > 0;
  const hasTermAvg = Boolean(breakdown.termAverage?.houses);

  const rows = housesData.map((h, idx) => {
    const p         = h.points ?? h.value ?? 0;
    const colorHex  = (h.color || "#94a3b8").replace("#", "");
    const prev      = hasPrev ? breakdown.previous.houses.find(x => x.id === h.id || x.name === h.name) : null;
    const delta     = prev != null ? p - (prev.points ?? prev.value ?? 0) : null;
    const prevPts   = prev != null ? (prev.points ?? prev.value ?? 0) : null;
    const avg       = hasTermAvg ? (breakdown.termAverage.houses[h.id] ?? breakdown.termAverage.houses[h.name] ?? null) : null;

    const prevCells = hasPrev
      ? `<td class="num">${prevPts != null ? pts(prevPts) : "—"}</td>
         <td class="num ${deltaClass(delta)}">${deltaStr(delta)}</td>`
      : "";
    const avgCell = hasTermAvg
      ? `<td class="num rpt-pts">${avg != null ? pts(avg) : "—"}</td>`
      : "";

    return `<tr>
      <td class="rpt-rank">${idx + 1}</td>
      <td><span class="rpt-dot" style="background:#${colorHex}"></span>${h.name || h.id || "—"}</td>
      <td class="num rpt-pts">${pts(p)}</td>
      ${prevCells}${avgCell}
    </tr>`;
  }).join("");

  const capsHtml = buildCaptions(Object.values(captions.houses || {}));

  return `
  <div class="rpt-section">
    <div class="rpt-section-label">House breakdown</div>
    <table class="rpt-table">
      <thead><tr>
        <th class="rpt-rank">#</th>
        <th>House</th>
        <th class="num">This ${periodLabel.toLowerCase()}</th>
        ${hasPrev    ? `<th class="num">Previous</th><th class="num">Change</th>` : ""}
        ${hasTermAvg ? `<th class="num">Term average</th>` : ""}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${capsHtml}
  </div>`;
}

function buildYearsSection(yearsData, breakdown, captions, periodLabel) {
  if (!yearsData.length) return "";

  const hasPrev = Array.isArray(breakdown.previous?.years) && breakdown.previous.years.length > 0;

  const rows = yearsData.map(y => {
    const p       = y.points ?? y.value ?? 0;
    const prev    = hasPrev ? breakdown.previous.years.find(x => x.id === y.id || x.name === y.name) : null;
    const delta   = prev != null ? p - (prev.points ?? prev.value ?? 0) : null;
    const prevPts = prev != null ? (prev.points ?? prev.value ?? 0) : null;

    const prevCells = hasPrev
      ? `<td class="num">${prevPts != null ? pts(prevPts) : "—"}</td>
         <td class="num ${deltaClass(delta)}">${deltaStr(delta)}</td>`
      : "";

    return `<tr>
      <td>${y.name || y.id || "—"}</td>
      <td class="num rpt-pts">${pts(p)}</td>
      ${prevCells}
    </tr>`;
  }).join("");

  const capsHtml = buildCaptions(Object.values(captions.years || {}));

  return `
  <div class="rpt-section">
    <div class="rpt-section-label">Year group breakdown</div>
    <table class="rpt-table">
      <thead><tr>
        <th>Year group</th>
        <th class="num">This ${periodLabel.toLowerCase()}</th>
        ${hasPrev ? `<th class="num">Previous</th><th class="num">Change</th>` : ""}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${capsHtml}
  </div>`;
}

function buildCaptions(values) {
  if (!values.length) return "";
  const pills = values.map(v => `<span class="rpt-pill">${v}</span>`).join("");
  return `<div class="rpt-captions">${pills}</div>`;
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function onRequest({ env, request }) {
  const url      = new URL(request.url);
  const token    = url.searchParams.get("token");
  const audience = url.searchParams.get("audience") || "staff";
  const isParent = audience === "parents";
  const isPdf    = url.searchParams.get("format") === "pdf";
  const monochrome = url.searchParams.get("monochrome") === "true";

  if (token !== env.STAFF_REPORT_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const period      = url.searchParams.get("period") || "week";
  const periodLabel = period === "term" ? "Term" : "Week";

  const safeFetchJson = async (path, fallback) => {
    try {
      const res = await fetch(`${url.origin}${path}`);
      if (!res.ok) return fallback;
      return await res.json();
    } catch {
      return fallback;
    }
  };

  const [breakdown, captions, narrative] = await Promise.all([
    safeFetchJson(`/api/values-breakdown?period=${period}`, { current: { houses: [], years: [] } }),
    safeFetchJson(`/api/values-captions?period=${period}`,  { houses: {}, years: {} }),
    safeFetchJson(`/api/values-narrative?period=${period}`,  { title: "Values summary", paragraph: "", bullets: [] }),
  ]);

  // ── Parent-mode filtering ──────────────────────────────────────────────────
  if (isParent) {
    captions.houses = {};
    captions.years  = {};
    breakdown.previous    = null;
    breakdown.termAverage = null;
    if (breakdown.current?.years) breakdown.current.years = [];
    if (Array.isArray(narrative.bullets)) {
      narrative.bullets = narrative.bullets.filter(b => !b.toLowerCase().includes("compared"));
    }
    narrative.paragraph =
      "Across the school, pupils are consistently recognised for demonstrating our shared values. " +
      "These rewards reflect positive attitudes to learning, kindness towards others, and a strong sense of responsibility.";
  }

  // ── Build page sections ────────────────────────────────────────────────────
  const generatedAt = new Date().toLocaleString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  const housesData = [...(breakdown.current?.houses || [])].sort(
    (a, b) => (b.points ?? b.value ?? 0) - (a.points ?? a.value ?? 0)
  );
  const yearsData = breakdown.current?.years || [];

  const bulletsHtml = (narrative.bullets || []).length > 0
    ? "<ul class='rpt-bullets'>" + narrative.bullets.map(b => `<li>${b}</li>`).join("") + "</ul>"
    : "";

  const housesHtml = isParent ? "" : buildHousesSection(housesData, breakdown, captions, periodLabel);
  const yearsHtml  = isParent ? "" : buildYearsSection(yearsData, breakdown, captions, periodLabel);

  const printBtn = isPdf
    ? `<button class="rpt-print-btn" onclick="window.print()">&#128424;&#xFE0E;&nbsp; Print / Save as PDF</button>`
    : "";

  const title      = isParent ? "School Values Update"    : "Values Evidence Report";
  const badge      = isParent ? "PARENT EDITION"          : "STAFF / OFSTED";
  const footerText = isParent ? "School Community Update" : "Confidential &middot; Staff and Ofsted use only";

  return responseHtml(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} &ndash; ${periodLabel}</title>
  <style>${buildCss(monochrome)}</style>
</head>
<body>

<div class="rpt-header">
  <img src="/favicon.png" alt="School logo" />
  <div>
    <h1>${title}</h1>
    <p>${periodLabel} report &middot; Generated ${generatedAt}</p>
  </div>
  <span class="rpt-badge">${badge}</span>
</div>

<div class="rpt-body">
  ${printBtn}

  <div class="rpt-section">
    <div class="rpt-section-label">${narrative.title || "Values summary"}</div>
    <p class="rpt-para">${narrative.paragraph || ""}</p>
    ${bulletsHtml}
  </div>

  ${housesHtml}
  ${yearsHtml}
</div>

<div class="rpt-footer">
  <span>${footerText}</span>
  <span>Generated ${generatedAt}</span>
</div>

</body>
</html>`);
}
