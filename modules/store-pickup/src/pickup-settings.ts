/**
 * Pickup settings reader - reads configurable policy settings from the settings module.
 * This provides a minimal interface to avoid cross-module type imports.
 */

interface SettingsReader {
	getValue(key: string): Promise<string | null>;
}

export type PickupCancelLockState = "started" | "preparing" | "ready" | "none";
export type PickupNoShowOutcome = "no_refund" | "refund" | "store_credit";
export type PickupRefundMethod = "original_payment_method";
export type ItemIssueResolution = "remake" | "refund" | "remake_or_refund";

const SETTING_KEYS = {
	timezone: "general.timezone",
	prepTimeMinutes: "pickup.prep_time_minutes",
	cancelLockState: "pickup.cancel_lock_state",
	noShowWindowMinutes: "pickup.no_show_window_minutes",
	noShowOutcome: "pickup.no_show_outcome",
	lateOrderRefundEnabled: "pickup.late_order_refund_enabled",
	lateOrderGraceMinutes: "pickup.late_order_grace_minutes",
	partialRefundsEnabled: "pickup.partial_refunds_enabled",
	refundMethod: "pickup.refund_method",
	itemIssueReportEnabled: "pickup.item_issue_report_enabled",
	itemIssueReportWindowHours: "pickup.item_issue_report_window_hours",
	itemIssueReportResolution: "pickup.item_issue_report_resolution",
	supportContact: "pickup.support_contact",
	policyCopy: "pickup.policy_copy",
	cancelBlockedMessage: "pickup.cancel_blocked_message",
} as const;

const DEFAULT_CANCEL_BLOCKED_MESSAGE =
	"Cannot cancel order after preparation has started. Please contact the store.";

const DEFAULTS = {
	cancelLockState: "started" as PickupCancelLockState,
	noShowWindowMinutes: 30,
	noShowOutcome: "no_refund" as PickupNoShowOutcome,
	lateOrderRefundEnabled: false,
	partialRefundsEnabled: true,
	refundMethod: "original_payment_method" as PickupRefundMethod,
	itemIssueReportEnabled: false,
};

const CANCEL_LOCK_VALUES = new Set<string>([
	"started",
	"preparing",
	"ready",
	"none",
]);
const NO_SHOW_OUTCOME_VALUES = new Set<string>([
	"no_refund",
	"refund",
	"store_credit",
]);
const ITEM_ISSUE_RESOLUTION_VALUES = new Set<string>([
	"remake",
	"refund",
	"remake_or_refund",
]);

export type PickupPolicySettings = {
	timezone: string | null;
	prepTimeMinutes: number | null;
	cancelLockState: PickupCancelLockState;
	noShowWindowMinutes: number;
	noShowOutcome: PickupNoShowOutcome;
	lateOrderRefundEnabled: boolean;
	lateOrderGraceMinutes: number | null;
	partialRefundsEnabled: boolean;
	refundMethod: PickupRefundMethod;
	itemIssueReportEnabled: boolean;
	itemIssueReportWindowHours: number | null;
	itemIssueReportResolution: ItemIssueResolution | null;
	supportContact: string | null;
	policyCopy: string | null;
	cancelBlockedMessage: string;
};

function parseBoolean(value: string | null, defaultValue: boolean): boolean {
	if (value === null) return defaultValue;
	return value === "true";
}

function parseNumber(
	value: string | null,
	defaultValue: number | null = null,
): number | null {
	if (value === null) return defaultValue;
	const num = Number.parseInt(value, 10);
	return Number.isFinite(num) && num > 0 ? num : defaultValue;
}

function parseCancelLockState(value: string | null): PickupCancelLockState {
	if (value !== null && CANCEL_LOCK_VALUES.has(value)) {
		return value as PickupCancelLockState;
	}
	return DEFAULTS.cancelLockState;
}

function parseNoShowOutcome(value: string | null): PickupNoShowOutcome {
	if (value !== null && NO_SHOW_OUTCOME_VALUES.has(value)) {
		return value as PickupNoShowOutcome;
	}
	return DEFAULTS.noShowOutcome;
}

