CREATE TYPE "public"."confidence" AS ENUM('confirmed', 'estimated', 'unverified');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('critical', 'high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('owner', 'guardian', 'mentor', 'recommender');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"actor_id" text,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text,
	"diff" jsonb,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "budget_scenario" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"currency" text NOT NULL,
	"amount_per_year" double precision NOT NULL,
	"weight" double precision,
	"is_central" boolean DEFAULT false NOT NULL,
	"incomes" jsonb,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "event" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"notes" text,
	"all_day" boolean DEFAULT true NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone,
	"timezone" text NOT NULL,
	"rrule" text,
	"confidence" "confidence" DEFAULT 'unverified' NOT NULL,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"institution_id" text,
	"scholarship_id" text,
	"exam_session_id" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reminders" jsonb,
	"external_key" text,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"sections" jsonb,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_session" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"exam_id" text NOT NULL,
	"slug" text NOT NULL,
	"starts_on" text,
	"ends_on" text,
	"registration_opens_at" timestamp with time zone,
	"registration_closes_at" timestamp with time zone,
	"timezone" text,
	"location" text,
	"cost" jsonb,
	"status" text,
	"confidence" "confidence" DEFAULT 'unverified' NOT NULL,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_source" (
	"id" text PRIMARY KEY NOT NULL,
	"source_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"field" text DEFAULT '*' NOT NULL,
	"confidence" "confidence" DEFAULT 'unverified' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fx_rate" (
	"workspace_id" text NOT NULL,
	"base" text NOT NULL,
	"quote" text NOT NULL,
	"rate" double precision NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "fx_rate_workspace_id_base_quote_pk" PRIMARY KEY("workspace_id","base","quote")
);
--> statement-breakpoint
CREATE TABLE "institution" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"names" jsonb,
	"kind" text,
	"country" text,
	"city" text,
	"region" text,
	"lat" double precision,
	"lon" double precision,
	"tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rankings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"climate" jsonb,
	"cost_of_living" jsonb,
	"admission" jsonb,
	"finance" jsonb,
	"details" jsonb,
	"confidence" "confidence" DEFAULT 'unverified' NOT NULL,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invitation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"email" text NOT NULL,
	"role" "role" NOT NULL,
	"permissions" jsonb,
	"token" text NOT NULL,
	"invited_by" text NOT NULL,
	"message" text,
	"expires_at" timestamp with time zone NOT NULL,
	"accepted_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invitation_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "membership" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" "role" NOT NULL,
	"permissions" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "privacy_flag" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"hidden_from" jsonb DEFAULT '["guardian","mentor"]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "program" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"institution_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"field" text,
	"language" text,
	"level" text DEFAULT 'bachelor' NOT NULL,
	"duration_years" integer,
	"tuition" jsonb,
	"requirements" jsonb,
	"confidence" "confidence" DEFAULT 'unverified' NOT NULL,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "requirement_template" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"applies_to" text DEFAULT 'application' NOT NULL,
	"items" jsonb NOT NULL,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scholarship" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"institution_id" text,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"issuer" text,
	"scope" text,
	"country" text,
	"region" text,
	"coverage" jsonb,
	"eligibility" jsonb,
	"how_to_apply" text,
	"deadline_text" text,
	"notes" text,
	"confidence" "confidence" DEFAULT 'unverified' NOT NULL,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "score_snapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"model_id" text NOT NULL,
	"institution_id" text NOT NULL,
	"total" double precision NOT NULL,
	"breakdown" jsonb NOT NULL,
	"category" text,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scoring_model" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"version" integer NOT NULL,
	"name" text NOT NULL,
	"params" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seed_pack" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"slug" text NOT NULL,
	"version" text NOT NULL,
	"title" text NOT NULL,
	"schema_version" integer NOT NULL,
	"summary" jsonb,
	"imported_by" text,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"token" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "source" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text,
	"url" text,
	"title" text NOT NULL,
	"verified_at" timestamp with time zone,
	"verified_by" text,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"display_name" text NOT NULL,
	"nationality" text,
	"country" text,
	"timezone" text,
	"school" jsonb,
	"academics" jsonb,
	"interests" jsonb,
	"preferences" jsonb,
	"career_goal" text,
	"activities" jsonb,
	"extra" jsonb,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "student_profile_workspace_id_unique" UNIQUE("workspace_id")
);
--> statement-breakpoint
CREATE TABLE "study_goal" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"subject" text NOT NULL,
	"target" text,
	"deadline_text" text,
	"deadline" text,
	"notes" text,
	"external_key" text,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_plan" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"name" text NOT NULL,
	"weekly_hours" jsonb NOT NULL,
	"constraints" jsonb,
	"notes" jsonb,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"slug" text NOT NULL,
	"label" text NOT NULL,
	"color" text,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "target_list_item" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"institution_id" text,
	"program_id" text,
	"scholarship_id" text,
	"label" text,
	"list" text DEFAULT 'main' NOT NULL,
	"status" text DEFAULT 'researching' NOT NULL,
	"category" text,
	"priority" integer,
	"reasons" text,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"parent_id" text,
	"title" text NOT NULL,
	"notes" text,
	"status" text DEFAULT 'todo' NOT NULL,
	"due_at" timestamp with time zone,
	"timezone" text,
	"estimate_min" integer,
	"energy" text,
	"context" text,
	"priority" "priority" DEFAULT 'medium' NOT NULL,
	"blocked_by" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"rrule" text,
	"event_id" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"completed_at" timestamp with time zone,
	"external_key" text,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"locale" text DEFAULT 'es' NOT NULL,
	"timezone" text,
	"is_platform_admin" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"locale" text DEFAULT 'es' NOT NULL,
	"settings" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ics_token" text NOT NULL,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspace_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_log" ADD CONSTRAINT "activity_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "budget_scenario" ADD CONSTRAINT "budget_scenario_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_institution_id_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institution"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_scholarship_id_scholarship_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarship"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "event" ADD CONSTRAINT "event_exam_session_id_exam_session_id_fk" FOREIGN KEY ("exam_session_id") REFERENCES "public"."exam_session"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam" ADD CONSTRAINT "exam_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_session" ADD CONSTRAINT "exam_session_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_session" ADD CONSTRAINT "exam_session_exam_id_exam_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."exam"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_source" ADD CONSTRAINT "field_source_source_id_source_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."source"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fx_rate" ADD CONSTRAINT "fx_rate_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "institution" ADD CONSTRAINT "institution_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "membership" ADD CONSTRAINT "membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "privacy_flag" ADD CONSTRAINT "privacy_flag_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program" ADD CONSTRAINT "program_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program" ADD CONSTRAINT "program_institution_id_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "requirement_template" ADD CONSTRAINT "requirement_template_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship" ADD CONSTRAINT "scholarship_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scholarship" ADD CONSTRAINT "scholarship_institution_id_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institution"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshot" ADD CONSTRAINT "score_snapshot_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshot" ADD CONSTRAINT "score_snapshot_model_id_scoring_model_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."scoring_model"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshot" ADD CONSTRAINT "score_snapshot_institution_id_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scoring_model" ADD CONSTRAINT "scoring_model_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seed_pack" ADD CONSTRAINT "seed_pack_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source" ADD CONSTRAINT "source_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_profile" ADD CONSTRAINT "student_profile_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_goal" ADD CONSTRAINT "study_goal_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_plan" ADD CONSTRAINT "study_plan_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_list_item" ADD CONSTRAINT "target_list_item_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_list_item" ADD CONSTRAINT "target_list_item_institution_id_institution_id_fk" FOREIGN KEY ("institution_id") REFERENCES "public"."institution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_list_item" ADD CONSTRAINT "target_list_item_program_id_program_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."program"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "target_list_item" ADD CONSTRAINT "target_list_item_scholarship_id_scholarship_id_fk" FOREIGN KEY ("scholarship_id") REFERENCES "public"."scholarship"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_event_id_event_id_fk" FOREIGN KEY ("event_id") REFERENCES "public"."event"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "activity_ws_time" ON "activity_log" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "budget_ws_key" ON "budget_scenario" USING btree ("workspace_id","key");--> statement-breakpoint
CREATE INDEX "event_ws_start" ON "event" USING btree ("workspace_id","starts_at");--> statement-breakpoint
CREATE UNIQUE INDEX "event_ws_extkey" ON "event" USING btree ("workspace_id","external_key");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_ws_slug" ON "exam" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "exam_session_ws_slug" ON "exam_session" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE INDEX "field_source_res" ON "field_source" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "institution_ws_slug" ON "institution" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "membership_ws_user" ON "membership" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "privacy_res" ON "privacy_flag" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_ws_slug" ON "program" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "req_tpl_ws_slug" ON "requirement_template" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "scholarship_ws_slug" ON "scholarship" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "snapshot_model_inst" ON "score_snapshot" USING btree ("model_id","institution_id");--> statement-breakpoint
CREATE UNIQUE INDEX "model_ws_version" ON "scoring_model" USING btree ("workspace_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "goal_ws_extkey" ON "study_goal" USING btree ("workspace_id","external_key");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_ws_slug" ON "tag" USING btree ("workspace_id","slug");--> statement-breakpoint
CREATE UNIQUE INDEX "task_ws_extkey" ON "task" USING btree ("workspace_id","external_key");