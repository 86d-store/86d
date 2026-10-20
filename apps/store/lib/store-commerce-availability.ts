import { getStoreConfig } from "@86d-store/sdk/get-store-config";
import {
	type Config,
	isRemoteStoreConfigV2,
	type RemoteStoreConfig,
} from "@86d-store/sdk/types";
import { readProcessEnv } from "env/process-env";
import { logger } from "utils/logger";

/**
 * Store ordering status determines whether the store accepts orders:
 * - coming_soon: default for new stores, storefront visible with banner, checkout refused
 * - paused: temporarily unavailable, storefront visible, checkout refused
 * - open: normal ordering, subject to business hours
 */
export type StoreStatus = "coming_soon" | "paused" | "open";

export const STORE_STATUS_VALUES: readonly StoreStatus[] = [
	"coming_soon",
	"paused",
	"open",
] as const;

export const DEFAULT_STORE_STATUS: StoreStatus = "coming_soon";

export type StoreStatusGate =
	| { accepting: true; status: "open" }
	| { accepting: false; status: "coming_soon" | "paused"; message: string };

const STATUS_MESSAGES: Record<Exclude<StoreStatus, "open">, string> = {
	coming_soon: "This store is not taking orders yet.",
	paused: "This store is temporarily closed.",
};

function isValidStoreStatus(
	value: string | null | undefined,
): value is StoreStatus {
	return value === "coming_soon" || value === "paused" || value === "open";
}

/**
 * Parse a store status value, returning the default if invalid.
 */
export function parseStoreStatus(
	value: string | null | undefined,
): StoreStatus {
	return isValidStoreStatus(value) ? value : DEFAULT_STORE_STATUS;
}

/**
 * Create a StoreStatusGate from a store status value.
 */
export function createStoreStatusGate(status: StoreStatus): StoreStatusGate {
	if (status === "open") {
		return { accepting: true, status: "open" };
	}
	return {
		accepting: false,
		status,
		message: STATUS_MESSAGES[status],
	};
}

export type StoreCommerceGate =
	| {
			managed: false;
			available: true;
			reason: "standalone";
	  }
	| {
			managed: true;
			available: boolean;
			reason:
				| "entitlement_available"
				| "entitlement_unavailable"
				| "entitlement_stale"
				| "legacy_billing_available"
				| "legacy_billing_unavailable"
				| "configuration_unavailable";
	  };

/**
 * A standalone Runtime commonly has STORE_ID for local data isolation. Only a
 * managed credential signal opts it into Control Plane configuration.
 */
export function isManagedStoreRuntime(
	environment: NodeJS.ProcessEnv = readProcessEnv(),
): boolean {
	return [
		environment["86D_STORE_ID"],
		environment["86D_WORKLOAD_CREDENTIAL"],
	].some((value) => typeof value === "string" && value.trim().length > 0);
}

function deadlineIsCurrent(deadline: string | undefined, now: Date): boolean {
	if (!deadline) return false;
	const deadlineTime = Date.parse(deadline);
	return Number.isFinite(deadlineTime) && deadlineTime > now.getTime();
}

export function evaluateManagedCommerceConfig(
	config: Config | RemoteStoreConfig,
	now: Date = new Date(),
): StoreCommerceGate {
	if (isRemoteStoreConfigV2(config)) {
		if (!config.commerceAvailability.available) {
			return {
				managed: true,
				available: false,
				reason: "entitlement_unavailable",
			};
		}
		const recheckAt = config.commerceAvailability.recheckAt;
		if (!deadlineIsCurrent(recheckAt, now)) {
			return {
				managed: true,
				available: false,
				reason: "entitlement_stale",
			};
		}
		return {
			managed: true,
			available: true,
			reason: "entitlement_available",
		};
	}

	const billing = config.billing;
	const activeStatus =
		billing?.status === "active" || billing?.status === "trialing";
	if (
		billing?.isActive === true &&
		activeStatus &&
		deadlineIsCurrent(billing.periodEnd, now)
	) {
		return {
			managed: true,
			available: true,
			reason: "legacy_billing_available",
		};
	}
	return {
		managed: true,
		available: false,
		reason: "legacy_billing_unavailable",
	};
}

export async function resolveStoreCommerceGate(): Promise<StoreCommerceGate> {
	if (!isManagedStoreRuntime()) {
		return { managed: false, available: true, reason: "standalone" };
	}

	try {
		const config = await getStoreConfig();
		return evaluateManagedCommerceConfig(config);
	} catch (error) {
		logger.warn("Managed Store commerce configuration is unavailable", {
			error: error instanceof Error ? error.message : "Unknown error",
		});
		return {
			managed: true,
			available: false,
			reason: "configuration_unavailable",
		};
	}
}
