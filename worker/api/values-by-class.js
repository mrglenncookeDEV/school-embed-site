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
      console.error("values-by-class term lookup failed", error);
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
    const period = new URL(request.url).searchParams.get("period") === "term" ? "term" : "week";
    const { start, end } = await getPeriodRange(period, env.DB);

    const rows = await env.DB.prepare(
      `SELECT
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
      ORDER BY c.name ASC`
    )
      .bind(start, end)
      .all();

    return json({ period, data: rows.results || [] });
  } catch (error) {
    console.error("/api/values-by-class error", error);
    return json({ period: null, data: [] }, 500);
  }
}
