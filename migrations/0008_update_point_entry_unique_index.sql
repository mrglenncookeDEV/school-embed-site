DROP INDEX IF EXISTS idx_unique_week_class_house;

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_week_class_house_category
  ON point_entries(week_id, class_id, house_id, award_category);
