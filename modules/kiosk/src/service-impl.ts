import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	KioskController,
	KioskItem,
	KioskSession,
	KioskStation,
	OverallStats,
	StationStats,
} from "./service";

function recalcTotals(items: KioskItem[]): {
	subtotal: number;
	tax: number;
	total: number;
} {
	const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);
	const tax = Math.round(subtotal * 0.08 * 100) / 100; // 8% tax
	return { subtotal, tax, total: Math.round((subtotal + tax) * 100) / 100 };
}

export function createKioskController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): KioskController {
	return {
		async registerStation(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const station: KioskStation = {
				id,
				name: params.name,
				location: params.location,
				isOnline: false,
				isActive: true,
				settings: params.settings ?? {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("kioskStation", id, station as Record<string, unknown>);
			void events?.emit("kiosk.registered", {
				stationId: station.id,
				name: station.name,
			});
			return station;
		},

		async updateStation(id, params) {
			const existing = await data.get("kioskStation", id);
			if (!existing) return null;

			const station = existing as unknown as KioskStation;
			const updated: KioskStation = {
				...station,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.location !== undefined ? { location: params.location } : {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.settings !== undefined ? { settings: params.settings } : {}),
				updatedAt: new Date(),
			};
			await data.upsert("kioskStation", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteStation(id) {
			const existing = await data.get("kioskStation", id);
			if (!existing) return false;
			await data.delete("kioskStation", id);
			return true;
		},

		async listStations(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const all = await data.findMany("kioskStation", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as KioskStation[];
		},

		async getStation(id) {
			const raw = await data.get("kioskStation", id);
			if (!raw) return null;
			return raw as unknown as KioskStation;
		},

		async heartbeat(stationId) {
			const existing = await data.get("kioskStation", stationId);
			if (!existing) return null;

			const station = existing as unknown as KioskStation;
			const now = new Date();
			const updated: KioskStation = {
				...station,
				isOnline: true,
				lastHeartbeat: now,
				updatedAt: now,
			};
			await data.upsert(
				"kioskStation",
				stationId,
				updated as Record<string, unknown>,
			);
			void events?.emit("kiosk.heartbeat", { stationId });
			return updated;
		},

		async startSession(stationId) {
			const existing = await data.get("kioskStation", stationId);
			if (!existing) return null;

			const station = existing as unknown as KioskStation;
			if (!station.isActive) return null;

			const now = new Date();
			const id = crypto.randomUUID();
			const session: KioskSession = {
				id,
				stationId,
				status: "active",
				items: [],
				subtotal: 0,
				tax: 0,
				tip: 0,
				total: 0,
				paymentStatus: "pending",
				startedAt: now,
				createdAt: now,
			};
			await data.upsert("kioskSession", id, session as Record<string, unknown>);

			// Link session to station
			const updatedStation: KioskStation = {
				...station,
				currentSessionId: id,
				updatedAt: now,
			};
			await data.upsert(
				"kioskStation",
				stationId,
				updatedStation as Record<string, unknown>,
			);

			void events?.emit("kiosk.session.started", {
				sessionId: session.id,
				stationId,
			});
			return session;
		},

		async addItem(sessionId, item) {
			const existing = await data.get("kioskSession", sessionId);
			if (!existing) return null;

			const session = existing as unknown as KioskSession;
			if (session.status !== "active") return null;

			const newItem: KioskItem = {
				id: crypto.randomUUID(),
				name: item.name,
				price: item.price,
				quantity: item.quantity,
			};
			const items = [...session.items, newItem];
			const totals = recalcTotals(items);

			const updated: KioskSession = {
				...session,
				items,
				...totals,
				total: Math.round((totals.total + session.tip) * 100) / 100,
			};
			await data.upsert(
				"kioskSession",
				sessionId,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async removeItem(sessionId, itemId) {
			const existing = await data.get("kioskSession", sessionId);
			if (!existing) return null;

			const session = existing as unknown as KioskSession;
			if (session.status !== "active") return null;

			const items = session.items.filter((i) => i.id !== itemId);
			if (items.length === session.items.length) return null; // item not found

			const totals = recalcTotals(items);
			const updated: KioskSession = {
				...session,
				items,
				...totals,
				total: Math.round((totals.total + session.tip) * 100) / 100,
			};
			await data.upsert(
				"kioskSession",
				sessionId,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async updateItemQuantity(sessionId, itemId, quantity) {
			const existing = await data.get("kioskSession", sessionId);
			if (!existing) return null;

			const session = existing as unknown as KioskSession;
			if (session.status !== "active") return null;

			const itemIndex = session.items.findIndex((i) => i.id === itemId);
			if (itemIndex === -1) return null;

			const items = [...session.items];
			if (quantity <= 0) {
				items.splice(itemIndex, 1);
			} else {
				items[itemIndex] = { ...items[itemIndex], quantity };
			}

			const totals = recalcTotals(items);
			const updated: KioskSession = {
				...session,
				items,
				...totals,
				total: Math.round((totals.total + session.tip) * 100) / 100,
			};
			await data.upsert(
				"kioskSession",
				sessionId,
				updated as Record<string, unknown>,
			);
			return updated;
		},

		async getSession(id) {
			const raw = await data.get("kioskSession", id);
			if (!raw) return null;
			return raw as unknown as KioskSession;
		},

		async completeSession(id, paymentMethod) {
			const existing = await data.get("kioskSession", id);
			if (!existing) return null;

			const session = existing as unknown as KioskSession;
			if (session.status !== "active") return null;

			const now = new Date();
			const updated: KioskSession = {
				...session,
				status: "completed",
				paymentMethod,
				paymentStatus: "paid",
				completedAt: now,
			};
			await data.upsert("kioskSession", id, updated as Record<string, unknown>);

			// Clear station current session
			const stationRaw = await data.get("kioskStation", session.stationId);
			if (stationRaw) {
				const station = stationRaw as unknown as KioskStation;
				const updatedStation: KioskStation = {
					...station,
					currentSessionId: undefined,
					updatedAt: now,
				};
				await data.upsert(
					"kioskStation",
					session.stationId,
					updatedStation as Record<string, unknown>,
				);
			}

			void events?.emit("kiosk.order.paid", {
				sessionId: updated.id,
				stationId: updated.stationId,
				total: updated.total,
				paymentMethod,
			});
			void events?.emit("kiosk.session.ended", {
				sessionId: updated.id,
				stationId: updated.stationId,
				status: "completed",
			});
			return updated;
		},

		async abandonSession(id) {
			const existing = await data.get("kioskSession", id);
			if (!existing) return null;

			const session = existing as unknown as KioskSession;
			if (session.status !== "active") return null;

			const now = new Date();
			const updated: KioskSession = {
				...session,
				status: "abandoned",
				completedAt: now,
			};
			await data.upsert("kioskSession", id, updated as Record<string, unknown>);

			// Clear station current session
			const stationRaw = await data.get("kioskStation", session.stationId);
			if (stationRaw) {
				const station = stationRaw as unknown as KioskStation;
				const updatedStation: KioskStation = {
					...station,
					currentSessionId: undefined,
					updatedAt: now,
				};
				await data.upsert(
					"kioskStation",
					session.stationId,
					updatedStation as Record<string, unknown>,
				);
			}

			void events?.emit("kiosk.session.ended", {
				sessionId: updated.id,
				stationId: updated.stationId,
				status: "abandoned",
			});
			return updated;
		},

		async listSessions(params) {
			const where: Record<string, unknown> = {};
			if (params?.stationId) where.stationId = params.stationId;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("kioskSession", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as KioskSession[];
		},

		async getStationStats(stationId) {
			const sessions = await data.findMany("kioskSession", {
				where: { stationId },
			});
			const all = sessions as unknown as KioskSession[];

			const stats: StationStats = {
				totalSessions: all.length,
				completedSessions: 0,
				abandonedSessions: 0,
				totalRevenue: 0,
			};

			for (const s of all) {
				if (s.status === "completed") {
					stats.completedSessions++;
					stats.totalRevenue += s.total;
				} else if (s.status === "abandoned" || s.status === "timed-out") {
					stats.abandonedSessions++;
				}
			}

			return stats;
		},

		async getOverallStats() {
			const allStations = await data.findMany("kioskStation", {});
			const stations = allStations as unknown as KioskStation[];

			const allSessions = await data.findMany("kioskSession", {});
			const sessions = allSessions as unknown as KioskSession[];

			const stats: OverallStats = {
				totalStations: stations.length,
				onlineStations: stations.filter((s) => s.isOnline).length,
				totalSessions: sessions.length,
				completedSessions: 0,
				abandonedSessions: 0,
				totalRevenue: 0,
			};

			for (const s of sessions) {
				if (s.status === "completed") {
					stats.completedSessions++;
					stats.totalRevenue += s.total;
				} else if (s.status === "abandoned" || s.status === "timed-out") {
					stats.abandonedSessions++;
				}
			}

			return stats;
		},
	};
}
