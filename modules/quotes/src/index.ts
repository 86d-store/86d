import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { quoteSchema } from "./schema";
import { createQuoteController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	AuthorType,
	Quote,
	QuoteComment,
	QuoteController,
	QuoteHistory,
	QuoteItem,
	QuoteStats,
	QuoteStatus,
} from "./service";

export interface QuotesOptions extends ModuleConfig {
	defaultExpirationDays?: number | undefined;
}

export default function quotes(options?: QuotesOptions): Module {
	const defaultExpirationDays = options?.defaultExpirationDays ?? 30;

	return {
		id: "quotes",
		version: "0.0.1",
		schema: quoteSchema,
		exports: {
			read: ["quote", "quoteItem"],
		},
		events: {
			emits: [
				"quote.created",
				"quote.submitted",
				"quote.reviewed",
				"quote.countered",
				"quote.accepted",
				"quote.rejected",
				"quote.expired",
				"quote.converted",
				"quote.comment.added",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createQuoteController(ctx.data, {
				defaultExpirationDays,
			});
			return { controllers: { quotes: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/quotes",
					component: "QuoteList",
					label: "Quotes",
					icon: "FileText",
					group: "Sales",
				},
				{
					path: "/admin/quotes/:id",
					component: "QuoteDetail",
					label: "Quote Detail",
					icon: "FileText",
					group: "Sales",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/quotes",
					component: "MyQuotes",
				},
				{
					path: "/quotes/request",
					component: "QuoteRequest",
				},
				{
					path: "/quotes/:id",
					component: "QuoteDetail",
				},
			],
		},
		options,
	};
}
