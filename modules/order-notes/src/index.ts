import { acceptCapability } from "@86d-app/core/capabilities";
import { orderCustomerAuthorizeCapability } from "@86d-app/core/commerce-capabilities";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { orderNotesSchema } from "./schema";
import { createOrderNotesController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	AuthorType,
	OrderNote,
	OrderNoteSummary,
	OrderNotesController,
} from "./service";

export interface OrderNotesOptions extends ModuleConfig {
	/** Maximum notes per order (default: unlimited) */
	maxNotesPerOrder?: string;
}

export default function orderNotes(options?: OrderNotesOptions): Module {
	return {
		id: "order-notes",
		version: "0.0.1",
		schema: orderNotesSchema,
		capabilities: {
			accepts: [
				acceptCapability(orderCustomerAuthorizeCapability, { optional: true }),
			],
		},
		exports: {
			read: ["noteCount"],
		},
		events: {
			emits: [
				"orderNote.created",
				"orderNote.updated",
				"orderNote.deleted",
				"orderNote.pinned",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createOrderNotesController(ctx.data);
			return { controllers: { orderNotes: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/order-notes",
					component: "OrderNotesOverview",
					label: "Order Notes",
					icon: "MessageSquare",
					group: "Sales",
				},
			],
		},
		options,
	};
}
