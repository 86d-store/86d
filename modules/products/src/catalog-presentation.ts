import {
	catalogPublishedV1,
	consumeDurableEvent,
	type DurableEventEnvelope,
} from "@86d-app/core/durable-events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { z } from "zod";
import {
	catalogRevisionCategorySchema,
	catalogRevisionProductSchema,
	catalogRevisionRecordSchema,
	catalogRevisionVariantSchema,
	digestCatalogRevisionContent,
} from "./catalog-revisions";

const searchDocumentSchema = z
	.object({
		id: z.string().min(1).max(200),
		entityType: z.literal("product"),
		entityId: z.string().min(1).max(200),
		title: z.string().min(1).max(500),
		body: z.string().max(100_000).optional(),
		tags: z.array(z.string().min(1).max(100)).max(100),
		url: z.string().min(1).max(500),
		image: z.string().min(1).max(2_048).optional(),
		metadata: z
			.object({
				priceMinor: z.number().int().nonnegative(),
				currency: z.string().regex(/^[A-Z]{3}$/),
				categoryId: z.string().min(1).max(200).optional(),
				isFeatured: z.boolean(),
			})
			.strict(),
	})
	.strict();

const feedProductSchema = z
	.object({
		id: z.string().min(1).max(200),
		title: z.string().min(1).max(500),
		description: z.string().max(100_000).optional(),
		priceMinor: z.number().int().nonnegative(),
		compareAtPriceMinor: z.number().int().nonnegative().optional(),
		currency: z.string().regex(/^[A-Z]{3}$/),
		sku: z.string().min(1).max(255).optional(),
		barcode: z.string().min(1).max(255).optional(),
		category: z.string().min(1).max(500).optional(),
		imageUrl: z.string().min(1).max(2_048).optional(),
		additionalImages: z.array(z.string().min(1).max(2_048)).max(49),
		url: z.string().min(1).max(500),
		weight: z.number().finite().nonnegative().optional(),
		weightUnit: z.enum(["kg", "lb", "oz", "g"]).optional(),
	})
	.strict();

export const catalogPresentationSchema = z
	.object({
		id: z.literal("catalog"),
		revisionId: z.string().min(1).max(200),
		revisionSequence: z.number().int().positive(),
		contentVersion: z.literal(1),
		contentDigest: z.string().regex(/^[a-f0-9]{64}$/),
		currency: z.string().regex(/^[A-Z]{3}$/),
		projectedAt: z.string().datetime(),
		storefront: z
			.object({
				categories: z.array(catalogRevisionCategorySchema).max(10_000),
				products: z.array(catalogRevisionProductSchema).max(25_000),
				variants: z.array(catalogRevisionVariantSchema).max(100_000),
			})
			.strict(),
		search: z
			.object({ documents: z.array(searchDocumentSchema).max(25_000) })
			.strict(),
		feeds: z
			.object({ products: z.array(feedProductSchema).max(25_000) })
			.strict(),
	})
	.strict();

export type CatalogPresentation = z.infer<typeof catalogPresentationSchema>;

async function assertPublicationMatchesRevision(
	event: DurableEventEnvelope<typeof catalogPublishedV1>,
	revision: z.infer<typeof catalogRevisionRecordSchema>,
): Promise<void> {
	const actualDigest = await digestCatalogRevisionContent(revision.content);
	const matches =
		event.aggregate.type === "catalog" &&
		event.aggregate.id === "catalog" &&
		revision.id === event.payload.revisionId &&
		revision.sequence === event.payload.revisionSequence &&
		revision.baseRevisionId === event.payload.baseRevisionId &&
		revision.contentVersion === event.payload.contentVersion &&
		revision.contentDigest === event.payload.contentDigest &&
		actualDigest === revision.contentDigest &&
		revision.content.currency === event.payload.currency &&
		revision.content.products.length === event.payload.productCount &&
		revision.content.variants.length === event.payload.variantCount &&
		revision.content.categories.length === event.payload.categoryCount;
	if (!matches) {
		throw new Error(
			"The Catalog publication does not match its immutable revision.",
		);
	}
}

