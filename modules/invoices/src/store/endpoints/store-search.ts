import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "@86d-app/core/zod";
import type { InvoiceController } from "../../service";

export const storeSearch = createStoreEndpoint(
	"/invoices/store-search",
	{
		method: "GET",
		query: z.object({
			q: z.string().min(0).max(200).transform(sanitizeText),
		}),
	},
	async (ctx) => {
		const userId = ctx.context.session?.user.id;
		if (!userId) {
			return { error: "Unauthorized", status: 401 };
		}

		const q = ctx.query.q.trim();
		if (q.length === 0) {
			return { results: [], total: 0 };
		}

		const controller = ctx.context.controllers.invoice as InvoiceController;
		const { invoices, total } = await controller.list({
			search: q,
			customerId: userId,
			limit: 10,
		});

		return {
			results: invoices.map((inv) => ({
				id: inv.id,
				title: `Invoice ${inv.invoiceNumber}`,
				type: "invoice" as const,
			})),
			total,
		};
	},
);
