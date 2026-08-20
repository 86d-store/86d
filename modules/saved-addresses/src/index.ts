import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { savedAddressesSchema } from "./schema";
import { createSavedAddressesController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Address,
	AddressInput,
	AddressSummary,
	SavedAddressesController,
} from "./service";

export interface SavedAddressesOptions extends ModuleConfig {
	/** Maximum addresses per customer (default: 20) */
	maxAddresses?: string;
}

export default function savedAddresses(
	options?: SavedAddressesOptions,
): Module {
	return {
		id: "saved-addresses",
		version: "0.0.1",
		schema: savedAddressesSchema,
		exports: {
			read: ["defaultAddress", "defaultBillingAddress", "addressList"],
		},
		events: {
			emits: [
				"address.created",
				"address.updated",
				"address.deleted",
				"address.defaultChanged",
			],
		},
		init: async (ctx: ModuleContext) => {
			const maxAddresses = options?.maxAddresses
				? Number.parseInt(options.maxAddresses, 10)
				: undefined;
			const controller = createSavedAddressesController(ctx.data, {
				maxAddresses:
					maxAddresses !== undefined && !Number.isNaN(maxAddresses)
						? maxAddresses
						: undefined,
			});
			return { controllers: { savedAddresses: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/saved-addresses",
					component: "AddressOverview",
					label: "Addresses",
					icon: "MapPin",
					group: "Customers",
				},
			],
		},
		store: {
			pages: [{ path: "/account/addresses", component: "AddressBook" }],
		},
		options,
	};
}
