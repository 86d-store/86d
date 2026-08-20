import { bulkSetEntries } from "./bulk-set-entries";
import { createPriceList } from "./create-price-list";
import { deletePriceList } from "./delete-price-list";
import { getPriceList } from "./get-price-list";
import { getStats } from "./get-stats";
import { listEntries } from "./list-entries";
import { listPriceLists } from "./list-price-lists";
import { removeEntry } from "./remove-entry";
import { setEntry } from "./set-entry";
import { updatePriceList } from "./update-price-list";

export const adminEndpoints = {
	"/admin/price-lists": listPriceLists,
	"/admin/price-lists/stats": getStats,
	"/admin/price-lists/create": createPriceList,
	"/admin/price-lists/:id": getPriceList,
	"/admin/price-lists/:id/update": updatePriceList,
	"/admin/price-lists/:id/delete": deletePriceList,
	"/admin/price-lists/:id/entries": listEntries,
	"/admin/price-lists/:id/entries/set": setEntry,
	"/admin/price-lists/:id/entries/:productId/remove": removeEntry,
	"/admin/price-lists/:id/entries/bulk": bulkSetEntries,
};