function parseItemIssueResolution(
	value: string | null,
): ItemIssueResolution | null {
	if (value !== null && ITEM_ISSUE_RESOLUTION_VALUES.has(value)) {
		return value as ItemIssueResolution;
	}
	return null;
}

/**
 * Read pickup policy settings from the settings controller.
 * Returns null if the settings controller is not available.
 */
export async function readPickupSettings(
	settingsController: SettingsReader | undefined,
): Promise<PickupPolicySettings | null> {
	if (!settingsController) {
		return null;
	}

	const [
		timezone,
		prepTimeMinutes,
		cancelLockState,
		noShowWindowMinutes,
		noShowOutcome,
		lateOrderRefundEnabled,
		lateOrderGraceMinutes,
		partialRefundsEnabled,
		itemIssueReportEnabled,
		itemIssueReportWindowHours,
		itemIssueReportResolution,
		supportContact,
		policyCopy,
		cancelBlockedMessage,
	] = await Promise.all([
		settingsController.getValue(SETTING_KEYS.timezone),
		settingsController.getValue(SETTING_KEYS.prepTimeMinutes),
		settingsController.getValue(SETTING_KEYS.cancelLockState),
		settingsController.getValue(SETTING_KEYS.noShowWindowMinutes),
		settingsController.getValue(SETTING_KEYS.noShowOutcome),
		settingsController.getValue(SETTING_KEYS.lateOrderRefundEnabled),
		settingsController.getValue(SETTING_KEYS.lateOrderGraceMinutes),
		settingsController.getValue(SETTING_KEYS.partialRefundsEnabled),
		settingsController.getValue(SETTING_KEYS.itemIssueReportEnabled),
		settingsController.getValue(SETTING_KEYS.itemIssueReportWindowHours),
		settingsController.getValue(SETTING_KEYS.itemIssueReportResolution),
		settingsController.getValue(SETTING_KEYS.supportContact),
		settingsController.getValue(SETTING_KEYS.policyCopy),
		settingsController.getValue(SETTING_KEYS.cancelBlockedMessage),
	]);

	return {
		timezone,
		prepTimeMinutes: parseNumber(prepTimeMinutes),
		cancelLockState: parseCancelLockState(cancelLockState),
		noShowWindowMinutes:
			parseNumber(noShowWindowMinutes) ?? DEFAULTS.noShowWindowMinutes,
		noShowOutcome: parseNoShowOutcome(noShowOutcome),
		lateOrderRefundEnabled: parseBoolean(
			lateOrderRefundEnabled,
			DEFAULTS.lateOrderRefundEnabled,
		),
		lateOrderGraceMinutes: parseNumber(lateOrderGraceMinutes),
		partialRefundsEnabled: parseBoolean(
			partialRefundsEnabled,
			DEFAULTS.partialRefundsEnabled,
		),
		refundMethod: DEFAULTS.refundMethod,
		itemIssueReportEnabled: parseBoolean(
			itemIssueReportEnabled,
			DEFAULTS.itemIssueReportEnabled,
		),
		itemIssueReportWindowHours: parseNumber(itemIssueReportWindowHours),
		itemIssueReportResolution: parseItemIssueResolution(
			itemIssueReportResolution,
		),
		supportContact,
		policyCopy,
		cancelBlockedMessage:
			cancelBlockedMessage ?? DEFAULT_CANCEL_BLOCKED_MESSAGE,
	};
}

/**
 * Get the list of statuses that block customer cancellation based on the cancel lock state.
 */
export function getCancelBlockedStatuses(
	lockState: PickupCancelLockState,
): string[] {
	switch (lockState) {
		case "none":
			return [];
		case "started":
			return ["started", "preparing", "ready", "picked_up", "no_show"];
		case "preparing":
			return ["preparing", "ready", "picked_up", "no_show"];
		case "ready":
			return ["ready", "picked_up", "no_show"];
		default:
			return ["started", "preparing", "ready", "picked_up", "no_show"];
	}
}
