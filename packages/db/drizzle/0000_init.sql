CREATE TYPE "public"."activity_type" AS ENUM('rekryteringstraff', 'kurs', 'spontanansokan', 'natverkande', 'cv_arbete', 'mote_af', 'ovrigt');--> statement-breakpoint
CREATE TYPE "public"."application_source" AS ENUM('platsbanken', 'linkedin', 'company', 'recruiter', 'other');--> statement-breakpoint
CREATE TYPE "public"."event_origin" AS ENUM('manual', 'auto', 'import');--> statement-breakpoint
CREATE TYPE "public"."intent" AS ENUM('active', 'paused');--> statement-breakpoint
CREATE TYPE "public"."outcome" AS ENUM('avslag', 'inget_svar', 'aterkallad', 'tackade_ja', 'tackade_nej', 'tjansten_tillsatt');--> statement-breakpoint
CREATE TYPE "public"."stage" AS ENUM('bevakad', 'sokt', 'kontakt', 'intervju', 'erbjudande', 'avslutad');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('wishlist', 'applied', 'screening', 'interview', 'forwarded', 'offer', 'accepted', 'rejected', 'no_response', 'withdrawn');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
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
CREATE TABLE "activities" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"type" "activity_type" NOT NULL,
	"occurred_on" date NOT NULL,
	"title" text NOT NULL,
	"organisation" text DEFAULT '' NOT NULL,
	"note" text DEFAULT '' NOT NULL,
	"application_id" text,
	"report_excluded" boolean DEFAULT false NOT NULL,
	"report_note" text DEFAULT '' NOT NULL,
	"reported_in_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_events" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"application_id" text NOT NULL,
	"occurred_at" date NOT NULL,
	"note" varchar(500) NOT NULL,
	"status" "status",
	"from_stage" "stage",
	"to_stage" "stage",
	"event_type" text DEFAULT '' NOT NULL,
	"origin" "event_origin" DEFAULT 'manual' NOT NULL,
	"is_reportable" boolean DEFAULT false NOT NULL,
	"report_excluded" boolean DEFAULT false NOT NULL,
	"reported_in_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"company" text NOT NULL,
	"title" text NOT NULL,
	"location" text DEFAULT '' NOT NULL,
	"ad_url" text DEFAULT '' NOT NULL,
	"ad_url_key" text DEFAULT '' NOT NULL,
	"apply_url" text DEFAULT '' NOT NULL,
	"ad_description" text DEFAULT '' NOT NULL,
	"source_job_id" text DEFAULT '' NOT NULL,
	"source" "application_source",
	"status" "status" DEFAULT 'applied' NOT NULL,
	"stage" "stage" DEFAULT 'sokt' NOT NULL,
	"outcome" "outcome",
	"furthest_stage" "stage" DEFAULT 'sokt' NOT NULL,
	"employer_key" text DEFAULT '' NOT NULL,
	"occupation_concept_id" text DEFAULT '' NOT NULL,
	"occupation_label" text DEFAULT '' NOT NULL,
	"occupation_group_label" text DEFAULT '' NOT NULL,
	"working_hours_type" text DEFAULT '' NOT NULL,
	"scope_of_work_min" smallint,
	"scope_of_work_max" smallint,
	"intent" "intent" DEFAULT 'active' NOT NULL,
	"apply_by" date,
	"apply_by_is_auto" boolean DEFAULT true NOT NULL,
	"applied_at" date,
	"deadline" date,
	"next_action_at" date,
	"last_activity_at" date,
	"closed_at" timestamp with time zone,
	"archived_at" timestamp with time zone,
	"salary_claim" varchar(80) DEFAULT '' NOT NULL,
	"contact_name" text DEFAULT '' NOT NULL,
	"contact_info" text DEFAULT '' NOT NULL,
	"notes" text DEFAULT '' NOT NULL,
	"match_score" smallint,
	"match_snapshot" jsonb,
	"match_version" smallint DEFAULT 0 NOT NULL,
	"match_scored_at" timestamp with time zone,
	"report_excluded" boolean DEFAULT false NOT NULL,
	"report_note" text DEFAULT '' NOT NULL,
	"reported_in_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cached_ads" (
	"id" text PRIMARY KEY NOT NULL,
	"payload" jsonb NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "digest_seen_ads" (
	"saved_search_id" text NOT NULL,
	"ad_id" text NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "digest_seen_ads_saved_search_id_ad_id_pk" PRIMARY KEY("saved_search_id","ad_id")
);
--> statement-breakpoint
CREATE TABLE "report_periods" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"year" smallint NOT NULL,
	"month" smallint NOT NULL,
	"submitted_at" timestamp with time zone,
	"note" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumes" (
	"user_id" text PRIMARY KEY NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"experience" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"education" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"job_profiles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_searches" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"label" varchar(120) DEFAULT '' NOT NULL,
	"query" text DEFAULT '' NOT NULL,
	"regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"municipalities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"occupation_fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"occupation_groups" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"remote" boolean DEFAULT false NOT NULL,
	"match_cv" boolean DEFAULT false NOT NULL,
	"digest_checked_at" timestamp with time zone,
	"digest_opt_in" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"operator_id" varchar(16) NOT NULL,
	"deletion_warned_at" timestamp with time zone,
	"weekly_summary_sent_at" timestamp with time zone,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"weekly_summary_opt_in" boolean DEFAULT true NOT NULL,
	"reminder_opt_in" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_reported_in_id_report_periods_id_fk" FOREIGN KEY ("reported_in_id") REFERENCES "public"."report_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_events" ADD CONSTRAINT "application_events_reported_in_id_report_periods_id_fk" FOREIGN KEY ("reported_in_id") REFERENCES "public"."report_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_reported_in_id_report_periods_id_fk" FOREIGN KEY ("reported_in_id") REFERENCES "public"."report_periods"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digest_seen_ads" ADD CONSTRAINT "digest_seen_ads_saved_search_id_saved_searches_id_fk" FOREIGN KEY ("saved_search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "report_periods" ADD CONSTRAINT "report_periods_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumes" ADD CONSTRAINT "resumes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_searches" ADD CONSTRAINT "saved_searches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_account_key" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "activities_user_date_idx" ON "activities" USING btree ("user_id","occurred_on");--> statement-breakpoint
CREATE INDEX "activities_reported_in_idx" ON "activities" USING btree ("reported_in_id");--> statement-breakpoint
CREATE INDEX "application_events_application_idx" ON "application_events" USING btree ("application_id","occurred_at");--> statement-breakpoint
CREATE INDEX "application_events_reported_in_idx" ON "application_events" USING btree ("reported_in_id");--> statement-breakpoint
CREATE INDEX "applications_user_stage_idx" ON "applications" USING btree ("user_id","stage","applied_at");--> statement-breakpoint
CREATE INDEX "applications_user_archived_idx" ON "applications" USING btree ("user_id","archived_at");--> statement-breakpoint
CREATE INDEX "applications_user_apply_by_idx" ON "applications" USING btree ("user_id","apply_by");--> statement-breakpoint
CREATE INDEX "applications_user_next_action_idx" ON "applications" USING btree ("user_id","next_action_at");--> statement-breakpoint
CREATE INDEX "applications_employer_idx" ON "applications" USING btree ("user_id","employer_key");--> statement-breakpoint
CREATE INDEX "applications_reported_in_idx" ON "applications" USING btree ("reported_in_id");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_user_ad_url_key" ON "applications" USING btree ("user_id","ad_url_key") WHERE "applications"."ad_url_key" <> '';--> statement-breakpoint
CREATE INDEX "cached_ads_fetched_idx" ON "cached_ads" USING btree ("fetched_at");--> statement-breakpoint
CREATE INDEX "digest_seen_ads_seen_idx" ON "digest_seen_ads" USING btree ("seen_at");--> statement-breakpoint
CREATE UNIQUE INDEX "report_periods_user_month_key" ON "report_periods" USING btree ("user_id","year","month");--> statement-breakpoint
CREATE INDEX "saved_searches_user_idx" ON "saved_searches" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_key" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_key" ON "users" USING btree (lower("email"));--> statement-breakpoint
CREATE UNIQUE INDEX "users_operator_id_key" ON "users" USING btree ("operator_id");--> statement-breakpoint
CREATE INDEX "users_last_seen_idx" ON "users" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");