import { createAdminEndpoint } from "@86d-store/core/api";
import {
	DEFAULT_PICKUP_CANCEL_BLOCKED_MESSAGE,
	DEFAULT_PICKUP_CANCEL_LOCK_STATE,
	DEFAULT_PICKUP_ITEM_ISSUE_REPORT_ENABLED,
	DEFAULT_PICKUP_LATE_ORDER_REFUND_ENABLED,
	DEFAULT_PICKUP_NO_SHOW_OUTCOME,
	DEFAULT_PICKUP_NO_SHOW_WINDOW_MINUTES,
	DEFAULT_PICKUP_PARTIAL_REFUNDS_ENABLED,
	DEFAULT_PICKUP_REFUND_METHOD,
	ITEM_ISSUE_RESOLUTION_VALUES,
	type ItemIssueResolution,
	PICKUP_CANCEL_LOCK_VALUES,
	PICKUP_NO_SHOW_OUTCOME_VALUES,
	PICKUP_REFUND_METHOD_VALUES,
	type PickupCancelLockState,
	type PickupNoShowOutcome,
	type PickupRefundMethod,
	SETTING_KEYS,
	type SettingsController,
} from "../../service";

export type PickupSettings = {
	prepTimeMinutes: number | null;
	cancelLockState: PickupCancelLockState;
	cancelBlockedMessage: string;
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
	timezone: string | null;
	isConfigured: boolean;
	missingRequired: string[];
};

function parseBoolean(value: string | null, defaultValue: boolean): boolean {
	if (value === null) return defaultValue;
	return value === "true";
}

function parseNumber(value: string | null): number | null {
	if (value === null) return null;
	const num = Number.parseInt(value, 10);
	return Number.isFinite(num) ? num : null;
}

function parseCancelLockState(value: string | null): PickupCancelLockState {
	if (
		value !== null &&
		PICKUP_CANCEL_LOCK_VALUES.includes(value as PickupCancelLockState)
	) {
		return value as PickupCancelLockState;
	}
	return DEFAULT_PICKUP_CANCEL_LOCK_STATE;
}

function parseNoShowOutcome(value: string | null): PickupNoShowOutcome {
	if (
		value !== null &&
		PICKUP_NO_SHOW_OUTCOME_VALUES.includes(value as PickupNoShowOutcome)
	) {
		return value as PickupNoShowOutcome;
	}
	return DEFAULT_PICKUP_NO_SHOW_OUTCOME;
}

function parseRefundMethod(value: string | null): PickupRefundMethod {
	if (
		value !== null &&
		PICKUP_REFUND_METHOD_VALUES.includes(value as PickupRefundMethod)
	) {
		return value as PickupRefundMethod;
	}
	return DEFAULT_PICKUP_REFUND_METHOD;
}

function parseItemIssueResolution(
	value: string | null,
): ItemIssueResolution | null {
	if (
		value !== null &&
		ITEM_ISSUE_RESOLUTION_VALUES.includes(value as ItemIssueResolution)
	) {
		return value as ItemIssueResolution;
	}
	return null;
}

export const getPickupSettingsEndpoint = createAdminEndpoint(
	"/admin/settings/pickup",
	{ method: "GET" },
	async (ctx) => {
		const controller = ctx.context.controllers.settings as SettingsController;

		const [
			prepTimeMinutes,
			cancelLockState,
			cancelBlockedMessage,
			noShowWindowMinutes,
			noShowOutcome,
			lateOrderRefundEnabled,
			lateOrderGraceMinutes,
			partialRefundsEnabled,
			refundMethod,
			itemIssueReportEnabled,
			itemIssueReportWindowHours,
			itemIssueReportResolution,
			supportContact,
			policyCopy,
			timezone,
		] = await Promise.all([
			controller.getValue(SETTING_KEYS.pickupPrepTimeMinutes),
			controller.getValue(SETTING_KEYS.pickupCancelLockState),
			controller.getValue(SETTING_KEYS.pickupCancelBlockedMessage),
			controller.getValue(SETTING_KEYS.pickupNoShowWindowMinutes),
			controller.getValue(SETTING_KEYS.pickupNoShowOutcome),
			controller.getValue(SETTING_KEYS.pickupLateOrderRefundEnabled),
			controller.getValue(SETTING_KEYS.pickupLateOrderGraceMinutes),
			controller.getValue(SETTING_KEYS.pickupPartialRefundsEnabled),
			controller.getValue(SETTING_KEYS.pickupRefundMethod),
			controller.getValue(SETTING_KEYS.pickupItemIssueReportEnabled),
			controller.getValue(SETTING_KEYS.pickupItemIssueReportWindowHours),
			controller.getValue(SETTING_KEYS.pickupItemIssueReportResolution),
			controller.getValue(SETTING_KEYS.pickupSupportContact),
			controller.getValue(SETTING_KEYS.pickupPolicyCopy),
			controller.getValue(SETTING_KEYS.timezone),
		]);

		const prepTime = parseNumber(prepTimeMinutes);
		const lateRefundEnabled = parseBoolean(
			lateOrderRefundEnabled,
			DEFAULT_PICKUP_LATE_ORDER_REFUND_ENABLED,
		);
		const lateGraceMinutes = parseNumber(lateOrderGraceMinutes);
		const issueReportEnabled = parseBoolean(
			itemIssueReportEnabled,
			DEFAULT_PICKUP_ITEM_ISSUE_REPORT_ENABLED,
		);
		const issueReportWindowHours = parseNumber(itemIssueReportWindowHours);
		const issueReportResolution = parseItemIssueResolution(
			itemIssueReportResolution,
		);

		const missingRequired: string[] = [];
		if (prepTime === null) {
			missingRequired.push("prepTimeMinutes");
		}
		if (timezone === null) {
			missingRequired.push("timezone");
		}
		if (lateRefundEnabled && lateGraceMinutes === null) {
			missingRequired.push("lateOrderGraceMinutes");
		}
		if (issueReportEnabled && issueReportWindowHours === null) {
			missingRequired.push("itemIssueReportWindowHours");
		}
		if (issueReportEnabled && issueReportResolution === null) {
			missingRequired.push("itemIssueReportResolution");
		}

		const settings: PickupSettings = {
			prepTimeMinutes: prepTime,
			cancelLockState: parseCancelLockState(cancelLockState),
			cancelBlockedMessage:
				cancelBlockedMessage ?? DEFAULT_PICKUP_CANCEL_BLOCKED_MESSAGE,
			noShowWindowMinutes:
				parseNumber(noShowWindowMinutes) ??
				DEFAULT_PICKUP_NO_SHOW_WINDOW_MINUTES,
			noShowOutcome: parseNoShowOutcome(noShowOutcome),
			lateOrderRefundEnabled: lateRefundEnabled,
			lateOrderGraceMinutes: lateGraceMinutes,
			partialRefundsEnabled: parseBoolean(
				partialRefundsEnabled,
				DEFAULT_PICKUP_PARTIAL_REFUNDS_ENABLED,
			),
			refundMethod: parseRefundMethod(refundMethod),
			itemIssueReportEnabled: issueReportEnabled,
			itemIssueReportWindowHours: issueReportWindowHours,
			itemIssueReportResolution: issueReportResolution,
			supportContact,
			policyCopy,
			timezone,
			isConfigured: missingRequired.length === 0,
			missingRequired,
		};

		return { settings };
	},
);
