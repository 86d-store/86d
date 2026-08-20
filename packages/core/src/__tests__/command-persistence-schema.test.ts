import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const drizzleTables = readFileSync(
	new URL("../../../db/src/schema/tables.ts", import.meta.url),
	"utf8",
);
const grantIntegrityMigration = readFileSync(
	new URL(
		"../../../db/drizzle/0004_command_grant_integrity.sql",
		import.meta.url,
	),
	"utf8",
);

describe("Command grant persistence schema", () => {
	it("models exact review, confirmation, standing, and normalized grant bindings", () => {
		expect(drizzleTables).toContain("changeSetHashVersion");
		expect(drizzleTables).toContain("proposal: jsonb()");
		expect(drizzleTables).toContain("supersedesChangeSetId");
		expect(drizzleTables).toContain("commandBindingHashVersion");
		expect(drizzleTables).toContain("grantUse: jsonb()");
		expect(drizzleTables).toContain("commandName: varchar({ length: 200 })");
		expect(drizzleTables).toContain("bindingHashVersion");
		expect(drizzleTables).toContain("grantorType");
		expect(drizzleTables).toContain("commandExecutionId");
		expect(drizzleTables).toContain(
			'"StandingPermissionUseReservation_commandExecutionId_key"',
		);
		expect(drizzleTables).toContain(
			'uniqueIndex("CommandExecution_approvalId_key")',
		);
		expect(drizzleTables).not.toMatch(
			/index\("Approval_approvalId_idx"\)|@@index\(\[approvalId\]\)/,
		);
	});

	it("installs database enforcement for immutable grants and atomic reservations", () => {
		expect(grantIntegrityMigration.trimStart()).toMatch(/^BEGIN;/);
		expect(grantIntegrityMigration.trimEnd()).toMatch(/COMMIT;$/);
		expect(grantIntegrityMigration).toContain(
			'LOCK TABLE "CommandExecution", "Approval", "Confirmation", "ChangeSet", "StandingPermission", "StandingPermissionUseReservation" IN SHARE ROW EXCLUSIVE MODE',
		);
		expect(grantIntegrityMigration).toContain(
			'CREATE FUNCTION "validate_command_grant_use"',
		);
		expect(grantIntegrityMigration).toContain("DEFERRABLE INITIALLY DEFERRED");
		expect(grantIntegrityMigration).toContain(
			'CREATE FUNCTION "enforce_change_set_immutability"',
		);
		expect(grantIntegrityMigration).toContain(
			'CREATE FUNCTION "enforce_approval_binding"',
		);
		expect(grantIntegrityMigration).toContain(
			'CREATE FUNCTION "enforce_confirmation_one_time_use"',
		);
		expect(grantIntegrityMigration).toContain(
			'CREATE FUNCTION "enforce_standing_permission_immutability"',
		);
		expect(grantIntegrityMigration).toContain(
			'CREATE FUNCTION "enforce_standing_reservation"',
		);
		expect(grantIntegrityMigration).toContain("FOR UPDATE");
		expect(grantIntegrityMigration).toContain(
			"current_setting('app86d.approving_change_set', TRUE)",
		);
		expect(grantIntegrityMigration).toContain(
			'"commandBindingHashVersion" = 1',
		);
		expect(grantIntegrityMigration).toContain(
			"A Business Command requires a Business-global StandingPermission",
		);
		expect(grantIntegrityMigration).toContain(
			'CREATE FUNCTION "validate_command_grant_use"',
		);
		expect(grantIntegrityMigration).toContain(
			'UPDATE "Approval" SET "invalidatedAt" = CURRENT_TIMESTAMP',
		);
		expect(grantIntegrityMigration).toContain(
			'UPDATE "ChangeSet" SET "status" = \'conflicted\'',
		);
	});
});
