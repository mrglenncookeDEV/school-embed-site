import { getCanonicalHouses } from "./config/houses.js";
import { onRequest as highlights } from "../worker/api/highlights.js";
import { onRequest as valuesBreakdown } from "../worker/api/values-breakdown.js";
import { onRequest as valuesByClass } from "../worker/api/values-by-class.js";
import { onRequest as valuesCaptions } from "../worker/api/values-captions.js";
import { onRequest as valuesReport } from "../worker/reports/values-report.js";

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

const AWARD_CATEGORIES = [
  "General Award",
  "Be Kind",
  "Be Responsible",
  "Be Safe",
  "Be Ready",
];

async function checkSchema(db) {
  try {
    await db.prepare("SELECT 1 FROM weeks LIMIT 1").all();
    return null;
  } catch (error) {
    if (error.message && error.message.includes("no such table")) {
      return json(
        {
          error:
            `D1 schema missing (weeks table not found). Apply the migrations before calling /api/* (see docs/d1-setup.md).`,
        },
        500
      );
    }
    throw error;
  }
}

const formatDate = (date) => date.toISOString().split("T")[0];

const getLondonDate = () => {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(new Date());
  const part = (type) => parseInt(parts.find(p => p.type === type).value, 10);

  // Construct a UTC date that matches the London wall time.
  // This essentially "shifts" the timestamp so that getUTC* methods return London time.
  return new Date(Date.UTC(
    part('year'),
    part('month') - 1,
    part('day'),
    part('hour'),
    part('minute'),
    part('second')
  ));
};

const getWeekStart = (date = getLondonDate()) => {
  const current = new Date(date);
  const day = current.getUTCDay();
  // Adjust to Monday (1) being start of week
  // If Sunday (0), we go back 6 days. If Monday (1), go back 0 days.
  const diff = (day + 6) % 7;
  const monday = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() - diff));
  monday.setUTCHours(0, 0, 0, 0);
  return monday;
};

const getEntryWeekStart = (date = getLondonDate()) => {
  const current = new Date(date);
  const monday = getWeekStart(current);
  const fridayReopen = new Date(monday);
  fridayReopen.setUTCDate(fridayReopen.getUTCDate() + 4);
  fridayReopen.setUTCHours(15, 15, 0, 0);
  if (current >= fridayReopen) {
    const nextMonday = new Date(monday);
    nextMonday.setUTCDate(nextMonday.getUTCDate() + 7);
    return nextMonday;
  }
  return monday;
};

const getDeadlineFor = (weekStart) => {
  const deadline = new Date(weekStart);
  deadline.setUTCDate(deadline.getUTCDate() + 4);
  deadline.setUTCHours(14, 25, 0, 0);
  return deadline;
};

const camelizeWeek = (row) => ({
  id: row.id,
  weekStart: row.week_start,
  deadlineAt: row.deadline_at,
});

async function ensureWeekForStart(db, weekStart) {
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

async function ensureCurrentWeek(db) {
  return ensureWeekForStart(db, getEntryWeekStart());
}


async function fetchHouses(db) {
  const { results } = await db.prepare("SELECT id, name, color, icon FROM houses ORDER BY name ASC").all();
  return results.map((row) => ({
    id: row.id,
    houseId: row.id,
    name: row.name,
    color: row.color,
    icon: row.icon || "shield",
  }));
}

async function handleHousesPost(request, db) {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { name, color, icon } = payload;

  if (!name || !color) {
    return json({ error: "Name and color are required" }, 400);
  }

  try {
    const result = await db
      .prepare("INSERT INTO houses (name, color, icon) VALUES (?, ?, ?)")
      .bind(name, color, icon || "shield")
      .run();

    await logAudit(db, {
      action: "create_house",
      actorEmail: "admin@school.local",
      targetType: "house",
      targetId: result.meta.last_row_id,
      meta: { name, color, icon },
    });

    return json({ success: true, id: result.meta.last_row_id });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return json({ error: "House name already exists" }, 409);
    }
    return json({ error: error.message }, 500);
  }
}

