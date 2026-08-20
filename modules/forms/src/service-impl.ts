import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Form,
	FormField,
	FormSubmission,
	FormsController,
} from "./service";

function validateSubmission(
	fields: FormField[],
	values: Record<string, unknown>,
): string[] {
	const errors: string[] = [];

	for (const field of fields) {
		const value = values[field.name];

		if (
			field.required &&
			(value === undefined || value === null || value === "")
		) {
			errors.push(`${field.label} is required`);
			continue;
		}

		if (value === undefined || value === null || value === "") continue;

		const strValue = String(value);

		if (
			field.type === "email" &&
			!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(strValue)
		) {
			errors.push(`${field.label} must be a valid email address`);
		}

		if (field.type === "url" && !/^https?:\/\/.+/.test(strValue)) {
			errors.push(`${field.label} must be a valid URL`);
		}

		if (field.type === "number") {
			const num = Number(value);
			if (Number.isNaN(num)) {
				errors.push(`${field.label} must be a number`);
			} else {
				if (field.min !== undefined && num < field.min) {
					errors.push(`${field.label} must be at least ${field.min}`);
				}
				if (field.max !== undefined && num > field.max) {
					errors.push(`${field.label} must be at most ${field.max}`);
				}
			}
		}

		if (
			(field.type === "text" || field.type === "textarea") &&
			typeof value === "string"
		) {
			if (field.min !== undefined && value.length < field.min) {
				errors.push(`${field.label} must be at least ${field.min} characters`);
			}
			if (field.max !== undefined && value.length > field.max) {
				errors.push(`${field.label} must be at most ${field.max} characters`);
			}
		}

		if (field.pattern) {
			const regex = new RegExp(field.pattern);
			if (!regex.test(strValue)) {
				errors.push(`${field.label} format is invalid`);
			}
		}

		if (
			(field.type === "select" || field.type === "radio") &&
			field.options &&
			field.options.length > 0 &&
			!field.options.includes(strValue)
		) {
			errors.push(`${field.label} must be one of: ${field.options.join(", ")}`);
		}
	}

	return errors;
}

