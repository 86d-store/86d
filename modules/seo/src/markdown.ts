import type { ModuleContext } from "@86d-app/core/types/module";
import type { SeoController } from "./service";

export async function toMarkdownSitemap(
	ctx: ModuleContext,
	_params: Record<string, string>,
): Promise<string | null> {
	const controller = ctx.controllers.seo as SeoController | undefined;
	if (!controller?.getSitemapEntries) return null;

	const entries = await controller.getSitemapEntries();

	let md = "# Sitemap\n\n";
	if (entries.length === 0) {
		md += "No pages indexed.\n";
		return md;
	}

	for (const entry of entries) {
		md += `- [${entry.path}](${entry.path})`;
		if (entry.lastModified) {
			md += ` — updated ${entry.lastModified.toISOString().split("T")[0]}`;
		}
		md += "\n";
	}
	return md;
}
