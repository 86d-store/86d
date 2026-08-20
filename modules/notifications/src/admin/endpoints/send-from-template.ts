import { createAdminEndpoint } from "@86d-app/core/api";
import { z } from "@86d-app/core/zod";
import { notificationDeliveryDurabilityRequired } from "./delivery-containment";

const templateSchema = z.object({
	id: z.string(),
	slug: z.string(),
	type: z.enum([
		"info",
		"success",
		"warning",
		"error",
		"order",
		"shipping",
		"promotion",
	]),
	channel: z.enum(["in_app", "email", "both"]),
	priority: z.enum(["low", "normal", "high", "urgent"]),
	titleTemplate: z.string(),
	bodyTemplate: z.string(),
	actionUrlTemplate: z.string().optional(),
	active: z.boolean(),
});

function interpolate(
	template: string,
	variables: Record<string, string>,
): string {
	return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
		key in variables ? variables[key] : `{{${key}}}`,
	);
}

function templateUnavailable(customerIds: string[], error: string) {
	return {
		sent: 0,
		failed: customerIds.length,
		errors: customerIds.map((customerId) => ({ customerId, error })),
	};
}

function emptyBatchResult() {
	const errors: Array<{ customerId: string; error: string }> = [];
	return { sent: 0, failed: 0, errors };
}

export const sendFromTemplateEndpoint = createAdminEndpoint(
	"/admin/notifications/templates/send",
	{
		method: "POST",
		body: z.object({
			templateId: z.string(),
			customerIds: z.array(z.string()).min(1).max(500),
			variables: z
				.record(z.string().max(50), z.string().max(1000))
				.refine((r) => Object.keys(r).length <= 20, "Too many variables")
				.optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers.notifications;
		const storedTemplate = await controller.getTemplate(ctx.body.templateId);
		if (storedTemplate === null) {
			return templateUnavailable(ctx.body.customerIds, "Template not found");
		}

		const parsedTemplate = templateSchema.safeParse(storedTemplate);
		if (!parsedTemplate.success) {
			return {
				code: "NOTIFICATION_TEMPLATE_STATE_UNAVAILABLE",
				error: "The notification template could not be validated.",
				status: 503,
			};
		}

		const template = parsedTemplate.data;
		if (template.channel !== "in_app") {
			return notificationDeliveryDurabilityRequired();
		}
		if (!template.active) {
			return templateUnavailable(ctx.body.customerIds, "Template is inactive");
		}

		const variables = ctx.body.variables ?? {};
		const title = interpolate(template.titleTemplate, variables);
		const body = interpolate(template.bodyTemplate, variables);
		const actionUrl = template.actionUrlTemplate
			? interpolate(template.actionUrlTemplate, variables)
			: undefined;
		const result = emptyBatchResult();

		for (const customerId of ctx.body.customerIds) {
			try {
				await controller.create({
					customerId,
					type: template.type,
					channel: "in_app",
					priority: template.priority,
					title,
					body,
					actionUrl,
					metadata: {
						templateId: template.id,
						templateSlug: template.slug,
					},
				});
				result.sent += 1;
			} catch (error) {
				result.failed += 1;
				result.errors.push({
					customerId,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return result;
	},
);