export function createFormsControllers(
	data: ModuleDataService,
): FormsController {
	return {
		async createForm(params) {
			const id = crypto.randomUUID();
			const now = new Date();

			const form: Form = {
				id,
				name: params.name,
				slug: params.slug,
				description: params.description ?? undefined,
				fields: params.fields ?? [],
				submitLabel: params.submitLabel ?? "Submit",
				successMessage:
					params.successMessage ?? "Thank you for your submission.",
				isActive: true,
				notifyEmail: params.notifyEmail ?? undefined,
				honeypotEnabled: params.honeypotEnabled ?? true,
				maxSubmissions: params.maxSubmissions ?? 0,
				metadata: {},
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert("form", id, form as Record<string, unknown>);

			return form;
		},

		async getForm(id: string) {
			return (await data.get("form", id)) as Form | null;
		},

		async getFormBySlug(slug: string) {
			const forms = (await data.findMany("form", {
				where: { slug },
			})) as Form[];

			return forms[0] ?? null;
		},

		async listForms(opts = {}) {
			const { activeOnly = false } = opts;

			const where: Record<string, unknown> = {};
			if (activeOnly) where.isActive = true;

			const forms = (await data.findMany("form", { where })) as Form[];

			return forms.sort(
				(a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
			);
		},

		async updateForm(id, updateData) {
			const existing = (await data.get("form", id)) as Form | null;
			if (!existing) {
				throw new Error(`Form ${id} not found`);
			}

			const updated: Form = {
				...existing,
				...(updateData.name !== undefined && { name: updateData.name }),
				...(updateData.slug !== undefined && { slug: updateData.slug }),
				...(updateData.description !== undefined && {
					description: updateData.description,
				}),
				...(updateData.fields !== undefined && { fields: updateData.fields }),
				...(updateData.submitLabel !== undefined && {
					submitLabel: updateData.submitLabel,
				}),
				...(updateData.successMessage !== undefined && {
					successMessage: updateData.successMessage,
				}),
				...(updateData.isActive !== undefined && {
					isActive: updateData.isActive,
				}),
				...(updateData.notifyEmail !== undefined && {
					notifyEmail: updateData.notifyEmail,
				}),
				...(updateData.honeypotEnabled !== undefined && {
					honeypotEnabled: updateData.honeypotEnabled,
				}),
				...(updateData.maxSubmissions !== undefined && {
					maxSubmissions: updateData.maxSubmissions,
				}),
				updatedAt: new Date(),
			};

			await data.upsert("form", id, updated as Record<string, unknown>);

			return updated;
		},

		async deleteForm(id: string) {
			const submissions = (await data.findMany("formSubmission", {
				where: { formId: id },
			})) as FormSubmission[];

			for (const sub of submissions) {
				await data.delete("formSubmission", sub.id);
			}

			await data.delete("form", id);
		},

		async submitForm(params) {
			const form = (await data.get("form", params.formId)) as Form | null;
			if (!form) {
				throw new Error(`Form ${params.formId} not found`);
			}

			if (!form.isActive) {
				throw new Error("This form is not currently accepting submissions");
			}

			// Check max submissions limit
			if (form.maxSubmissions > 0) {
				const existing = (await data.findMany("formSubmission", {
					where: { formId: params.formId },
				})) as FormSubmission[];

				if (existing.length >= form.maxSubmissions) {
					throw new Error(
						"This form has reached its maximum number of submissions",
					);
				}
			}

			// Validate submitted values against field definitions
			const errors = validateSubmission(form.fields, params.values);
			if (errors.length > 0) {
				throw new Error(`Validation failed: ${errors.join("; ")}`);
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const submission: FormSubmission = {
				id,
				formId: params.formId,
				values: params.values,
				ipAddress: params.ipAddress ?? undefined,
				status: "unread",
				metadata: {},
				createdAt: now,
			};

			await data.upsert(
				"formSubmission",
				id,
				submission as Record<string, unknown>,
			);

			return submission;
		},

		async getSubmission(id: string) {
			return (await data.get("formSubmission", id)) as FormSubmission | null;
		},

		async listSubmissions(opts = {}) {
			const { formId, status, limit = 50, offset = 0 } = opts;

			const where: Record<string, unknown> = {};
			if (formId) where.formId = formId;
			if (status) where.status = status;

			const submissions = (await data.findMany("formSubmission", {
				where,
			})) as FormSubmission[];

			return submissions
				.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
				.slice(offset, offset + limit);
		},

		async updateSubmissionStatus(id, status) {
			const existing = (await data.get(
				"formSubmission",
				id,
			)) as FormSubmission | null;
			if (!existing) {
				throw new Error(`Submission ${id} not found`);
			}

			const updated: FormSubmission = {
				...existing,
				status,
			};

			await data.upsert(
				"formSubmission",
				id,
				updated as Record<string, unknown>,
			);

			return updated;
		},

		async deleteSubmission(id: string) {
			await data.delete("formSubmission", id);
		},

		async bulkDeleteSubmissions(ids) {
			let deleted = 0;
			for (const id of ids) {
				const existing = (await data.get(
					"formSubmission",
					id,
				)) as FormSubmission | null;
				if (existing) {
					await data.delete("formSubmission", id);
					deleted++;
				}
			}
			return deleted;
		},

		async getStats(formId) {
			const formsWhere: Record<string, unknown> = {};
			const subsWhere: Record<string, unknown> = {};

			if (formId) {
				formsWhere.id = formId;
				subsWhere.formId = formId;
			}

			const forms = (await data.findMany("form", {
				where: formsWhere,
			})) as Form[];
			const submissions = (await data.findMany("formSubmission", {
				where: subsWhere,
			})) as FormSubmission[];

			return {
				totalForms: forms.length,
				totalSubmissions: submissions.length,
				unreadCount: submissions.filter((s) => s.status === "unread").length,
				spamCount: submissions.filter((s) => s.status === "spam").length,
			};
		},
	};
}
