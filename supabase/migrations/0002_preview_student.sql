-- Practice student ("Try it as a student"): one hidden student per class that the teacher can sign in as.
-- Hidden from class lists, cards and the join page; sees every week of its class's plans unlocked.
alter table wp_students add column if not exists is_preview boolean not null default false;
create unique index if not exists wp_students_one_preview_per_class on wp_students (class_id) where is_preview;
