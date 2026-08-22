import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, describe, expect, it } from "vitest";
import { writeCoreMoney } from "../core-money";
import { loadCoreMigration } from "../schema/apply-disposable-ddl";
import {
	coreSchema,
	coreTables,
	moduleConfig,
	party,
	subject,
	transaction,
} from "../schema/core";

describe("core money invariant", () => {
	const client = new PGlite();
	const db = drizzle(client, {
		schema: {
			coreSchema,
			party,
			subject,
			transaction,
			moduleConfig,
			coreTables,
		},
	});

	afterAll(async () => {
		await client.close();
	});

	it("rejects captured_minor that exceeds subject expected_minor at commit", async () => {
		for (const statement of loadCoreMigration("0001_core_tables.sql")) {
			await client.exec(statement);
		}
		for (const statement of loadCoreMigration(
			"0003_core_money_invariant.sql",
		)) {
			await client.exec(statement);
		}

		await writeCoreMoney(db as never, {
			party: {
				id: "11111111-1111-1111-1111-111111111111",
				kind: "person",
				displayName: "Test",
				email: "test@example.com",
			},
			subject: {
				id: "22222222-2222-2222-2222-222222222222",
				kind: "order",
				ownerModule: "orders",
				partyId: "11111111-1111-1111-1111-111111111111",
				currency: "USD",
				expectedMinor: 1000,
				settleState: "open",
			},
			transaction: {
				id: "33333333-3333-3333-3333-333333333333",
				subjectId: "22222222-2222-2222-2222-222222222222",
				authorizedMinor: 1000,
				capturedMinor: 1000,
			},
		});

		await expect(
			client.exec(`
				BEGIN;
				INSERT INTO core.transaction (id, subject_id, authorized_minor, captured_minor, refunded_minor)
				VALUES (
					'44444444-4444-4444-4444-444444444444',
					'22222222-2222-2222-2222-222222222222',
					500,
					500,
					0
				);
				COMMIT;
			`),
		).rejects.toThrow(/subject_overrun|check_violation|exceeds expected/i);
	});
});
