// Row types mirroring the wp_ tables. Convention: snake_case keys, exactly as the columns
// are named, because rows come straight from `postgres` (no camelCase transform).
// uuid -> string, timestamptz -> string (ISO) or Date as returned by the driver, date -> string (YYYY-MM-DD; the driver is configured in src/lib/db/options.ts).

export type PlanKind = 'test' | 'winter' | 'homework';
export type AttemptContext = 'lesson' | 'free';
export type StarReason = 'lesson' | 'week_bonus' | 'free_correct';

export interface WpClass { id: string; grade: number; name: string; class_code: string }
export interface WpStudent {
  id: string; class_id: string; display_name: string; blob_color: string | null;
  link_secret: string; created_at: Date;
  /** the class's hidden practice student ("Try it as a student") */
  is_preview: boolean;
}
export interface WpPlan { id: string; title: string; kind: PlanKind; created_at: Date }
export interface WpPlanAssignment {
  id: string; plan_id: string; class_id: string | null; student_id: string | null;
}
export interface WpWeek {
  id: string; plan_id: string; position: number; skill: string; opens_on: string | null;
}
export interface WpLesson { id: string; week_id: string; position: number; title: string }
export interface WpQuestion {
  /** lesson_id for class questions; bank_grade for review-bank questions (exactly one is set) */
  id: string; lesson_id: string | null; bank_grade: number | null; skill: string | null; position: number; type: string;
  payload: unknown; audio: Record<string, unknown>;
  deleted_at: Date | null; updated_at: Date;
}
export interface WpAttempt {
  id: string; student_id: string; question_id: string; client_attempt_id: string;
  correct: boolean; context: AttemptContext; created_at: Date; run_id: string | null;
}
export type SkillSource = 'pretest' | 'next_step' | 'auto' | 'teacher';
export type SkillState = 'active' | 'mastered' | 'removed';
export interface WpStudentSkill {
  student_id: string; skill: string; source: SkillSource; state: SkillState;
  spacing: number; lessons_since: number; removed_by_teacher: boolean; added_at: Date; changed_at: Date;
}
export interface WpLessonCompletion {
  id: string; student_id: string; lesson_id: string; completed_at: Date;
}
export interface WpStarEvent {
  id: string; student_id: string; plan_id: string | null; amount: number;
  reason: StarReason; ref_id: string; created_at: Date;
}
export interface WpPracticeDay { student_id: string; day: string; seconds: number }
