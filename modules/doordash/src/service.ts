import type { ModuleController } from "@86d-app/core/types/module";

export type DeliveryStatus =
	| "pending"
	| "accepted"
	| "picked-up"
	| "delivered"
	| "cancelled";

export type Delivery = {
	id: string;
	orderId: string;
	externalDeliveryId?: string | undefined;
	status: DeliveryStatus;
	pickupAddress: Record<string, unknown>;
	dropoffAddress: Record<string, unknown>;
	estimatedPickupTime?: Date | undefined;
	estimatedDeliveryTime?: Date | undefined;
	actualPickupTime?: Date | undefined;
	actualDeliveryTime?: Date | undefined;
	fee: number;
	tip: number;
	trackingUrl?: string | undefined;
	driverName?: string | undefined;
	driverPhone?: string | undefined;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type DeliveryQuote = {
	id: string;
	externalDeliveryId: string;
	fee: number;
	currency: string;
	estimatedPickupTime?: string | undefined;
	estimatedDropoffTime?: string | undefined;
	expiresAt: Date;
	createdAt: Date;
};

export type DeliveryZone = {
	id: string;
	name: string;
	isActive: boolean;
	radius: number;
	centerLat: number;
	centerLng: number;
	minOrderAmount: number;
	deliveryFee: number;
	estimatedMinutes: number;
	createdAt: Date;
	updatedAt: Date;
};

export type DeliveryAvailability = {
	available: boolean;
	zone?: DeliveryZone | undefined;
	estimatedMinutes?: number | undefined;
	deliveryFee?: number | undefined;
};

export type DoordashController = ModuleController & {
	createDelivery(params: {
		orderId: string;
		pickupAddress: Record<string, unknown>;
		dropoffAddress: Record<string, unknown>;
		fee: number;
		tip?: number | undefined;
		metadata?: Record<string, unknown> | undefined;
	}): Promise<Delivery>;

	getDelivery(id: string): Promise<Delivery | null>;

	cancelDelivery(id: string): Promise<Delivery | null>;

	updateDeliveryStatus(
		id: string,
		status: DeliveryStatus,
	): Promise<Delivery | null>;

	listDeliveries(params?: {
		status?: DeliveryStatus | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Delivery[]>;

	requestQuote(params: {
		pickupAddress: string;
		pickupBusinessName: string;
		pickupPhoneNumber: string;
		dropoffAddress: string;
		dropoffBusinessName: string;
		dropoffPhoneNumber: string;
		orderValue: number;
	}): Promise<DeliveryQuote>;

	acceptQuote(quoteId: string): Promise<Delivery>;

	createZone(params: {
		name: string;
		radius: number;
		centerLat: number;
		centerLng: number;
		minOrderAmount?: number | undefined;
		deliveryFee: number;
		estimatedMinutes: number;
	}): Promise<DeliveryZone>;

	updateZone(
		id: string,
		params: {
			name?: string | undefined;
			isActive?: boolean | undefined;
			radius?: number | undefined;
			centerLat?: number | undefined;
			centerLng?: number | undefined;
			minOrderAmount?: number | undefined;
			deliveryFee?: number | undefined;
			estimatedMinutes?: number | undefined;
		},
	): Promise<DeliveryZone | null>;

	deleteZone(id: string): Promise<boolean>;

	listZones(params?: {
		isActive?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<DeliveryZone[]>;

	checkDeliveryAvailability(address: {
		lat: number;
		lng: number;
	}): Promise<DeliveryAvailability>;
};
