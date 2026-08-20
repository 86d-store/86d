import { clearHistory } from "./clear-history";
import { listViews } from "./list-views";
import { mergeHistory } from "./merge-history";
import { trackView } from "./track-view";

export const storeEndpoints = {
	"/recently-viewed": listViews,
	"/recently-viewed/track": trackView,
	"/recently-viewed/clear": clearHistory,
	"/recently-viewed/merge": mergeHistory,
};
