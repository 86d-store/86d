import { createAdminEndpoint } from "@86d-app/core/api";
import { sanitizeText } from "@86d-app/core/sanitize";
import { z } from "zod";
import type { AutomationsController } from "../../service";

const conditionSchema = z.object({
	field: z.string().min(1),
	operator: z.enum([
		"equals",
		"not_equals",
		"contains",
		"not_contains",
		"greater_than",
		"less_than",
		"exists",
		"not_exists",
	]),
	value: z.union([z.string(), z.number(), z.boolean()]).optional(),
});

const actionSchema = z.object({
	type: z.enum([
		"send_notification",
		"send_email",
		"update_field",
		"create_record",
		"webhook",
		"log",
	]),
	config: z
		.record(z.string().max(100), z.unknown())
		.refine((r) => Object.keys(r).length <= 100, "Too many keys"),
});

export const createAutomation = createAdminEndpoint(
	"/admin/automations/create",
	{
		method: "POST",
		body: z.object({
			name: z.string().min(1).max(200).transform(sanitizeText),
			description: z.string().max(2000).optional(),
			triggerEvent: z.string().min(1).max(200),
			conditions: z.array(conditionSchema).optional(),
			actions: z.array(actionSchema).min(1),
			priority: z.number().int().min(0).max(1000).optional(),
			status: z.enum(["active", "paused", "draft"]).optional(),
		}),
	},
	async (ctx) => {
		const controller = ctx.context.controllers
			.automations as AutomationsController;
		const automation = await controller.create(ctx.body);
		return { automation, status: 201 };
	},
);
