import { acceptCapability } from "@86d-app/core/capabilities";
import { notificationCreateCapability } from "@86d-app/core/commerce-capabilities";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { automationsStorage } from "./schema";
import { createAutomationsController } from "./service-impl";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type {
	ActionType,
	Automation,
	AutomationAction,
	AutomationActionResult,
	AutomationCondition,
	AutomationExecution,
	AutomationListParams,
	AutomationStats,
	AutomationStatus,
	AutomationsController,
	ConditionOperator,
	CreateAutomationParams,
	ExecutionListParams,
	ExecutionStatus,
	UpdateAutomationParams,
} from "./service";

export interface AutomationsOptions extends ModuleConfig {
	/**
	 * Maximum number of execution records to retain per automation.
	 * Older records are purged when this limit is exceeded.
	 * Set to 0 to disable auto-purge.
	 * @default 0
	 */
	maxExecutionHistory?: number;

	/**
	 * Shared secret for the `/automations/webhooks` store endpoint.
	 * When set, incoming webhook requests must include a matching
	 * `x-webhook-secret` header. Leave unset to disable authentication
	 * (not recommended in production).
	 */
	webhookSecret?: string;

	/**
	 * Resend API key for send_email automation actions.
	 * When omitted, send_email actions fail gracefully with a config error.
	 */
	resendApiKey?: string | undefined;

	/**
	 * Default "from" address for send_email actions.
	 * Defaults to "automations@example.com" when not set.
	 */
	resendFrom?: string | undefined;
}

/**
 * Automations module factory function.
 * Creates event-driven workflows that trigger automatically when
 * specific events occur. Supports conditional logic, multiple action
 * types, and execution history tracking.
 *
 * Other modules emit events; automations evaluate active rules against
 * those events, check conditions, and execute configured actions.
 */
export default function automations(options?: AutomationsOptions): Module {
	return {
		id: "automations",
		version: "0.0.1",
		storage: automationsStorage,
		capabilities: {
			accepts: [
				acceptCapability(notificationCreateCapability, { optional: true }),
			],
		},
		exports: {
			read: [
				"automationTriggerEvent",
				"automationStatus",
				"automationRunCount",
			],
		},
		events: {
			emits: [
				"automations.created",
				"automations.updated",
				"automations.deleted",
				"automations.activated",
				"automations.paused",
				"automations.executed",
			],
		},

		init: async (ctx: ModuleContext) => {
			const controller = createAutomationsController(
				ctx.data,
				{
					resendApiKey: options?.resendApiKey,
					resendFrom: options?.resendFrom,
				},
				ctx.capabilities,
			);

			// Subscribe to cross-module events so automations can trigger on them.
			// Each call to evaluateEvent finds all active automations matching the
			// event type and executes them with the event payload as context.
			const CROSS_MODULE_EVENTS = [
				"order.placed",
				"order.shipped",
				"order.fulfilled",
				"order.cancelled",
				"return.requested",
				"return.approved",
				"return.rejected",
				"return.completed",
				"review.submitted",
				"review.approved",
				"review.rejected",
				"review.responded",
				"review.requested",
				"subscription.created",
				"subscription.cancelled",
				"subscription.renewed",
				"membership.subscribed",
				"membership.cancelled",
				"membership.paused",
				"membership.resumed",
				"loyalty.pointsEarned",
				"loyalty.pointsRedeemed",
				"waitlist.subscribed",
				"waitlist.notified",
				"affiliates.application_submitted",
				"affiliates.approved",
				"affiliates.rejected",
				"affiliates.conversion_recorded",
				"newsletter.subscribed",
				"newsletter.campaign.sent",
				"store-credits.credited",
				"store-credits.debited",
				"cart.abandoned",
				"cart.recovered",
				"bid.placed",
				"bid.outbid",
				"auction.ended",
				"auction.sold",
				"auction.buy_now",
				"quote.submitted",
				"quote.reviewed",
				"quote.accepted",
				"quote.rejected",
				"quote.converted",
				"appointment.created",
				"appointment.cancelled",
				"appointment.confirmed",
				"appointment.completed",
				"auction.published",
				"auction.cancelled",
				"store-credits.account.frozen",
				"waitlist.unsubscribed",
				"warranty.registered",
				"claim.submitted",
				"claim.approved",
				"claim.denied",
				"claim.resolved",
				"product.created",
				"product.updated",
				"product.deleted",
				"checkout.completed",
				"inventory.back-in-stock",
				"delivery-slots.booking.created",
				"delivery-slots.booking.cancelled",
				"bundle.created",
				"bundle.updated",
				"affiliates.suspended",
			] as const;

			for (const eventName of CROSS_MODULE_EVENTS) {
				ctx.events?.on(eventName, async (event) => {
					await controller
						.evaluateEvent(eventName, event.payload as Record<string, unknown>)
						.catch(() => {});
				});
			}

			return {
				controllers: { automations: controller },
			};
		},

		endpoints: {
			store: createStoreEndpoints({
				webhookSecret: options?.webhookSecret,
			}),
			admin: adminEndpoints,
		},

		admin: {
			pages: [
				{
					path: "/admin/automations",
					component: "AutomationList",
					label: "Automations",
					icon: "Lightning",
					group: "System",
				},
				{
					path: "/admin/automations/:id",
					component: "AutomationDetail",
				},
			],
		},

		options,
	};
}
