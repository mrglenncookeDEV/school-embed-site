CREATE TABLE IF NOT EXISTS houses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  teacher_name TEXT NOT NULL,
  teacher_email TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  role TEXT NOT NULL CHECK(role IN ('teacher','admin')),
  class_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(class_id) REFERENCES classes(id)
);

CREATE TABLE IF NOT EXISTS weeks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  week_start TEXT NOT NULL UNIQUE,
  deadline_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS point_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entry_date TEXT NOT NULL,
  week_id INTEGER NOT NULL,
  house_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  points INTEGER NOT NULL CHECK(points >= 0),
  notes TEXT,
  award_category TEXT NOT NULL DEFAULT 'General Award',
  submitted_by_email TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(week_id) REFERENCES weeks(id),
  FOREIGN KEY(house_id) REFERENCES houses(id),
  FOREIGN KEY(class_id) REFERENCES classes(id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_week_class_house 
  ON point_entries(week_id, class_id, house_id);

CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  meta_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO houses (name, color)
SELECT 'Red', '#e11d48'
WHERE NOT EXISTS (SELECT 1 FROM houses WHERE name = 'Red');

INSERT INTO houses (name, color)
SELECT 'Gold', '#fbbf24'
WHERE NOT EXISTS (SELECT 1 FROM houses WHERE name = 'Gold');

INSERT INTO houses (name, color)
SELECT 'Green', '#34d399'
WHERE NOT EXISTS (SELECT 1 FROM houses WHERE name = 'Green');

INSERT INTO houses (name, color)
SELECT 'Blue', '#38bdf8'
WHERE NOT EXISTS (SELECT 1 FROM houses WHERE name = 'Blue');

INSERT INTO classes (name, teacher_name, teacher_email)
SELECT 'Math 101', 'Ms. Reyes', 'reyes@school.edu'
WHERE NOT EXISTS (SELECT 1 FROM classes WHERE name = 'Math 101');

INSERT INTO classes (name, teacher_name, teacher_email)
SELECT 'Science 204', 'Mr. Patel', 'patel@school.edu'
WHERE NOT EXISTS (SELECT 1 FROM classes WHERE name = 'Science 204');

INSERT INTO classes (name, teacher_name, teacher_email)
SELECT 'English 310', 'Ms. Carter', 'carter@school.edu'
WHERE NOT EXISTS (SELECT 1 FROM classes WHERE name = 'English 310');
