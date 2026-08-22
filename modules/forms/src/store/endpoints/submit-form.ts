import { createStoreEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { FormsController } from "../../service";

export const submitForm = createStoreEndpoint(
	"/forms/:slug/submit",
	{
		method: "POST",
		params: z.object({
			slug: z.string().max(200),
		}),
		body: z.object({
			values: z
				.record(z.string().max(100), z.unknown())
				.refine((obj) => Object.keys(obj).length <= 100, {
					message: "Form must have at most 100 fields",
				}),
			/** Honeypot field — if filled, the submission is silently discarded */
			_hp: z.string().max(1000).optional(),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		const form = await formsController.getFormBySlug(ctx.params.slug);

		if (!form?.isActive) {
			return { error: "Form not found", status: 404 };
		}

		// Honeypot check: if _hp is filled, silently accept but don't store
		if (form.honeypotEnabled && ctx.body._hp) {
			return {
				success: true,
				message: form.successMessage,
			};
		}

		// Sanitize string values to prevent XSS
		const sanitizedValues: Record<string, unknown> = {};
		for (const [key, value] of Object.entries(ctx.body.values)) {
			sanitizedValues[sanitizeText(key)] =
				typeof value === "string" ? sanitizeText(value) : value;
		}

		const submission = await formsController.submitForm({
			formId: form.id,
			values: sanitizedValues,
		});

		return {
			success: true,
			message: form.successMessage,
			submissionId: submission.id,
		};
	},
);
