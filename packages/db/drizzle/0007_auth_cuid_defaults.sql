-- Better Auth inserts Session/Account/Passkey/Invitation rows without cuid.
-- Without a column default, PostgreSQL stores NULL and NOT NULL rejects login.
ALTER TABLE "Session" ALTER COLUMN "cuid" SET DEFAULT nanoid(24, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'::text);--> statement-breakpoint
ALTER TABLE "Account" ALTER COLUMN "cuid" SET DEFAULT nanoid(24, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'::text);--> statement-breakpoint
ALTER TABLE "Passkey" ALTER COLUMN "cuid" SET DEFAULT nanoid(24, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'::text);--> statement-breakpoint
ALTER TABLE "Invitation" ALTER COLUMN "cuid" SET DEFAULT nanoid(24, '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'::text);