async function handleHousesPut(request, db, houseId) {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { name, color, icon } = payload;

  if (!name || !color) {
    return json({ error: "Name and color are required" }, 400);
  }

  try {
    await db
      .prepare("UPDATE houses SET name = ?, color = ?, icon = ? WHERE id = ?")
      .bind(name, color, icon || "shield", houseId)
      .run();

    await logAudit(db, {
      action: "update_house",
      actorEmail: "admin@school.local",
      targetType: "house",
      targetId: houseId,
      meta: { name, color, icon },
    });

    return json({ success: true });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return json({ error: "House name already exists" }, 409);
    }
    return json({ error: error.message }, 500);
  }
}

async function handleHousesDelete(request, db, houseId) {
  try {
    // Check if house has point entries
    const { results } = await db
      .prepare("SELECT 1 FROM point_entries WHERE house_id = ? LIMIT 1")
      .bind(houseId)
      .all();

    if (results.length > 0) {
      return json({ error: "Cannot delete house with existing point entries" }, 400);
    }

    await db.prepare("DELETE FROM houses WHERE id = ?").bind(houseId).run();

    await logAudit(db, {
      action: "delete_house",
      actorEmail: "admin@school.local",
      targetType: "house",
      targetId: houseId,
    });

    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

async function fetchClasses(db) {
  const { results } = await db
    .prepare(
      `SELECT
        id,
        name,
        YearGrp,
        Teacher_Title,
        Teacher_FirstName,
        Teacher_LastName,
        Teacher_email
      FROM classes
      ORDER BY YearGrp, name`
    )
    .all();
  return results.map((row) => ({
    id: row.id,
    name: row.name,
    YearGrp: row.YearGrp,
    teacherTitle: row.Teacher_Title,
    teacherFirstName: row.Teacher_FirstName,
    teacherLastName: row.Teacher_LastName,
    teacherEmail: row.Teacher_email,
    teacherDisplayName: `${row.Teacher_Title ?? ""} ${row.Teacher_LastName ?? ""}`.trim(),
  }));
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
        c.YearGrp,
        c.Teacher_Title,
        c.Teacher_FirstName,
        c.Teacher_LastName,
        c.Teacher_email
      FROM classes c
      WHERE NOT EXISTS (
        SELECT 1 FROM point_entries pe
        WHERE pe.class_id = c.id AND pe.week_id = ?
      )
      ORDER BY c.YearGrp, c.name ASC`
    )
    .bind(weekId)
    .all();

  return results.map((row) => ({
    id: row.id,
    name: row.name,
    YearGrp: row.YearGrp,
    teacherTitle: row.Teacher_Title,
    teacherFirstName: row.Teacher_FirstName,
    teacherLastName: row.Teacher_LastName,
    teacherEmail: row.Teacher_email,
    teacherDisplayName: `${row.Teacher_Title ?? ""} ${row.Teacher_LastName ?? ""}`.trim(),
  }));
}

async function fetchEntries(db, weekId) {
  const { results } = await db
    .prepare(
      `SELECT
        pe.id,
        pe.entry_date,
        pe.points,
        pe.notes,
        pe.award_category,
        pe.submitted_by_email,
        pe.updated_at,
        c.id AS class_id,
        c.name AS class_name,
        c.Teacher_Title,
        c.Teacher_FirstName,
        c.Teacher_LastName,
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

  return results.map((row) => ({
    ...row,
    teacherDisplayName: [
      row.Teacher_Title,
      row.Teacher_FirstName,
      row.Teacher_LastName,
    ]
      .filter(Boolean)
      .join(" "),
  }));
}

async function fetchAllEntries(db) {
  const { results } = await db
    .prepare(
      `SELECT
        pe.id,
        pe.entry_date,
        pe.points,
        pe.notes,
        pe.award_category,
        pe.submitted_by_email,
        pe.updated_at,
        c.id AS class_id,
        c.name AS class_name,
        c.Teacher_Title,
        c.Teacher_FirstName,
        c.Teacher_LastName,
        h.id AS house_id,
        h.name AS house_name,
        h.color AS house_color
      FROM point_entries pe
      JOIN classes c ON c.id = pe.class_id
      JOIN houses h ON h.id = pe.house_id
      ORDER BY pe.entry_date DESC, pe.id DESC`
    )
    .all();

  return results.map((row) => ({
    ...row,
    teacherDisplayName: [
      row.Teacher_Title,
      row.Teacher_FirstName,
      row.Teacher_LastName,
    ]
      .filter(Boolean)
      .join(" "),
  }));
}

async function fetchEntriesByTerm(db, term) {
  const { results } = await db
    .prepare(
      `SELECT
        pe.id,
        pe.entry_date,
        pe.points,
        pe.notes,
        pe.award_category,
        pe.submitted_by_email,
        pe.updated_at,
        c.id AS class_id,
        c.name AS class_name,
        c.Teacher_Title,
        c.Teacher_FirstName,
        c.Teacher_LastName,
        h.id AS house_id,
        h.name AS house_name,
        h.color AS house_color
      FROM point_entries pe
      JOIN classes c ON c.id = pe.class_id
      JOIN houses h ON h.id = pe.house_id
      JOIN weeks w ON w.id = pe.week_id
      WHERE w.week_start BETWEEN ? AND ?
      ORDER BY pe.entry_date DESC, pe.id DESC`
    )
    .bind(term.start_date, term.end_date)
    .all();

  return results.map((row) => ({
    ...row,
    teacherDisplayName: [
      row.Teacher_Title,
      row.Teacher_FirstName,
      row.Teacher_LastName,
    ]
      .filter(Boolean)
      .join(" "),
  }));
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
    {
      name: "Class 1A",
      YearGrp: 3,
      Teacher_Title: "Ms",
      Teacher_FirstName: "Ada",
      Teacher_LastName: "Smith",
      Teacher_email: "teacher1@school.org",
    },
    {
      name: "Class 1B",
      YearGrp: 3,
      Teacher_Title: "Mr",
      Teacher_FirstName: "Ben",
      Teacher_LastName: "Jones",
      Teacher_email: "teacher2@school.org",
    },
  ];
  const before = await countRows(db, "classes");
  for (const klass of classes) {
    await db
      .prepare(
        "INSERT OR IGNORE INTO classes (name, YearGrp, Teacher_Title, Teacher_FirstName, Teacher_LastName, Teacher_email) VALUES (?, ?, ?, ?, ?, ?)"
      )
      .bind(
        klass.name,
        klass.YearGrp,
        klass.Teacher_Title,
        klass.Teacher_FirstName,
        klass.Teacher_LastName,
        klass.Teacher_email
      )
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

async function handleClassesPost(request, db) {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { name, YearGrp, Teacher_Title, Teacher_FirstName, Teacher_LastName, Teacher_email } = payload;

  if (!name || !YearGrp || !Teacher_Title || !Teacher_LastName || !Teacher_email) {
    return json({ error: "Required fields missing" }, 400);
  }

  try {
    const result = await db
      .prepare(
        `INSERT INTO classes (name, YearGrp, Teacher_Title, Teacher_FirstName, Teacher_LastName, Teacher_email)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      .bind(name, YearGrp, Teacher_Title, Teacher_FirstName || null, Teacher_LastName, Teacher_email)
      .run();

    await logAudit(db, {
      action: "create_class",
      actorEmail: "admin@school.local",
      targetType: "class",
      targetId: result.meta.last_row_id,
      meta: { name, YearGrp, Teacher_email },
    });

    return json({ success: true, id: result.meta.last_row_id });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return json({ error: "Class name or Teacher email already exists" }, 409);
    }
    return json({ error: error.message }, 500);
  }
}

async function handleClassesPut(request, db, classId) {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { name, YearGrp, Teacher_Title, Teacher_FirstName, Teacher_LastName, Teacher_email } = payload;

  if (!name || !YearGrp || !Teacher_Title || !Teacher_LastName || !Teacher_email) {
    return json({ error: "Required fields missing" }, 400);
  }

  try {
    await db
      .prepare(
        `UPDATE classes
         SET name = ?, YearGrp = ?, Teacher_Title = ?, Teacher_FirstName = ?, Teacher_LastName = ?, Teacher_email = ?
         WHERE id = ?`
      )
      .bind(name, YearGrp, Teacher_Title, Teacher_FirstName || null, Teacher_LastName, Teacher_email, classId)
      .run();

    await logAudit(db, {
      action: "update_class",
      actorEmail: "admin@school.local",
      targetType: "class",
      targetId: classId,
      meta: { name, YearGrp, Teacher_email },
    });

    return json({ success: true });
  } catch (error) {
    if (error.message.includes("UNIQUE constraint failed")) {
      return json({ error: "Class name or Teacher email already exists" }, 409);
    }
    return json({ error: error.message }, 500);
  }
}

async function handleClassesDelete(request, db, classId) {
  try {
    // Check if class has point entries
    const { results: entries } = await db
      .prepare("SELECT 1 FROM point_entries WHERE class_id = ? LIMIT 1")
      .bind(classId)
      .all();

    if (entries.length > 0) {
      return json({ error: "Cannot delete class with existing point entries" }, 400);
    }

    // Check if class has users
    const { results: users } = await db
      .prepare("SELECT 1 FROM users WHERE class_id = ? LIMIT 1")
      .bind(classId)
      .all();

    if (users.length > 0) {
      return json({ error: "Cannot delete class with existing users" }, 400);
    }

    await db.prepare("DELETE FROM classes WHERE id = ?").bind(classId).run();

    await logAudit(db, {
      action: "delete_class",
      actorEmail: "admin@school.local",
      targetType: "class",
      targetId: classId,
    });

    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
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
  const awardCategoryRaw = (payload.award_category ?? "").trim();
  const awardCategory = AWARD_CATEGORIES.includes(awardCategoryRaw)
    ? awardCategoryRaw
    : AWARD_CATEGORIES[0];

  if (!classId || !houseId || !Number.isInteger(points)) {
    return json({ error: "classId, houseId, and points are required" }, 400);
  }

  if (points < 0 || points > 500) {
    return json({ error: "Points must be between 0 and 500" }, 400);
  }

  if (!submittedByEmail) {
    return json({ error: "submittedByEmail is required" }, 400);
  }

  const entryDate = formatDate(getLondonDate());

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
        award_category,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(week_id, class_id, house_id)
      DO UPDATE SET
        entry_date = excluded.entry_date,
        points = excluded.points,
        notes = excluded.notes,
        submitted_by_email = excluded.submitted_by_email,
        award_category = excluded.award_category,
        updated_at = datetime('now')`
    )
    .bind(
      entryDate,
      week.id,
      houseId,
      classId,
      points,
      notes,
      submittedByEmail,
      awardCategory
    )
    .run();

  const { results } = await db
    .prepare(
      `SELECT id, entry_date, week_id, house_id, class_id, points, notes, submitted_by_email, award_category
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
      meta: { points, notes, awardCategory, weekId: week.id, classId, houseId },
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

async function fetchTerms(db) {
  const { results } = await db.prepare("SELECT * FROM terms ORDER BY start_date DESC").all();
  return results;
}

async function handleTermsPost(request, db) {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { name, start_date, end_date, is_active } = payload;
  if (!name || !start_date || !end_date) {
    return json({ error: "Name, start_date, and end_date are required" }, 400);
  }

  const isActive = is_active ? 1 : 0;

  try {
    if (isActive) {
      await db.prepare("UPDATE terms SET is_active = 0").run();
    }

    const result = await db
      .prepare(
        "INSERT INTO terms (name, start_date, end_date, is_active, created_at) VALUES (?, ?, ?, ?, datetime('now'))"
      )
      .bind(name, start_date, end_date, isActive)
      .run();

    await logAudit(db, {
      action: "create_term",
      actorEmail: "admin@school.local",
      targetType: "term",
      targetId: result.meta.last_row_id,
      meta: { name, start_date, end_date, is_active: isActive },
    });

    return json({ success: true, id: result.meta.last_row_id });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

async function handleTermsPut(request, db, termId) {
  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return json({ error: "Invalid JSON" }, 400);
  }

  const { name, start_date, end_date, is_active } = payload;
  if (!name || !start_date || !end_date) {
    return json({ error: "Name, start_date, and end_date are required" }, 400);
  }

  const isActive = is_active ? 1 : 0;

  try {
    if (isActive) {
      await db.prepare("UPDATE terms SET is_active = 0 WHERE id != ?").bind(termId).run();
    }

    await db
      .prepare(
        "UPDATE terms SET name = ?, start_date = ?, end_date = ?, is_active = ? WHERE id = ?"
      )
      .bind(name, start_date, end_date, isActive, termId)
      .run();

    await logAudit(db, {
      action: "update_term",
      actorEmail: "admin@school.local",
      targetType: "term",
      targetId: termId,
      meta: { name, start_date, end_date, is_active: isActive },
    });

    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
}

async function handleTermsDelete(request, db, termId) {
  try {
    await db.prepare("DELETE FROM terms WHERE id = ?").bind(termId).run();

    await logAudit(db, {
      action: "delete_term",
      actorEmail: "admin@school.local",
      targetType: "term",
      targetId: termId,
    });

    return json({ success: true });
  } catch (error) {
    return json({ error: error.message }, 500);
  }
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

  if (pathname === `/api/message` && method === "GET") {
    return json({ message: "Hello from Worker API" });
  }

  const db = env.DB;
  if (!db) {
    return json({ error: "Database binding not configured" }, 500);
  }

  if (pathname === `/api/houses` && method === "GET") {
    const houses = await fetchHouses(db);
    return json({ houses });
  }

  if (pathname === `/api/houses` && method === "POST") {
    return handleHousesPost(request, db);
  }

  if (pathname.startsWith(`/api/houses/`) && (method === "PUT" || method === "DELETE")) {
    const parts = pathname.split("/").filter(Boolean);
    const houseId = Number(parts[2]);
    if (!houseId) {
      return json({ error: "Invalid house id" }, 400);
    }
    if (method === "PUT") {
      return handleHousesPut(request, db, houseId);
    }
    if (method === "DELETE") {
      return handleHousesDelete(request, db, houseId);
    }
  }

  if (pathname === `/api/classes` && method === "GET") {
    const classes = await fetchClasses(db);
    return json({ classes });
  }

  if (pathname === `/api/classes` && method === "POST") {
    return handleClassesPost(request, db);
  }

  if (pathname.startsWith(`/api/classes/`) && (method === "PUT" || method === "DELETE")) {
    const parts = pathname.split("/").filter(Boolean);
    const classId = Number(parts[2]);
    if (!classId) {
      return json({ error: "Invalid class id" }, 400);
    }
    if (method === "PUT") {
      return handleClassesPut(request, db, classId);
    }
    if (method === "DELETE") {
      return handleClassesDelete(request, db, classId);
    }
  }

  if (pathname === `/api/admin/seed` && method === "POST") {
    const housesInserted = await seedDefaultHouses(db);
    const classesInserted = await seedDefaultClasses(db);
    return json({ housesInserted, classesInserted });
  }

  if (pathname === `/api/terms` && method === "GET") {
    const terms = await fetchTerms(db);
    return json({ terms });
  }

  if (pathname === `/api/terms` && method === "POST") {
    return handleTermsPost(request, db);
  }

  if (pathname.startsWith(`/api/terms/`) && (method === "PUT" || method === "DELETE")) {
    const parts = pathname.split("/").filter(Boolean);
    const termId = Number(parts[2]);
    if (!termId) {
      return json({ error: "Invalid term id" }, 400);
    }
    if (method === "PUT") {
      return handleTermsPut(request, db, termId);
    }
    if (method === "DELETE") {
      return handleTermsDelete(request, db, termId);
    }
  }

  if (pathname === `/api/weeks/current` && method === "GET") {
    const week = await ensureCurrentWeek(db);
    return json(camelizeWeek(week));
  }

  if (pathname === `/api/scoreboard/current` && method === "GET") {
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

  if (pathname === `/api/missing/current` && method === "GET") {
    const week = await ensureCurrentWeek(db);
    const classes = await fetchMissingClasses(db, week.id);
    return json({ classes });
  }

  if (pathname === `/api/entries` && method === "POST") {
    const week = await ensureWeekForStart(db, getEntryWeekStart());
    return handleEntriesPost(request, db, week);
  }

  if (pathname === `/api/entries` && method === "GET") {
    const weekParam = url.searchParams.get("week");
    const termParam = url.searchParams.get("term");

    if (weekParam === "current") {
      const week = await ensureCurrentWeek(db);
      const entries = await fetchEntries(db, week.id);
      return json({ entries });
    }

    if (weekParam === "all") {
      const entries = await fetchAllEntries(db);
      return json({ entries });
    }

    if (termParam === "current") {
      const term = await fetchActiveTerm(db);
      if (!term) {
        return json({ error: "No active term" }, 404);
      }
      const entries = await fetchEntriesByTerm(db, term);
      return json({ entries });
    }

    // Default to returning all entries for compatibility with admin
    const entries = await fetchAllEntries(db);
    return json({ entries });
  }

  if (pathname.startsWith(`/api/entries/`) && method === "DELETE") {
    const parts = pathname.split("/").filter(Boolean);
    const entryId = Number(parts[2]);
    if (!entryId) {
      return json({ error: "Invalid entry id" }, 400);
    }
    return handleEntryDelete(request, db, entryId);
  }

  if (pathname === `/api/audit` && method === "GET") {
    const limitParam = Number(url.searchParams.get("limit") || 50);
    const limit = Math.min(Math.max(limitParam || 50, 1), 100);
    const audit = await fetchAudit(db, limit);
    return json({ audit });
  }

  if (pathname === `/api/highlights` && method === "GET") {
    return highlights({ env, request });
  }

  if (pathname === `/api/values-breakdown` && method === "GET") {
    return valuesBreakdown({ env, request });
  }

  if (pathname === `/api/values-by-class` && method === "GET") {
    return valuesByClass({ env, request });
  }

  if (pathname === `/api/values-captions` && method === "GET") {
    return valuesCaptions({ env, request });
  }

  if (pathname === "/reports/values" && method === "GET") {
    return valuesReport({ env, request });
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env, ctx) {
    const originalUrl = new URL(request.url);

    // OLD workers.dev domain → show moved message
    if (originalUrl.hostname.endsWith(".workers.dev")) {
      return new Response(
        `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Site moved</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #f8fafc;
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .card {
      background: white;
      padding: 32px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,.08);
      text-align: center;
    }
    a {
      display: inline-block;
      margin-top: 16px;
      padding: 10px 18px;
      background: #2563eb;
      color: white;
      border-radius: 6px;
      text-decoration: none;
    }
  </style>
</head>
<body>
  <div class="card">
    <h2>This site has moved</h2>
    <p>Please use the new address:</p>
    <a href="https://folville.co.uk/houses/">Open Folville Houses</a>
  </div>
</body>
</html>
`,
        { headers: { "content-type": "text/html" } }
      );
    }

    // Normalize /houses → /houses/
    if (originalUrl.pathname === "/houses") {
      return Response.redirect(originalUrl.origin + "/houses/", 301);
    }

    let pathname = originalUrl.pathname;

    // Strip /houses prefix
    if (pathname.startsWith("/houses")) {
      pathname = pathname.replace(/^\/houses/, "") || "/";
    }

    const url = new URL(request.url);
    url.pathname = pathname;

    // API ROUTES
    if (pathname.startsWith("/api/")) {
      if (!env.DB) {
        return new Response("DB missing", { status: 500 });
      }

      const apiRequest = new Request(url.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

try {
  return await handleApi(apiRequest, env, url);
} catch (err) {
  return new Response(
    JSON.stringify({
      workerError: true,
      message: err?.message,
      stack: err?.stack,
    }),
    {
      status: 500,
      headers: { "content-type": "application/json" },
    }
  );
}    }

    // STATIC ASSETS + SPA FALLBACK
    if (!env.ASSETS) {
      return new Response("Assets missing", { status: 500 });
    }

    const assetRequest = new Request(url.toString(), request);
    const assetResponse = await env.ASSETS.fetch(assetRequest);

    if (assetResponse.status !== 404) {
      return assetResponse;
    }

    // SPA fallback for ANY frontend route
    const accept = request.headers.get("accept");
    if (accept && accept.includes("text/html")) {
      const indexUrl = new URL(request.url);
      indexUrl.pathname = "/houses/index.html";
      const houseIndex = await env.ASSETS.fetch(indexUrl.toString());
      if (houseIndex.status !== 404) {
        return houseIndex;
      }
      indexUrl.pathname = "/index.html";
      return env.ASSETS.fetch(indexUrl.toString());
    }

    return assetResponse;
  },
};
