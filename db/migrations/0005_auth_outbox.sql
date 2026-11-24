CREATE TABLE "auth_outbox" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"url" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
