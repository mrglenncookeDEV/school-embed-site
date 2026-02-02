const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const SYSTEM_PROMPT = `
You are writing a short public-facing highlights summary for a school scoreboard.

Rules:
- Use positive, celebratory language only
- You MAY include individual pupil first names if they appear in the comments
- Do NOT invent names
- Do NOT infer behaviour issues
- Focus on effort, teamwork, kindness, achievement
- 2–4 short sentences
- British English
- Suitable for display on a school website
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
  const diff = (day + 6) % 7; // Monday-based week
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
        return { start: term.start_date, end: term.end_date };
      }
    } catch (error) {
      // fall back to week below
      console.error("highlights: term lookup failed", error);
    }
  }

  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  return {
    start: formatDate(weekStart),
    end: formatDate(weekEnd),
  };
};

export async function onRequest({ env, request }) {
  try {
    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period");
    const period = periodParam === "term" ? "term" : "week";

    const { start, end } = await getPeriodRange(period, env.DB);
    if (!start || !end) {
      return json({ text: null });
    }

    const rows = await env.DB.prepare(
      `SELECT notes
       FROM point_entries
       WHERE entry_date BETWEEN ? AND ?
         AND notes IS NOT NULL
         AND TRIM(notes) != ''
       ORDER BY entry_date DESC
       LIMIT 40`
    )
      .bind(start, end)
      .all();

    if (!rows.results?.length) {
      return json({ text: null });
    }

    const combinedNotes = rows.results
    .map((r) => r.notes)
    .join("\n")
    .slice(0, 3000);

    // Try AI first
    if (env.AI) {
      try {
        const aiResponse = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
          messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: combinedNotes },
          ],
          max_tokens: 140,
        });
        const aiText = aiResponse.response?.trim() || null;
        if (aiText) return json({ text: aiText });
      } catch (err) {
        console.error("highlights AI error", err);
      }
    }

    // Fallback (non-AI) summary so something renders during local dev:
    // - uses first few notes
    // - keeps tone positive & brief
    const fallbackNotes = rows.results
      .map((r) => (r.notes || "").trim())
      .filter(Boolean)
      .slice(0, 4);

    if (!fallbackNotes.length) {
      return json({ text: null });
    }

    const first = fallbackNotes[0];
    const rest = fallbackNotes.slice(1);
    const tail = rest.length ? ` More wins: ${rest.join(" · ")}` : "";
    const fallback = `Highlights: ${first}${tail}`;

    return json({ text: fallback });
  } catch (error) {
    console.error("/api/highlights error", error);
    return json({ text: null });
  }
}
