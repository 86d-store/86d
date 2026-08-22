/**
 * EasyPost Shipping API provider.
 * Makes real HTTP calls to https://api.easypost.com/v2/.
 * Authentication uses HTTP Basic Auth with the API key as username.
 */

// ── EasyPost API types ──────────────────────────────────────────────────────

export interface EasyPostAddress {
	name?: string | undefined;
	company?: string | undefined;
	street1: string;
	street2?: string | undefined;
	city: string;
	state: string;
	zip: string;
	country: string;
	phone?: string | undefined;
	email?: string | undefined;
}

export interface EasyPostVerifiedAddress extends EasyPostAddress {
	id?: string | undefined;
	verifications?:
		| {
				delivery?: { success?: boolean | undefined } | undefined;
		  }
		| undefined;
}

export interface EasyPostParcel {
	length: number;
	width: number;
	height: number;
	/** Weight in ounces */
	weight: number;
}

export interface EasyPostRate {
	id: string;
	object: "Rate";
	carrier: string;
	service: string;
	rate: string;
	currency: string;
	delivery_days: number | null;
	delivery_date: string | null;
	delivery_date_guaranteed: boolean;
	est_delivery_days: number | null;
}

export interface EasyPostPostageLabel {
	id: string;
	label_url: string | null;
	label_pdf_url: string | null;
	label_zpl_url: string | null;
	label_size: string;
}

export interface EasyPostTracker {
	id: string;
	tracking_code: string;
	status: EasyPostTrackingStatus;
	status_detail: string;
	carrier: string;
	est_delivery_date: string | null;
	public_url: string;
	tracking_details: EasyPostTrackingDetail[];
	created_at: string;
	updated_at: string;
}

export interface EasyPostTrackingDetail {
	message: string;
	status: EasyPostTrackingStatus;
	status_detail: string;
	datetime: string;
	source: string;
	tracking_location: {
		city: string | null;
		state: string | null;
		country: string | null;
		zip: string | null;
	};
}

export type EasyPostTrackingStatus =
	| "unknown"
	| "pre_transit"
	| "in_transit"
	| "out_for_delivery"
	| "delivered"
	| "available_for_pickup"
	| "return_to_sender"
	| "failure"
	| "cancelled"
	| "error";

export interface EasyPostShipmentResponse {
	id: string;
	object: "Shipment";
	tracking_code: string | null;
	rates: EasyPostRate[];
	selected_rate: EasyPostRate | null;
	postage_label: EasyPostPostageLabel | null;
	tracker: EasyPostTracker | null;
	to_address: { id: string } & EasyPostAddress;
	from_address: { id: string } & EasyPostAddress;
	parcel: { id: string } & EasyPostParcel;
	created_at: string;
	updated_at: string;
}

export interface EasyPostErrorResponse {
	error: {
		code: string;
		message: string;
		errors?: Array<{ field: string; message: string }> | undefined;
	};
}

export interface GetRatesParams {
	fromAddress: EasyPostAddress;
	toAddress: EasyPostAddress;
	parcel: EasyPostParcel;
}

export interface BuyShipmentParams {
	shipmentId: string;
	rateId: string;
	insurance?: string | undefined;
}

// ── Provider class ──────────────────────────────────────────────────────────

export class EasyPostProvider {
	private readonly apiKey: string;
	private readonly baseUrl: string;

	constructor(apiKey: string, testMode = false) {
		this.apiKey = apiKey;
		this.baseUrl = testMode
			? "https://api.easypost.com/v2"
			: "https://api.easypost.com/v2";
	}

	private async request<T>(
		method: "GET" | "POST",
		path: string,
		body?: Record<string, unknown>,
	): Promise<T> {
		const credentials = btoa(`${this.apiKey}:`);
		const res = await fetch(`${this.baseUrl}${path}`, {
			method,
			headers: {
				Authorization: `Basic ${credentials}`,
				"Content-Type": "application/json",
			},
			...(body !== undefined ? { body: JSON.stringify(body) } : {}),
		});

		const json = (await res.json()) as T | EasyPostErrorResponse;
		if (!res.ok) {
			const err = json as EasyPostErrorResponse;
			throw new Error(
				`EasyPost API error: ${err.error.message} (${err.error.code})`,
			);
		}
		return json as T;
	}

