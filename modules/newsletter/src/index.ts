import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { ResendNewsletterProvider } from "./email-provider";
import { newsletterSchema, newsletterTables } from "./schema";
import { createNewsletterController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Campaign,
	CampaignStats,
	CampaignStatus,
	NewsletterController,
	Subscriber,
	SubscriberStatus,
} from "./service";

export interface NewsletterOptions extends ModuleConfig {
	/** Allow duplicate subscriptions silently (default: true) */
	allowResubscribe?: string; // "true" | "false"
	/** Resend API key — enables real campaign delivery when set */
	resendApiKey?: string | undefined;
	/** Sender email shown to recipients, e.g. "Store <newsletter@store.com>" */
	resendFromAddress?: string | undefined;
}

export default function newsletter(options?: NewsletterOptions): Module {
	return {
		id: "newsletter",
		version: "0.0.1",
		schema: newsletterSchema,
		tables: newsletterTables,
		exports: {
			read: ["subscriberEmail", "subscriberStatus"],
		},
		events: {
			emits: [
				"newsletter.subscribed",
				"newsletter.unsubscribed",
				"newsletter.campaign.sent",
			],
		},
		init: async (ctx: ModuleContext) => {
			const emailProvider =
				options?.resendApiKey && options?.resendFromAddress
					? new ResendNewsletterProvider(
							options.resendApiKey,
							options.resendFromAddress,
						)
					: undefined;
			const controller = createNewsletterController(
				ctx.data,
				ctx.events,
				emailProvider,
			);
			return { controllers: { newsletter: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/newsletter",
					component: "NewsletterAdmin",
					label: "Newsletter",
					icon: "Envelope",
					group: "Marketing",
				},
				{
					path: "/admin/newsletter/campaigns",
					component: "CampaignAdmin",
					label: "Campaigns",
					icon: "PaperPlaneTilt",
					group: "Marketing",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/newsletter/unsubscribe",
					component: "NewsletterUnsubscribe",
				},
			],
		},
		options,
	};
}
