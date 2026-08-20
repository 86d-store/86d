import type {
	catalogPublishedV1,
	DurableEventEnvelope,
} from "@86d-app/core/durable-events";
import { createMockDataService } from "@86d-app/core/test-utils";
import products from "@86d-app/products";
import {
	catalogPresentationConsumer,
	readCatalogPresentation,
} from "@86d-app/products/catalog-presentation";
import { describe, expect, it } from "vitest";
import {
	type CatalogRevisionContent,
	catalogRevisionRecordSchema,
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
		{
			id: "category-internal",
			name: "Internal",
			slug: "internal",
			position: 1,
			isVisible: false,
			metadata: {},
		},
	],
	products: [
		{
			id: "product-leash",
			name: "Trail Leash",
			slug: "trail-leash",
			description: "A dependable trail leash.",
			price: 2_500,
			status: "active",
			categoryId: "category-dogs",
			images: ["https://store.example/products/trail-leash.jpg"],
			tags: ["walking"],
			metadata: {},
			isFeatured: true,
		},
		{
			id: "product-internal",
			name: "Internal sample",
			slug: "internal-sample",
			price: 900,
			status: "draft",
			categoryId: "category-internal",
			images: [],
			tags: [],
			metadata: {},
			isFeatured: false,
		},
	],
	variants: [
		{
			id: "variant-leash-red",
			productId: "product-leash",
			name: "Red",
			price: 2_500,
			options: { color: "Red" },
			images: [],
			position: 0,
		},
		{
			id: "variant-internal",
			productId: "product-internal",
			name: "Internal",
			price: 900,
			options: {},
			images: [],
			position: 0,
		},
	],
} satisfies CatalogRevisionContent;

async function seedPublication(
	data: ReturnType<typeof createMockDataService>,
	options: {
		revisionId?: string;
		revisionSequence?: number;
		name?: string;
		occurredAt?: string;
	} = {},
): Promise<DurableEventEnvelope<typeof catalogPublishedV1>> {
	const revisionId = options.revisionId ?? "revision-1";
	const revisionSequence = options.revisionSequence ?? 1;
	const occurredAt = new Date(options.occurredAt ?? "2026-08-13T18:00:00.000Z");
	const product = content.products[0];
	if (!product) throw new Error("The Catalog fixture requires one product.");
	const revisionContent =
		options.name === undefined
			? content
			: {
					...content,
					products: [{ ...product, name: options.name }, content.products[1]],
				};
	const contentDigest = await digestCatalogRevisionContent(revisionContent);
	await data.upsert(
		"catalogRevision",
		revisionId,
		catalogRevisionRecordSchema.parse({
			id: revisionId,
			sequence: revisionSequence,
			state: "published",
			contentVersion: 1,
			contentDigest,
			content: revisionContent,
			createdAt: "2026-08-13T17:00:00.000Z",
			createdBy: { type: "account", id: "account-owner" },
			createdAuthorityId: "store-admin-authority",
			reviewedAt: "2026-08-13T17:30:00.000Z",
			reviewedBy: { type: "account", id: "account-owner" },
			reviewedAuthorityId: "store-admin-authority",
			publishedAt: occurredAt.toISOString(),
			publishedBy: { type: "account", id: "account-owner" },
			publishedAuthorityId: "store-admin-authority",
		}),
	);

	return {
		id: `event-${revisionId}`,
		name: "catalog.published",
		version: 1,
		storeId: "store-1",
		sourceModule: "products",
		aggregate: {
			type: "catalog",
			id: "catalog",
			sequence: revisionSequence,
		},
		occurredAt,
		payload: {
			revisionId,
			revisionSequence,
			contentVersion: 1,
			contentDigest,
			currency: "USD",
			productCount: 2,
			variantCount: 2,
			categoryCount: 2,
			operationId: "catalog-publish-0001",
			actor: { type: "account", id: "account-owner" },
			authorityId: "store-admin-authority",
		},
	};
}

