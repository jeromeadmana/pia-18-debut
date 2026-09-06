CREATE TYPE "public"."court_category" AS ENUM('roses', 'candles', 'treasures', 'bills', 'shots', 'cotillion');--> statement-breakpoint
CREATE TYPE "public"."rsvp_status" AS ENUM('pending', 'attending', 'declined');--> statement-breakpoint
CREATE TABLE "court_roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"guest_id" integer,
	"category" "court_category" NOT NULL,
	"position" integer NOT NULL,
	"display_name" text NOT NULL,
	"dedication" text
);
--> statement-breakpoint
CREATE TABLE "guestbook_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"invite_id" integer,
	"author_name" text NOT NULL,
	"body" text NOT NULL,
	"is_approved" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "guests" (
	"id" serial PRIMARY KEY NOT NULL,
	"invite_id" integer NOT NULL,
	"full_name" text NOT NULL,
	"rsvp_status" "rsvp_status" DEFAULT 'pending' NOT NULL,
	"dietary_notes" text,
	"is_primary" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "invites" (
	"id" serial PRIMARY KEY NOT NULL,
	"rsvp_code" text NOT NULL,
	"party_name" text NOT NULL,
	"max_seats" integer DEFAULT 1 NOT NULL,
	"table_id" integer,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seating_tables" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"capacity" integer DEFAULT 10 NOT NULL,
	"location_note" text
);
--> statement-breakpoint
CREATE TABLE "song_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"invite_id" integer NOT NULL,
	"title" text NOT NULL,
	"artist" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "court_roles" ADD CONSTRAINT "court_roles_guest_id_guests_id_fk" FOREIGN KEY ("guest_id") REFERENCES "public"."guests"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guestbook_messages" ADD CONSTRAINT "guestbook_messages_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guests" ADD CONSTRAINT "guests_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_table_id_seating_tables_id_fk" FOREIGN KEY ("table_id") REFERENCES "public"."seating_tables"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "song_requests" ADD CONSTRAINT "song_requests_invite_id_invites_id_fk" FOREIGN KEY ("invite_id") REFERENCES "public"."invites"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "court_roles_category_position_uq" ON "court_roles" USING btree ("category","position");--> statement-breakpoint
CREATE INDEX "court_roles_guest_id_idx" ON "court_roles" USING btree ("guest_id");--> statement-breakpoint
CREATE INDEX "guestbook_approved_created_idx" ON "guestbook_messages" USING btree ("is_approved","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "guests_invite_id_idx" ON "guests" USING btree ("invite_id");--> statement-breakpoint
CREATE INDEX "guests_full_name_lower_idx" ON "guests" USING btree (lower("full_name"));--> statement-breakpoint
CREATE UNIQUE INDEX "invites_rsvp_code_uq" ON "invites" USING btree ("rsvp_code");--> statement-breakpoint
CREATE INDEX "song_requests_invite_id_idx" ON "song_requests" USING btree ("invite_id");--> statement-breakpoint
CREATE UNIQUE INDEX "song_requests_invite_title_uq" ON "song_requests" USING btree ("invite_id",lower("title"));