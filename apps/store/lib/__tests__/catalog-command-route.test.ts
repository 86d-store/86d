import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import type { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { catalogDraftCommandReference } from "../catalog-command-executor";

const mockEnv = vi.hoisted(() => ({
	STORE_ID: "store-1",
	BETTER_AUTH_SECRET: "command-conformance-digest-key-0001",
}));
const mockCreateCatalogCommandExecutor = vi.hoisted(() => vi.fn());

vi.mock("env", () => ({
	default: mockEnv,
}));
vi.mock("../catalog-command-executor", async (importOriginal) => {
	const actual =
		await importOriginal<typeof import("../catalog-command-executor")>();
	return {
		...actual,
		createCatalogCommandExecutor: mockCreateCatalogCommandExecutor,
	};
});

import {
	handleCatalogRevisionCommand,
	matchCatalogRevisionCommandPath,
} from "../catalog-command-route";

const libDir = dirname(fileURLToPath(import.meta.url));
const session = {
	user: { id: "account-owner", role: "admin" },
	session: { id: "session-admin" },
};

function jsonRequest(body: unknown): NextRequest {
	return {
		json: async () => body,
	} as NextRequest;
}

afterEach(() => {
	mockEnv.BETTER_AUTH_SECRET = "command-conformance-digest-key-0001";
	vi.clearAllMocks();
});

describe("Catalog Command transport", () => {
	it("fails closed when the Store authentication secret is missing", async () => {
		mockEnv.BETTER_AUTH_SECRET = "";

		const response = await handleCatalogRevisionCommand(
			jsonRequest({
				operationId: "catalog-draft-0001",
				revisionId: "revision-1",
				content: {
					version: 1,
					currency: "USD",
					categories: [],
					products: [],
					variants: [],
				},
			}),
			session as never,
			{ action: "draft" },
		);

		expect(response.status).toBe(503);
		await expect(response.json()).resolves.toEqual({
			error: {
				code: "COMMAND_DIGEST_KEY_UNAVAILABLE",
				message:
					"Store Commands are unavailable until the Store authentication secret is configured.",
			},
		});
		expect(mockCreateCatalogCommandExecutor).not.toHaveBeenCalled();
	});

	it("derives the Command digest key from the parsed Store authentication secret", async () => {
		const execute = vi.fn().mockResolvedValue({
			ok: false,
			failure: {
				code: "execution_failed",
				message: "stopped after identity",
				retryable: false,
			},
		});
		mockCreateCatalogCommandExecutor.mockResolvedValue({ execute });

		await handleCatalogRevisionCommand(
			jsonRequest({
				operationId: "catalog-draft-0001",
				revisionId: "revision-1",
				content: {
					version: 1,
					currency: "USD",
					categories: [],
					products: [],
					variants: [],
				},
			}),
			session as never,
			{ action: "draft" },
		);

		const digestKey = createHash("sha256")
			.update("86d.store-command.digest.v1\0")
			.update("command-conformance-digest-key-0001")
			.digest("hex");
		expect(mockCreateCatalogCommandExecutor).toHaveBeenCalledWith(
			expect.objectContaining({ digestKey }),
		);
		expect(execute).toHaveBeenCalledWith(
			expect.objectContaining({
				command: catalogDraftCommandReference,
				target: { type: "store", id: "store-1" },
			}),
			expect.objectContaining({
				principal: {
					type: "session",
					credentialId: "session-admin",
					sessionId: "session-admin",
				},
			}),
		);
	});

	it("rejects grant-like money fields on the transport body", async () => {
		const response = await handleCatalogRevisionCommand(
			jsonRequest({
				operationId: "catalog-publish-0001",
				expectedContentDigest: "a".repeat(64),
				amount: "10.00",
				currency: "USD",
				tax: 0,
				shipping: "free",
				paymentSuccess: true,
			}),
			session as never,
			{ action: "publish", revisionId: "revision-1" },
		);

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({
			error: { code: "INVALID_CATALOG_REVISION" },
		});
		expect(mockCreateCatalogCommandExecutor).not.toHaveBeenCalled();
	});

	it("matches Admin Command paths and ignores catalog reads", () => {
		expect(
			matchCatalogRevisionCommandPath("/admin/catalog/revisions/create"),
		).toEqual({
			action: "draft",
		});
		expect(
			matchCatalogRevisionCommandPath(
				"/admin/catalog/revisions/revision-1/review",
			),
		).toEqual({ action: "review", revisionId: "revision-1" });
		expect(
			matchCatalogRevisionCommandPath(
				"/admin/catalog/revisions/revision-1/publish",
			),
		).toEqual({ action: "publish", revisionId: "revision-1" });
		expect(
			matchCatalogRevisionCommandPath("/admin/catalog/revisions/list"),
		).toBeNull();
		expect(
			matchCatalogRevisionCommandPath("/admin/catalog/revisions/revision-1"),
		).toBeNull();
		expect(
			matchCatalogRevisionCommandPath("/catalog/revisions/create"),
		).toBeNull();
	});

	it("does not import 86d.app or Control Plane clients", () => {
		const source = readFileSync(
			join(libDir, "../catalog-command-route.ts"),
			"utf8",
		);
		expect(source).not.toMatch(/control.?plane/i);
		expect(source).not.toMatch(/from ["']api\//);
		expect(source).not.toMatch(/86D_API_KEY/);
	});
});
