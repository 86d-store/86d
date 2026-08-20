import type { ModuleContext } from "@86d-app/core/types/module";
import type { NavigationController } from "./service";

export async function toMarkdownMenuListing(
	ctx: ModuleContext,
	_params: Record<string, string>,
): Promise<string | null> {
	const controller = ctx.controllers.navigation as
		| NavigationController
		| undefined;
	if (!controller?.listMenus) return null;

	const menus = await controller.listMenus({ isActive: true });

	let md = "# Navigation Menus\n\n";
	if (menus.length === 0) {
		md += "No menus configured.\n";
		return md;
	}
	for (const menu of menus) {
		md += `- **${menu.name}** (${menu.location})\n`;
	}
	return md;
}
