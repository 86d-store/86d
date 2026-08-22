import type { ModuleContext } from "@86d-app/core/types/module";
import type { PagesController } from "./service";

export async function toMarkdownPageListing(
	ctx: ModuleContext,
	_params: Record<string, string>,
): Promise<string | null> {
	const controller = ctx.controllers.pages as PagesController | undefined;
	if (!controller?.listPages) return null;

	const pages = await controller.listPages({
		status: "published",
		take: 100,
	});

	let md = "# Pages\n\n";
	if (pages.length === 0) {
		md += "No pages yet.\n";
		return md;
	}
	for (const page of pages) {
		md += `## [${page.title}](/p/${page.slug})\n\n`;
		if (page.excerpt) md += `${page.excerpt}\n\n`;
	}
	return md;
}

export async function toMarkdownPageDetail(
	ctx: ModuleContext,
	params: Record<string, string>,
): Promise<string | null> {
	const slug = params.slug;
	if (!slug) return null;

	const controller = ctx.controllers.pages as PagesController | undefined;
	if (!controller?.getPageBySlug) return null;

	const page = await controller.getPageBySlug(slug);
	if (page?.status !== "published") return null;

	let md = `# ${page.title}\n\n`;
	if (page.excerpt) md += `${page.excerpt}\n\n`;
	md += `---\n\n${page.content}\n`;
	return md;
}
