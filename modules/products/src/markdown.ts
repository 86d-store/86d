import type { ModuleContext } from "@86d-app/core/types/module";
import type {
	Collection,
	CollectionWithProducts,
	Product,
	ProductWithVariants,
} from "./controllers";

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

/** Build minimal endpoint-like ctx for controller calls. */
function withQuery(ctx: ModuleContext, query: Record<string, string>) {
	return { context: ctx, query, params: {} };
}

function withParams(ctx: ModuleContext, params: Record<string, string>) {
	return { context: ctx, query: {}, params };
}

export async function toMarkdownProductListing(
	ctx: ModuleContext,
	_params: Record<string, string>,
): Promise<string | null> {
	const result = await (
		ctx.controllers as {
			product: {
				list: (ctx: unknown) => Promise<{ products?: ProductWithVariants[] }>;
			};
		}
	).product.list(withQuery(ctx, { limit: "100", status: "active" }));
	const products = (result?.products ?? []) as ProductWithVariants[];
	let md = `# Products\n\n`;
	if (products.length === 0) {
		md += "No products yet.\n";
		return md;
	}
	for (const p of products) {
		md += `- [${p.name}](/products/${p.slug}) — ${formatPrice(p.price)}\n`;
	}
	return md;
}

export async function toMarkdownProductDetail(
	ctx: ModuleContext,
	params: Record<string, string>,
): Promise<string | null> {
	const slug = params.slug;
	if (!slug) return null;

	const bySlug = (await (
		ctx.controllers as {
			product: { getBySlug: (ctx: unknown) => Promise<Product | null> };
		}
	).product.getBySlug(withQuery(ctx, { slug }))) as Product | null;
	if (!bySlug || bySlug.status !== "active") return null;

	const product = (await (
		ctx.controllers as {
			product: {
				getWithVariants: (ctx: unknown) => Promise<ProductWithVariants | null>;
			};
		}
	).product.getWithVariants(
		withParams(ctx, { id: bySlug.id }),
	)) as ProductWithVariants | null;
	if (!product) return null;

	let md = `# ${product.name}\n\n`;
	if (product.shortDescription) {
		md += `${product.shortDescription}\n\n`;
	}
	if (product.description) {
		md += `${product.description}\n\n`;
	}
	md += `## Price\n\n${formatPrice(product.price)}\n\n`;
	if (product.images?.length > 0) {
		md += `## Images\n\n`;
		for (const img of product.images) {
			md += `![${product.name}](${img})\n`;
		}
	}
	md += `\n[View product](/products/${product.slug})\n`;
	return md;
}

export async function toMarkdownCollectionListing(
	ctx: ModuleContext,
	_params: Record<string, string>,
): Promise<string | null> {
	const result = await (
		ctx.controllers as {
			collection: {
				list: (ctx: unknown) => Promise<{ collections?: Collection[] }>;
			};
		}
	).collection.list(withQuery(ctx, { limit: "100", visible: "true" }));
	const collections = (result?.collections ?? []) as Collection[];
	let md = `# Collections\n\n`;
	if (collections.length === 0) {
		md += "No collections yet.\n";
		return md;
	}
	for (const c of collections) {
		md += `- [${c.name}](/collections/${c.slug})\n`;
	}
	return md;
}

export async function toMarkdownCollectionDetail(
	ctx: ModuleContext,
	params: Record<string, string>,
): Promise<string | null> {
	const slug = params.slug;
	if (!slug) return null;

	const bySlug = (await (
		ctx.controllers as {
			collection: { getBySlug: (ctx: unknown) => Promise<Collection | null> };
		}
	).collection.getBySlug(withQuery(ctx, { slug }))) as Collection | null;
	if (!bySlug?.isVisible) return null;

	const collection = (await (
		ctx.controllers as {
			collection: {
				getWithProducts: (
					ctx: unknown,
				) => Promise<CollectionWithProducts | null>;
			};
		}
	).collection.getWithProducts(
		withParams(ctx, { id: bySlug.id }),
	)) as CollectionWithProducts | null;
	if (!collection) return null;

	let md = `# ${collection.name}\n\n`;
	if (collection.description) {
		md += `${collection.description}\n\n`;
	}
	if (collection.image) {
		md += `![${collection.name}](${collection.image})\n\n`;
	}
	md += `[View collection](/collections/${collection.slug})\n`;
	return md;
}
