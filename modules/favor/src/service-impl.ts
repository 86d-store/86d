import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	CreateFavorDeliveryParams,
	CreateServiceAreaParams,
	FavorController,
	FavorDelivery,
	FavorDeliveryStats,
	ServiceArea,
	UpdateServiceAreaParams,
} from "./service";

export function createFavorController(
	data: ModuleDataService,
): FavorController {
	return {
		async createDelivery(
			params: CreateFavorDeliveryParams,
		): Promise<FavorDelivery> {
			const id = crypto.randomUUID();
			const now = new Date();

			const delivery: FavorDelivery = {
				id,
				orderId: params.orderId,
				status: "pending",
				pickupAddress: params.pickupAddress,
				dropoffAddress: params.dropoffAddress,
				fee: params.fee,
				tip: params.tip ?? 0,
				specialInstructions: params.specialInstructions,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("delivery", id, delivery as Record<string, unknown>);
			return delivery;
		},

		async getDelivery(id: string): Promise<FavorDelivery | null> {
			const raw = await data.get("delivery", id);
			if (!raw) return null;
			return raw as unknown as FavorDelivery;
		},

		async cancelDelivery(id: string): Promise<FavorDelivery | null> {
			const raw = await data.get("delivery", id);
			if (!raw) return null;

			const delivery = raw as unknown as FavorDelivery;

			if (delivery.status === "completed" || delivery.status === "cancelled") {
				return null;
			}

			const updated: FavorDelivery = {
				...delivery,
				status: "cancelled",
				updatedAt: new Date(),
			};

			await data.upsert("delivery", id, updated as Record<string, unknown>);
			return updated;
		},

		async updateDeliveryStatus(
			id,
			status,
			updates,
		): Promise<FavorDelivery | null> {
			const raw = await data.get("delivery", id);
			if (!raw) return null;

			const delivery = raw as unknown as FavorDelivery;
			const now = new Date();

			const updated: FavorDelivery = {
				...delivery,
				status,
				...(updates?.externalId !== undefined
					? { externalId: updates.externalId }
					: {}),
				...(updates?.runnerName !== undefined
					? { runnerName: updates.runnerName }
					: {}),
				...(updates?.runnerPhone !== undefined
					? { runnerPhone: updates.runnerPhone }
					: {}),
				...(updates?.trackingUrl !== undefined
					? { trackingUrl: updates.trackingUrl }
					: {}),
				...(updates?.estimatedArrival !== undefined
					? { estimatedArrival: updates.estimatedArrival }
					: {}),
				...(updates?.actualArrival !== undefined
					? { actualArrival: updates.actualArrival }
					: {}),
				updatedAt: now,
			};

			await data.upsert("delivery", id, updated as Record<string, unknown>);
			return updated;
		},

		async listDeliveries(params): Promise<FavorDelivery[]> {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.orderId) where.orderId = params.orderId;

			const results = await data.findMany("delivery", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as FavorDelivery[];
		},

		async createServiceArea(
			params: CreateServiceAreaParams,
		): Promise<ServiceArea> {
			const id = crypto.randomUUID();
			const now = new Date();

			const area: ServiceArea = {
				id,
				name: params.name,
				isActive: true,
				zipCodes: params.zipCodes,
				minOrderAmount: params.minOrderAmount ?? 0,
				deliveryFee: params.deliveryFee,
				estimatedMinutes: params.estimatedMinutes,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("serviceArea", id, area as Record<string, unknown>);
			return area;
		},

		async updateServiceArea(
			id: string,
			params: UpdateServiceAreaParams,
		): Promise<ServiceArea | null> {
			const raw = await data.get("serviceArea", id);
			if (!raw) return null;

			const area = raw as unknown as ServiceArea;
			const updated: ServiceArea = {
				...area,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.zipCodes !== undefined ? { zipCodes: params.zipCodes } : {}),
				...(params.minOrderAmount !== undefined
					? { minOrderAmount: params.minOrderAmount }
					: {}),
				...(params.deliveryFee !== undefined
					? { deliveryFee: params.deliveryFee }
					: {}),
				...(params.estimatedMinutes !== undefined
					? { estimatedMinutes: params.estimatedMinutes }
					: {}),
				updatedAt: new Date(),
			};

			await data.upsert("serviceArea", id, updated as Record<string, unknown>);
			return updated;
		},

		async deleteServiceArea(id: string): Promise<boolean> {
			const raw = await data.get("serviceArea", id);
			if (!raw) return false;
			await data.delete("serviceArea", id);
			return true;
		},

		async listServiceAreas(params): Promise<ServiceArea[]> {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const results = await data.findMany("serviceArea", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as ServiceArea[];
		},

		async checkAvailability(
			zipCode: string,
		): Promise<{ available: boolean; area: ServiceArea | null }> {
			const allAreas = (await data.findMany("serviceArea", {
				where: { isActive: true },
			})) as unknown as ServiceArea[];

			for (const area of allAreas) {
				if (area.zipCodes.includes(zipCode)) {
					return { available: true, area };
				}
			}
			return { available: false, area: null };
		},

		async getDeliveryStats(): Promise<FavorDeliveryStats> {
			const allDeliveries = (await data.findMany(
				"delivery",
				{},
			)) as unknown as FavorDelivery[];

			let totalPending = 0;
			let totalAssigned = 0;
			let totalEnRoute = 0;
			let totalCompleted = 0;
			let totalCancelled = 0;
			let totalFees = 0;
			let totalTips = 0;

			for (const d of allDeliveries) {
				totalFees += d.fee;
				totalTips += d.tip;

				switch (d.status) {
					case "pending":
						totalPending++;
						break;
					case "assigned":
						totalAssigned++;
						break;
					case "en-route":
					case "arrived":
						totalEnRoute++;
						break;
					case "completed":
						totalCompleted++;
						break;
					case "cancelled":
						totalCancelled++;
						break;
				}
			}

			return {
				totalDeliveries: allDeliveries.length,
				totalPending,
				totalAssigned,
				totalEnRoute,
				totalCompleted,
				totalCancelled,
				totalFees,
				totalTips,
			};
		},
	};
}
