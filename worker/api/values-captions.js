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
  const fridayReopen = new Date(monday);
  fridayReopen.setUTCDate(fridayReopen.getUTCDate() + 4);
  fridayReopen.setUTCHours(15, 15, 0, 0);
  if (current >= fridayReopen) {
    monday.setUTCDate(monday.getUTCDate() + 7);
  }
  return monday;
};

const getDeadlineFor = (weekStart) => {
  const deadline = new Date(weekStart);
  deadline.setUTCDate(deadline.getUTCDate() + 4);
  deadline.setUTCHours(14, 25, 0, 0);
  return deadline;
};

const ensureWeek = async (db, weekStart) => {
  const weekStartIso = formatDate(weekStart);
  const deadlineAt = getDeadlineFor(weekStart).toISOString();
  await db
    .prepare(
      `INSERT OR IGNORE INTO weeks (week_start, deadline_at)
       VALUES (?, ?)`
    )
    .bind(weekStartIso, deadlineAt)
    .run();
  const { results } = await db
    .prepare(`SELECT id, week_start FROM weeks WHERE week_start = ?`)
    .bind(weekStartIso)
    .all();
  return results?.[0] || null;
};

const getPeriodRange = async (period, db) => {
  if (period === "term") {
    try {
      const { results } = await db
        .prepare(`SELECT start_date, end_date FROM terms WHERE is_active = 1 LIMIT 1`)
        .all();
      const term = results?.[0];
      if (term?.start_date && term?.end_date) {
        return { mode: "term", start: term.start_date, end: term.end_date };
      }
    } catch (error) {
      console.error("values-captions term lookup failed", error);
    }
  }

  const week = await ensureWeek(db, getWeekStart());
  return week ? { mode: "week", weekId: week.id } : { mode: "week", weekId: null };
};

const sanitizeCaption = (text) => {
  if (!text) return text;
  return text
    .replace(
      /^here is a short positive sentence for each house describing which value was most emphasised:\s*/i,
      ""
    )
    .replace(
      /^here is a short positive sentence describing which value was most emphasised:\s*/i,
      ""
    )
    .trim();
};

export async function onRequest({ env, request }) {
  try {
    const safeRunAI = async (systemPrompt, userPrompt) => {
      if (!env.AI?.run) return null;
      try {
        const res = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 20,
        });
        return res.response?.trim() || null;
      } catch (err) {
        // Local dev (Miniflare) cannot execute AI; fall back silently.
        if (String(err?.message || "").includes("needs to be run remotely")) {
          return null;
        }
        console.error("values-captions AI error (safeRunAI)", err);
        return null;
      }
    };

    const period = new URL(request.url).searchParams.get("period") === "term" ? "term" : "week";
    const range = await getPeriodRange(period, env.DB);

    const weekQuery = `SELECT house_id, award_category, SUM(points) AS total
       FROM point_entries
       WHERE week_id = ?
       GROUP BY house_id, award_category`;
    const weekYearQuery = `SELECT c.YearGrp AS year_group, pe.award_category, SUM(pe.points) AS total
       FROM point_entries pe
       JOIN classes c ON c.id = pe.class_id
       WHERE pe.week_id = ?
       GROUP BY c.YearGrp, pe.award_category
       ORDER BY c.YearGrp ASC`;
    const termQuery = `SELECT house_id, award_category, SUM(points) AS total
       FROM point_entries
       WHERE entry_date BETWEEN ? AND ?
       GROUP BY house_id, award_category`;
    const termYearQuery = `SELECT c.YearGrp AS year_group, pe.award_category, SUM(pe.points) AS total
       FROM point_entries pe
       JOIN classes c ON c.id = pe.class_id
       WHERE pe.entry_date BETWEEN ? AND ?
       GROUP BY c.YearGrp, pe.award_category
       ORDER BY c.YearGrp ASC`;

    const rows =
      range.mode === "week"
        ? await env.DB.prepare(weekQuery).bind(range.weekId || -1).all()
        : await env.DB.prepare(termQuery).bind(range.start, range.end).all();

    const yearRows =
      range.mode === "week"
        ? await env.DB.prepare(weekYearQuery).bind(range.weekId || -1).all()
        : await env.DB.prepare(termYearQuery).bind(range.start, range.end).all();

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

      const rawAiText = await safeRunAI(SYSTEM_PROMPT, `${houseName}: ${top.category}`);
      const aiText = sanitizeCaption(rawAiText);
      houseCaptions[houseId] =
        aiText ||
        `${houseName} showed strong ${top.category?.toLowerCase() || "teamwork"} this ${period}.`;
    }

    const yearCaptions = {};

    for (const yearId of Object.keys(byYear)) {
      const top = byYear[yearId].sort((a, b) => b.points - a.points)[0];
      if (!top) continue;

      const yearLabel = `Year ${yearId}`;

      const rawAiText = await safeRunAI(YEAR_SYSTEM_PROMPT, `${yearLabel}: ${top.category}`);
      const aiText = sanitizeCaption(rawAiText);
      yearCaptions[yearId] =
        aiText ||
        `${yearLabel} highlighted ${top.category?.toLowerCase() || "values"} this ${period}.`;
    }

    return json({ houses: houseCaptions, years: yearCaptions });
  } catch (error) {
    console.error("/api/values-captions error", error);
    return json({ houses: {}, years: {} }, 500);
  }
}
