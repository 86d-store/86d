import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { kioskSchema } from "./schema";
import { createKioskController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	KioskController,
	KioskItem,
	KioskSession,
	KioskStation,
	OverallStats,
	PaymentStatus,
	SessionStatus,
	StationStats,
} from "./service";

export interface KioskOptions extends ModuleConfig {
	/** Idle timeout in seconds (default: "120") */
	idleTimeout?: string;
	/** Enable tipping (default: "true") */
	enableTipping?: string;
	/** Default tip percentages, comma-separated (default: "15,18,20,25") */
	defaultTipPercents?: string;
}

export default function kiosk(options?: KioskOptions): Module {
	return {
		id: "kiosk",
		version: "0.0.1",
		schema: kioskSchema,
		exports: {
			read: ["kioskSessionStatus", "kioskStationOnline"],
		},
		events: {
			emits: [
				"kiosk.session.started",
				"kiosk.session.ended",
				"kiosk.order.placed",
				"kiosk.order.paid",
				"kiosk.registered",
				"kiosk.heartbeat",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createKioskController(ctx.data, ctx.events);
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
