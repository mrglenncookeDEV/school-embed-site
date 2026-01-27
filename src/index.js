import { getCanonicalHouses } from "./config/houses.js";

// Durable Object required by your project config
export class MyDurableObject {
  constructor(state, env) {
    this.state = state;
    this.env = env;
  }

  async fetch() {
    return new Response("OK");
  }
}

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });

async function checkSchema(db) {
  try {
    await db.prepare("SELECT 1 FROM weeks LIMIT 1").all();
    return null;
  } catch (error) {
    if (error.message && error.message.includes("no such table")) {
      return json(
        {
          error:
            "D1 schema missing (weeks table not found). Apply the migrations before calling /api/* (see docs/d1-setup.md).",
        },
        500
      );
    }
    throw error;
  }
}

const formatDate = (date) => date.toISOString().split("T")[0];

const getWeekStart = (date = new Date()) => {
  const current = new Date(date);
  const day = current.getUTCDay();
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() - diff));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
};

const getDeadlineFor = (weekStart) => {
  const deadline = new Date(weekStart);
  deadline.setUTCDate(deadline.getUTCDate() + 4);
  deadline.setUTCHours(12, 0, 0, 0);
  return deadline;
};

const camelizeWeek = (row) => ({
  id: row.id,
  weekStart: row.week_start,
  deadlineAt: row.deadline_at,
});

async function ensureCurrentWeek(db) {
  const weekStart = getWeekStart();
  const weekStartIso = formatDate(weekStart);
  const deadlineAt = getDeadlineFor(weekStart).toISOString();

  // Atomic + idempotent: safe under concurrency
  await db
    .prepare(
      `INSERT OR IGNORE INTO weeks (week_start, deadline_at)
       VALUES (?, ?)`
    )
    .bind(weekStartIso, deadlineAt)
    .run();

  // Guaranteed to exist now
  const { results } = await db
    .prepare(
      `SELECT id, week_start, deadline_at
       FROM weeks
       WHERE week_start = ?
       LIMIT 1`
    )
    .bind(weekStartIso)
    .all();

  return results[0];
}


async function fetchHouses(db) {
  return getCanonicalHouses();
}

async function fetchClasses(db) {
  const { results } = await db
    .prepare("SELECT id, name, teacher_name, teacher_email FROM classes ORDER BY name ASC")
    .all();
  return results;
}

async function fetchScoreboard(db, weekId) {
  const { results: weeklyResults } = await db
    .prepare(
      `SELECT
        h.id AS house_id,
        h.name,
        h.color,
        COALESCE(SUM(pe.points), 0) AS points
      FROM houses h
      LEFT JOIN point_entries pe ON pe.house_id = h.id AND pe.week_id = ?
      GROUP BY h.id
      ORDER BY h.name ASC`
    )
    .bind(weekId)
    .all();

  const { results: allTimeResults } = await db
    .prepare(
      `SELECT
        h.id AS house_id,
        h.name,
        h.color,
        COALESCE(SUM(pe.points), 0) AS points
      FROM houses h
      LEFT JOIN point_entries pe ON pe.house_id = h.id
      GROUP BY h.id
      ORDER BY h.name ASC`
    )
    .all();

  const { results: lastUpdatedResults } = await db
    .prepare(`SELECT MAX(updated_at) AS lastUpdated FROM point_entries WHERE week_id = ?`)
    .bind(weekId)
    .all();

  return {
    totalsThisWeek: weeklyResults.map((row) => ({
      houseId: row.house_id,
      name: row.name,
      color: row.color,
      points: Number(row.points ?? 0),
    })),
    totalsAllTime: allTimeResults.map((row) => ({
      houseId: row.house_id,
      name: row.name,
      color: row.color,
      points: Number(row.points ?? 0),
    })),
    lastUpdated: (lastUpdatedResults[0] && lastUpdatedResults[0].lastUpdated) || null,
  };
}

