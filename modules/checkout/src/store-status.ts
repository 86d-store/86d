/**
 * Minimal interface for reading settings values.
 * This matches the relevant methods from SettingsController
 * without requiring a cross-module import.
 */
interface SettingsReader {
	getValue(key: string): Promise<string | null>;
}

/**
 * Store ordering status:
 * - coming_soon: default for new stores, checkout refused with "Not taking orders yet"
 * - paused: temporarily unavailable, checkout refused with "Temporarily closed"
 * - open: normal ordering, subject to business hours
 */
export type StoreStatus = "coming_soon" | "paused" | "open";

const STORE_STATUS_KEY = "commerce.store_status";
const DEFAULT_STORE_STATUS = "coming_soon" as const;

const COMING_SOON_MESSAGE_KEY = "commerce.coming_soon_message";
const PAUSED_MESSAGE_KEY = "commerce.paused_message";

export type StoreStatusGate =
	| { accepting: true; status: "open" }
	| { accepting: false; status: "coming_soon" | "paused"; message: string };

const DEFAULT_STATUS_MESSAGES: Record<"coming_soon" | "paused", string> = {
	coming_soon: "This store is not taking orders yet.",
	paused: "This store is temporarily closed.",
};

/**
 * Resolve the store status from settings.
 * Returns a gate object indicating whether the store accepts orders.
 */
export async function resolveStoreStatus(
	settingsController: SettingsReader | undefined,
): Promise<StoreStatusGate> {
	if (!settingsController) {
		return {
			accepting: false,
			status: DEFAULT_STORE_STATUS,
			message: DEFAULT_STATUS_MESSAGES[DEFAULT_STORE_STATUS],
		};
	}

	const value = await settingsController.getValue(STORE_STATUS_KEY);

	if (value === "open") {
		return { accepting: true, status: "open" };
	}

	if (value === "paused") {
		const customMessage = await settingsController.getValue(PAUSED_MESSAGE_KEY);
		return {
			accepting: false,
			status: "paused",
			message: customMessage ?? DEFAULT_STATUS_MESSAGES.paused,
		};
	}

	const customMessage = await settingsController.getValue(
		COMING_SOON_MESSAGE_KEY,
	);
	return {
		accepting: false,
		status: "coming_soon",
		message: customMessage ?? DEFAULT_STATUS_MESSAGES.coming_soon,
	};
}

/**
 * Error response when the store is not accepting orders.
 */
export function storeNotAcceptingError(
	gate: StoreStatusGate & { accepting: false },
) {
	return {
		code: "STORE_NOT_ACCEPTING_ORDERS" as const,
		error: gate.message,
		status: 503 as const,
		storeStatus: gate.status,
	};
}
