import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createFormsControllers } from "../service-impl";

/**
 * Security regression tests for forms endpoints.
 *
 * Forms have public store endpoints (submit) and admin CRUD.
 * Security focuses on:
 * - Inactive forms reject submissions
 * - Max submission limits are enforced
 * - Field validation prevents invalid data
 * - Cascade deletion removes all submissions
 * - Required field enforcement
 * - Pattern and option validation
 */

describe("forms endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFormsControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFormsControllers(mockData);
	});

	describe("inactive form protection", () => {
		it("inactive forms reject submissions", async () => {
			const form = await controller.createForm({
				name: "Contact",
				slug: "contact",
				fields: [
					{
						name: "message",
						label: "Message",
						type: "textarea",
						required: true,
						position: 0,
					},
				],
			});

			await controller.updateForm(form.id, { isActive: false });

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { message: "Hello" },
				}),
			).rejects.toThrow("not currently accepting submissions");
		});

		it("active forms accept submissions", async () => {
			const form = await controller.createForm({
				name: "Contact",
				slug: "contact",
				fields: [
					{
						name: "message",
						label: "Message",
						type: "textarea",
						required: true,
						position: 0,
					},
				],
			});

			const submission = await controller.submitForm({
				formId: form.id,
				values: { message: "Hello" },
			});
			expect(submission.status).toBe("unread");
		});
	});

	describe("max submissions enforcement", () => {
		it("rejects submission when maxSubmissions limit reached", async () => {
			const form = await controller.createForm({
				name: "Limited",
				slug: "limited",
				maxSubmissions: 2,
				fields: [
					{
						name: "name",
						label: "Name",
						type: "text",
						required: true,
						position: 0,
					},
				],
			});

			await controller.submitForm({
				formId: form.id,
				values: { name: "Alice" },
			});
			await controller.submitForm({
				formId: form.id,
				values: { name: "Bob" },
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { name: "Charlie" },
				}),
			).rejects.toThrow("maximum number of submissions");
		});

		it("zero maxSubmissions means unlimited", async () => {
			const form = await controller.createForm({
				name: "Unlimited",
				slug: "unlimited",
				maxSubmissions: 0,
				fields: [
					{
						name: "name",
						label: "Name",
						type: "text",
						required: false,
						position: 0,
					},
				],
			});

			// Should not throw
			await controller.submitForm({
				formId: form.id,
				values: { name: "Test" },
			});
			await controller.submitForm({
				formId: form.id,
				values: { name: "Test2" },
			});
		});
	});

	describe("field validation", () => {
		it("rejects missing required fields", async () => {
			const form = await controller.createForm({
				name: "Required Test",
				slug: "required-test",
				fields: [
					{
						name: "email",
						label: "Email",
						type: "email",
						required: true,
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: {},
				}),
			).rejects.toThrow("Email is required");
		});

		it("rejects invalid email format", async () => {
			const form = await controller.createForm({
				name: "Email Test",
				slug: "email-test",
				fields: [
					{
						name: "email",
						label: "Email",
						type: "email",
						required: true,
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { email: "not-an-email" },
				}),
			).rejects.toThrow("valid email");
		});

		it("rejects invalid URL format", async () => {
			const form = await controller.createForm({
				name: "URL Test",
				slug: "url-test",
				fields: [
					{
						name: "website",
						label: "Website",
						type: "url",
						required: true,
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { website: "not-a-url" },
				}),
			).rejects.toThrow("valid URL");
		});

		it("enforces number min/max constraints", async () => {
			const form = await controller.createForm({
				name: "Number Test",
				slug: "number-test",
				fields: [
					{
						name: "age",
						label: "Age",
						type: "number",
						required: true,
						min: 1,
						max: 120,
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { age: 0 },
				}),
			).rejects.toThrow("at least 1");

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { age: 200 },
				}),
			).rejects.toThrow("at most 120");
		});

		it("enforces select/radio options", async () => {
			const form = await controller.createForm({
				name: "Select Test",
				slug: "select-test",
				fields: [
					{
						name: "color",
						label: "Color",
						type: "select",
						required: true,
						options: ["red", "blue", "green"],
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { color: "purple" },
				}),
			).rejects.toThrow("must be one of");
		});

		it("enforces pattern validation", async () => {
			const form = await controller.createForm({
				name: "Pattern Test",
				slug: "pattern-test",
				fields: [
					{
						name: "zipcode",
						label: "Zip Code",
						type: "text",
						required: true,
						pattern: "^\\d{5}$",
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { zipcode: "abc" },
				}),
			).rejects.toThrow("format is invalid");

			// Valid pattern passes
			const result = await controller.submitForm({
				formId: form.id,
				values: { zipcode: "12345" },
			});
			expect(result.id).toBeDefined();
		});
	});

	describe("cascade deletion", () => {
		it("deleteForm removes all submissions", async () => {
			const form = await controller.createForm({
				name: "Doomed",
				slug: "doomed",
				fields: [],
			});

			await controller.submitForm({
				formId: form.id,
				values: {},
			});
			await controller.submitForm({
				formId: form.id,
				values: {},
			});

			await controller.deleteForm(form.id);

			const submissions = await controller.listSubmissions({
				formId: form.id,
			});
			expect(submissions).toHaveLength(0);
		});
	});

	describe("submission to non-existent form", () => {
		it("rejects submission to non-existent form", async () => {
			await expect(
				controller.submitForm({
					formId: "nonexistent",
					values: { name: "Test" },
				}),
			).rejects.toThrow("not found");
		});
	});

	describe("bulk deletion safety", () => {
		it("bulkDeleteSubmissions only deletes existing records", async () => {
			const form = await controller.createForm({
				name: "Bulk Test",
				slug: "bulk-test",
				fields: [],
			});

			const sub1 = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			const deleted = await controller.bulkDeleteSubmissions([
				sub1.id,
				"nonexistent",
			]);
			expect(deleted).toBe(1);
		});
	});
});
