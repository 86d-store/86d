import { acceptCapability } from "@86d-app/core/capabilities";
import {
	abandonedCartRecoveryResolveCapability,
	customerContactResolveCapability,
} from "@86d-app/core/commerce-capabilities";
import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { createGetSettingsEndpoint } from "./admin/endpoints/get-settings";
import { createAdminEndpointsWithSettings } from "./admin/endpoints/routes";
import { notificationCreateProvider } from "./capabilities";
import { buildAffiliateStatusEmail } from "./emails/affiliate-status";
import { buildAppointmentStatusEmail } from "./emails/appointment-status";
import { buildAuctionWonEmail } from "./emails/auction-won";
import { buildBackInStockEmail } from "./emails/back-in-stock";
import { buildCartRecoveryEmail } from "./emails/cart-recovery";
import { buildQuoteStatusEmail } from "./emails/quote-status";
import { buildReviewApprovedEmail } from "./emails/review-approved";
import { buildSubscriptionStatusEmail } from "./emails/subscription-status";
import { buildWarrantyRegisteredEmail } from "./emails/warranty-registered";
import {
	createNotificationIntentStore,
	notificationIntentInputSchema,
} from "./intents";
import { ResendProvider, TwilioProvider } from "./provider";
import { notificationsSchema, notificationsTables } from "./schema";
import { createNotificationsController } from "./service-impl";
import { createStoreEndpoints } from "./store/endpoints/routes";

export type {
	NotificationIntent,
	NotificationIntentEnqueueResult,
	NotificationIntentInput,
} from "./intents";
export type {
	BatchSendResult,
	DeliveryStatus,
	Notification,
	NotificationChannel,
	NotificationPreference,
	NotificationPriority,
	NotificationStats,
	NotificationsController,
	NotificationTemplate,
	NotificationType,
} from "./service";
export { createNotificationIntentStore, notificationIntentInputSchema };

export interface NotificationsOptions extends ModuleConfig {
	/** Max notifications per customer before auto-cleanup (default: "500") */
	maxPerCustomer?: string;
	/** Resend API key for email delivery */
	resendApiKey?: string | undefined;
	/** Sender email address for Resend (e.g. "Store Name <noreply@store.com>") */
	resendFromAddress?: string | undefined;
	/** Resend webhook signing secret — enables delivery status tracking via inbound webhooks */
	resendWebhookSecret?: string | undefined;
	/** Twilio Account SID */
	twilioAccountSid?: string | undefined;
	/** Twilio Auth Token */
	twilioAuthToken?: string | undefined;
	/** Twilio phone number in E.164 format (e.g. "+15551234567") */
	twilioFromNumber?: string | undefined;
	/** Full public URL of the Twilio StatusCallback endpoint (e.g. "https://store.com/notifications/webhook/twilio") */
	twilioStatusCallbackUrl?: string | undefined;
}

