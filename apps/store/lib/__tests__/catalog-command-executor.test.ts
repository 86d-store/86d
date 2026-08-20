import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import {
	type CatalogRevisionContent,
	digestCatalogRevisionContent,
} from "@86d-app/products";
import {
	createInMemoryCommandPersistence,
	type MemoryCommandTransaction,
} from "@86d-app/runtime/command";
import { describe, expect, it, vi } from "vitest";
import {
	catalogDraftCommandReference,
	catalogPublishCommandReference,
	catalogReviewCommandReference,
	composeCatalogCommandExecutor,
	createStoreAdminCatalogAuthority,
} from "../catalog-command-executor";

vi.mock("env", () => ({
	default: {
		STORE_ID: "store-1",
		BETTER_AUTH_SECRET: "command-conformance-digest-key-0001",
	},
}));
vi.mock("db", () => ({
	db: {},
}));
vi.mock("../api-registry", () => ({
	ensureBooted: async () => ({
		getModuleDbId: () => "products-module-db-id",
	}),
}));

const storeId = "store-1";
const digestKey = "command-conformance-digest-key-0001";
const occurredAt = new Date("2026-08-16T12:00:00.000Z");
const libDir = dirname(fileURLToPath(import.meta.url));

const content = {
	version: 1,
	currency: "USD",
	categories: [
		{
			id: "category-dogs",
			name: "Dogs",
			slug: "dogs",
			position: 0,
			isVisible: true,
			metadata: {},
		},
	],
	products: [
		{
			id: "product-leash",
			name: "Trail Leash",
			slug: "trail-leash",
			price: 2_500,
			status: "active",
			categoryId: "category-dogs",
			images: ["https://store.example/products/trail-leash.jpg"],
			tags: ["walking"],
			metadata: {},
			isFeatured: true,
		},
	],
	variants: [],
} satisfies CatalogRevisionContent;

const draftInput = {
	operationId: "catalog-draft-0001",
	revisionId: "revision-1",
	content,
} as const;

function principal() {
	return {
		principal: {
			type: "session" as const,
			credentialId: "session-admin",
			sessionId: "session-admin",
		},
	};
}

function createHarness(options?: { beforeEmit?: () => void }) {
	const runner = createMockTransactionRunner({
		storeId,
		...(options?.beforeEmit === undefined
			? {}
			: { beforeEmit: options.beforeEmit }),
	});
	let ids = 0;
	const executor = composeCatalogCommandExecutor<MemoryCommandTransaction>({
		storeId,
		authority: createStoreAdminCatalogAuthority({
			storeId,
			userId: "account-owner",
			sessionId: "session-admin",
			role: "admin",
		}),
		digestKey,
		clock: () => occurredAt,
		createId: (kind) => `${kind}-${++ids}`,
		persistence: createInMemoryCommandPersistence(),
		runOnOwnerTransaction: async (_transaction, operation) =>
			runner.transaction((transaction) => operation(transaction)),
	});
	return { executor, runner };
}

async function draftThenReview(
	harness: ReturnType<typeof createHarness>,
	digest: string,
) {
	await harness.executor.execute(
		{
			command: catalogDraftCommandReference,
			idempotencyKey: draftInput.operationId,
			target: { type: "store", id: storeId },
			input: draftInput,
		},
		principal(),
	);
	return harness.executor.execute(
		{
			command: catalogReviewCommandReference,
			idempotencyKey: "catalog-review-0001",
			target: { type: "store", id: storeId },
			input: {
				operationId: "catalog-review-0001",
				revisionId: "revision-1",
				expectedContentDigest: digest,
			},
		},
		principal(),
	);
}

