import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { productLabelsSchema } from "./schema";
import { createProductLabelController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Label,
	LabelConditions,
	LabelPosition,
	LabelStats,
	LabelType,
	ProductLabel,
	ProductLabelController,
	ProductWithLabels,
} from "./service";

export interface ProductLabelsOptions extends ModuleConfig {
	/** Maximum labels per product. Default: 10. */
	maxLabelsPerProduct?: string;
}

export default function productLabels(options?: ProductLabelsOptions): Module {
	return {
		id: "product-labels",
		version: "0.0.1",
		schema: productLabelsSchema,
		exports: {
			read: ["activeLabels", "productLabels", "labelStats"],
		},
		events: {
			emits: [
				"label.created",
				"label.updated",
				"label.deleted",
				"label.assigned",
				"label.unassigned",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createProductLabelController(ctx.data);
			return { controllers: { productLabels: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/product-labels",
					component: "LabelAdmin",
					label: "Labels",
					icon: "Tag",
					group: "Catalog",
				},
			],
		},
		options,
	};
}