export default function notifications(options?: NotificationsOptions): Module {
	const emailProvider =
		options?.resendApiKey && options?.resendFromAddress
			? new ResendProvider(options.resendApiKey, options.resendFromAddress)
			: undefined;

	const smsProvider =
		options?.twilioAccountSid &&
		options?.twilioAuthToken &&
		options?.twilioFromNumber
			? new TwilioProvider(
					options.twilioAccountSid,
					options.twilioAuthToken,
					options.twilioFromNumber,
				)
			: undefined;

	const settingsEndpoint = createGetSettingsEndpoint({
		resendApiKey: options?.resendApiKey,
		resendFromAddress: options?.resendFromAddress,
		resendWebhookSecret: options?.resendWebhookSecret,
		twilioAccountSid: options?.twilioAccountSid,
		twilioAuthToken: options?.twilioAuthToken,
		twilioFromNumber: options?.twilioFromNumber,
		twilioStatusCallbackUrl: options?.twilioStatusCallbackUrl,
	});

	return {
		id: "notifications",
		version: "0.1.0",
		schema: notificationsSchema,
		tables: notificationsTables,
		capabilities: {
			provides: [notificationCreateProvider],
			accepts: [
				acceptCapability(customerContactResolveCapability, { optional: true }),
				acceptCapability(abandonedCartRecoveryResolveCapability, {
					optional: true,
				}),
			],
		},
		exports: {
			read: ["unreadCount", "notificationType"],
		},
		events: {
			emits: [
				"notifications.created",
				"notifications.read",
				"notifications.all_read",
			],
		},
		init: async (ctx: ModuleContext) => {
			const maxStr = options?.maxPerCustomer;
			const maxPerCustomer = maxStr ? Number.parseInt(maxStr, 10) : undefined;

			// Wire customerResolver from the customers module so email/SMS
			// delivery can look up contact info for in-app notifications,
			// template-based batch sends, and SMS delivery.
			const customerResolver = async (customerId: string) => {
				const resolved = await ctx.capabilities.invoke(
					customerContactResolveCapability,
					{ customerId },
				);
				if (!resolved.ok) return {};
				return {
					email: resolved.decision.email,
					phone: resolved.decision.phone,
				};
			};

			const controller = createNotificationsController(ctx.data, ctx.events, {
				...(maxPerCustomer && !Number.isNaN(maxPerCustomer)
					? { maxPerCustomer }
					: {}),
				emailProvider,
				smsProvider,
				customerResolver,
				twilioStatusCallbackUrl: options?.twilioStatusCallbackUrl,
			});

			interface CartRecoveryPayload {
				cartId: string;
				channel: string;
				recipient: string;
				attemptId: string;
			}

			ctx.events?.on<CartRecoveryPayload>(
				"cart.recoveryAttempted",
				async (event) => {
					const p = event.payload;
					if (p?.channel !== "email" || !emailProvider) return;

					const cartResult = await ctx.capabilities.invoke(
						abandonedCartRecoveryResolveCapability,
						{ cartId: p.cartId },
					);
					if (!cartResult.ok) return;
					const cart = cartResult.decision;

					const recoveryUrl = `/abandoned-carts/recover/${cart.recoveryToken}`;
					const { subject, html, text } = buildCartRecoveryEmail({
						items: cart.items,
						cartTotal: cart.cartTotal,
						currency: cart.currency,
						recoveryUrl,
					});

					await emailProvider
						.sendEmail({
							to: p.recipient,
							subject,
							html,
							text,
							tags: [
								{ name: "type", value: "cart_recovery" },
								{ name: "cart_id", value: p.cartId },
								{ name: "attempt_id", value: p.attemptId },
							],
						})
						.catch(() => {});
				},
			);

			// ── Warranty registration notifications ──────────────────────────
			interface WarrantyRegisteredPayload {
				registrationId: string;
				customerId: string;
				productId: string;
				warrantyPlanId: string;
				productName?: string | undefined;
				serialNumber?: string | undefined;
				expiresAt?: Date | undefined;
			}

			ctx.events?.on<WarrantyRegisteredPayload>(
				"warranty.registered",
				async (event) => {
					const p = event.payload;
					if (!p || !emailProvider || !customerResolver) return;

					const contact = await customerResolver(p.customerId).catch(
						() => null,
					);
					if (!contact?.email) return;

					const { subject, html, text } = buildWarrantyRegisteredEmail({
						productName: p.productName ?? p.productId,
						serialNumber: p.serialNumber,
						expiresAt: p.expiresAt,
					});
					await emailProvider
						.sendEmail({
							to: contact.email,
							subject,
							html,
							text,
							tags: [
								{ name: "type", value: "warranty_registered" },
								{ name: "registration_id", value: p.registrationId },
							],
						})
						.catch(() => {});
				},
			);

			// ── Review approved notifications ───────────────────────────────
			interface ReviewApprovedPayload {
				reviewId: string;
				productId: string;
				customerId?: string | undefined;
				authorEmail?: string | undefined;
				rating: number;
			}

			ctx.events?.on<ReviewApprovedPayload>(
				"review.approved",
				async (event) => {
					const p = event.payload;
					if (!p || !emailProvider) return;

					// Try to get email from the event payload first, then from customerResolver
					let email = p.authorEmail;
					if (!email && p.customerId && customerResolver) {
						const contact = await customerResolver(p.customerId).catch(
							() => null,
						);
						email = contact?.email;
					}
					if (!email) return;

					const { subject, html, text } = buildReviewApprovedEmail({
						rating: p.rating,
					});
					await emailProvider
						.sendEmail({
							to: email,
							subject,
							html,
							text,
							tags: [
								{ name: "type", value: "review_approved" },
								{ name: "review_id", value: p.reviewId },
							],
						})
						.catch(() => {});
				},
			);

			// ── Auction won notifications ────────────────────────────────────
			interface AuctionSoldPayload {
				auctionId: string;
				title: string;
				winnerId?: string | undefined;
				salePrice: number;
			}

			ctx.events?.on<AuctionSoldPayload>("auction.sold", async (event) => {
				const p = event.payload;
				if (!p || !emailProvider || !p.winnerId || !customerResolver) return;

				const winnerContact = await customerResolver(p.winnerId).catch(
					() => null,
				);
				if (!winnerContact?.email) return;

				const { subject, html, text } = buildAuctionWonEmail({
					auctionTitle: p.title,
					winningBid: p.salePrice,
				});
				await emailProvider
					.sendEmail({
						to: winnerContact.email,
						subject,
						html,
						text,
						tags: [
							{ name: "type", value: "auction_won" },
							{ name: "auction_id", value: p.auctionId },
						],
					})
					.catch(() => {});
			});

			// ── Back-in-stock notifications ─────────────────────────────────
			interface BackInStockPayload {
				productId: string;
				variantId?: string | undefined;
				available: number;
				subscribers: Array<{
					email: string;
					productName: string;
				}>;
			}

			ctx.events?.on<BackInStockPayload>(
				"inventory.back-in-stock",
				async (event) => {
					const p = event.payload;
					if (!p || !emailProvider || !p.subscribers.length) return;

					for (const sub of p.subscribers) {
						const { subject, html, text } = buildBackInStockEmail({
							productName: sub.productName,
						});
						await emailProvider
							.sendEmail({
								to: sub.email,
								subject,
								html,
								text,
								tags: [
									{ name: "type", value: "back_in_stock" },
									{ name: "product_id", value: p.productId },
								],
							})
							.catch(() => {});
					}
				},
			);

			// ── Subscription notifications ───────────────────────────────────
			interface SubscriptionEventPayload {
				subscriptionId: string;
				planId: string;
				customerId: string;
				email?: string | undefined;
				planName?: string | undefined;
				price?: number | undefined;
				currency?: string | undefined;
			}

			const subscriptionStatuses = ["created", "cancelled", "renewed"] as const;

			for (const status of subscriptionStatuses) {
				ctx.events?.on<SubscriptionEventPayload>(
					`subscription.${status}`,
					async (event) => {
						const p = event.payload;
						if (!p || !emailProvider || !p.email) return;

						const { subject, html, text } = buildSubscriptionStatusEmail({
							status,
							customerEmail: p.email,
							planName: p.planName ?? p.planId,
							price: p.price,
							currency: p.currency,
						});
						await emailProvider
							.sendEmail({
								to: p.email,
								subject,
								html,
								text,
								tags: [
									{ name: "type", value: `subscription_${status}` },
									{ name: "subscription_id", value: p.subscriptionId },
								],
							})
							.catch(() => {});
					},
				);
			}

			// ── Appointment notifications ────────────────────────────────────
			interface AppointmentEventPayload {
				appointmentId: string;
				serviceId: string;
				customerId?: string | undefined;
				customerEmail?: string | undefined;
				customerName?: string | undefined;
				startsAt?: Date | undefined;
			}

			const appointmentStatuses = [
				"created",
				"confirmed",
				"cancelled",
			] as const;

			for (const status of appointmentStatuses) {
				ctx.events?.on<AppointmentEventPayload>(
					`appointment.${status}`,
					async (event) => {
						const p = event.payload;
						if (!p || !emailProvider || !p.customerEmail) return;

						const { subject, html, text } = buildAppointmentStatusEmail({
							status,
							customerName: p.customerName ?? "",
							serviceName: p.serviceId,
							startsAt: p.startsAt ?? new Date(),
						});
						await emailProvider
							.sendEmail({
								to: p.customerEmail,
								subject,
								html,
								text,
								tags: [
									{ name: "type", value: `appointment_${status}` },
									{ name: "appointment_id", value: p.appointmentId },
								],
							})
							.catch(() => {});
					},
				);
			}

			// ── Membership notifications ─────────────────────────────────────
			interface MembershipEventPayload {
				membershipId: string;
				customerId: string;
				planId?: string | undefined;
			}

			const membershipMessages: Record<
				string,
				{ title: string; body: string }
			> = {
				subscribed: {
					title: "Membership activated",
					body: "Your membership is now active. Enjoy your benefits!",
				},
				cancelled: {
					title: "Membership cancelled",
					body: "Your membership has been cancelled.",
				},
				paused: {
					title: "Membership paused",
					body: "Your membership has been paused.",
				},
				resumed: {
					title: "Membership resumed",
					body: "Your membership has been resumed.",
				},
			};

			for (const status of Object.keys(membershipMessages)) {
				ctx.events?.on<MembershipEventPayload>(
					`membership.${status}`,
					async (event) => {
						const p = event.payload;
						if (!p?.customerId) return;
						const msg = membershipMessages[status];
						await controller
							.create({
								customerId: p.customerId,
								type: "info",
								channel: "in_app",
								priority: "normal",
								title: msg.title,
								body: msg.body,
								actionUrl: "/account/memberships",
								metadata: {
									membershipId: p.membershipId,
									planId: p.planId,
								},
							})
							.catch(() => {});
					},
				);
			}

			// ── Affiliate notifications ──────────────────────────────────────
			interface AffiliateEventPayload {
				affiliateId: string;
				email?: string | undefined;
				name?: string | undefined;
				customerId?: string | undefined;
			}

			const affiliateStatuses = [
				"application_submitted",
				"approved",
				"rejected",
			] as const;

			for (const status of affiliateStatuses) {
				ctx.events?.on<AffiliateEventPayload>(
					`affiliates.${status}`,
					async (event) => {
						const p = event.payload;
						if (!p || !emailProvider || !p.email) return;

						const emailStatus =
							status === "application_submitted" ? "submitted" : status;
						const { subject, html, text } = buildAffiliateStatusEmail({
							status: emailStatus,
							name: p.name ?? "there",
						});
						await emailProvider
							.sendEmail({
								to: p.email,
								subject,
								html,
								text,
								tags: [
									{ name: "type", value: `affiliate_${status}` },
									{ name: "affiliate_id", value: p.affiliateId },
								],
							})
							.catch(() => {});
					},
				);
			}

			// ── Quote notifications ──────────────────────────────────────────
			interface QuoteEventPayload {
				quoteId: string;
				customerId?: string | undefined;
				total?: number | undefined;
				currency?: string | undefined;
				reason?: string | undefined;
				status?: string | undefined;
			}

			const quoteStatuses = [
				"submitted",
				"reviewed",
				"accepted",
				"rejected",
				"converted",
			] as const;

			for (const status of quoteStatuses) {
				ctx.events?.on<QuoteEventPayload>(`quote.${status}`, async (event) => {
					const p = event.payload;
					if (!p || !emailProvider || !p.customerId || !customerResolver)
						return;

					const contact = await customerResolver(p.customerId).catch(
						() => null,
					);
					if (!contact?.email) return;

					const { subject, html, text } = buildQuoteStatusEmail({
						status,
						quoteId: p.quoteId,
						total: p.total,
						currency: p.currency,
						reason: p.reason,
					});
					await emailProvider
						.sendEmail({
							to: contact.email,
							subject,
							html,
							text,
							tags: [
								{ name: "type", value: `quote_${status}` },
								{ name: "quote_id", value: p.quoteId },
							],
						})
						.catch(() => {});
				});
			}

			// ── Loyalty points in-app notifications ──────────────────────────
			interface LoyaltyPointsPayload {
				customerId: string;
				points: number;
				balance?: number | undefined;
				orderId?: string | undefined;
				description?: string | undefined;
			}

			ctx.events?.on<LoyaltyPointsPayload>(
				"loyalty.pointsEarned",
				async (event) => {
					const p = event.payload;
					if (!p?.customerId || p.points <= 0) return;
					await controller
						.create({
							customerId: p.customerId,
							type: "promotion",
							channel: "in_app",
							priority: "low",
							title: `${p.points} points earned`,
							body:
								p.balance !== undefined
									? `You now have ${p.balance} points. ${p.description ?? ""}`
									: (p.description ?? "Points added to your account."),
							actionUrl: "/account/loyalty",
							metadata: {
								points: p.points,
								balance: p.balance,
								orderId: p.orderId,
							},
						})
						.catch(() => {});
				},
			);

			ctx.events?.on<LoyaltyPointsPayload>(
				"loyalty.pointsRedeemed",
				async (event) => {
					const p = event.payload;
					if (!p?.customerId) return;
					await controller
						.create({
							customerId: p.customerId,
							type: "promotion",
							channel: "in_app",
							priority: "low",
							title: `${p.points} points redeemed`,
							body: "Points applied to your order.",
							actionUrl: p.orderId
								? `/orders/${p.orderId}`
								: "/account/loyalty",
							metadata: { points: p.points, orderId: p.orderId },
						})
						.catch(() => {});
				},
			);

			// ── Store credits in-app notifications ────────────────────────────
			interface StoreCreditsPayload {
				customerId: string;
				amount?: number | undefined;
				currency?: string | undefined;
				balance?: number | undefined;
				reason?: string | undefined;
			}

			ctx.events?.on<StoreCreditsPayload>(
				"store-credits.credited",
				async (event) => {
					const p = event.payload;
					if (!p?.customerId || !p.amount) return;
					const amtStr = p.currency
						? `${(p.amount / 100).toFixed(2)} ${p.currency.toUpperCase()}`
						: `${(p.amount / 100).toFixed(2)}`;
					await controller
						.create({
							customerId: p.customerId,
							type: "promotion",
							channel: "in_app",
							priority: "normal",
							title: `${amtStr} store credit added`,
							body: p.reason ?? "Store credit has been added to your account.",
							actionUrl: "/account",
							metadata: {
								amount: p.amount,
								currency: p.currency,
								balance: p.balance,
							},
						})
						.catch(() => {});
				},
			);

			ctx.events?.on<StoreCreditsPayload>(
				"store-credits.account.frozen",
				async (event) => {
					const p = event.payload;
					if (!p?.customerId) return;
					await controller
						.create({
							customerId: p.customerId,
							type: "warning",
							channel: "in_app",
							priority: "high",
							title: "Store credit account suspended",
							body: "Your store credit account has been suspended. Contact support for assistance.",
							actionUrl: "/account",
							metadata: {},
						})
						.catch(() => {});
				},
			);

			return { controllers: { notifications: controller } };
		},
		endpoints: {
			store: createStoreEndpoints({
				resendWebhookSecret: options?.resendWebhookSecret,
				twilioAuthToken: options?.twilioAuthToken,
				twilioWebhookUrl: options?.twilioStatusCallbackUrl,
			}),
			admin: createAdminEndpointsWithSettings(settingsEndpoint),
		},
		admin: {
			pages: [
				{
					path: "/admin/notifications",
					component: "NotificationList",
					label: "Notifications",
					icon: "Bell",
					group: "Support",
				},
				{
					path: "/admin/notifications/compose",
					component: "NotificationComposer",
					label: "Compose",
					icon: "PaperPlaneTilt",
					group: "Support",
				},
				{
					path: "/admin/notifications/templates",
					component: "NotificationTemplateList",
					label: "Templates",
					icon: "FileText",
					group: "Support",
				},
				{
					path: "/admin/notifications/settings",
					component: "NotificationSettings",
					label: "Settings",
					icon: "Gear",
					group: "Support",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/notifications",
					component: "NotificationInbox",
				},
				{
					path: "/notifications/preferences",
					component: "NotificationPreferences",
				},
			],
		},
		options,
	};
}