describe("Catalog presentation projection", () => {
	it("registers the Products-owned consumer at the public Module interface", () => {
		expect(products().durableEvents?.handles).toContain(
			catalogPresentationConsumer,
		);
	});

	it("projects one immutable publication into Storefront, search, and feed read state", async () => {
		const data = createMockDataService();
		const event = await seedPublication(data);

		await catalogPresentationConsumer.handle({ data }, event);

		expect(await readCatalogPresentation(data)).toEqual({
			id: "catalog",
			revisionId: "revision-1",
			revisionSequence: 1,
			contentVersion: 1,
			contentDigest: event.payload.contentDigest,
			currency: "USD",
			projectedAt: "2026-08-13T18:00:00.000Z",
			storefront: {
				categories: [content.categories[0]],
				products: [content.products[0]],
				variants: [content.variants[0]],
			},
			search: {
				documents: [
					{
						id: "product-leash",
						entityType: "product",
						entityId: "product-leash",
						title: "Trail Leash",
						body: "A dependable trail leash.",
						tags: ["walking"],
						url: "/products/trail-leash",
						image: "https://store.example/products/trail-leash.jpg",
						metadata: {
							priceMinor: 2_500,
							currency: "USD",
							categoryId: "category-dogs",
							isFeatured: true,
						},
					},
				],
			},
			feeds: {
				products: [
					{
						id: "product-leash",
						title: "Trail Leash",
						description: "A dependable trail leash.",
						priceMinor: 2_500,
						currency: "USD",
						category: "Dogs",
						imageUrl: "https://store.example/products/trail-leash.jpg",
						additionalImages: [],
						url: "/products/trail-leash",
					},
				],
			},
		});
	});

	it("ignores an older publication delivered after the current projection", async () => {
		const data = createMockDataService();
		const older = await seedPublication(data, {
			revisionId: "revision-1",
			revisionSequence: 1,
			name: "Original Trail Leash",
			occurredAt: "2026-08-13T18:00:00.000Z",
		});
		const current = await seedPublication(data, {
			revisionId: "revision-2",
			revisionSequence: 2,
			name: "Current Trail Leash",
			occurredAt: "2026-08-13T19:00:00.000Z",
		});

		await catalogPresentationConsumer.handle({ data }, current);
		await catalogPresentationConsumer.handle({ data }, older);

		expect(await readCatalogPresentation(data)).toMatchObject({
			revisionId: "revision-2",
			revisionSequence: 2,
			storefront: { products: [{ name: "Current Trail Leash" }] },
			search: { documents: [{ title: "Current Trail Leash" }] },
			feeds: { products: [{ title: "Current Trail Leash" }] },
		});
	});

	it("converges when the same publication is delivered more than once", async () => {
		const data = createMockDataService();
		const event = await seedPublication(data);
		await catalogPresentationConsumer.handle({ data }, event);
		const first = await readCatalogPresentation(data);

		await data.delete("catalogRevision", event.payload.revisionId);
		await catalogPresentationConsumer.handle({ data }, event);

		expect(await readCatalogPresentation(data)).toEqual(first);
	});

	it("fails a corrupted immutable revision without replacing the last good projection", async () => {
		const data = createMockDataService();
		const current = await seedPublication(data);
		await catalogPresentationConsumer.handle({ data }, current);
		const lastGood = await readCatalogPresentation(data);
		const next = await seedPublication(data, {
			revisionId: "revision-2",
			revisionSequence: 2,
			name: "Unverified Trail Leash",
			occurredAt: "2026-08-13T19:00:00.000Z",
		});
		const stored = await data.get("catalogRevision", next.payload.revisionId);
		const revision = catalogRevisionRecordSchema.parse(stored);
		const product = revision.content.products[0];
		if (!product) throw new Error("The seeded Catalog product is missing.");
		await data.upsert("catalogRevision", revision.id, {
			...revision,
			content: {
				...revision.content,
				products: [
					{ ...product, name: "Corrupted Trail Leash" },
					...revision.content.products.slice(1),
				],
			},
		});

		await expect(
			catalogPresentationConsumer.handle({ data }, next),
		).rejects.toThrow("does not match");
		expect(await readCatalogPresentation(data)).toEqual(lastGood);
	});

	it("applies the same event after a transient source failure is repaired", async () => {
		const data = createMockDataService();
		const event = await seedPublication(data);
		const revision = await data.get(
			"catalogRevision",
			event.payload.revisionId,
		);
		if (!revision) throw new Error("The seeded Catalog revision is missing.");
		await data.delete("catalogRevision", event.payload.revisionId);

		await expect(
			catalogPresentationConsumer.handle({ data }, event),
		).rejects.toThrow("was not found");
		expect(await readCatalogPresentation(data)).toBeNull();

		await data.upsert("catalogRevision", event.payload.revisionId, revision);
		await catalogPresentationConsumer.handle({ data }, event);

		expect(await readCatalogPresentation(data)).toMatchObject({
			revisionId: "revision-1",
			revisionSequence: 1,
			storefront: { products: [{ name: "Trail Leash" }] },
			search: { documents: [{ title: "Trail Leash" }] },
			feeds: { products: [{ title: "Trail Leash" }] },
		});
	});
});
