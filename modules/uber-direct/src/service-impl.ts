import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { mapUberStatusToInternal, UberDirectProvider } from "./provider";
import type {
	CreateDeliveryParams,
	CreateServiceAreaParams,
	Delivery,
	DeliveryAvailability,
	DeliveryStats,
	Quote,
	RequestQuoteParams,
	ServiceArea,
	UberDirectController,
	UpdateServiceAreaParams,
} from "./service";

interface UberDirectControllerOptions {
	clientId?: string | undefined;
	clientSecret?: string | undefined;
	customerId?: string | undefined;
}

export function createUberDirectController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: UberDirectControllerOptions | undefined,
): UberDirectController {
	// Create real Uber Direct API provider when credentials are configured
	const provider =
		options?.clientId && options?.clientSecret && options?.customerId
			? new UberDirectProvider({
					clientId: options.clientId,
					clientSecret: options.clientSecret,
					customerId: options.customerId,
				})
			: null;

	return {
		async requestQuote(params: RequestQuoteParams): Promise<Quote> {
			const id = crypto.randomUUID();
			const now = new Date();

			let fee: number;
			let estimatedMinutes: number;
			let expiresAt: Date;
			let externalId: string | undefined;

			if (provider) {
				// Real Uber Direct API call
				const pickupAddr = extractAddress(params.pickupAddress);
				const dropoffAddr = extractAddress(params.dropoffAddress);

				const uberQuote = await provider.createQuote({
					pickup_address: pickupAddr,
					dropoff_address: dropoffAddr,
				});

				fee = uberQuote.fee ?? 0;
				// duration is in minutes
				estimatedMinutes = uberQuote.duration ?? 30;
				expiresAt = uberQuote.expires
					? new Date(uberQuote.expires)
					: new Date(now.getTime() + 15 * 60 * 1000);
				externalId = uberQuote.id;
			} else {
				// No credentials configured — cannot provide real quotes
				throw new Error(
					"Uber Direct API credentials are not configured. Set clientId, clientSecret, and customerId in module options.",
				);
			}

			const quote: Quote = {
				id,
				pickupAddress: params.pickupAddress,
				dropoffAddress: params.dropoffAddress,
				fee,
				estimatedMinutes,
				expiresAt,
				status: "active",
				createdAt: now,
			};

			const quoteRecord = {
				...quote,
				...(externalId ? { externalId } : {}),
			};
			await data.upsert(
				"quote",
				id,
				quoteRecord as unknown as Record<string, unknown>,
			);

			void events?.emit("uber-direct.quote.created", {
				quoteId: id,
				fee,
				estimatedMinutes,
			});

			return quote;
		},

		async createDelivery(
			params: CreateDeliveryParams,
		): Promise<Delivery | null> {
			const quoteRaw = await data.get("quote", params.quoteId);
			if (!quoteRaw) return null;

			const quote = quoteRaw as unknown as Quote;

			if (quote.status !== "active") return null;
			if (new Date() > quote.expiresAt) return null;

			// Mark quote as used
			const usedQuote: Quote = { ...quote, status: "used" };
			await data.upsert(
				"quote",
				quote.id,
				usedQuote as unknown as Record<string, unknown>,
			);

			const id = crypto.randomUUID();
			const now = new Date();

			let externalId: string | undefined;
			let trackingUrl: string | undefined;
			let courierName: string | undefined;
			let courierPhone: string | undefined;
			let courierVehicle: string | undefined;
			let estimatedDeliveryTime: Date | undefined;
			let fee = quote.fee;

			// Call real Uber Direct API when provider is available
			if (provider) {
				const pickupAddr = extractAddress(quote.pickupAddress);
				const dropoffAddr = extractAddress(quote.dropoffAddress);

				const uberDelivery = await provider.createDelivery({
					pickup_name: extractField(quote.pickupAddress, "name") || "Store",
					pickup_address: pickupAddr,
					pickup_phone_number:
						extractField(quote.pickupAddress, "phone") || "+10000000000",
					dropoff_name:
						extractField(quote.dropoffAddress, "name") || "Customer",
					dropoff_address: dropoffAddr,
					dropoff_phone_number:
						extractField(quote.dropoffAddress, "phone") || "+10000000000",
					manifest_items: [{ name: "Order", quantity: 1, size: "medium" }],
					pickup_notes: params.pickupNotes,
					dropoff_notes: params.dropoffNotes,
					tip: params.tip,
					quote_id: (quoteRaw as Record<string, unknown>).externalId as
						| string
						| undefined,
					external_id: id,
				});

				externalId = uberDelivery.id;
				trackingUrl = uberDelivery.tracking_url;
				fee = uberDelivery.fee ?? fee;
				if (uberDelivery.courier) {
					courierName = uberDelivery.courier.name;
					courierPhone = uberDelivery.courier.phone_number;
					courierVehicle = uberDelivery.courier.vehicle_type;
				}
				if (uberDelivery.dropoff_eta) {
					estimatedDeliveryTime = new Date(uberDelivery.dropoff_eta);
				}
			}

			const delivery: Delivery = {
				id,
				orderId: params.orderId,
				externalId,
				status: "pending",
				pickupAddress: quote.pickupAddress,
				dropoffAddress: quote.dropoffAddress,
				pickupNotes: params.pickupNotes,
				dropoffNotes: params.dropoffNotes,
				estimatedDeliveryTime,
				fee,
				tip: params.tip ?? 0,
				trackingUrl,
				courierName,
				courierPhone,
				courierVehicle,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"delivery",
				id,
				delivery as unknown as Record<string, unknown>,
			);

			void events?.emit("uber-direct.delivery.created", {
				deliveryId: delivery.id,
				orderId: delivery.orderId,
			});

			return delivery;
		},

		async getDelivery(id: string): Promise<Delivery | null> {
			const raw = await data.get("delivery", id);
			if (!raw) return null;
			const delivery = raw as unknown as Delivery;

			// Refresh status from Uber Direct if provider is available
			if (provider && delivery.externalId) {
				try {
					const uberDelivery = await provider.getDelivery(delivery.externalId);
					const newStatus = mapUberStatusToInternal(
						uberDelivery.status ?? "pending",
					);
					if (newStatus !== delivery.status) {
						const updated: Delivery = {
							...delivery,
							status: newStatus,
							trackingUrl: uberDelivery.tracking_url ?? delivery.trackingUrl,
							...(uberDelivery.courier
								? {
										courierName:
											uberDelivery.courier.name ?? delivery.courierName,
										courierPhone:
											uberDelivery.courier.phone_number ??
											delivery.courierPhone,
										courierVehicle:
											uberDelivery.courier.vehicle_type ??
											delivery.courierVehicle,
									}
								: {}),
							...(uberDelivery.dropoff_eta
								? {
										estimatedDeliveryTime: new Date(uberDelivery.dropoff_eta),
									}
								: {}),
							...(newStatus === "picked-up"
								? { actualPickupTime: new Date() }
								: {}),
							...(newStatus === "delivered"
								? { actualDeliveryTime: new Date() }
								: {}),
							updatedAt: new Date(),
						};
						await data.upsert(
							"delivery",
							id,
							updated as unknown as Record<string, unknown>,
						);
						return updated;
					}
				} catch {
					// Fall back to local data if API call fails
				}
			}

			return delivery;
		},

		async cancelDelivery(id: string): Promise<Delivery | null> {
			const raw = await data.get("delivery", id);
			if (!raw) return null;

			const delivery = raw as unknown as Delivery;

			if (
				delivery.status === "delivered" ||
				delivery.status === "cancelled" ||
				delivery.status === "failed"
			) {
				return null;
			}

			// Cancel via Uber Direct API
			if (provider && delivery.externalId) {
				try {
					await provider.cancelDelivery(delivery.externalId);
				} catch {
					// Proceed with local cancellation even if API call fails
				}
			}

			const updated: Delivery = {
				...delivery,
				status: "cancelled",
				updatedAt: new Date(),
			};

			await data.upsert(
				"delivery",
				id,
				updated as unknown as Record<string, unknown>,
			);

			void events?.emit("uber-direct.delivery.cancelled", {
				deliveryId: updated.id,
				orderId: updated.orderId,
			});

			return updated;
		},

		async updateDeliveryStatus(id, status, updates): Promise<Delivery | null> {
			const raw = await data.get("delivery", id);
			if (!raw) return null;

			const delivery = raw as unknown as Delivery;
			const now = new Date();

			const updated: Delivery = {
				...delivery,
				status,
				...(updates?.externalId !== undefined
					? { externalId: updates.externalId }
					: {}),
				...(updates?.trackingUrl !== undefined
					? { trackingUrl: updates.trackingUrl }
					: {}),
				...(updates?.courierName !== undefined
					? { courierName: updates.courierName }
					: {}),
				...(updates?.courierPhone !== undefined
					? { courierPhone: updates.courierPhone }
					: {}),
				...(updates?.courierVehicle !== undefined
					? { courierVehicle: updates.courierVehicle }
					: {}),
				...(updates?.actualPickupTime !== undefined
					? { actualPickupTime: updates.actualPickupTime }
					: {}),
				...(updates?.actualDeliveryTime !== undefined
					? { actualDeliveryTime: updates.actualDeliveryTime }
					: {}),
				updatedAt: now,
			};

			await data.upsert(
				"delivery",
				id,
				updated as unknown as Record<string, unknown>,
			);

			if (status === "picked-up") {
				void events?.emit("uber-direct.delivery.picked-up", {
					deliveryId: updated.id,
					orderId: updated.orderId,
				});
			} else if (status === "delivered") {
				void events?.emit("uber-direct.delivery.delivered", {
					deliveryId: updated.id,
					orderId: updated.orderId,
				});
			}

			return updated;
		},

		async listDeliveries(params): Promise<Delivery[]> {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.orderId) where.orderId = params.orderId;

			const results = await data.findMany("delivery", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as Delivery[];
		},

		async getQuote(id: string): Promise<Quote | null> {
			const raw = await data.get("quote", id);
			if (!raw) return null;
			return raw as unknown as Quote;
		},

		async listQuotes(params): Promise<Quote[]> {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const results = await data.findMany("quote", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return results as unknown as Quote[];
		},

		async checkAvailability(coords: {
			lat: number;
			lng: number;
		}): Promise<DeliveryAvailability> {
			const areas = (await data.findMany("serviceArea", {
				where: { isActive: true },
			})) as unknown as ServiceArea[];

			for (const area of areas) {
				const dist = haversineDistanceKm(
					area.centerLat,
					area.centerLng,
					coords.lat,
					coords.lng,
				);
				if (dist <= area.radius) {
					return { available: true, area };
				}
			}
			return { available: false };
		},

		async createServiceArea(
			params: CreateServiceAreaParams,
		): Promise<ServiceArea> {
			const id = crypto.randomUUID();
			const now = new Date();
			const area: ServiceArea = {
				id,
				name: params.name,
				isActive: params.isActive ?? true,
				radius: params.radius,
				centerLat: params.centerLat,
				centerLng: params.centerLng,
				deliveryFee: params.deliveryFee,
				estimatedMinutes: params.estimatedMinutes,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"serviceArea",
				id,
				area as unknown as Record<string, unknown>,
			);
			return area;
		},

		async updateServiceArea(
			id: string,
			params: UpdateServiceAreaParams,
		): Promise<ServiceArea | null> {
			const raw = await data.get("serviceArea", id);
			if (!raw) return null;
			const existing = raw as unknown as ServiceArea;
			const updated: ServiceArea = {
				...existing,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.radius !== undefined ? { radius: params.radius } : {}),
				...(params.centerLat !== undefined
					? { centerLat: params.centerLat }
					: {}),
				...(params.centerLng !== undefined
					? { centerLng: params.centerLng }
					: {}),
				...(params.deliveryFee !== undefined
					? { deliveryFee: params.deliveryFee }
					: {}),
				...(params.estimatedMinutes !== undefined
					? { estimatedMinutes: params.estimatedMinutes }
					: {}),
				updatedAt: new Date(),
			};
			await data.upsert(
				"serviceArea",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteServiceArea(id: string): Promise<boolean> {
			const raw = await data.get("serviceArea", id);
			if (!raw) return false;
			await data.delete("serviceArea", id);
			return true;
		},

		async listServiceAreas(params?: {
			isActive?: boolean | undefined;
		}): Promise<ServiceArea[]> {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;
			const results = await data.findMany("serviceArea", {
				...(Object.keys(where).length > 0 ? { where } : {}),
			});
			return results as unknown as ServiceArea[];
		},

		async getDeliveryStats(): Promise<DeliveryStats> {
			const allDeliveries = (await data.findMany(
				"delivery",
				{},
			)) as unknown as Delivery[];

			let totalPending = 0;
			let totalAccepted = 0;
			let totalPickedUp = 0;
			let totalDelivered = 0;
			let totalCancelled = 0;
			let totalFailed = 0;
			let totalFees = 0;
			let totalTips = 0;

			for (const d of allDeliveries) {
				totalFees += d.fee;
				totalTips += d.tip;

				switch (d.status) {
					case "pending":
					case "quoted":
						totalPending++;
						break;
					case "accepted":
						totalAccepted++;
						break;
					case "picked-up":
						totalPickedUp++;
						break;
					case "delivered":
						totalDelivered++;
						break;
					case "cancelled":
						totalCancelled++;
						break;
					case "failed":
						totalFailed++;
						break;
				}
			}

			return {
				totalDeliveries: allDeliveries.length,
				totalPending,
				totalAccepted,
				totalPickedUp,
				totalDelivered,
				totalCancelled,
				totalFailed,
				totalFees,
				totalTips,
			};
		},
	};
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Haversine distance in km between two lat/lng pairs. */
function haversineDistanceKm(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Extract a flat address string from the address object. */
function extractAddress(addr: Record<string, unknown>): string {
	if (typeof addr.street === "string") return addr.street;
	if (typeof addr.address === "string") return addr.address;

	// Try to build from structured fields
	const parts: string[] = [];
	if (typeof addr.street_address_1 === "string")
		parts.push(addr.street_address_1);
	if (typeof addr.city === "string") parts.push(addr.city);
	if (typeof addr.state === "string") parts.push(addr.state);
	if (typeof addr.zip_code === "string") parts.push(addr.zip_code);
	if (parts.length > 0) return parts.join(", ");

	return JSON.stringify(addr);
}

/** Safely extract a string field from an address object. */
function extractField(
	addr: Record<string, unknown>,
	field: string,
): string | undefined {
	const value = addr[field];
	return typeof value === "string" ? value : undefined;
}
