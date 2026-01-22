-- Migration: 0008_child_time_limit
-- Adds a custom daily time limit per child.
ALTER TABLE student_profiles ADD COLUMN daily_time_limit_seconds INTEGER DEFAULT 900;
