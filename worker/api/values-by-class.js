const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

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
  const diff = (day + 6) % 7; // Monday based
  const monday = new Date(
    Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() - diff)
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
      console.error("values-by-class term lookup failed", error);
    }
  }

  const week = await ensureWeek(db, getWeekStart());
  return week ? { mode: "week", weekId: week.id } : { mode: "week", weekId: null };
};

export async function onRequest({ env, request }) {
  try {
    const period = new URL(request.url).searchParams.get("period") === "term" ? "term" : "week";
    const range = await getPeriodRange(period, env.DB);
    const query =
      range.mode === "week"
        ? `SELECT
            c.id AS class_id,
            c.name AS class_name,
            c.Teacher_Title AS teacher_title,
            c.Teacher_FirstName AS teacher_first_name,
            c.Teacher_LastName AS teacher_last_name,
            pe.house_id,
            pe.award_category,
            SUM(pe.points) AS total_points
          FROM point_entries pe
          JOIN classes c ON c.id = pe.class_id
          WHERE pe.week_id = ?
          GROUP BY c.id, pe.house_id, pe.award_category
          ORDER BY c.name ASC`
        : `SELECT
            c.id AS class_id,
            c.name AS class_name,
            c.Teacher_Title AS teacher_title,
            c.Teacher_FirstName AS teacher_first_name,
            c.Teacher_LastName AS teacher_last_name,
            pe.house_id,
            pe.award_category,
            SUM(pe.points) AS total_points
          FROM point_entries pe
          JOIN classes c ON c.id = pe.class_id
          WHERE pe.entry_date BETWEEN ? AND ?
          GROUP BY c.id, pe.house_id, pe.award_category
          ORDER BY c.name ASC`;

    const rows =
      range.mode === "week"
        ? await env.DB.prepare(query).bind(range.weekId || -1).all()
        : await env.DB.prepare(query).bind(range.start, range.end).all();

    return json({ period, data: rows.results || [] });
  } catch (error) {
    console.error("/api/values-by-class error", error);
    return json({ period: null, data: [] }, 500);
  }
}
