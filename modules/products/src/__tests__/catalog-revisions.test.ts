import { createMockTransactionRunner } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import {
	applyCatalogRevisionOperation,
	type CatalogRevisionContent,
	type CatalogRevisionOperationContext,
	type CatalogRevisionOperationInput,
	digestCatalogRevisionContent,
} from "../catalog-revisions";

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

function operationContext(occurredAt: string): CatalogRevisionOperationContext {
	return {
		actor: { type: "account", id: "account-owner" },
		authority: {
			id: "store-admin-authority",
			type: "custom_role",
			role: "admin",
			permissions: ["catalog:write"],
			storeId: "store-1",
		},
		occurredAt: new Date(occurredAt),
	};
}

type MockTransactions = ReturnType<typeof createMockTransactionRunner>;

function applyAt(
	transactions: MockTransactions,
	input: CatalogRevisionOperationInput,
	occurredAt: string,
) {
	return transactions.transaction((transaction) =>
		applyCatalogRevisionOperation(
			transaction,
			input,
			operationContext(occurredAt),
		),
	);
}

function catalogNamed(name: string): CatalogRevisionContent {
	const product = content.products[0];
	if (!product) throw new Error("The Catalog fixture requires one product.");
	return {
		...content,
		products: [{ ...product, name }],
	};
}

