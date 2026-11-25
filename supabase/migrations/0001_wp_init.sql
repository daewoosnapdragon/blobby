-- Soft Blobs winter practice: initial schema.
-- Every statement below targets a new wp_ table only. Nothing touches existing tables,
-- no extensions are created, no functions are defined. gen_random_uuid() is built into Postgres 13+.
-- Safe to paste into the Supabase SQL editor.

begin;

-- Classes ------------------------------------------------------------------
create table wp_classes (
  id         uuid primary key default gen_random_uuid(),
  grade      int  not null,
  name       text not null,
  class_code text not null unique
);

-- Students: id comes from the roster export. No Korean name/class or class number is stored.
create table wp_students (
  id           uuid primary key,
  class_id     uuid not null references wp_classes(id),
  display_name text not null,
  blob_color   text,
  link_secret  text not null unique,
  created_at   timestamptz not null default now()
);
create index wp_students_class_idx on wp_students (class_id);

-- Plans, and who they are assigned to ---------------------------------------
create table wp_plans (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  kind       text not null check (kind in ('test', 'winter', 'homework')),
  created_at timestamptz not null default now()
);

create table wp_plan_assignments (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references wp_plans(id) on delete cascade,
  class_id   uuid references wp_classes(id),
  student_id uuid references wp_students(id),
  -- exactly one target: a whole class or a single student
  check (num_nonnulls(class_id, student_id) = 1)
);
create index wp_plan_assignments_plan_idx    on wp_plan_assignments (plan_id);
create index wp_plan_assignments_class_idx   on wp_plan_assignments (class_id);
create index wp_plan_assignments_student_idx on wp_plan_assignments (student_id);

-- Content: plan > week > lesson > question (structural children cascade) ----
create table wp_weeks (
  id        uuid primary key default gen_random_uuid(),
  plan_id   uuid not null references wp_plans(id) on delete cascade,
  position  int  not null,
  skill     text not null,
  opens_on  date
);
create index wp_weeks_plan_idx on wp_weeks (plan_id, position);

create table wp_lessons (
  id       uuid primary key default gen_random_uuid(),
  week_id  uuid not null references wp_weeks(id) on delete cascade,
  position int  not null,
  title    text not null
);
create index wp_lessons_week_idx on wp_lessons (week_id, position);

-- Questions are soft-deleted (deleted_at); the app never hard-deletes them.
create table wp_questions (
  id         uuid primary key default gen_random_uuid(),
  lesson_id  uuid not null references wp_lessons(id) on delete cascade,
  position   int  not null,
  type       text not null,
  payload    jsonb not null,
  audio      jsonb not null default '{}',
  deleted_at timestamptz,
  updated_at timestamptz not null default now()
);
create index wp_questions_lesson_idx on wp_questions (lesson_id, position);

-- Progress (references students, questions, lessons; no cascade) ------------
create table wp_attempts (
  id                uuid primary key default gen_random_uuid(),
  student_id        uuid not null references wp_students(id),
  question_id       uuid not null references wp_questions(id),
  client_attempt_id uuid not null unique,  -- makes retries idempotent
  correct           boolean not null,
  context           text not null check (context in ('lesson', 'free')),
  created_at        timestamptz not null default now()
);
create index wp_attempts_student_idx  on wp_attempts (student_id, created_at);
create index wp_attempts_question_idx on wp_attempts (question_id);

create table wp_lesson_completions (
  id           uuid primary key default gen_random_uuid(),
  student_id   uuid not null references wp_students(id),
  lesson_id    uuid not null references wp_lessons(id),
  completed_at timestamptz not null default now(),
  unique (student_id, lesson_id)
);
create index wp_lesson_completions_lesson_idx on wp_lesson_completions (lesson_id);

create table wp_star_events (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references wp_students(id),
  plan_id    uuid references wp_plans(id),
  amount     int  not null,
  reason     text not null check (reason in ('lesson', 'week_bonus', 'free_correct')),
  ref_id     uuid,  -- lesson id, week id, or attempt id depending on reason
  created_at timestamptz not null default now(),
  unique (student_id, reason, ref_id)
);
create index wp_star_events_student_idx on wp_star_events (student_id, created_at);

create table wp_practice_days (
  student_id uuid not null references wp_students(id),
  day        date not null,  -- Asia/Seoul date, computed by the app
  seconds    int  not null default 0,
  primary key (student_id, day)
);

-- Lockdown: RLS on, and deliberately NO policies, so anon/authenticated get nothing.
-- Privileges are also revoked as a second lock. Only server code (service role / direct DB) reads or writes.
alter table wp_classes            enable row level security;
alter table wp_students           enable row level security;
alter table wp_plans              enable row level security;
alter table wp_plan_assignments   enable row level security;
alter table wp_weeks              enable row level security;
alter table wp_lessons            enable row level security;
alter table wp_questions          enable row level security;
alter table wp_attempts           enable row level security;
alter table wp_lesson_completions enable row level security;
alter table wp_star_events        enable row level security;
alter table wp_practice_days      enable row level security;

revoke all on wp_classes            from anon, authenticated;
revoke all on wp_students           from anon, authenticated;
revoke all on wp_plans              from anon, authenticated;
revoke all on wp_plan_assignments   from anon, authenticated;
revoke all on wp_weeks              from anon, authenticated;
revoke all on wp_lessons            from anon, authenticated;
revoke all on wp_questions          from anon, authenticated;
revoke all on wp_attempts           from anon, authenticated;
revoke all on wp_lesson_completions from anon, authenticated;
revoke all on wp_star_events        from anon, authenticated;
revoke all on wp_practice_days      from anon, authenticated;

commit;
