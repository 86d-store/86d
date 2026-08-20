import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { comparisonsStorage } from "./schema";
import { createComparisonController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	ComparisonController,
	ComparisonItem,
	FrequentlyCompared,
} from "./service";

export interface ComparisonsOptions extends ModuleConfig {
	/** Maximum products per comparison list. Default: 4. */
	maxProducts?: string;
}

export default function comparisons(options?: ComparisonsOptions): Module {
	return {
		id: "comparisons",
		version: "0.0.1",
		storage: comparisonsStorage,
		exports: {
			read: ["comparisonItems", "frequentlyCompared"],
		},
		events: {
			emits: ["product.compared"],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createComparisonController(ctx.data);
			return { controllers: { comparisons: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/comparisons",
					component: "ComparisonAdmin",
					label: "Comparisons",
					icon: "BarChart3",
					group: "Marketing",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/compare",
					component: "ComparisonTable",
				},
			],
		},
		options,
	};
}
