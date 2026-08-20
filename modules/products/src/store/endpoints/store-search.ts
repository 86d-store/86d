import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { Collection, Product } from "../../controllers";

/** Quick links shown in store command search (label and href). */
const QUICK_LINKS = [
	{ id: "products", label: "All products", href: "/products", group: "Pages" },
	{
		id: "collections",
		label: "Collections",
		href: "/collections",
		group: "Pages",
	},
	{ id: "blog", label: "Blog", href: "/blog", group: "Pages" },
	{ id: "about", label: "About", href: "/about", group: "Pages" },
	{ id: "contact", label: "Contact", href: "/contact", group: "Pages" },
	{ id: "terms", label: "Terms", href: "/terms", group: "Pages" },
	{ id: "privacy", label: "Privacy", href: "/privacy", group: "Pages" },
	{ id: "account", label: "Account", href: "/account", group: "Account" },
	{
		id: "profile",
		label: "Profile",
		href: "/account/profile",
		group: "Account",
	},
	{
		id: "addresses",
		label: "Addresses",
		href: "/account/addresses",
		group: "Account",
	},
];

export const storeSearch = createStoreEndpoint(
	"/products/store-search",
	{
		method: "GET",
		query: z.object({
			q: z.string().min(0).max(500).transform(sanitizeText),
			limit: z.string().max(10).optional(),
		}),
	},
	async (ctx) => {
		const { query } = ctx;
		const q = query.q.trim();
		const limit = query.limit ? parseInt(query.limit, 10) : 15;
		const queryLower = q.toLowerCase();

		const results: Array<{
			id: string;
			label: string;
			href: string;
			image?: string;
			subtitle?: string;
			group?: string;
		}> = [];

		if (q.length > 0) {
			const [products, collections] = (await Promise.all([
				ctx.context.controllers.product.search({
					...ctx,
					query: { q, limit: String(Math.min(limit, 8)) },
				}),
				ctx.context.controllers.collection.search({
					...ctx,
					query: { q, limit: String(Math.min(limit, 5)) },
				}),
			])) as [Product[], Collection[]];

			for (const p of products) {
				const image = p.images?.[0];
				results.push({
					id: `product-${p.id}`,
					label: p.name,
					href: `/products/${p.slug}`,
					...(image ? { image } : {}),
					...(p.price != null ? { subtitle: formatCents(p.price) } : {}),
					group: "Products",
				});
			}
			for (const c of collections) {
				results.push({
					id: `collection-${c.id}`,
					label: c.name,
					href: `/collections/${c.slug}`,
					...(c.image ? { image: c.image } : {}),
					group: "Collections",
				});
			}
		}

		for (const link of QUICK_LINKS) {
			if (q.length === 0 || link.label.toLowerCase().includes(queryLower)) {
				results.push({
					id: link.id,
					label: link.label,
					href: link.href,
					group: link.group,
				});
			}
		}

		return { results };
	},
);

function formatCents(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}
