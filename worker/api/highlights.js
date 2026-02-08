const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

const SYSTEM_PROMPT = `
You are writing a short public-facing highlights summary for a school scoreboard.

Rules:
- Use positive, celebratory language only
- Keep the tone upbeat and conversational (think "Wow, what a week!" or "Absolutely buzzing")
- Paraphrase the teacher notes and reshape them into an energised narrative instead of repeating them verbatim
- You MAY include individual pupil first names if they appear in the comments
- Do NOT invent names or infer behaviour issues
- Focus on effort, teamwork, kindness, achievement, and community spirit
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
      // fall back to week below
      console.error("highlights: term lookup failed", error);
    }
  }

  const week = await ensureWeek(db, getWeekStart());
  return week ? { mode: "week", weekId: week.id } : { mode: "week", weekId: null };
};

const ensureSentence = (value) => {
  if (!value) return "";
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

export async function onRequest({ env, request }) {
  try {
    const url = new URL(request.url);
    const periodParam = url.searchParams.get("period");
    const period = periodParam === "term" ? "term" : "week";

    const range = await getPeriodRange(period, env.DB);
    if (range.mode === "term" && (!range.start || !range.end)) {
      return json({ text: null });
    }

    const query =
      period === "week"
        ? `SELECT notes
           FROM point_entries
           WHERE week_id = ?
             AND notes IS NOT NULL
             AND TRIM(notes) != ''
           ORDER BY entry_date DESC
           LIMIT 40`
        : `SELECT notes
           FROM point_entries
           WHERE entry_date BETWEEN ? AND ?
             AND notes IS NOT NULL
             AND TRIM(notes) != ''
           ORDER BY entry_date DESC
           LIMIT 40`;
    const rows =
      range.mode === "week"
        ? await env.DB.prepare(query).bind(range.weekId || -1).all()
        : await env.DB.prepare(query).bind(range.start, range.end).all();

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

    const periodDescriptor = period === "term" ? "this term" : "this week";
    const firstSentence = ensureSentence(fallbackNotes[0]);
    const remainingSentences = fallbackNotes
      .slice(1)
      .map((note) => {
        const sentence = ensureSentence(note);
        return sentence ? `Also, ${sentence}` : "";
      })
      .filter(Boolean);
    const opener = firstSentence
      ? `What a vibrant ${periodDescriptor} we've had! ${firstSentence}`
      : `What a vibrant ${periodDescriptor} we've had!`;
    const fallback = [opener, ...remainingSentences].join(" ");

    return json({ text: fallback });
  } catch (error) {
    console.error("/api/highlights error", error);
    return json({ text: null });
  }
}
