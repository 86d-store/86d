import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import { DoordashDriveProvider, mapDriveStatusToInternal } from "./provider";
import type {
	Delivery,
	DeliveryAvailability,
	DeliveryQuote,
	DeliveryZone,
	DoordashController,
} from "./service";

function haversineDistance(
	lat1: number,
	lng1: number,
	lat2: number,
	lng2: number,
): number {
	const R = 3959; // Earth radius in miles
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLng / 2) *
			Math.sin(dLng / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}

interface DoordashControllerOptions {
	developerId?: string | undefined;
	keyId?: string | undefined;
	signingSecret?: string | undefined;
	sandbox?: boolean | undefined;
}

export function createDoordashController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
	options?: DoordashControllerOptions | undefined,
): DoordashController {
	// Create real DoorDash Drive API provider when credentials are configured
	const provider =
		options?.developerId && options?.keyId && options?.signingSecret
			? new DoordashDriveProvider(
					{
						developerId: options.developerId,
						keyId: options.keyId,
						signingSecret: options.signingSecret,
					},
					options.sandbox ?? true,
				)
			: null;

	return {
		async createDelivery(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const externalDeliveryId = `86d_${id}`;

			let fee = params.fee;
			let trackingUrl: string | undefined;
			let estimatedPickupTime: Date | undefined;
			let estimatedDeliveryTime: Date | undefined;
			let driverName: string | undefined;

			// Call DoorDash Drive API when provider is available
			if (provider) {
				const pickupAddr =
					typeof params.pickupAddress.street === "string"
						? String(params.pickupAddress.street)
						: JSON.stringify(params.pickupAddress);
				const dropoffAddr =
					typeof params.dropoffAddress.street === "string"
						? String(params.dropoffAddress.street)
						: JSON.stringify(params.dropoffAddress);

				const driveResponse = await provider.createDelivery({
					externalDeliveryId,
					pickupAddress: pickupAddr,
					pickupBusinessName:
						typeof params.pickupAddress.businessName === "string"
							? String(params.pickupAddress.businessName)
							: "Store",
					pickupPhoneNumber:
						typeof params.pickupAddress.phone === "string"
							? String(params.pickupAddress.phone)
							: "+10000000000",
					dropoffAddress: dropoffAddr,
					dropoffBusinessName:
						typeof params.dropoffAddress.businessName === "string"
							? String(params.dropoffAddress.businessName)
							: "Customer",
					dropoffPhoneNumber:
						typeof params.dropoffAddress.phone === "string"
							? String(params.dropoffAddress.phone)
							: "+10000000000",
					orderValue: params.fee,
					tip: params.tip,
				});

				fee = driveResponse.fee;
				trackingUrl = driveResponse.tracking_url ?? undefined;
				driverName = driveResponse.dasher_name ?? undefined;
				if (driveResponse.pickup_time_estimated) {
					estimatedPickupTime = new Date(driveResponse.pickup_time_estimated);
				}
				if (driveResponse.dropoff_time_estimated) {
					estimatedDeliveryTime = new Date(
						driveResponse.dropoff_time_estimated,
					);
				}
			}

			const delivery: Delivery = {
				id,
				orderId: params.orderId,
				externalDeliveryId,
				status: "pending",
				pickupAddress: params.pickupAddress,
				dropoffAddress: params.dropoffAddress,
				fee,
				tip: params.tip ?? 0,
				trackingUrl,
				driverName,
				estimatedPickupTime,
				estimatedDeliveryTime,
				metadata: params.metadata ?? {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"delivery",
				id,
				delivery as unknown as Record<string, unknown>,
			);
			void events?.emit("doordash.delivery.created", {
				deliveryId: delivery.id,
				orderId: delivery.orderId,
			});
			return delivery;
		},

		async getDelivery(id) {
			const raw = await data.get("delivery", id);
			if (!raw) return null;
			const delivery = raw as unknown as Delivery;

			// Refresh status from DoorDash if provider is available
			if (provider && delivery.externalDeliveryId) {
				try {
					const driveResponse = await provider.getDelivery(
						delivery.externalDeliveryId,
					);
					const newStatus = mapDriveStatusToInternal(
						driveResponse.delivery_status,
					);
					if (newStatus !== delivery.status) {
						const updated: Delivery = {
							...delivery,
							status: newStatus,
							trackingUrl: driveResponse.tracking_url ?? delivery.trackingUrl,
							driverName: driveResponse.dasher_name ?? delivery.driverName,
							driverPhone:
								driveResponse.dasher_dropoff_phone_number ??
								delivery.driverPhone,
							...(driveResponse.pickup_time_actual
								? {
										actualPickupTime: new Date(
											driveResponse.pickup_time_actual,
										),
									}
								: {}),
							...(driveResponse.dropoff_time_actual
								? {
										actualDeliveryTime: new Date(
											driveResponse.dropoff_time_actual,
										),
									}
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

		async cancelDelivery(id) {
			const existing = await data.get("delivery", id);
			if (!existing) return null;

			const delivery = existing as unknown as Delivery;
			if (delivery.status === "delivered" || delivery.status === "cancelled") {
				return null;
			}

			// Cancel via DoorDash Drive API
			if (provider && delivery.externalDeliveryId) {
				try {
					await provider.cancelDelivery(delivery.externalDeliveryId);
				} catch {
					// Proceed with local cancellation even if API call fails
				}
			}

			const now = new Date();
			const updated: Delivery = {
				...delivery,
				status: "cancelled",
				updatedAt: now,
			};
			await data.upsert(
				"delivery",
				id,
				updated as unknown as Record<string, unknown>,
			);
			void events?.emit("doordash.delivery.cancelled", {
				deliveryId: updated.id,
				orderId: updated.orderId,
			});
			return updated;
		},

		async updateDeliveryStatus(id, status) {
			const existing = await data.get("delivery", id);
			if (!existing) return null;

			const delivery = existing as unknown as Delivery;
			if (delivery.status === "delivered" || delivery.status === "cancelled") {
				return null;
			}

			const now = new Date();
			const updated: Delivery = {
				...delivery,
				status,
				...(status === "picked-up" ? { actualPickupTime: now } : {}),
				...(status === "delivered" ? { actualDeliveryTime: now } : {}),
				updatedAt: now,
			};
			await data.upsert(
				"delivery",
				id,
				updated as unknown as Record<string, unknown>,
			);

			if (status === "picked-up") {
				void events?.emit("doordash.delivery.picked-up", {
					deliveryId: updated.id,
					orderId: updated.orderId,
				});
			} else if (status === "delivered") {
				void events?.emit("doordash.delivery.delivered", {
					deliveryId: updated.id,
					orderId: updated.orderId,
				});
			}
			return updated;
		},

		async listDeliveries(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;

			const all = await data.findMany("delivery", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as Delivery[];
		},

		async requestQuote(params) {
			if (!provider) {
				throw new Error(
					"DoorDash API credentials are not configured. Set developerId, keyId, and signingSecret in module options.",
				);
			}

			const externalDeliveryId = `86d_quote_${crypto.randomUUID()}`;
			const driveQuote = await provider.createQuote({
				externalDeliveryId,
				pickupAddress: params.pickupAddress,
				pickupBusinessName: params.pickupBusinessName,
				pickupPhoneNumber: params.pickupPhoneNumber,
				dropoffAddress: params.dropoffAddress,
				dropoffBusinessName: params.dropoffBusinessName,
				dropoffPhoneNumber: params.dropoffPhoneNumber,
				orderValue: params.orderValue,
			});

			const now = new Date();
			const quote: DeliveryQuote = {
				id: crypto.randomUUID(),
				externalDeliveryId,
				fee: driveQuote.fee,
				currency: driveQuote.currency,
				estimatedPickupTime: driveQuote.pickup_time_estimated ?? undefined,
				estimatedDropoffTime: driveQuote.dropoff_time_estimated ?? undefined,
				expiresAt: new Date(now.getTime() + 5 * 60 * 1000), // 5 min expiry
				createdAt: now,
			};

			await data.upsert(
				"quote",
				quote.id,
				quote as unknown as Record<string, unknown>,
			);
			return quote;
		},

		async acceptQuote(quoteId) {
			if (!provider) {
				throw new Error(
					"DoorDash API credentials are not configured. Set developerId, keyId, and signingSecret in module options.",
				);
			}

			const rawQuote = await data.get("quote", quoteId);
			if (!rawQuote) {
				throw new Error(`Quote not found: ${quoteId}`);
			}
			const quote = rawQuote as unknown as DeliveryQuote;

			if (new Date() > quote.expiresAt) {
				throw new Error("Quote has expired. Please request a new quote.");
			}

			const driveResponse = await provider.acceptQuote(
				quote.externalDeliveryId,
			);

			const now = new Date();
			const id = crypto.randomUUID();
			const delivery: Delivery = {
				id,
				orderId: quote.externalDeliveryId,
				externalDeliveryId: quote.externalDeliveryId,
				status: mapDriveStatusToInternal(driveResponse.delivery_status),
				pickupAddress: { address: driveResponse.pickup_address },
				dropoffAddress: { address: driveResponse.dropoff_address },
				fee: driveResponse.fee,
				tip: driveResponse.tip,
				trackingUrl: driveResponse.tracking_url ?? undefined,
				driverName: driveResponse.dasher_name ?? undefined,
				driverPhone: driveResponse.dasher_dropoff_phone_number ?? undefined,
				metadata: { quoteId },
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"delivery",
				id,
				delivery as unknown as Record<string, unknown>,
			);
			void events?.emit("doordash.delivery.created", {
				deliveryId: delivery.id,
				orderId: delivery.orderId,
			});
			return delivery;
		},

		async createZone(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const zone: DeliveryZone = {
				id,
				name: params.name,
				isActive: true,
				radius: params.radius,
				centerLat: params.centerLat,
				centerLng: params.centerLng,
				minOrderAmount: params.minOrderAmount ?? 0,
				deliveryFee: params.deliveryFee,
				estimatedMinutes: params.estimatedMinutes,
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert(
				"deliveryZone",
				id,
				zone as unknown as Record<string, unknown>,
			);
			return zone;
		},

		async updateZone(id, params) {
			const existing = await data.get("deliveryZone", id);
			if (!existing) return null;

			const zone = existing as unknown as DeliveryZone;
			const updated: DeliveryZone = {
				...zone,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.radius !== undefined ? { radius: params.radius } : {}),
				...(params.centerLat !== undefined
					? { centerLat: params.centerLat }
					: {}),
				...(params.centerLng !== undefined
					? { centerLng: params.centerLng }
					: {}),
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
			await data.upsert(
				"deliveryZone",
				id,
				updated as unknown as Record<string, unknown>,
			);
			return updated;
		},

		async deleteZone(id) {
			const existing = await data.get("deliveryZone", id);
			if (!existing) return false;
			await data.delete("deliveryZone", id);
			return true;
		},

		async listZones(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const all = await data.findMany("deliveryZone", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as DeliveryZone[];
		},

		async checkDeliveryAvailability(address) {
			const zones = await data.findMany("deliveryZone", {
				where: { isActive: true },
			});
			const activeZones = zones as unknown as DeliveryZone[];

			for (const zone of activeZones) {
				const distance = haversineDistance(
					zone.centerLat,
					zone.centerLng,
					address.lat,
					address.lng,
				);
				if (distance <= zone.radius) {
					const result: DeliveryAvailability = {
						available: true,
						zone,
						estimatedMinutes: zone.estimatedMinutes,
						deliveryFee: zone.deliveryFee,
					};
					return result;
				}
			}

			return { available: false };
		},
	};
}
