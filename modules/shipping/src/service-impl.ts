import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { EasyPostProvider } from "./provider";
import type {
	CalculatedRate,
	LiveRate,
	Shipment,
	ShipmentStatus,
	ShippingCarrier,
	ShippingController,
	ShippingMethod,
	ShippingRate,
	ShippingZone,
} from "./service";

const VALID_SHIPMENT_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
	pending: ["shipped", "failed"],
	shipped: ["in_transit", "delivered", "returned", "failed"],
	in_transit: ["delivered", "returned", "failed"],
	delivered: ["returned"],
	returned: [],
	failed: ["pending"],
};

interface ShippingControllerOptions {
	easypostApiKey?: string | undefined;
	easypostTestMode?: boolean | undefined;
}

export function createShippingController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: ShippingControllerOptions | undefined,
): ShippingController {
	const provider = options?.easypostApiKey
		? new EasyPostProvider(
				options.easypostApiKey,
				options.easypostTestMode ?? true,
			)
		: null;

	return {
		// ── Zones ────────────────────────────────────────────────────────────

		async createZone(params): Promise<ShippingZone> {
			const id = crypto.randomUUID();
			const now = new Date();
			const zone: ShippingZone = {
				id,
				name: params.name,
				countries: params.countries ?? [],
				isActive: params.isActive ?? true,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"shippingZone",
				id,
				zone as unknown as Record<string, unknown>,
			);
			return zone;
		},

		async getZone(id): Promise<ShippingZone | null> {
			return (await data.get("shippingZone", id)) as ShippingZone | null;
		},

		async listZones(params): Promise<ShippingZone[]> {
			if (params?.activeOnly) {
				return (await data.findMany("shippingZone", {
					where: { isActive: true },
				})) as ShippingZone[];
			}
			return (await data.findMany("shippingZone", {})) as ShippingZone[];
		},

		async updateZone(id, params): Promise<ShippingZone | null> {
			const existing = (await data.get(
				"shippingZone",
				id,
			)) as ShippingZone | null;
			if (!existing) return null;

			const updated: ShippingZone = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.countries !== undefined
					? { countries: params.countries }
					: {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				updatedAt: new Date(),
			};
			await data.upsert(
				"shippingZone",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteZone(id): Promise<boolean> {
			const existing = (await data.get(
				"shippingZone",
				id,
			)) as ShippingZone | null;
			if (!existing) return false;

			// Remove all rates for this zone
			const rates = (await data.findMany("shippingRate", {
				where: { zoneId: id },
			})) as ShippingRate[];
			for (const rate of rates) {
				await data.delete("shippingRate", rate.id);
			}

			await data.delete("shippingZone", id);
			return true;
		},

		// ── Rates ────────────────────────────────────────────────────────────

		async addRate(params): Promise<ShippingRate> {
			const id = crypto.randomUUID();
			const now = new Date();
			const rate: ShippingRate = {
				id,
				zoneId: params.zoneId,
				name: params.name,
				price: params.price,
				minOrderAmount: params.minOrderAmount,
				maxOrderAmount: params.maxOrderAmount,
				minWeight: params.minWeight,
				maxWeight: params.maxWeight,
				isActive: params.isActive ?? true,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"shippingRate",
				id,
				rate as unknown as Record<string, unknown>,
			);
			return rate;
		},

		async getRate(id): Promise<ShippingRate | null> {
			return (await data.get("shippingRate", id)) as ShippingRate | null;
		},

		async listRates(params): Promise<ShippingRate[]> {
			const where: Record<string, unknown> = { zoneId: params.zoneId };
			if (params.activeOnly) where.isActive = true;

			return (await data.findMany("shippingRate", {
				where,
			})) as ShippingRate[];
		},

		async updateRate(id, params): Promise<ShippingRate | null> {
			const existing = (await data.get(
				"shippingRate",
				id,
			)) as ShippingRate | null;
			if (!existing) return null;

			const updated: ShippingRate = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.price !== undefined ? { price: params.price } : {}),
				...(params.minOrderAmount !== undefined
					? { minOrderAmount: params.minOrderAmount }
					: {}),
				...(params.maxOrderAmount !== undefined
					? { maxOrderAmount: params.maxOrderAmount }
					: {}),
				...(params.minWeight !== undefined
					? { minWeight: params.minWeight }
					: {}),
				...(params.maxWeight !== undefined
					? { maxWeight: params.maxWeight }
					: {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				updatedAt: new Date(),
			};
			await data.upsert(
				"shippingRate",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteRate(id): Promise<boolean> {
			const existing = (await data.get(
				"shippingRate",
				id,
			)) as ShippingRate | null;
			if (!existing) return false;
			await data.delete("shippingRate", id);
			return true;
		},

		async calculateRates(params): Promise<CalculatedRate[]> {
			// Find zones that include this country (or wildcard zones)
			const zones = (await data.findMany("shippingZone", {
				where: { isActive: true },
			})) as ShippingZone[];

			const matchingZones = zones.filter(
				(z) =>
					z.countries.length === 0 ||
					z.countries.includes(params.country.toUpperCase()),
			);

			const results: CalculatedRate[] = [];

			for (const zone of matchingZones) {
				const rates = (await data.findMany("shippingRate", {
					where: { zoneId: zone.id, isActive: true },
				})) as ShippingRate[];

				for (const rate of rates) {
					// Check amount conditions
					if (
						rate.minOrderAmount !== undefined &&
						rate.minOrderAmount !== null &&
						params.orderAmount < rate.minOrderAmount
					)
						continue;
					if (
						rate.maxOrderAmount !== undefined &&
						rate.maxOrderAmount !== null &&
						params.orderAmount > rate.maxOrderAmount
					)
						continue;

					// Check weight conditions
					if (params.weight !== undefined) {
						if (
							rate.minWeight !== undefined &&
							rate.minWeight !== null &&
							params.weight < rate.minWeight
						)
							continue;
						if (
							rate.maxWeight !== undefined &&
							rate.maxWeight !== null &&
							params.weight > rate.maxWeight
						)
							continue;
					}

					results.push({
						id: rate.id,
						name: rate.name,
						zoneName: zone.name,
						price: rate.price,
					});
				}
			}

			// Sort cheapest first
			return results.sort((a, b) => a.price - b.price);
		},

		// ── Methods ──────────────────────────────────────────────────────────

		async createMethod(params): Promise<ShippingMethod> {
			const id = crypto.randomUUID();
			const now = new Date();
			const method: ShippingMethod = {
				id,
				name: params.name,
				description: params.description,
				estimatedDaysMin: params.estimatedDaysMin,
				estimatedDaysMax: params.estimatedDaysMax,
				isActive: params.isActive ?? true,
				sortOrder: params.sortOrder ?? 0,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"shippingMethod",
				id,
				method as unknown as Record<string, unknown>,
			);
			return method;
		},

		async getMethod(id): Promise<ShippingMethod | null> {
			return (await data.get("shippingMethod", id)) as ShippingMethod | null;
		},

		async listMethods(params): Promise<ShippingMethod[]> {
			if (params?.activeOnly) {
				return (await data.findMany("shippingMethod", {
					where: { isActive: true },
				})) as ShippingMethod[];
			}
			return (await data.findMany("shippingMethod", {})) as ShippingMethod[];
		},

		async updateMethod(id, params): Promise<ShippingMethod | null> {
			const existing = (await data.get(
				"shippingMethod",
				id,
			)) as ShippingMethod | null;
			if (!existing) return null;

			const updated: ShippingMethod = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.description !== undefined
					? { description: params.description }
					: {}),
				...(params.estimatedDaysMin !== undefined
					? { estimatedDaysMin: params.estimatedDaysMin }
					: {}),
				...(params.estimatedDaysMax !== undefined
					? { estimatedDaysMax: params.estimatedDaysMax }
					: {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.sortOrder !== undefined
					? { sortOrder: params.sortOrder }
					: {}),
				updatedAt: new Date(),
			};
			await data.upsert(
				"shippingMethod",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteMethod(id): Promise<boolean> {
			const existing = (await data.get(
				"shippingMethod",
				id,
			)) as ShippingMethod | null;
			if (!existing) return false;
			await data.delete("shippingMethod", id);
			return true;
		},

		// ── Carriers ─────────────────────────────────────────────────────────

		async createCarrier(params): Promise<ShippingCarrier> {
			const id = crypto.randomUUID();
			const now = new Date();
			const carrier: ShippingCarrier = {
				id,
				name: params.name,
				code: params.code.toLowerCase(),
				trackingUrlTemplate: params.trackingUrlTemplate,
				isActive: params.isActive ?? true,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"shippingCarrier",
				id,
				carrier as unknown as Record<string, unknown>,
			);
			return carrier;
		},

		async getCarrier(id): Promise<ShippingCarrier | null> {
			return (await data.get("shippingCarrier", id)) as ShippingCarrier | null;
		},

		async listCarriers(params): Promise<ShippingCarrier[]> {
			if (params?.activeOnly) {
				return (await data.findMany("shippingCarrier", {
					where: { isActive: true },
				})) as ShippingCarrier[];
			}
			return (await data.findMany("shippingCarrier", {})) as ShippingCarrier[];
		},

		async updateCarrier(id, params): Promise<ShippingCarrier | null> {
			const existing = (await data.get(
				"shippingCarrier",
				id,
			)) as ShippingCarrier | null;
			if (!existing) return null;

			const updated: ShippingCarrier = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.code !== undefined
					? { code: params.code.toLowerCase() }
					: {}),
				...(params.trackingUrlTemplate !== undefined
					? { trackingUrlTemplate: params.trackingUrlTemplate }
					: {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				updatedAt: new Date(),
			};
			await data.upsert(
				"shippingCarrier",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteCarrier(id): Promise<boolean> {
			const existing = (await data.get(
				"shippingCarrier",
				id,
			)) as ShippingCarrier | null;
			if (!existing) return false;
			await data.delete("shippingCarrier", id);
			return true;
		},

		// ── Shipments ────────────────────────────────────────────────────────

		async createShipment(params): Promise<Shipment> {
			const id = crypto.randomUUID();
			const now = new Date();
			const shipment: Shipment = {
				id,
				orderId: params.orderId,
				carrierId: params.carrierId,
				methodId: params.methodId,
				trackingNumber: params.trackingNumber,
				status: "pending",
				estimatedDelivery: params.estimatedDelivery,
				notes: params.notes,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"shipment",
				id,
				shipment as unknown as Record<string, unknown>,
			);
			void events?.emit("shipment.created", {
				shipmentId: id,
				orderId: params.orderId,
			});
			return shipment;
		},

		async getShipment(id): Promise<Shipment | null> {
			return (await data.get("shipment", id)) as Shipment | null;
		},

		async listShipments(params): Promise<Shipment[]> {
			const where: Record<string, unknown> = {};
			if (params?.orderId) where.orderId = params.orderId;
			if (params?.status) where.status = params.status;

			return (await data.findMany("shipment", { where })) as Shipment[];
		},

		async findShipmentByTrackingNumber(
			trackingNumber: string,
		): Promise<Shipment | null> {
			const results = (await data.findMany("shipment", {
				where: { trackingNumber },
			})) as Shipment[];
			return results[0] ?? null;
		},

		async updateShipment(id, params): Promise<Shipment | null> {
			const existing = (await data.get("shipment", id)) as Shipment | null;
			if (!existing) return null;

			const updated: Shipment = {
				...existing,
				...(params.carrierId !== undefined
					? { carrierId: params.carrierId }
					: {}),
				...(params.methodId !== undefined ? { methodId: params.methodId } : {}),
				...(params.trackingNumber !== undefined
					? { trackingNumber: params.trackingNumber }
					: {}),
				...(params.estimatedDelivery !== undefined
					? { estimatedDelivery: params.estimatedDelivery }
					: {}),
				...(params.notes !== undefined ? { notes: params.notes } : {}),
				updatedAt: new Date(),
			};
			await data.upsert(
				"shipment",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async updateShipmentStatus(id, status): Promise<Shipment | null> {
			const existing = (await data.get("shipment", id)) as Shipment | null;
			if (!existing) return null;

			const allowed = VALID_SHIPMENT_TRANSITIONS[existing.status];
			if (!allowed.includes(status)) return null;

			const now = new Date();
			const updated: Shipment = {
				...existing,
				status,
				...(status === "shipped" ? { shippedAt: now } : {}),
				...(status === "delivered" ? { deliveredAt: now } : {}),
				updatedAt: now,
			};
			await data.upsert(
				"shipment",
				id,
				updated as unknown as Record<string, unknown>,
			);

			void events?.emit(`shipment.${status}`, {
				shipmentId: id,
				orderId: existing.orderId,
			});
			return updated;
		},

		async deleteShipment(id): Promise<boolean> {
			const existing = (await data.get("shipment", id)) as Shipment | null;
			if (!existing) return false;
			await data.delete("shipment", id);
			return true;
		},

		async getTrackingUrl(shipmentId): Promise<string | null> {
			const shipment = (await data.get(
				"shipment",
				shipmentId,
			)) as Shipment | null;
			if (!shipment) return null;

			// Return EasyPost public tracking URL if available
			if (shipment.publicTrackingUrl) {
				return shipment.publicTrackingUrl;
			}

			if (!shipment.trackingNumber || !shipment.carrierId) return null;

			const carrier = (await data.get(
				"shippingCarrier",
				shipment.carrierId,
			)) as ShippingCarrier | null;
			if (!carrier?.trackingUrlTemplate) return null;

			return carrier.trackingUrlTemplate.replace(
				"{tracking}",
				shipment.trackingNumber,
			);
		},

		// ── Live carrier rates (EasyPost) ────────────────────────────────────

		async getLiveRates(params): Promise<LiveRate[]> {
			if (!provider) {
				throw new Error(
					"EasyPost API key is not configured. Set easypostApiKey in module options.",
				);
			}

			const response = await provider.getRates({
				fromAddress: params.fromAddress,
				toAddress: params.toAddress,
				parcel: params.parcel,
			});

			return response.rates.map((rate) => ({
				rateId: rate.id,
				shipmentId: response.id,
				carrier: rate.carrier,
				service: rate.service,
				rate: rate.rate,
				currency: rate.currency,
				deliveryDays: rate.delivery_days ?? rate.est_delivery_days ?? null,
				deliveryDate: rate.delivery_date,
				deliveryDateGuaranteed: rate.delivery_date_guaranteed,
			}));
		},

		async purchaseLabel(params): Promise<Shipment> {
			void params;
			throw new Error(
				"Shipping label purchase is unavailable until a durable, idempotent fulfillment operation is configured.",
			);
		},
	};
}
