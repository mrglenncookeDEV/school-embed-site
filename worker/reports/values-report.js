const html = (body) =>
  new Response(body, { headers: { "content-type": "text/html" } });

export async function onRequest({ env, request }) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");
  const audience = url.searchParams.get("audience") || "staff";
  const isParent = audience === "parents";

  if (token !== env.STAFF_REPORT_SECRET) {
    return new Response("Forbidden", { status: 403 });
  }

  const period = url.searchParams.get("period") || "week";

  const safeFetchJson = async (path, fallback) => {
    try {
      const res = await fetch(`${url.origin}${path}`);
      return await res.json();
    } catch {
      return fallback;
    }
  };

  const breakdown = await safeFetchJson(
    `/api/values-breakdown?period=${period}`,
    { current: { houses: [], years: [] } }
  );

  const captions = await safeFetchJson(
    `/api/values-captions?period=${period}`,
    { houses: {}, years: {} }
  );

  const narrative = await safeFetchJson(
    `/api/values-narrative?period=${period}`,
    { title: "Values summary", paragraph: "", bullets: [] }
  );

  if (isParent) {
    captions.houses = {};
    captions.years = {};
    breakdown.previous = null;
    breakdown.termAverage = null;
    if (breakdown.current?.years) breakdown.current.years = [];
    if (Array.isArray(narrative.bullets)) {
      narrative.bullets = narrative.bullets.filter(
        (b) => !b.toLowerCase().includes("compared")
      );
    }
    narrative.paragraph =
      "Across the school, pupils are consistently recognised for demonstrating our shared values. " +
      "These rewards reflect positive attitudes to learning, kindness towards others, and a strong sense of responsibility.";
  }

  return html(`
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Values Report</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; padding: 32px; color: #111; }
    h1, h2, h3 { margin-bottom: 0.4em; }
    .badge { display: inline-block; padding: 6px 12px; border-radius: 999px; font-weight: 600; background: #fef3c7; color: #b45309; }
    .section { margin-top: 32px; }
    .footer { margin-top: 48px; font-size: 12px; color: #666; }
    ul { padding-left: 20px; }
  </style>
</head>
<body>

<img src="/favicon.png" width="48" style="float:right" />

<h1>Living our values through points</h1>
<p>${period === "week" ? "Weekly report" : "Term report"}</p>

<div class="section">
  <h2>${narrative.title}</h2>
  <p>${narrative.paragraph}</p>
</div>

<div class="section">
  <h3>Evidence</h3>
  <ul>
    ${(narrative.bullets || []).map((b) => `<li>${b}</li>`).join("")}
  </ul>
</div>

<div class="section">
  <h3>Captions</h3>
  <p>Houses: ${Object.values(captions.houses || {}).join("; ") || "—"}</p>
  <p>Years: ${Object.values(captions.years || {}).join("; ") || "—"}</p>
</div>

<div class="footer">
  Confidential — staff use only
</div>

</body>
</html>
`);
}