async function fetchActiveTerm(db) {
  try {
    const { results } = await db.prepare(`SELECT * FROM terms WHERE is_active = 1 LIMIT 1`).all();
    return results[0] || null;
  } catch (error) {
    if (error.message && error.message.includes("no such table")) {
      return null;
    }
    throw error;
  }
}

async function fetchTermScoreboard(db, term) {
  const { results } = await db
    .prepare(
      `SELECT
        h.id AS house_id,
        h.name,
        h.color,
        COALESCE(SUM(pe.points), 0) AS points
      FROM houses h
      LEFT JOIN point_entries pe ON pe.house_id = h.id
      LEFT JOIN weeks w ON w.id = pe.week_id AND w.week_start BETWEEN ? AND ?
      GROUP BY h.id
      ORDER BY h.name ASC`
    )
    .bind(term.start_date, term.end_date)
    .all();

  return results.map((row) => ({
    houseId: row.house_id,
    name: row.name,
    color: row.color,
    points: Number(row.points ?? 0),
  }));
}

async function fetchMissingClasses(db, weekId) {
  const { results } = await db
    .prepare(
      `SELECT
        c.id,
        c.name,
        c.teacher_name,
        c.teacher_email
      FROM classes c
      WHERE NOT EXISTS (
        SELECT 1 FROM point_entries pe
        WHERE pe.class_id = c.id AND pe.week_id = ?
      )
      ORDER BY c.name ASC`
    )
    .bind(weekId)
    .all();

  return results;
}

async function fetchEntries(db, weekId) {
  const { results } = await db
    .prepare(
      `SELECT
        pe.id,
        pe.entry_date,
        pe.points,
        pe.notes,
        pe.submitted_by_email,
        pe.updated_at,
        c.id AS class_id,
        c.name AS class_name,
        h.id AS house_id,
        h.name AS house_name,
        h.color AS house_color
      FROM point_entries pe
      JOIN classes c ON c.id = pe.class_id
      JOIN houses h ON h.id = pe.house_id
      WHERE pe.week_id = ?
      ORDER BY pe.entry_date DESC, pe.id DESC`
    )
    .bind(weekId)
    .all();

  return results;
}

async function countRows(db, table) {
  const { results } = await db.prepare(`SELECT COUNT(*) AS total FROM ${table}`).all();
  return Number(results[0]?.total ?? 0);
}

async function seedDefaultHouses(db) {
  const houses = [
    { name: "Lions", color: "#2563eb" },
    { name: "Tigers", color: "#ef4444" },
    { name: "Eagles", color: "#10b981" },
    { name: "Bears", color: "#facc15" },
  ];
  const before = await countRows(db, "houses");
  for (const house of houses) {
    await db.prepare("INSERT OR IGNORE INTO houses (name, color) VALUES (?, ?)").bind(house.name, house.color).run();
  }
  const after = await countRows(db, "houses");
  return after - before;
}

async function seedDefaultClasses(db) {
  const classes = [
    { name: "Class 1A", teacher_name: "Teacher A", teacher_email: "teacher1@school.org" },
    { name: "Class 1B", teacher_name: "Teacher B", teacher_email: "teacher2@school.org" },
  ];
  const before = await countRows(db, "classes");
  for (const klass of classes) {
    await db
      .prepare("INSERT OR IGNORE INTO classes (name, teacher_name, teacher_email) VALUES (?, ?, ?)")
      .bind(klass.name, klass.teacher_name, klass.teacher_email)
      .run();
  }
  const after = await countRows(db, "classes");
  return after - before;
}

async function logAudit(db, { action, actorEmail, targetType, targetId, meta }) {
  await db
    .prepare(
      `INSERT INTO audit_log (action, actor_email, target_type, target_id, meta_json)
       VALUES (?, ?, ?, ?, ?)`
    )
    .bind(action, actorEmail, targetType, targetId ?? null, meta ? JSON.stringify(meta) : null)
    .run();
}

