export interface LlmsProduct {
	name: string;
	slug: string;
	shortDescription: string | null;
	price: number;
	images: string[];
}

export interface LlmsCollection {
	name: string;
	slug: string;
	description: string | null;
}

export interface LlmsBlogPost {
	title: string;
	slug: string;
	excerpt: string | null;
	author: string | null;
	publishedAt: string | null;
}

export interface LlmsFullContent {
	products: LlmsProduct[];
	collections: LlmsCollection[];
	blogPosts: LlmsBlogPost[];
}

export function renderLlmsFullMarkdown(
	content: LlmsFullContent,
	storeName: string,
	baseUrl: string,
): string {
	const lines: string[] = [`# ${storeName}`, ""];

	if (content.products.length > 0) {
		lines.push("## Products", "");
		for (const p of content.products) {
			lines.push(`### ${p.name}`);
			lines.push(`- URL: ${baseUrl}/products/${p.slug}`);
			lines.push(`- Price: $${p.price.toFixed(2)}`);
			if (p.shortDescription) lines.push(`- ${p.shortDescription}`);
			lines.push("");
		}
	}

	if (content.collections.length > 0) {
		lines.push("## Collections", "");
		for (const c of content.collections) {
			lines.push(`### ${c.name}`);
			lines.push(`- URL: ${baseUrl}/collections/${c.slug}`);
			if (c.description) lines.push(`- ${c.description}`);
			lines.push("");
		}
	}

	if (content.blogPosts.length > 0) {
		lines.push("## Blog", "");
		for (const b of content.blogPosts) {
			lines.push(`### ${b.title}`);
			lines.push(`- URL: ${baseUrl}/blog/${b.slug}`);
			if (b.excerpt) lines.push(`- ${b.excerpt}`);
			if (b.author) lines.push(`- Author: ${b.author}`);
			lines.push("");
		}
	}

	return lines.join("\n");
}
