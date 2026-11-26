-- Review tracks: skills on questions, the review bank, lesson runs, and each kid's review skills.
-- Safe to run more than once.

-- Questions carry a skill key (src/lib/skills.ts). Class questions may; bank questions must.
alter table wp_questions add column if not exists skill text;

-- Review-bank questions belong to a grade, not a lesson: exactly one of lesson_id / bank_grade.
alter table wp_questions alter column lesson_id drop not null;
alter table wp_questions add column if not exists bank_grade int;
alter table wp_questions drop constraint if exists wp_questions_lesson_or_bank;
alter table wp_questions add constraint wp_questions_lesson_or_bank check (num_nonnulls(lesson_id, bank_grade) = 1);
alter table wp_questions drop constraint if exists wp_questions_bank_has_skill;
alter table wp_questions add constraint wp_questions_bank_has_skill check (bank_grade is null or skill is not null);
create index if not exists wp_questions_bank_idx on wp_questions (bank_grade, skill) where bank_grade is not null;

-- One lesson or practice run (made by the screen), so the app can tell which answers belong together.
alter table wp_attempts add column if not exists run_id uuid;
create index if not exists wp_attempts_run_idx on wp_attempts (student_id, run_id) where run_id is not null;

-- Each kid's review skills. Rows are kept for history: a removed skill is state 'removed', not deleted.
create table if not exists wp_student_skills (
  student_id         uuid not null references wp_students(id),
  skill              text not null,
  source             text not null check (source in ('pretest', 'next_step', 'auto', 'teacher')),
  state              text not null check (state in ('active', 'mastered', 'removed')),
  spacing            int  not null default 3,     -- when mastered: shows every Nth lesson (3, 6, 12)
  lessons_since      int  not null default 0,     -- lessons since it last appeared
  removed_by_teacher boolean not null default false,
  added_at           timestamptz not null default now(),
  changed_at         timestamptz not null default now(),
  primary key (student_id, skill)
);
alter table wp_student_skills enable row level security;
revoke all on wp_student_skills from anon, authenticated;

-- Lesson runs already counted for the track, so a repeated "lesson finished" call never counts a run twice.
create table if not exists wp_track_runs (
  student_id uuid not null references wp_students(id),
  run_id     uuid not null,
  counted_at timestamptz not null default now(),
  primary key (student_id, run_id)
);
alter table wp_track_runs enable row level security;
revoke all on wp_track_runs from anon, authenticated;

-- The "just for you" questions picked for a kid's lesson, kept until that play-through is finished,
-- so a reload mid-lesson shows the same questions even after the kid has answered some.
create table if not exists wp_review_picks (
  student_id   uuid not null references wp_students(id),
  lesson_id    uuid not null references wp_lessons(id),
  question_ids uuid[] not null,
  picked_at    timestamptz not null default now(),
  primary key (student_id, lesson_id)
);
alter table wp_review_picks enable row level security;
revoke all on wp_review_picks from anon, authenticated;
