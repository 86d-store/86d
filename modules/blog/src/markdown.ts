import type { ModuleContext } from "@86d-app/core/types/module";
import type { BlogController } from "./service";

export async function toMarkdownBlogListing(
	ctx: ModuleContext,
	_params: Record<string, string>,
): Promise<string | null> {
	const controller = ctx.controllers.blog as BlogController | undefined;
	if (!controller?.listPosts) return null;

	const posts = await controller.listPosts({
		status: "published",
		take: 100,
	});

	let md = "# Blog\n\n";
	if (posts.length === 0) {
		md += "No posts yet.\n";
		return md;
	}
	for (const post of posts) {
		md += `## [${post.title}](/blog/${post.slug})\n\n`;
		if (post.author) md += `By ${post.author}`;
		if (post.publishedAt) {
			const date = post.publishedAt.toLocaleDateString("en-US", {
				year: "numeric",
				month: "long",
				day: "numeric",
			});
			md += post.author ? ` · ${date}` : date;
		}
		if (post.author || post.publishedAt) md += "\n\n";
		if (post.excerpt) md += `${post.excerpt}\n\n`;
	}
	return md;
}

export async function toMarkdownBlogPost(
	ctx: ModuleContext,
	params: Record<string, string>,
): Promise<string | null> {
	const slug = params.slug;
	if (!slug) return null;

	const controller = ctx.controllers.blog as BlogController | undefined;
	if (!controller?.getPostBySlug) return null;

	const post = await controller.getPostBySlug(slug);
	if (post?.status !== "published") return null;

	let md = `# ${post.title}\n\n`;
	if (post.author) md += `By ${post.author}\n\n`;
	if (post.publishedAt)
		md += `Published: ${post.publishedAt.toISOString()}\n\n`;
	if (post.excerpt) md += `${post.excerpt}\n\n`;
	md += `---\n\n${post.content}\n\n`;
	md += `[View post](/blog/${post.slug})\n`;
	return md;
}