async function handleEntriesPost(request, db, week) {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const classId = Number(payload.classId);
  const houseId = Number(payload.houseId);
  const points = Number(payload.points);
  const submittedByEmail = payload.submittedByEmail?.trim();
  const notes = payload.notes?.trim() || null;

  if (!classId || !houseId || !Number.isInteger(points)) {
    return json({ error: "classId, houseId, and points are required" }, 400);
  }

  if (points < 0 || points > 500) {
    return json({ error: "Points must be between 0 and 500" }, 400);
  }

  if (!submittedByEmail) {
    return json({ error: "submittedByEmail is required" }, 400);
  }

  const entryDate = formatDate(new Date());

  await db
    .prepare(
      `INSERT INTO point_entries (
        entry_date,
        week_id,
        house_id,
        class_id,
        points,
        notes,
        submitted_by_email,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(week_id, class_id, house_id)
      DO UPDATE SET
        entry_date = excluded.entry_date,
        points = excluded.points,
        notes = excluded.notes,
        submitted_by_email = excluded.submitted_by_email,
        updated_at = datetime('now')`
    )
    .bind(entryDate, week.id, houseId, classId, points, notes, submittedByEmail)
    .run();

  const { results } = await db
    .prepare(
      `SELECT id, entry_date, week_id, house_id, class_id, points, notes, submitted_by_email
       FROM point_entries
       WHERE week_id = ? AND class_id = ? AND house_id = ?
       LIMIT 1`
    )
    .bind(week.id, classId, houseId)
    .all();

  const entry = results[0];
  if (entry) {
    await logAudit(db, {
      action: "create_or_update_entry",
      actorEmail: submittedByEmail,
      targetType: "entry",
      targetId: entry.id,
      meta: { points, notes, weekId: week.id, classId, houseId },
    });
  }

  return json({ entry });
}

async function handleEntryDelete(request, db, entryId) {
  const actorEmailParam = request.headers.get("x-actor-email") || new URL(request.url).searchParams.get("actorEmail");
  const actorEmail = actorEmailParam?.trim() || "system@school.local";

  const { results } = await db
    .prepare(`SELECT id, class_id, house_id, points, notes FROM point_entries WHERE id = ? LIMIT 1`)
    .bind(entryId)
    .all();

  const entry = results[0];
  if (!entry) {
    return json({ error: "Entry not found" }, 404);
  }

  await db.prepare(`DELETE FROM point_entries WHERE id = ?`).bind(entryId).run();

  await logAudit(db, {
    action: "delete_entry",
    actorEmail,
    targetType: "entry",
    targetId: entryId,
    meta: { classId: entry.class_id, houseId: entry.house_id, points: entry.points },
  });

  return json({ deleted: true });
}

async function fetchAudit(db, limit) {
  const { results } = await db
    .prepare(
      `SELECT id, action, actor_email, target_type, target_id, meta_json, created_at
       FROM audit_log
       ORDER BY created_at DESC
       LIMIT ?`
    )
    .bind(limit)
    .all();
  return results.map((row) => ({
    ...row,
    meta: row.meta_json ? JSON.parse(row.meta_json) : null,
  }));
}

