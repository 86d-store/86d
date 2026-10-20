import { createAdminEndpoint } from "@86d-store/core/api";
import { sanitizeText } from "@86d-store/core/sanitize";
import { z } from "zod";
import {
	ITEM_ISSUE_RESOLUTION_VALUES,
	PICKUP_CANCEL_LOCK_VALUES,
	PICKUP_NO_SHOW_OUTCOME_VALUES,
	PICKUP_REFUND_METHOD_VALUES,
	SETTING_KEYS,
	type SettingsController,
} from "../../service";

const updatePickupSettingsSchema = z
	.object({
		prepTimeMinutes: z.number().int().min(1).max(1440).optional(),
		cancelLockState: z.enum(PICKUP_CANCEL_LOCK_VALUES).optional(),
		cancelBlockedMessage: z
			.string()
			.max(500)
			.transform(sanitizeText)
			.optional()
			.nullable(),
		noShowWindowMinutes: z.number().int().min(1).max(1440).optional(),
		noShowOutcome: z.enum(PICKUP_NO_SHOW_OUTCOME_VALUES).optional(),
		lateOrderRefundEnabled: z.boolean().optional(),
		lateOrderGraceMinutes: z.number().int().min(1).max(1440).optional(),
		partialRefundsEnabled: z.boolean().optional(),
		refundMethod: z.enum(PICKUP_REFUND_METHOD_VALUES).optional(),
		itemIssueReportEnabled: z.boolean().optional(),
		itemIssueReportWindowHours: z.number().int().min(1).max(168).optional(),
		itemIssueReportResolution: z.enum(ITEM_ISSUE_RESOLUTION_VALUES).optional(),
		supportContact: z
			.string()
			.max(500)
			.transform(sanitizeText)
			.optional()
			.nullable(),
		policyCopy: z
			.string()
			.max(10000)
			.transform(sanitizeText)
			.optional()
			.nullable(),
	})
	.refine(
		(data) => {
			if (data.lateOrderRefundEnabled === true) {
				return (
					data.lateOrderGraceMinutes !== undefined &&
					data.lateOrderGraceMinutes > 0
				);
			}
			return true;
		},
		{
			message:
				"lateOrderGraceMinutes is required when lateOrderRefundEnabled is true",
			path: ["lateOrderGraceMinutes"],
		},
	)
	.refine(
		(data) => {
			if (data.itemIssueReportEnabled === true) {
				return (
					data.itemIssueReportWindowHours !== undefined &&
					data.itemIssueReportWindowHours > 0
				);
			}
			return true;
		},
		{
			message:
				"itemIssueReportWindowHours is required when itemIssueReportEnabled is true",
			path: ["itemIssueReportWindowHours"],
		},
	)
	.refine(
		(data) => {
			if (data.itemIssueReportEnabled === true) {
				return data.itemIssueReportResolution !== undefined;
			}
			return true;
		},
		{
			message:
				"itemIssueReportResolution is required when itemIssueReportEnabled is true",
			path: ["itemIssueReportResolution"],
		},
	);

export const updatePickupSettingsEndpoint = createAdminEndpoint(
	"/admin/settings/pickup",
	{
		method: "POST",
		body: updatePickupSettingsSchema,
	},
	async (ctx) => {
		const controller = ctx.context.controllers.settings as SettingsController;
		const updates = ctx.body;

		const settingsToUpdate: Array<{
			key: string;
			value: string;
			group: "pickup";
		}> = [];

		if (updates.prepTimeMinutes !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupPrepTimeMinutes,
				value: String(updates.prepTimeMinutes),
				group: "pickup",
			});
		}

		if (updates.cancelLockState !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupCancelLockState,
				value: updates.cancelLockState,
				group: "pickup",
			});
		}

		if (updates.cancelBlockedMessage !== undefined) {
			if (updates.cancelBlockedMessage === null) {
				await controller.delete(SETTING_KEYS.pickupCancelBlockedMessage);
			} else {
				settingsToUpdate.push({
					key: SETTING_KEYS.pickupCancelBlockedMessage,
					value: updates.cancelBlockedMessage,
					group: "pickup",
				});
			}
		}

		if (updates.noShowWindowMinutes !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupNoShowWindowMinutes,
				value: String(updates.noShowWindowMinutes),
				group: "pickup",
			});
		}

		if (updates.noShowOutcome !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupNoShowOutcome,
				value: updates.noShowOutcome,
				group: "pickup",
			});
		}

		if (updates.lateOrderRefundEnabled !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupLateOrderRefundEnabled,
				value: String(updates.lateOrderRefundEnabled),
				group: "pickup",
			});
		}

		if (updates.lateOrderGraceMinutes !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupLateOrderGraceMinutes,
				value: String(updates.lateOrderGraceMinutes),
				group: "pickup",
			});
		}

		if (updates.partialRefundsEnabled !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupPartialRefundsEnabled,
				value: String(updates.partialRefundsEnabled),
				group: "pickup",
			});
		}

		if (updates.refundMethod !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupRefundMethod,
				value: updates.refundMethod,
				group: "pickup",
			});
		}

		if (updates.itemIssueReportEnabled !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupItemIssueReportEnabled,
				value: String(updates.itemIssueReportEnabled),
				group: "pickup",
			});
		}

		if (updates.itemIssueReportWindowHours !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupItemIssueReportWindowHours,
				value: String(updates.itemIssueReportWindowHours),
				group: "pickup",
			});
		}

		if (updates.itemIssueReportResolution !== undefined) {
			settingsToUpdate.push({
				key: SETTING_KEYS.pickupItemIssueReportResolution,
				value: updates.itemIssueReportResolution,
				group: "pickup",
			});
		}

		if (updates.supportContact !== undefined) {
			if (updates.supportContact === null) {
				await controller.delete(SETTING_KEYS.pickupSupportContact);
			} else {
				settingsToUpdate.push({
					key: SETTING_KEYS.pickupSupportContact,
					value: updates.supportContact,
					group: "pickup",
				});
			}
		}

		if (updates.policyCopy !== undefined) {
			if (updates.policyCopy === null) {
				await controller.delete(SETTING_KEYS.pickupPolicyCopy);
			} else {
				settingsToUpdate.push({
					key: SETTING_KEYS.pickupPolicyCopy,
					value: updates.policyCopy,
					group: "pickup",
				});
			}
		}

		if (settingsToUpdate.length > 0) {
			await controller.setBulk(settingsToUpdate);
		}

		return { success: true, updated: settingsToUpdate.length };
	},
);
