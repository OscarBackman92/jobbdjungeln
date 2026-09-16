CREATE TABLE "rate_limits" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"count" integer NOT NULL,
	"last_request" bigint NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "rate_limits_key_key" ON "rate_limits" USING btree ("key");
--> statement-breakpoint
CREATE TYPE "public"."af_outcome" AS ENUM('genomford', 'ej_genomford');
--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "af_outcome" "af_outcome";
--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'platsanvisning';
--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'platsforslag';
--> statement-breakpoint
ALTER TYPE "public"."activity_type" ADD VALUE 'handlingsplan';
