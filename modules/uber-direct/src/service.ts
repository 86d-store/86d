import type { ModuleController } from "@86d-app/core/types/module";

export type Delivery = {
	id: string;
	orderId: string;
	externalId?: string | undefined;
	status:
		| "pending"
		| "quoted"
		| "accepted"
		| "picked-up"
		| "delivered"
		| "cancelled"
		| "failed";
	pickupAddress: Record<string, unknown>;
	dropoffAddress: Record<string, unknown>;
	pickupNotes?: string | undefined;
	dropoffNotes?: string | undefined;
	estimatedPickupTime?: Date | undefined;
	estimatedDeliveryTime?: Date | undefined;
	actualPickupTime?: Date | undefined;
	actualDeliveryTime?: Date | undefined;
	fee: number;
	tip: number;
	trackingUrl?: string | undefined;
	courierName?: string | undefined;
	courierPhone?: string | undefined;
	courierVehicle?: string | undefined;
	metadata: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type Quote = {
	id: string;
	pickupAddress: Record<string, unknown>;
	dropoffAddress: Record<string, unknown>;
	fee: number;
	estimatedMinutes: number;
	expiresAt: Date;
	status: "active" | "expired" | "used";
	createdAt: Date;
};

export type RequestQuoteParams = {
	pickupAddress: Record<string, unknown>;
	dropoffAddress: Record<string, unknown>;
};

export type CreateDeliveryParams = {
	orderId: string;
	quoteId: string;
	pickupNotes?: string | undefined;
	dropoffNotes?: string | undefined;
	tip?: number | undefined;
	metadata?: Record<string, unknown> | undefined;
};

export type DeliveryStats = {
	totalDeliveries: number;
	totalPending: number;
	totalAccepted: number;
	totalPickedUp: number;
	totalDelivered: number;
	totalCancelled: number;
	totalFailed: number;
	totalFees: number;
	totalTips: number;
};

export type ServiceArea = {
	id: string;
	name: string;
	isActive: boolean;
	radius: number;
	centerLat: number;
	centerLng: number;
	deliveryFee: number;
	estimatedMinutes: number;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateServiceAreaParams = {
	name: string;
	radius: number;
	centerLat: number;
	centerLng: number;
	deliveryFee: number;
	estimatedMinutes: number;
	isActive?: boolean | undefined;
};

export type UpdateServiceAreaParams = {
	name?: string | undefined;
	isActive?: boolean | undefined;
	radius?: number | undefined;
	centerLat?: number | undefined;
	centerLng?: number | undefined;
	deliveryFee?: number | undefined;
	estimatedMinutes?: number | undefined;
};

export type DeliveryAvailability = {
	available: boolean;
	area?: ServiceArea | undefined;
};

export type UberDirectController = ModuleController & {
	requestQuote(params: RequestQuoteParams): Promise<Quote>;

	createDelivery(params: CreateDeliveryParams): Promise<Delivery | null>;

	getDelivery(id: string): Promise<Delivery | null>;

	cancelDelivery(id: string): Promise<Delivery | null>;

	updateDeliveryStatus(
		id: string,
		status: Delivery["status"],
		updates?: Partial<
			Pick<
				Delivery,
				| "externalId"
				| "trackingUrl"
				| "courierName"
				| "courierPhone"
				| "courierVehicle"
				| "actualPickupTime"
				| "actualDeliveryTime"
			>
		>,
	): Promise<Delivery | null>;

	listDeliveries(params?: {
		status?: string | undefined;
		orderId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Delivery[]>;

	getQuote(id: string): Promise<Quote | null>;

	listQuotes(params?: {
		status?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Quote[]>;

	getDeliveryStats(): Promise<DeliveryStats>;

	checkAvailability(coords: {
		lat: number;
		lng: number;
	}): Promise<DeliveryAvailability>;

	createServiceArea(params: CreateServiceAreaParams): Promise<ServiceArea>;

	updateServiceArea(
		id: string,
		params: UpdateServiceAreaParams,
	): Promise<ServiceArea | null>;

	deleteServiceArea(id: string): Promise<boolean>;

	listServiceAreas(params?: {
		isActive?: boolean | undefined;
	}): Promise<ServiceArea[]>;
};
