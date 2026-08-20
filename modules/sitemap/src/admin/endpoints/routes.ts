import { addEntry } from "./add-entry";
import { bulkAddEntries } from "./bulk-add";
import { bulkRemoveEntries } from "./bulk-remove";
import { getConfig } from "./get-config";
import { getEntry } from "./get-entry";
import { getStats } from "./get-stats";
import { listEntries } from "./list-entries";
import { previewSitemap } from "./preview";
import { regenerateSitemap } from "./regenerate";
import { removeEntry } from "./remove-entry";
import { updateConfig } from "./update-config";
import { updateEntry } from "./update-entry";

export const adminEndpoints = {
	"/admin/sitemap/config": getConfig,
	"/admin/sitemap/config/update": updateConfig,
	"/admin/sitemap/regenerate": regenerateSitemap,
	"/admin/sitemap/entries": listEntries,
	"/admin/sitemap/entries/add": addEntry,
	"/admin/sitemap/entries/bulk-add": bulkAddEntries,
	"/admin/sitemap/entries/bulk-remove": bulkRemoveEntries,
	"/admin/sitemap/entries/:id": getEntry,
	"/admin/sitemap/entries/:id/update": updateEntry,
	"/admin/sitemap/entries/:id/remove": removeEntry,
	"/admin/sitemap/stats": getStats,
	"/admin/sitemap/preview": previewSitemap,
};
