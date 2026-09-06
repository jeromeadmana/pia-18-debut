DROP INDEX "guestbook_approved_created_idx";--> statement-breakpoint
ALTER TABLE "guestbook_messages" ADD COLUMN "is_private" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "guestbook_public_idx" ON "guestbook_messages" USING btree ("is_approved","is_private","created_at" DESC NULLS LAST);