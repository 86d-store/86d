import { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";

describe("auth cuid defaults", () => {
	it("lets Session insert omit cuid the way Better Auth does", async () => {
		const db = new PGlite();
		await db.exec(`
			CREATE TABLE "User" (
				"id" uuid PRIMARY KEY NOT NULL
			);
			CREATE TABLE "Session" (
				"id" uuid PRIMARY KEY NOT NULL,
				"cuid" varchar(30) NOT NULL DEFAULT 'generated-auth-cuid-default',
				"expiresAt" timestamp(3) NOT NULL,
				"token" text NOT NULL,
				"userId" uuid NOT NULL
			);
		`);

		await db.exec(`
			INSERT INTO "User" ("id") VALUES ('11111111-1111-1111-1111-111111111111');
			INSERT INTO "Session" ("id", "cuid", "expiresAt", "token", "userId")
			VALUES (
				'22222222-2222-2222-2222-222222222222',
				DEFAULT,
				CURRENT_TIMESTAMP,
				'token',
				'11111111-1111-1111-1111-111111111111'
			);
		`);

		const rows = await db.query<{ cuid: string }>(
			`SELECT "cuid" FROM "Session"`,
		);
		expect(rows.rows[0]?.cuid).toBe("generated-auth-cuid-default");
	});
});
