import { getStoreConfig } from "@86d-app/sdk/get-store-config";
import {
	type Config,
	isRemoteStoreConfigV2,
	type RemoteStoreConfig,
} from "@86d-app/sdk/types";
import { readProcessEnv } from "env/process-env";
import { logger } from "utils/logger";

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
