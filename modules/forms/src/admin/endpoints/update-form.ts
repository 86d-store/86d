import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { FormsController } from "../../service";

const sanitizedString = (max: number) =>
	z.string().min(1).max(max).transform(sanitizeText);

const optionalSanitizedString = (max: number) =>
	z.string().max(max).transform(sanitizeText).optional();

const fieldSchema = z.object({
	name: sanitizedString(100),
	label: sanitizedString(200),
	type: z.enum([
		"text",
		"email",
		"textarea",
		"number",
		"phone",
		"select",
		"radio",
		"checkbox",
		"date",
		"url",
		"hidden",
	]),
	required: z.boolean(),
	placeholder: optionalSanitizedString(500),
	defaultValue: optionalSanitizedString(1000),
	options: z
		.array(z.string().max(200).transform(sanitizeText))
		.max(100)
		.optional(),
	pattern: z.string().max(500).optional(),
	min: z.number().optional(),
	max: z.number().optional(),
	position: z.number().int().min(0).max(1000),
});

export const updateForm = createAdminEndpoint(
	"/admin/forms/:id/update",
	{
		method: "POST",
		params: z.object({
			id: z.string().min(1).max(200),
		}),
		body: z.object({
			name: sanitizedString(200).optional(),
			slug: sanitizedString(200).optional(),
			description: optionalSanitizedString(1000),
			fields: z.array(fieldSchema).max(100).optional(),
			submitLabel: optionalSanitizedString(100),
			successMessage: optionalSanitizedString(500),
			isActive: z.boolean().optional(),
			notifyEmail: z.string().email().max(320).optional(),
			honeypotEnabled: z.boolean().optional(),
			maxSubmissions: z.number().int().min(0).max(100000).optional(),
		}),
	},
	async (ctx) => {
		const formsController = ctx.context.controllers.forms as FormsController;
		const form = await formsController.updateForm(ctx.params.id, ctx.body);

		return { form };
	},
);