	/**
	 * Verify a destination through EasyPost Address before quoting.
	 * Fails closed when delivery verification explicitly rejects the address.
	 */
	async verifyAddress(
		address: EasyPostAddress,
	): Promise<EasyPostVerifiedAddress> {
		const created = await this.request<EasyPostVerifiedAddress>(
			"POST",
			"/addresses",
			{
				address,
				verify: true,
			},
		);
		if (created.verifications?.delivery?.success === false) {
			throw new Error("EasyPost could not verify the destination address.");
		}
		return created;
	}

	/**
	 * Create a shipment to get available rates.
	 * Does NOT purchase a label — just returns rate options.
	 */
	async getRates(params: GetRatesParams): Promise<EasyPostShipmentResponse> {
		return this.request<EasyPostShipmentResponse>("POST", "/shipments", {
			shipment: {
				to_address: { ...params.toAddress, verify: true },
				from_address: params.fromAddress,
				parcel: params.parcel,
			},
		});
	}

	/**
	 * Purchase a shipment by selecting a rate.
	 * Returns the shipment with tracking code, label URL, and tracker.
	 */
	async buyShipment(
		params: BuyShipmentParams,
	): Promise<EasyPostShipmentResponse> {
		return this.request<EasyPostShipmentResponse>(
			"POST",
			`/shipments/${encodeURIComponent(params.shipmentId)}/buy`,
			{
				rate: { id: params.rateId },
				...(params.insurance !== undefined
					? { insurance: params.insurance }
					: {}),
			},
		);
	}

	/**
	 * Create a tracker for a tracking code.
	 */
	async createTracker(
		trackingCode: string,
		carrier?: string | undefined,
	): Promise<EasyPostTracker> {
		return this.request<EasyPostTracker>("POST", "/trackers", {
			tracker: {
				tracking_code: trackingCode,
				...(carrier !== undefined ? { carrier } : {}),
			},
		});
	}

	/**
	 * Retrieve a tracker by ID.
	 */
	async getTracker(trackerId: string): Promise<EasyPostTracker> {
		return this.request<EasyPostTracker>(
			"GET",
			`/trackers/${encodeURIComponent(trackerId)}`,
		);
	}

	/**
	 * Retrieve a shipment by ID.
	 */
	async getShipment(shipmentId: string): Promise<EasyPostShipmentResponse> {
		return this.request<EasyPostShipmentResponse>(
			"GET",
			`/shipments/${encodeURIComponent(shipmentId)}`,
		);
	}

	/**
	 * Verify API credentials by fetching the user resource.
	 * Returns account name on success, error message on failure.
	 */
	async verifyConnection(): Promise<
		{ ok: true; accountName: string } | { ok: false; error: string }
	> {
		try {
			const user = await this.request<{
				id: string;
				name: string | null;
				email: string | null;
			}>("GET", "/users");
			return {
				ok: true,
				accountName: user.name ?? user.email ?? user.id,
			};
		} catch (e) {
			return {
				ok: false,
				error: e instanceof Error ? e.message : String(e),
			};
		}
	}
}

// ── Status mapping ──────────────────────────────────────────────────────────

import type { ShipmentStatus } from "./service";

export function mapEasyPostStatusToInternal(
	status: EasyPostTrackingStatus,
): ShipmentStatus {
	switch (status) {
		case "pre_transit":
		case "unknown":
			return "pending";
		case "in_transit":
		case "out_for_delivery":
		case "available_for_pickup":
			return "in_transit";
		case "delivered":
			return "delivered";
		case "return_to_sender":
			return "returned";
		case "failure":
		case "cancelled":
		case "error":
			return "failed";
		default:
			return "pending";
	}
}
