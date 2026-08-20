import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const coreCommandsSchema = readFileSync(
	new URL("../../prisma/commands.prisma", import.meta.url),
	"utf8",
);
const databaseCommandsSchema = readFileSync(
	new URL("../../../db/prisma/commands.prisma", import.meta.url),
	"utf8",
);
const grantIntegrityMigration = readFileSync(
	new URL(
		"../../../db/prisma/migrations/20260812090000_command_grant_integrity/migration.sql",
		import.meta.url,
	),
	"utf8",
);

describe("Command grant persistence schema", () => {
	it("keeps the generated-client and migration-owner schemas identical", () => {
		expect(coreCommandsSchema).toBe(databaseCommandsSchema);
	});

	it("models exact review, confirmation, standing, and normalized grant bindings", () => {
		expect(coreCommandsSchema).toContain("changeSetHashVersion Int");
		expect(coreCommandsSchema).toMatch(/proposal\s+Json/);
		expect(coreCommandsSchema).toContain("supersedesChangeSetId String?");
		expect(coreCommandsSchema).toContain("commandBindingHashVersion Int?");
		expect(coreCommandsSchema).toMatch(/grantUse\s+Json\?/);
		expect(coreCommandsSchema).toMatch(/commandName\s+String/);
		expect(coreCommandsSchema).toContain("bindingHashVersion Int");
		expect(coreCommandsSchema).toContain("grantorType String");
		expect(coreCommandsSchema).toMatch(/commandExecutionId\s+String/);
		expect(coreCommandsSchema).toContain(
			'@@unique([commandExecutionId], map: "StandingPermissionUseReservation_commandExecutionId_key")',
		);
		expect(coreCommandsSchema).toMatch(/approvalId\s+String\?\s+@unique/);
		expect(coreCommandsSchema).not.toContain("@@index([approvalId])");
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
			'CREATE UNIQUE INDEX "StandingPermissionUseReservation_commandExecutionId_key"',
		);
		expect(grantIntegrityMigration).toContain(
			'UPDATE "Approval" SET "invalidatedAt" = CURRENT_TIMESTAMP',
		);
		expect(grantIntegrityMigration).toContain(
			'UPDATE "ChangeSet" SET "status" = \'conflicted\'',
		);
	});
});
