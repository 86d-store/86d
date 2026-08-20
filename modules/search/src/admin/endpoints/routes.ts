import { analyticsEndpoint } from "./analytics";
import { bulkIndex } from "./bulk-index";
import { clickAnalyticsEndpoint } from "./click-analytics";
import { getSettings } from "./get-settings";
import { indexItem, removeFromIndex } from "./index-manage";
import { popularEndpoint } from "./popular";
import { addSynonym, listSynonyms, removeSynonym } from "./synonyms";
import { zeroResultsEndpoint } from "./zero-results";

export const adminEndpoints = {
	"/admin/search/settings": getSettings,
	"/admin/search/analytics": analyticsEndpoint,
	"/admin/search/popular": popularEndpoint,
	"/admin/search/zero-results": zeroResultsEndpoint,
	"/admin/search/clicks": clickAnalyticsEndpoint,
	"/admin/search/synonyms": listSynonyms,
	"/admin/search/synonyms/add": addSynonym,
	"/admin/search/synonyms/:id/delete": removeSynonym,
	"/admin/search/index": indexItem,
	"/admin/search/index/remove": removeFromIndex,
	"/admin/search/index/bulk": bulkIndex,
};
