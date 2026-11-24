CREATE TABLE "media" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"mime" text NOT NULL,
	"bytes" "bytea" NOT NULL,
	"width" integer,
	"height" integer,
	"caption" text,
	"is_cover" boolean DEFAULT false NOT NULL,
	"created_by" text,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "target_list_item" ADD COLUMN "gut" integer;--> statement-breakpoint
ALTER TABLE "target_list_item" ADD COLUMN "pros" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "target_list_item" ADD COLUMN "cons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "target_list_item" ADD COLUMN "notes" text;--> statement-breakpoint
ALTER TABLE "target_list_item" ADD COLUMN "position" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "media" ADD CONSTRAINT "media_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "media_res" ON "media" USING btree ("resource_type","resource_id");--> statement-breakpoint
CREATE INDEX "tli_ws_list" ON "target_list_item" USING btree ("workspace_id","list");