function buildCatalogPresentation(
	revision: z.infer<typeof catalogRevisionRecordSchema>,
	projectedAt: Date,
): CatalogPresentation {
	const categoriesById = new Map(
		revision.content.categories.map((category) => [category.id, category]),
	);
	const categories = revision.content.categories.filter(
		(category) => category.isVisible,
	);
	const products = revision.content.products.filter(
		(product) => product.status === "active",
	);
	const productIds = new Set(products.map((product) => product.id));
	const variants = revision.content.variants.filter((variant) =>
		productIds.has(variant.productId),
	);

	return catalogPresentationSchema.parse({
		id: "catalog",
		revisionId: revision.id,
		revisionSequence: revision.sequence,
		contentVersion: revision.contentVersion,
		contentDigest: revision.contentDigest,
		currency: revision.content.currency,
		projectedAt: projectedAt.toISOString(),
		storefront: { categories, products, variants },
		search: {
			documents: products.map((product) => ({
				id: product.id,
				entityType: "product",
				entityId: product.id,
				title: product.name,
				...(product.description === undefined
					? {}
					: { body: product.description }),
				tags: product.tags,
				url: `/products/${product.slug}`,
				...(product.images[0] === undefined
					? {}
					: { image: product.images[0] }),
				metadata: {
					priceMinor: product.price,
					currency: revision.content.currency,
					...(product.categoryId === undefined
						? {}
						: { categoryId: product.categoryId }),
					isFeatured: product.isFeatured,
				},
			})),
		},
		feeds: {
			products: products.map((product) => {
				const category =
					product.categoryId === undefined
						? undefined
						: categoriesById.get(product.categoryId);
				return {
					id: product.id,
					title: product.name,
					...(product.description === undefined
						? {}
						: { description: product.description }),
					priceMinor: product.price,
					...(product.compareAtPrice === undefined
						? {}
						: { compareAtPriceMinor: product.compareAtPrice }),
					currency: revision.content.currency,
					...(product.sku === undefined ? {} : { sku: product.sku }),
					...(product.barcode === undefined
						? {}
						: { barcode: product.barcode }),
					...(category?.isVisible === true ? { category: category.name } : {}),
					...(product.images[0] === undefined
						? {}
						: { imageUrl: product.images[0] }),
					additionalImages: product.images.slice(1),
					url: `/products/${product.slug}`,
					...(product.weight === undefined ? {} : { weight: product.weight }),
					...(product.weightUnit === undefined
						? {}
						: { weightUnit: product.weightUnit }),
				};
			}),
		},
	});
}

export async function readCatalogPresentation(
	data: ModuleDataService,
): Promise<CatalogPresentation | null> {
	const stored = await data.get("catalogPresentation", "catalog");
	if (!stored) return null;
	const parsed = catalogPresentationSchema.safeParse(stored);
	if (!parsed.success) {
		throw new Error("The current Catalog presentation is malformed.");
	}
	return parsed.data;
}

export const catalogPresentationConsumer = consumeDurableEvent({
	consumer: "products.catalog-presentation.v1",
	owner: "products",
	definition: catalogPublishedV1,
	async handle(context, event) {
		const current = await readCatalogPresentation(context.data);
		if (current && event.payload.revisionSequence < current.revisionSequence) {
			return;
		}
		if (
			current &&
			event.payload.revisionSequence === current.revisionSequence
		) {
			if (
				event.payload.revisionId === current.revisionId &&
				event.payload.contentDigest === current.contentDigest
			) {
				return;
			}
			throw new Error(
				"The Catalog publication sequence conflicts with the current projection.",
			);
		}
		const stored = await context.data.get(
			"catalogRevision",
			event.payload.revisionId,
		);
		if (!stored) {
			throw new Error("The published Catalog revision was not found.");
		}
		const revision = catalogRevisionRecordSchema.safeParse(stored);
		if (
			!revision.success ||
			(revision.data.state !== "published" &&
				revision.data.state !== "superseded")
		) {
			throw new Error("The published Catalog revision is malformed.");
		}
		await assertPublicationMatchesRevision(event, revision.data);
		await context.data.upsert(
			"catalogPresentation",
			"catalog",
			buildCatalogPresentation(revision.data, event.occurredAt),
		);
	},
});
