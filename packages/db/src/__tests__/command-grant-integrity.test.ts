import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const migrationsDirectory = resolve(
	import.meta.dirname,
	"../../prisma/migrations",
);
let database: PGlite;

beforeAll(async () => {
	database = new PGlite({ extensions: { pgcrypto } });
	for (const migration of readdirSync(migrationsDirectory, {
		withFileTypes: true,
	})
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name)
		.sort()) {
		await database.exec(
			readFileSync(
				resolve(migrationsDirectory, migration, "migration.sql"),
				"utf8",
			),
		);
	}
}, 15_000);

afterAll(async () => {
	await database.close();
});

describe("Command grant integrity migration", () => {
	it("rejects a standing reservation after the locked permission has expired", async () => {
		const actor = JSON.stringify({ type: "account", id: "account-expiry" });
		const authority = JSON.stringify({
			id: "membership-expiry",
			type: "store_membership",
			permissions: ["store:update"],
			businessId: "business-expiry",
			storeId: "store-expiry",
		});
		const target = JSON.stringify({ type: "store", id: "store-expiry" });
		await database.exec("BEGIN");
		try {
			await database.query(
				`INSERT INTO "StandingPermission" (
					"id", "granteeType", "granteeId", "grantee", "grantorType",
					"grantorId", "grantor", "authorityType", "authorityId", "authority",
					"businessId", "storeId", "actionName", "actionVersion",
					"validFrom", "validUntil"
				) VALUES (
					'standing-expiry', 'account', 'account-expiry', $1::jsonb, 'account',
					'account-expiry', $1::jsonb, 'store_membership', 'membership-expiry',
					$2::jsonb, 'business-expiry', 'store-expiry',
					'store_runtime.settings.publish', 1,
					'2000-01-01T00:00:00.000Z', '2000-01-01T01:00:00.000Z'
				)`,
				[actor, authority],
			);
			await database.query(
				`INSERT INTO "CommandExecution" (
					"id", "plane", "commandName", "commandVersion", "actionLevel",
					"idempotencyKey", "inputDigest", "redactedInput", "actorType",
					"actorId", "actor", "authorityType", "authorityId", "authority",
					"targetType", "targetId", "target", "status", "startedAt"
				) VALUES (
					'execution-expiry', 'store_runtime', 'store_runtime.settings.publish',
					1, 'confirm_now', 'standing-expiry-idempotency', $1, '{}'::jsonb,
					'account', 'account-expiry', $2::jsonb, 'store_membership',
					'membership-expiry', $3::jsonb, 'store', 'store-expiry', $4::jsonb,
					'running', '2000-01-01T00:30:00.000Z'
				)`,
				["a".repeat(64), actor, authority, target],
			);

			await expect(
				database.query(
					`INSERT INTO "StandingPermissionUseReservation" (
						"id", "standingPermissionId", "commandExecutionId", "amount", "currency"
					) VALUES (
						'reservation-expiry', 'standing-expiry', 'execution-expiry', NULL, NULL
					)`,
				),
			).rejects.toThrow(
				"StandingPermission does not cover this Command execution",
			);
		} finally {
			await database.exec("ROLLBACK");
		}
	});

	it("rejects missing required keys in every JSON authority validator", async () => {
		const result = await database.query<Record<string, boolean>>(`
			SELECT
				"command_target_reference_is_valid"('{}'::jsonb) IS TRUE AS target,
				"command_target_reference_matches"('{}'::jsonb, 'store', 'store-1') IS TRUE AS target_match,
				"command_actor_reference_matches"('{}'::jsonb, 'account', 'account-1') IS TRUE AS actor,
				"command_authority_snapshot_matches"('{}'::jsonb, 'store_membership', 'membership-1') IS TRUE AS authority,
				"change_set_base_revisions_are_valid"('[{}]'::jsonb) IS TRUE AS revisions,
				"change_set_targets_are_valid"('[{}]'::jsonb, '{}'::jsonb) IS TRUE AS targets,
				"change_set_estimated_charges_are_valid"('[{}]'::jsonb) IS TRUE AS charges,
				"change_set_proposal_matches"('{}'::jsonb, 'store', 'store-1') IS TRUE AS proposal
		`);

		expect(result.rows[0]).toEqual({
			target: false,
			target_match: false,
			actor: false,
			authority: false,
			revisions: false,
			targets: false,
			charges: false,
			proposal: false,
		});
	});

	it("invalidates an approved parent when a replacement Change Set is created", async () => {
		const target = JSON.stringify({ type: "store", id: "store-1" });
		const revisions = JSON.stringify([
			{
				target: { type: "store", id: "store-1" },
				revision: "revision-1",
			},
		]);
		const proposal = JSON.stringify({
			command: { name: "store_runtime.settings.publish", version: 1 },
			target: { type: "store", id: "store-1" },
			inputDigest: "a".repeat(64),
		});
		const insertChangeSet = async (
			id: string,
			reviewHash: string,
			supersedesChangeSetId?: string,
		) =>
			database.query(
				`INSERT INTO "ChangeSet" (
					"id", "version", "ownerPlane", "status", "reviewHash",
					"targetType", "targetId", "target", "proposal", "supersedesChangeSetId",
					"baseRevisions", "affectedTargets", "beforeSummary", "afterSummary",
					"publicEffects", "operationalEffects", "estimatedCharges",
					"requiredPermissions", "validationBlocks", "rollbackCoverage"
				) VALUES ($1, 1, 'store_runtime', 'draft', $2, 'store', 'store-1',
					$3::jsonb, $4::jsonb, $5, $6::jsonb, $7::jsonb, '{}'::jsonb,
					'{}'::jsonb, '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
					'["store:update"]'::jsonb, '[]'::jsonb, 'database')`,
				[
					id,
					reviewHash,
					target,
					proposal,
					supersedesChangeSetId ?? null,
					revisions,
					`[${target}]`,
				],
			);

		await insertChangeSet("parent", "1".repeat(64));
		await database.query(
			`INSERT INTO "Approval" (
				"id", "changeSetId", "reviewHash", "baseRevisions", "actorType",
				"actorId", "actor", "authorityType", "authorityId", "authority"
			) VALUES ('approval-parent', 'parent', $1, $2::jsonb, 'account',
				'account-1', $3::jsonb, 'store_membership', 'membership-1', $4::jsonb)`,
			[
				"1".repeat(64),
				revisions,
				JSON.stringify({ type: "account", id: "account-1" }),
				JSON.stringify({
					id: "membership-1",
					type: "store_membership",
					permissions: ["store:update"],
					businessId: "business-1",
					storeId: "store-1",
				}),
			],
		);
		await insertChangeSet("child", "2".repeat(64), "parent");

		const result = await database.query<{
			status: string;
			invalidatedAt: Date | null;
		}>(
			`SELECT c."status", a."invalidatedAt"
			 FROM "ChangeSet" c JOIN "Approval" a ON a."changeSetId" = c."id"
			 WHERE c."id" = 'parent'`,
		);
		expect(result.rows[0]?.status).toBe("conflicted");
		expect(result.rows[0]?.invalidatedAt).not.toBeNull();
	});
});
