import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { kioskStorage } from "./schema";
import { createKioskController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	KioskAdminSortDirection,
	KioskController,
	KioskItem,
	KioskSession,
	KioskSessionAdminListPage,
	KioskSessionAdminListParams,
	KioskSessionAdminSortField,
	KioskStation,
	KioskStationAdminListPage,
	KioskStationAdminListParams,
	KioskStationAdminSortField,
	OverallStats,
	PaymentStatus,
	SessionStatus,
	StationStats,
} from "./service";

export interface KioskOptions extends ModuleConfig {
	/** Reserved compatibility option; public sessions are unavailable. */
	idleTimeout?: string;
	/** Reserved compatibility option; tipping is unavailable. */
	enableTipping?: string;
	/** Reserved compatibility option; tip choices are unavailable. */
	defaultTipPercents?: string;
}

export default function kiosk(options?: KioskOptions): Module {
	return {
		id: "kiosk",
		version: "0.0.1",
		storage: kioskStorage,
		init: async (ctx: ModuleContext) => {
			const controller = createKioskController(ctx.data, ctx.transactions);
			return { controllers: { kiosk: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/kiosk",
					component: "KioskAdmin",
					label: "Kiosks",
					icon: "Monitor",
					group: "Sales",
				},
				{
					path: "/admin/kiosk/stations",
					component: "KioskStations",
					label: "Stations",
					icon: "Columns",
					group: "Sales",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/kiosk/:stationId",
					component: "KioskTerminal",
				},
			],
		},
		options,
	};
}