describe("Catalog revision Commands", () => {
	it("refuses review and publish without a server-authenticated principal", async () => {
		const { executor, runner } = createHarness();
		const digest = await digestCatalogRevisionContent(content);

		const draft = await executor.execute(
			{
				command: catalogDraftCommandReference,
				idempotencyKey: draftInput.operationId,
				target: { type: "store", id: storeId },
				input: draftInput,
			},
			{ principal: { type: "system", credentialId: "" } },
		);
		const publish = await executor.execute(
			{
				command: catalogPublishCommandReference,
				idempotencyKey: "catalog-publish-0001",
				target: { type: "store", id: storeId },
				input: {
					operationId: "catalog-publish-0001",
					revisionId: "revision-1",
					expectedContentDigest: digest,
				},
			},
			{ principal: { type: "system", credentialId: "" } },
		);

		expect(draft).toMatchObject({
			ok: false,
			failure: { code: "unauthenticated" },
		});
		expect(publish).toMatchObject({
			ok: false,
			failure: { code: "unauthenticated" },
		});
		expect(await runner.data.get("catalogRevision", "revision-1")).toBeNull();
		expect(runner.emitted).toEqual([]);
	});

	it("rejects actor injection and grant-like money fields before writing", async () => {
		const { executor, runner } = createHarness();
		const digest = await digestCatalogRevisionContent(content);

		const injectedActor = await executor.execute(
			{
				command: catalogDraftCommandReference,
				idempotencyKey: draftInput.operationId,
				target: { type: "store", id: storeId },
				input: draftInput,
				actor: { type: "account", id: "attacker" },
			},
			principal(),
		);
		const moneyOnInput = await executor.execute(
			{
				command: catalogPublishCommandReference,
				idempotencyKey: "catalog-publish-money",
				target: { type: "store", id: storeId },
				input: {
					operationId: "catalog-publish-money",
					revisionId: "revision-1",
					expectedContentDigest: digest,
					amount: "10.00",
					currency: "USD",
					tax: 0,
					shipping: "free",
					paymentSuccess: true,
				},
			},
			principal(),
		);

		expect(injectedActor).toMatchObject({
			ok: false,
			failure: { code: "invalid_request" },
		});
		expect(moneyOnInput).toMatchObject({
			ok: false,
			failure: { code: "invalid_input" },
		});
		expect(await runner.data.get("catalogRevision", "revision-1")).toBeNull();
		expect(runner.emitted).toEqual([]);
	});

	it("publishes one revision, one outbox fact, and one Command execution", async () => {
		const harness = createHarness();
		const digest = await digestCatalogRevisionContent(content);
		await draftThenReview(harness, digest);

		const draftRevision = await harness.runner.data.get(
			"catalogRevision",
			"revision-1",
		);
		expect(draftRevision).toMatchObject({ state: "reviewed" });
		expect(harness.runner.emitted).toEqual([]);

		const publish = await harness.executor.execute(
			{
				command: catalogPublishCommandReference,
				idempotencyKey: "catalog-publish-0001",
				target: { type: "store", id: storeId },
				input: {
					operationId: "catalog-publish-0001",
					revisionId: "revision-1",
					expectedContentDigest: digest,
				},
			},
			principal(),
		);

		expect(publish).toMatchObject({
			ok: true,
			receipt: {
				status: "succeeded",
				replayed: false,
				result: { state: "published", revisionId: "revision-1" },
			},
		});
		expect(
			await harness.runner.data.get("catalogRevision", "revision-1"),
		).toMatchObject({
			state: "published",
			reviewedAt: occurredAt.toISOString(),
			publishedAt: occurredAt.toISOString(),
		});
		expect(harness.runner.emitted).toEqual([
			expect.objectContaining({
				name: "catalog.published",
				version: 1,
				payload: expect.objectContaining({
					revisionId: "revision-1",
					contentDigest: digest,
					operationId: "catalog-publish-0001",
				}),
			}),
		]);
	});

	it("replays the same publish operation without a second publication", async () => {
		const harness = createHarness();
		const digest = await digestCatalogRevisionContent(content);
		await draftThenReview(harness, digest);
		const request = {
			command: catalogPublishCommandReference,
			idempotencyKey: "catalog-publish-0001",
			target: { type: "store", id: storeId },
			input: {
				operationId: "catalog-publish-0001",
				revisionId: "revision-1",
				expectedContentDigest: digest,
			},
		};

		const first = await harness.executor.execute(request, principal());
		const second = await harness.executor.execute(request, principal());

		expect(first).toMatchObject({
			ok: true,
			receipt: { replayed: false, status: "succeeded" },
		});
		expect(second).toMatchObject({
			ok: true,
			receipt: { replayed: true, status: "succeeded" },
		});
		expect(
			first.ok && second.ok
				? first.receipt.executionId === second.receipt.executionId
				: false,
		).toBe(true);
		expect(harness.runner.emitted).toHaveLength(1);
	});

	it("rolls publication back when the durable fact cannot commit", async () => {
		const harness = createHarness({
			beforeEmit() {
				throw new Error("outbox unavailable");
			},
		});
		const digest = await digestCatalogRevisionContent(content);
		await draftThenReview(harness, digest);

		await expect(
			harness.executor.execute(
				{
					command: catalogPublishCommandReference,
					idempotencyKey: "catalog-publish-rollback",
					target: { type: "store", id: storeId },
					input: {
						operationId: "catalog-publish-rollback",
						revisionId: "revision-1",
						expectedContentDigest: digest,
					},
				},
				principal(),
			),
		).rejects.toThrow("outbox unavailable");

		expect(
			await harness.runner.data.get("catalogRevision", "revision-1"),
		).toMatchObject({ state: "reviewed" });
		expect(harness.runner.emitted).toHaveLength(0);
	});

	it("does not import 86d.app or Control Plane clients", () => {
		const source = readFileSync(
			join(libDir, "../catalog-command-executor.ts"),
			"utf8",
		);
		expect(source).not.toMatch(/control.?plane/i);
		expect(source).not.toMatch(/from ["']api\//);
		expect(source).not.toMatch(/86D_API_KEY/);
	});
});
