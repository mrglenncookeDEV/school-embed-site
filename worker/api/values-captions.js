const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const SYSTEM_PROMPT = `
You write one short positive sentence per house describing
which value was most emphasised.

Rules:
- Use house name explicitly
- Mention only ONE award category
- No pupil names
- British English
- Suitable for public display
- 8–12 words
`;

const YEAR_SYSTEM_PROMPT = `
You write one short positive sentence describing
which value was most emphasised by this year group.

Rules:
- Start with "Year X"
- Mention only ONE award category
- British English
- 8–12 words
- Suitable for public display
`;

const formatDate = (date) => date.toISOString().split("T")[0];

const getLondonDate = () => {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date());
  const part = (type) => parseInt(parts.find((p) => p.type === type).value, 10);

  return new Date(
    Date.UTC(
      part("year"),
      part("month") - 1,
      part("day"),
      part("hour"),
      part("minute"),
      part("second")
    )
  );
};

const getWeekStart = (date = getLondonDate()) => {
  const current = new Date(date);
  const day = current.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(
    Date.UTC(
      current.getUTCFullYear(),
      current.getUTCMonth(),
      current.getUTCDate() - diff
    )
  );
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
};

const getPeriodRange = async (period, db) => {
  if (period === "term") {
    try {
      const { results } = await db
        .prepare(`SELECT start_date, end_date FROM terms WHERE is_active = 1 LIMIT 1`)
        .all();
      const term = results?.[0];
      if (term?.start_date && term?.end_date) {
        return [term.start_date, term.end_date];
      }
    } catch (error) {
      console.error("values-captions term lookup failed", error);
    }
  }

  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  return [formatDate(weekStart), formatDate(weekEnd)];
};

export async function onRequest({ env, request }) {
  try {
    const period = new URL(request.url).searchParams.get("period") === "term" ? "term" : "week";
    const [start, end] = await getPeriodRange(period, env.DB);

    const rows = await env.DB.prepare(
      `SELECT house_id, award_category, SUM(points) AS total
       FROM point_entries
       WHERE entry_date BETWEEN ? AND ?
       GROUP BY house_id, award_category`
    )
      .bind(start, end)
      .all();

    const yearRows = await env.DB.prepare(
      `SELECT c.YearGrp AS year_group, pe.award_category, SUM(pe.points) AS total
       FROM point_entries pe
       JOIN classes c ON c.id = pe.class_id
       WHERE pe.entry_date BETWEEN ? AND ?
       GROUP BY c.YearGrp, pe.award_category
       ORDER BY c.YearGrp ASC`
    )
      .bind(start, end)
      .all();

    const houseMetaRows = await env.DB.prepare(
      `SELECT id, name
       FROM houses`
    ).all();
    const houseNameMap = {};
    (houseMetaRows.results || []).forEach((h) => {
      houseNameMap[h.id] = h.name || h.id;
    });

    const byHouse = {};
    (rows.results || []).forEach((r) => {
      if (!byHouse[r.house_id]) byHouse[r.house_id] = [];
      byHouse[r.house_id].push({
        category: r.award_category,
        points: r.total,
      });
    });

    const byYear = {};
    (yearRows.results || []).forEach((r) => {
      if (!byYear[r.year_group]) byYear[r.year_group] = [];
      byYear[r.year_group].push({
        category: r.award_category,
        points: r.total,
      });
    });

    const houseCaptions = {};

    for (const houseId of Object.keys(byHouse)) {
      const top = byHouse[houseId].sort((a, b) => b.points - a.points)[0];
      if (!top) continue;

      const houseName = houseNameMap[houseId] || `House ${houseId}`;

      if (!env.AI) {
        houseCaptions[houseId] = `${houseName} showed strong ${top.category?.toLowerCase() || "teamwork"} this ${period}.`;
        continue;
      }

      try {
        const prompt = `${houseName}: ${top.category}`;
        const res = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          max_tokens: 20,
        });
        houseCaptions[houseId] = res.response?.trim() || null;
      } catch (err) {
        console.error("values-captions AI error", err);
        houseCaptions[houseId] = `${houseName} celebrated ${top.category?.toLowerCase() || "values"} this ${period}.`;
      }
    }

    const yearCaptions = {};

    for (const yearId of Object.keys(byYear)) {
      const top = byYear[yearId].sort((a, b) => b.points - a.points)[0];
      if (!top) continue;

      const yearLabel = `Year ${yearId}`;

      if (!env.AI) {
        yearCaptions[yearId] = `${yearLabel} celebrated ${top.category?.toLowerCase() || "teamwork"} this ${period}.`;
        continue;
      }

      try {
        const prompt = `${yearLabel}: ${top.category}`;
        const res = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
          messages: [
            { role: "system", content: YEAR_SYSTEM_PROMPT },
            { role: "user", content: prompt },
          ],
          max_tokens: 20,
        });
        yearCaptions[yearId] = res.response?.trim() || null;
      } catch (err) {
        console.error("values-captions AI error (year)", err);
        yearCaptions[yearId] = `${yearLabel} highlighted ${top.category?.toLowerCase() || "values"} this ${period}.`;
      }
    }

    return json({ houses: houseCaptions, years: yearCaptions });
  } catch (error) {
    console.error("/api/values-captions error", error);
    return json({ houses: {}, years: {} }, 500);
  }
}