describe("Catalog revision publication", () => {
	it("publishes one immutable fact and replays the same operation without duplicating it", async () => {
		const transactions = createMockTransactionRunner({ storeId: "store-1" });
		const digest = await digestCatalogRevisionContent(content);

		await transactions.transaction((transaction) =>
			applyCatalogRevisionOperation(
				transaction,
				{
					action: "create_draft",
					operationId: "catalog-create-0001",
					revisionId: "revision-1",
					content,
				},
				operationContext("2026-08-13T10:00:00.000Z"),
			),
		);
		await transactions.transaction((transaction) =>
			applyCatalogRevisionOperation(
				transaction,
				{
					action: "review",
					operationId: "catalog-review-0001",
					revisionId: "revision-1",
					expectedContentDigest: digest,
				},
				operationContext("2026-08-13T10:01:00.000Z"),
			),
		);
		const publish = () =>
			transactions.transaction((transaction) =>
				applyCatalogRevisionOperation(
					transaction,
					{
						action: "publish",
						operationId: "catalog-publish-0001",
						revisionId: "revision-1",
						expectedContentDigest: digest,
					},
					operationContext("2026-08-13T10:02:00.000Z"),
				),
			);

		expect(await publish()).toMatchObject({
			ok: true,
			decision: { state: "published", replayed: false },
		});
		expect(await publish()).toMatchObject({
			ok: true,
			decision: { state: "published", replayed: true },
		});
		expect(transactions.emitted).toEqual([
			expect.objectContaining({
				name: "catalog.published",
				version: 1,
				sourceModule: "products",
				payload: expect.objectContaining({
					revisionId: "revision-1",
					contentDigest: digest,
					productCount: 1,
				}),
			}),
		]);
	});

	it("rolls publication back when the durable fact cannot commit", async () => {
		const transactions = createMockTransactionRunner({
			beforeEmit() {
				throw new Error("outbox unavailable");
			},
		});
		const digest = await digestCatalogRevisionContent(content);

		await transactions.transaction((transaction) =>
			applyCatalogRevisionOperation(
				transaction,
				{
					action: "create_draft",
					operationId: "catalog-create-rollback",
					revisionId: "revision-rollback",
					content,
				},
				operationContext("2026-08-13T11:00:00.000Z"),
			),
		);
		await transactions.transaction((transaction) =>
			applyCatalogRevisionOperation(
				transaction,
				{
					action: "review",
					operationId: "catalog-review-rollback",
					revisionId: "revision-rollback",
					expectedContentDigest: digest,
				},
				operationContext("2026-08-13T11:01:00.000Z"),
			),
		);

		await expect(
			transactions.transaction((transaction) =>
				applyCatalogRevisionOperation(
					transaction,
					{
						action: "publish",
						operationId: "catalog-publish-rollback",
						revisionId: "revision-rollback",
						expectedContentDigest: digest,
					},
					operationContext("2026-08-13T11:02:00.000Z"),
				),
			),
		).rejects.toThrow("outbox unavailable");

		expect(
			await transactions.data.get("catalogRevision", "revision-rollback"),
		).toMatchObject({ state: "reviewed" });
		expect(
			await transactions.data.get("catalogRevisionHead", "catalog"),
		).not.toHaveProperty("publishedRevisionId");
		expect(transactions.emitted).toHaveLength(0);
	});

	it("rejects a reviewed stale-base draft and supersedes only the published head", async () => {
		const transactions = createMockTransactionRunner({ storeId: "store-1" });
		const baseDigest = await digestCatalogRevisionContent(content);
		const winnerContent = catalogNamed("Trail Leash v2");
		const loserContent = catalogNamed("Trail Leash alternate");
		const winnerDigest = await digestCatalogRevisionContent(winnerContent);
		const loserDigest = await digestCatalogRevisionContent(loserContent);

		await applyAt(
			transactions,
			{
				action: "create_draft",
				operationId: "catalog-create-base",
				revisionId: "revision-base",
				content,
			},
			"2026-08-13T12:00:00.000Z",
		);
		await applyAt(
			transactions,
			{
				action: "review",
				operationId: "catalog-review-base",
				revisionId: "revision-base",
				expectedContentDigest: baseDigest,
			},
			"2026-08-13T12:01:00.000Z",
		);
		await applyAt(
			transactions,
			{
				action: "publish",
				operationId: "catalog-publish-base",
				revisionId: "revision-base",
				expectedContentDigest: baseDigest,
			},
			"2026-08-13T12:02:00.000Z",
		);

		for (const draft of [
			{
				operationId: "catalog-create-winner",
				revisionId: "revision-winner",
				content: winnerContent,
			},
			{
				operationId: "catalog-create-loser",
				revisionId: "revision-loser",
				content: loserContent,
			},
		]) {
			await applyAt(
				transactions,
				{
					action: "create_draft",
					...draft,
					baseRevisionId: "revision-base",
				},
				"2026-08-13T12:03:00.000Z",
			);
		}
		await applyAt(
			transactions,
			{
				action: "review",
				operationId: "catalog-review-winner",
				revisionId: "revision-winner",
				expectedContentDigest: winnerDigest,
			},
			"2026-08-13T12:04:00.000Z",
		);
		await applyAt(
			transactions,
			{
				action: "review",
				operationId: "catalog-review-loser",
				revisionId: "revision-loser",
				expectedContentDigest: loserDigest,
			},
			"2026-08-13T12:04:00.000Z",
		);
		await expect(
			applyAt(
				transactions,
				{
					action: "publish",
					operationId: "catalog-publish-winner",
					revisionId: "revision-winner",
					expectedContentDigest: winnerDigest,
				},
				"2026-08-13T12:05:00.000Z",
			),
		).resolves.toMatchObject({
			ok: true,
			decision: { state: "published" },
		});

		await expect(
			applyAt(
				transactions,
				{
					action: "publish",
					operationId: "catalog-publish-loser",
					revisionId: "revision-loser",
					expectedContentDigest: loserDigest,
				},
				"2026-08-13T12:06:00.000Z",
			),
		).resolves.toEqual({
			ok: false,
			failure: {
				code: "stale_base_revision",
				message:
					"The published Catalog changed after this revision was drafted.",
				retryable: false,
			},
		});

		expect(
			await transactions.data.get("catalogRevision", "revision-base"),
		).toMatchObject({
			state: "superseded",
			supersededByRevisionId: "revision-winner",
		});
		expect(
			await transactions.data.get("catalogRevision", "revision-winner"),
		).toMatchObject({ state: "published" });
		expect(
			await transactions.data.get("catalogRevision", "revision-loser"),
		).toMatchObject({ state: "reviewed" });
		expect(
			await transactions.data.get("catalogRevisionHead", "catalog"),
		).toMatchObject({ publishedRevisionId: "revision-winner" });
		expect(transactions.emitted).toHaveLength(2);
	});

	it.each([
		{ reviewed: false, revisionId: "revision-failed-draft" },
		{ reviewed: true, revisionId: "revision-failed-reviewed" },
	])(
		"persists and replays a failed revision from its current state ($revisionId)",
		async ({ reviewed, revisionId }) => {
			const transactions = createMockTransactionRunner({ storeId: "store-1" });
			const digest = await digestCatalogRevisionContent(content);
			await applyAt(
				transactions,
				{
					action: "create_draft",
					operationId: `catalog-create-${revisionId}`,
					revisionId,
					content,
				},
				"2026-08-13T13:00:00.000Z",
			);
			if (reviewed) {
				await applyAt(
					transactions,
					{
						action: "review",
						operationId: `catalog-review-${revisionId}`,
						revisionId,
						expectedContentDigest: digest,
					},
					"2026-08-13T13:01:00.000Z",
				);
			}
			const failure = {
				action: "fail",
				operationId: `catalog-fail-${revisionId}`,
				revisionId,
				expectedContentDigest: digest,
				reason: "Provider validation rejected the revision.",
			} satisfies CatalogRevisionOperationInput;

			expect(
				await applyAt(transactions, failure, "2026-08-13T13:02:00.000Z"),
			).toMatchObject({
				ok: true,
				decision: { state: "failed", replayed: false },
			});
			expect(
				await applyAt(transactions, failure, "2026-08-13T13:03:00.000Z"),
			).toMatchObject({
				ok: true,
				decision: { state: "failed", replayed: true },
			});
			expect(
				await transactions.data.get("catalogRevision", revisionId),
			).toMatchObject({
				state: "failed",
				failedFromState: reviewed ? "reviewed" : "draft",
				failureReason: "Provider validation rejected the revision.",
			});
			expect(transactions.emitted).toHaveLength(0);
		},
	);

	it("rejects invalid transitions without changing the draft", async () => {
		const transactions = createMockTransactionRunner({ storeId: "store-1" });
		const digest = await digestCatalogRevisionContent(content);
		await applyAt(
			transactions,
			{
				action: "create_draft",
				operationId: "catalog-create-invalid-transition",
				revisionId: "revision-invalid-transition",
				content,
			},
			"2026-08-13T14:00:00.000Z",
		);

		expect(
			await applyAt(
				transactions,
				{
					action: "publish",
					operationId: "catalog-publish-invalid-transition",
					revisionId: "revision-invalid-transition",
					expectedContentDigest: digest,
				},
				"2026-08-13T14:01:00.000Z",
			),
		).toMatchObject({
			ok: false,
			failure: { code: "invalid_state" },
		});
		expect(
			await transactions.data.get(
				"catalogRevision",
				"revision-invalid-transition",
			),
		).toMatchObject({ state: "draft" });
		expect(
			await transactions.data.get(
				"catalogRevisionOperation",
				"catalog-publish-invalid-transition",
			),
		).toBeNull();
	});
});