async function handleApi(request, env, url) {
  const pathname = url.pathname;
  const method = request.method;

  if (pathname === "/api/message" && method === "GET") {
    return json({ message: "Hello from Worker API" });
  }

  const db = env.DB;
  if (!db) {
    return json({ error: "Database binding not configured" }, 500);
  }

  if (pathname === "/api/houses" && method === "GET") {
    const houses = await fetchHouses(db);
    return json({ houses });
  }

  if (pathname === "/api/classes" && method === "GET") {
    const classes = await fetchClasses(db);
    return json({ classes });
  }

  if (pathname === "/api/admin/seed" && method === "POST") {
    const housesInserted = await seedDefaultHouses(db);
    const classesInserted = await seedDefaultClasses(db);
    return json({ housesInserted, classesInserted });
  }

  if (pathname === "/api/weeks/current" && method === "GET") {
    const week = await ensureCurrentWeek(db);
    return json(camelizeWeek(week));
  }

  if (pathname === "/api/scoreboard/current" && method === "GET") {
    const week = await ensureCurrentWeek(db);
    const scoreboard = await fetchScoreboard(db, week.id);
    const term = await fetchActiveTerm(db);
    let termRows = [];
    let termError = null;
    if (term) {
      termRows = await fetchTermScoreboard(db, term);
    } else {
      termError = "No active term";
    }
    return json({
      ...scoreboard,
      week: {
        ...camelizeWeek(week),
        rows: scoreboard.totalsThisWeek,
      },
      term: term
        ? {
            id: term.id,
            name: term.name,
            start_date: term.start_date,
            end_date: term.end_date,
            is_active: term.is_active,
            rows: termRows,
          }
        : null,
      term_error: termError,
    });
  }

  if (pathname === "/api/missing/current" && method === "GET") {
    const week = await ensureCurrentWeek(db);
    const classes = await fetchMissingClasses(db, week.id);
    return json({ classes });
  }

  if (pathname === "/api/entries" && method === "POST") {
    const week = await ensureCurrentWeek(db);
    return handleEntriesPost(request, db, week);
  }

  if (pathname === "/api/entries" && method === "GET") {
    const weekParam = url.searchParams.get("week");
    if (weekParam !== "current") {
      return json({ error: "Only ?week=current is supported" }, 400);
    }
    const week = await ensureCurrentWeek(db);
    const entries = await fetchEntries(db, week.id);
    return json({ entries });
  }

  if (pathname.startsWith("/api/entries/") && method === "DELETE") {
    const parts = pathname.split("/").filter(Boolean);
    const entryId = Number(parts[2]);
    if (!entryId) {
      return json({ error: "Invalid entry id" }, 400);
    }
    return handleEntryDelete(request, db, entryId);
  }

  if (pathname === "/api/audit" && method === "GET") {
    const limitParam = Number(url.searchParams.get("limit") || 50);
    const limit = Math.min(Math.max(limitParam || 50, 1), 100);
    const audit = await fetchAudit(db, limit);
    return json({ audit });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1) API routes: handled by Worker (D1 etc)
    if (url.pathname.startsWith("/api/")) {
      if (!env.DB) {
        return json({ error: "Database binding not configured" }, 500);
      }

      const schemaResponse = await checkSchema(env.DB);
      if (schemaResponse) {
        return schemaResponse;
      }

      try {
        return await handleApi(request, env, url);
      } catch (error) {
        return json({ error: error.message ?? "Internal error" }, 500);
      }
    }

    // 2) Non-API: serve static assets from /public via Assets binding
    if (env.ASSETS && typeof env.ASSETS.fetch === "function") {
      const assetResponse = await env.ASSETS.fetch(request);

      // If asset exists, return it with cache headers
      if (assetResponse.status !== 404) {
        const res = new Response(assetResponse.body, assetResponse);

        const path = url.pathname;

        // Hashed Vite assets: cache forever
        if (path.startsWith("/assets/")) {
          res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
        }
        // HTML: don’t cache hard (so new deploys show immediately)
        else if (path === "/" || path.endsWith(".html")) {
          res.headers.set("Cache-Control", "no-cache");
        }

        return res;
      }

      // If request looks like a file path (has a .), keep 404 (don’t SPA-fallback)
      const last = url.pathname.split("/").pop() || "";
      const looksLikeFile = last.includes(".");
      if (looksLikeFile) {
        return assetResponse;
      }

      // SPA fallback -> /index.html (also set no-cache)
      const fallbackUrl = new URL(request.url);
      fallbackUrl.pathname = "/index.html";

      const fallbackResponse = await env.ASSETS.fetch(new Request(fallbackUrl, request));
      const res = new Response(fallbackResponse.body, fallbackResponse);
      res.headers.set("Cache-Control", "no-cache");
      return res;
    }

    // 3) If ASSETS binding missing, fail clearly
    return new Response("Assets binding not configured (env.ASSETS missing).", {
      status: 500,
    });
  },
};
