-- Player feel: the lesson bonus question. Safe to run more than once.

-- Stars for answering the lesson's bonus question right.
alter table wp_star_events drop constraint if exists wp_star_events_reason_check;
alter table wp_star_events add constraint wp_star_events_reason_check
  check (reason in ('lesson', 'week_bonus', 'free_correct', 'lesson_bonus'));

-- The lesson's bonus class question picked for a kid, kept with the "just for you" picks until the lesson is finished.
alter table wp_review_picks add column if not exists bonus_question_id uuid references wp_questions(id);
