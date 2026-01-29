CREATE TABLE classes_new (
  id INTEGER PRIMARY KEY,
  name TEXT,
  YearGrp INTEGER CHECK (YearGrp IN (3,4,5,6)),
  Teacher_Title TEXT CHECK (Teacher_Title IN ('Mr','Mrs','Miss','Ms','Dr')),
  Teacher_FirstName TEXT,
  Teacher_LastName TEXT,
  Teacher_email TEXT
);

INSERT INTO classes_new (
  id,
  name,
  YearGrp,
  Teacher_Title,
  Teacher_FirstName,
  Teacher_LastName,
  Teacher_email
)
SELECT
  id,
  name,
  YearGrp,
  Teacher_Title,
  Teacher_FirstName,
  Teacher_LastName,
  Teacher_email
FROM classes;

DROP TABLE classes;

ALTER TABLE classes_new RENAME TO classes;
