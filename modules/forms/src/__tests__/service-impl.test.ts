import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import type { FormField } from "../service";
import { createFormsControllers } from "../service-impl";

describe("createFormsControllers", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createFormsControllers>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createFormsControllers(mockData);
	});

	const sampleFields: FormField[] = [
		{
			name: "name",
			label: "Full Name",
			type: "text",
			required: true,
			placeholder: "John Doe",
			position: 0,
		},
		{
			name: "email",
			label: "Email",
			type: "email",
			required: true,
			placeholder: "john@example.com",
			position: 1,
		},
		{
			name: "message",
			label: "Message",
			type: "textarea",
			required: true,
			min: 10,
			max: 1000,
			position: 2,
		},
	];

	// --- Form CRUD ---

	describe("createForm", () => {
		it("creates a form with required fields", async () => {
			const form = await controller.createForm({
				name: "Contact Us",
				slug: "contact-us",
			});

			expect(form.name).toBe("Contact Us");
			expect(form.slug).toBe("contact-us");
			expect(form.isActive).toBe(true);
			expect(form.fields).toEqual([]);
			expect(form.submitLabel).toBe("Submit");
			expect(form.successMessage).toBe("Thank you for your submission.");
			expect(form.honeypotEnabled).toBe(true);
			expect(form.maxSubmissions).toBe(0);
			expect(form.id).toBeTruthy();
			expect(form.createdAt).toBeInstanceOf(Date);
			expect(form.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a form with all optional fields", async () => {
			const form = await controller.createForm({
				name: "Feedback",
				slug: "feedback",
				description: "Share your feedback",
				fields: sampleFields,
				submitLabel: "Send Feedback",
				successMessage: "Thanks for your feedback!",
				notifyEmail: "admin@example.com",
				honeypotEnabled: false,
				maxSubmissions: 100,
			});

			expect(form.description).toBe("Share your feedback");
			expect(form.fields).toHaveLength(3);
			expect(form.submitLabel).toBe("Send Feedback");
			expect(form.successMessage).toBe("Thanks for your feedback!");
			expect(form.notifyEmail).toBe("admin@example.com");
			expect(form.honeypotEnabled).toBe(false);
			expect(form.maxSubmissions).toBe(100);
		});

		it("assigns unique IDs to each form", async () => {
			const a = await controller.createForm({
				name: "A",
				slug: "a",
			});
			const b = await controller.createForm({
				name: "B",
				slug: "b",
			});

			expect(a.id).not.toBe(b.id);
		});
	});

	describe("getForm", () => {
		it("returns a form by ID", async () => {
			const created = await controller.createForm({
				name: "Contact",
				slug: "contact",
			});

			const found = await controller.getForm(created.id);
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Contact");
		});

		it("returns null for non-existent ID", async () => {
			const found = await controller.getForm("does-not-exist");
			expect(found).toBeNull();
		});
	});

	describe("getFormBySlug", () => {
		it("returns a form by slug", async () => {
			await controller.createForm({
				name: "Survey",
				slug: "customer-survey",
			});

			const found = await controller.getFormBySlug("customer-survey");
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Survey");
		});

		it("returns null for non-existent slug", async () => {
			const found = await controller.getFormBySlug("nope");
			expect(found).toBeNull();
		});
	});

	describe("listForms", () => {
		it("returns all forms", async () => {
			await controller.createForm({ name: "A", slug: "a" });
			await controller.createForm({ name: "B", slug: "b" });

			const forms = await controller.listForms();
			expect(forms).toHaveLength(2);
		});

		it("filters active-only forms", async () => {
			const form = await controller.createForm({ name: "A", slug: "a" });
			await controller.createForm({ name: "B", slug: "b" });
			await controller.updateForm(form.id, { isActive: false });

			const active = await controller.listForms({ activeOnly: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("B");
		});

		it("sorts by creation date", async () => {
			await controller.createForm({ name: "First", slug: "first" });
			await controller.createForm({ name: "Second", slug: "second" });

			const forms = await controller.listForms();
			expect(forms[0].name).toBe("First");
			expect(forms[1].name).toBe("Second");
		});
	});

	describe("updateForm", () => {
		it("updates form name", async () => {
			const form = await controller.createForm({
				name: "Old Name",
				slug: "old",
			});

			const updated = await controller.updateForm(form.id, {
				name: "New Name",
			});

			expect(updated.name).toBe("New Name");
			expect(updated.slug).toBe("old");
		});

		it("updates form fields", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});

			const updated = await controller.updateForm(form.id, {
				fields: sampleFields,
			});

			expect(updated.fields).toHaveLength(3);
			expect(updated.fields[0].name).toBe("name");
		});

		it("updates isActive", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});

			const updated = await controller.updateForm(form.id, {
				isActive: false,
			});

			expect(updated.isActive).toBe(false);
		});

		it("updates multiple fields at once", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});

			const updated = await controller.updateForm(form.id, {
				name: "Updated",
				submitLabel: "Go",
				successMessage: "Done!",
				honeypotEnabled: false,
				maxSubmissions: 50,
			});

			expect(updated.name).toBe("Updated");
			expect(updated.submitLabel).toBe("Go");
			expect(updated.successMessage).toBe("Done!");
			expect(updated.honeypotEnabled).toBe(false);
			expect(updated.maxSubmissions).toBe(50);
		});

		it("updates updatedAt timestamp", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});

			const updated = await controller.updateForm(form.id, {
				name: "Changed",
			});

			expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(
				form.updatedAt.getTime(),
			);
		});

		it("throws for non-existent form", async () => {
			await expect(
				controller.updateForm("nonexistent", { name: "X" }),
			).rejects.toThrow("Form nonexistent not found");
		});
	});

	describe("deleteForm", () => {
		it("deletes a form", async () => {
			const form = await controller.createForm({
				name: "Delete Me",
				slug: "delete-me",
			});

			await controller.deleteForm(form.id);

			const found = await controller.getForm(form.id);
			expect(found).toBeNull();
		});

		it("deletes associated submissions", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: sampleFields,
			});

			await controller.submitForm({
				formId: form.id,
				values: { name: "John", email: "j@x.com", message: "Hello World!" },
			});

			await controller.deleteForm(form.id);

			const submissions = await controller.listSubmissions({
				formId: form.id,
			});
			expect(submissions).toHaveLength(0);
		});
	});

	// --- Submissions ---

	describe("submitForm", () => {
		it("creates a submission with valid values", async () => {
			const form = await controller.createForm({
				name: "Contact",
				slug: "contact",
				fields: sampleFields,
			});

			const sub = await controller.submitForm({
				formId: form.id,
				values: {
					name: "Jane Doe",
					email: "jane@example.com",
					message: "Hello, this is my message to you.",
				},
			});

			expect(sub.id).toBeTruthy();
			expect(sub.formId).toBe(form.id);
			expect(sub.values.name).toBe("Jane Doe");
			expect(sub.status).toBe("unread");
			expect(sub.createdAt).toBeInstanceOf(Date);
		});

		it("records IP address", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});

			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
				ipAddress: "192.168.1.1",
			});

			expect(sub.ipAddress).toBe("192.168.1.1");
		});

		it("throws for non-existent form", async () => {
			await expect(
				controller.submitForm({
					formId: "nonexistent",
					values: {},
				}),
			).rejects.toThrow("Form nonexistent not found");
		});

		it("throws for inactive form", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});
			await controller.updateForm(form.id, { isActive: false });

			await expect(
				controller.submitForm({
					formId: form.id,
					values: {},
				}),
			).rejects.toThrow("not currently accepting submissions");
		});

		it("enforces maxSubmissions limit", async () => {
			const form = await controller.createForm({
				name: "Limited",
				slug: "limited",
				maxSubmissions: 2,
			});

			await controller.submitForm({ formId: form.id, values: {} });
			await controller.submitForm({ formId: form.id, values: {} });

			await expect(
				controller.submitForm({ formId: form.id, values: {} }),
			).rejects.toThrow("maximum number of submissions");
		});

		it("allows unlimited submissions when maxSubmissions is 0", async () => {
			const form = await controller.createForm({
				name: "Unlimited",
				slug: "unlimited",
				maxSubmissions: 0,
			});

			for (let i = 0; i < 5; i++) {
				await controller.submitForm({ formId: form.id, values: {} });
			}

			const subs = await controller.listSubmissions({ formId: form.id });
			expect(subs).toHaveLength(5);
		});
	});

	// --- Validation ---

	describe("submission validation", () => {
		it("rejects missing required fields", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
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

			await expect(
				controller.submitForm({
					formId: form.id,
					values: {},
				}),
			).rejects.toThrow("Name is required");
		});

		it("accepts empty optional fields", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "note",
						label: "Note",
						type: "text",
						required: false,
						position: 0,
					},
				],
			});

			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			expect(sub.id).toBeTruthy();
		});

		it("validates email format", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
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
			).rejects.toThrow("Email must be a valid email address");
		});

		it("accepts valid email", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
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

			const sub = await controller.submitForm({
				formId: form.id,
				values: { email: "test@example.com" },
			});

			expect(sub.values.email).toBe("test@example.com");
		});

		it("validates URL format", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
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
			).rejects.toThrow("Website must be a valid URL");
		});

		it("validates number type", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "qty",
						label: "Quantity",
						type: "number",
						required: true,
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { qty: "abc" },
				}),
			).rejects.toThrow("Quantity must be a number");
		});

		it("validates number min/max", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "qty",
						label: "Quantity",
						type: "number",
						required: true,
						min: 1,
						max: 100,
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { qty: 0 },
				}),
			).rejects.toThrow("Quantity must be at least 1");

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { qty: 101 },
				}),
			).rejects.toThrow("Quantity must be at most 100");
		});

		it("validates text min/max length", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "bio",
						label: "Bio",
						type: "textarea",
						required: true,
						min: 10,
						max: 50,
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { bio: "short" },
				}),
			).rejects.toThrow("Bio must be at least 10 characters");

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { bio: "x".repeat(51) },
				}),
			).rejects.toThrow("Bio must be at most 50 characters");
		});

		it("validates pattern", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "zip",
						label: "ZIP Code",
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
					values: { zip: "abc" },
				}),
			).rejects.toThrow("ZIP Code format is invalid");

			const sub = await controller.submitForm({
				formId: form.id,
				values: { zip: "12345" },
			});
			expect(sub.values.zip).toBe("12345");
		});

		it("validates select/radio options", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "color",
						label: "Color",
						type: "select",
						required: true,
						options: ["red", "green", "blue"],
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { color: "purple" },
				}),
			).rejects.toThrow("Color must be one of: red, green, blue");

			const sub = await controller.submitForm({
				formId: form.id,
				values: { color: "red" },
			});
			expect(sub.values.color).toBe("red");
		});

		it("reports multiple validation errors", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "name",
						label: "Name",
						type: "text",
						required: true,
						position: 0,
					},
					{
						name: "email",
						label: "Email",
						type: "email",
						required: true,
						position: 1,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: {},
				}),
			).rejects.toThrow("Name is required; Email is required");
		});
	});

	describe("additional field type validation", () => {
		it("accepts phone field with any string value", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "phone",
						label: "Phone",
						type: "phone",
						required: true,
						position: 0,
					},
				],
			});

			const sub = await controller.submitForm({
				formId: form.id,
				values: { phone: "+1-555-123-4567" },
			});
			expect(sub.values.phone).toBe("+1-555-123-4567");
		});

		it("accepts date field with valid date string", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "date",
						label: "Preferred Date",
						type: "date",
						required: true,
						position: 0,
					},
				],
			});

			const sub = await controller.submitForm({
				formId: form.id,
				values: { date: "2026-03-15" },
			});
			expect(sub.values.date).toBe("2026-03-15");
		});

		it("accepts checkbox field with boolean-like value", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "agree",
						label: "I agree",
						type: "checkbox",
						required: true,
						position: 0,
					},
				],
			});

			const sub = await controller.submitForm({
				formId: form.id,
				values: { agree: "true" },
			});
			expect(sub.values.agree).toBe("true");
		});

		it("accepts hidden field with preset value", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "source",
						label: "Source",
						type: "hidden",
						required: true,
						position: 0,
					},
				],
			});

			const sub = await controller.submitForm({
				formId: form.id,
				values: { source: "homepage" },
			});
			expect(sub.values.source).toBe("homepage");
		});

		it("validates radio options like select", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
				fields: [
					{
						name: "size",
						label: "Size",
						type: "radio",
						required: true,
						options: ["S", "M", "L"],
						position: 0,
					},
				],
			});

			await expect(
				controller.submitForm({
					formId: form.id,
					values: { size: "XL" },
				}),
			).rejects.toThrow("Size must be one of: S, M, L");

			const sub = await controller.submitForm({
				formId: form.id,
				values: { size: "M" },
			});
			expect(sub.values.size).toBe("M");
		});

		it("handles all field types in a single form", async () => {
			const allFields: FormField[] = [
				{
					name: "name",
					label: "Name",
					type: "text",
					required: false,
					position: 0,
				},
				{
					name: "email",
					label: "Email",
					type: "email",
					required: false,
					position: 1,
				},
				{
					name: "message",
					label: "Message",
					type: "textarea",
					required: false,
					position: 2,
				},
				{
					name: "qty",
					label: "Qty",
					type: "number",
					required: false,
					position: 3,
				},
				{
					name: "phone",
					label: "Phone",
					type: "phone",
					required: false,
					position: 4,
				},
				{
					name: "color",
					label: "Color",
					type: "select",
					required: false,
					options: ["red", "blue"],
					position: 5,
				},
				{
					name: "size",
					label: "Size",
					type: "radio",
					required: false,
					options: ["S", "M"],
					position: 6,
				},
				{
					name: "agree",
					label: "Agree",
					type: "checkbox",
					required: false,
					position: 7,
				},
				{
					name: "date",
					label: "Date",
					type: "date",
					required: false,
					position: 8,
				},
				{
					name: "site",
					label: "Site",
					type: "url",
					required: false,
					position: 9,
				},
				{
					name: "ref",
					label: "Ref",
					type: "hidden",
					required: false,
					position: 10,
				},
			];

			const form = await controller.createForm({
				name: "All Types",
				slug: "all-types",
				fields: allFields,
			});

			const sub = await controller.submitForm({
				formId: form.id,
				values: {
					name: "Jane",
					email: "jane@test.com",
					message: "Hello",
					qty: 5,
					phone: "555-1234",
					color: "red",
					size: "S",
					agree: "true",
					date: "2026-01-01",
					site: "https://example.com",
					ref: "abc123",
				},
			});

			expect(sub.id).toBeTruthy();
			expect(Object.keys(sub.values)).toHaveLength(11);
		});
	});

	// --- Submission management ---

	describe("getSubmission", () => {
		it("returns a submission by ID", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});
			const sub = await controller.submitForm({
				formId: form.id,
				values: { hello: "world" },
			});

			const found = await controller.getSubmission(sub.id);
			expect(found).not.toBeNull();
			expect(found?.values.hello).toBe("world");
		});

		it("returns null for non-existent submission", async () => {
			const found = await controller.getSubmission("nope");
			expect(found).toBeNull();
		});
	});

	describe("listSubmissions", () => {
		it("lists submissions for a form", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});

			await controller.submitForm({ formId: form.id, values: { a: 1 } });
			await controller.submitForm({ formId: form.id, values: { b: 2 } });

			const subs = await controller.listSubmissions({ formId: form.id });
			expect(subs).toHaveLength(2);
		});

		it("filters by status", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});

			const sub1 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			await controller.submitForm({ formId: form.id, values: {} });

			await controller.updateSubmissionStatus(sub1.id, "read");

			const unread = await controller.listSubmissions({
				formId: form.id,
				status: "unread",
			});
			expect(unread).toHaveLength(1);

			const read = await controller.listSubmissions({
				formId: form.id,
				status: "read",
			});
			expect(read).toHaveLength(1);
		});

		it("supports limit and offset", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});

			for (let i = 0; i < 5; i++) {
				await controller.submitForm({
					formId: form.id,
					values: { i },
				});
			}

			const page1 = await controller.listSubmissions({
				formId: form.id,
				limit: 2,
				offset: 0,
			});
			expect(page1).toHaveLength(2);

			const page2 = await controller.listSubmissions({
				formId: form.id,
				limit: 2,
				offset: 2,
			});
			expect(page2).toHaveLength(2);

			const page3 = await controller.listSubmissions({
				formId: form.id,
				limit: 2,
				offset: 4,
			});
			expect(page3).toHaveLength(1);
		});

		it("sorts by createdAt descending (newest first)", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});

			const s1 = await controller.submitForm({
				formId: form.id,
				values: { order: "first" },
			});
			const s2 = await controller.submitForm({
				formId: form.id,
				values: { order: "second" },
			});

			// Ensure different timestamps for deterministic sort
			(s2 as { createdAt: Date }).createdAt = new Date(
				s1.createdAt.getTime() + 1000,
			);
			await mockData.upsert(
				"formSubmission",
				s2.id,
				s2 as unknown as Record<string, unknown>,
			);

			const subs = await controller.listSubmissions({ formId: form.id });
			expect(subs[0].values.order).toBe("second");
			expect(subs[1].values.order).toBe("first");
		});
	});

	describe("updateSubmissionStatus", () => {
		it("changes submission status", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});
			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			expect(sub.status).toBe("unread");

			const updated = await controller.updateSubmissionStatus(sub.id, "read");
			expect(updated.status).toBe("read");
		});

		it("can mark as spam", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});
			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			const updated = await controller.updateSubmissionStatus(sub.id, "spam");
			expect(updated.status).toBe("spam");
		});

		it("can archive", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});
			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			const updated = await controller.updateSubmissionStatus(
				sub.id,
				"archived",
			);
			expect(updated.status).toBe("archived");
		});

		it("throws for non-existent submission", async () => {
			await expect(
				controller.updateSubmissionStatus("nope", "read"),
			).rejects.toThrow("Submission nope not found");
		});
	});

	describe("deleteSubmission", () => {
		it("deletes a submission", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});
			const sub = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			await controller.deleteSubmission(sub.id);

			const found = await controller.getSubmission(sub.id);
			expect(found).toBeNull();
		});
	});

	describe("bulkDeleteSubmissions", () => {
		it("deletes multiple submissions", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});
			const s1 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			const s2 = await controller.submitForm({
				formId: form.id,
				values: {},
			});
			const s3 = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			const deleted = await controller.bulkDeleteSubmissions([s1.id, s2.id]);
			expect(deleted).toBe(2);

			const remaining = await controller.listSubmissions({
				formId: form.id,
			});
			expect(remaining).toHaveLength(1);
			expect(remaining[0].id).toBe(s3.id);
		});

		it("skips non-existent IDs gracefully", async () => {
			const form = await controller.createForm({
				name: "Form",
				slug: "form",
			});
			const s1 = await controller.submitForm({
				formId: form.id,
				values: {},
			});

			const deleted = await controller.bulkDeleteSubmissions([s1.id, "nope"]);
			expect(deleted).toBe(1);
		});

		it("returns 0 when none found", async () => {
			const deleted = await controller.bulkDeleteSubmissions(["a", "b", "c"]);
			expect(deleted).toBe(0);
		});
	});

	// --- Stats ---

	describe("getStats", () => {
		it("returns overall stats", async () => {
			const f1 = await controller.createForm({
				name: "Form 1",
				slug: "form-1",
			});
			const f2 = await controller.createForm({
				name: "Form 2",
				slug: "form-2",
			});

			await controller.submitForm({ formId: f1.id, values: {} });
			await controller.submitForm({ formId: f1.id, values: {} });
			const s3 = await controller.submitForm({
				formId: f2.id,
				values: {},
			});
			await controller.updateSubmissionStatus(s3.id, "spam");

			const stats = await controller.getStats();
			expect(stats.totalForms).toBe(2);
			expect(stats.totalSubmissions).toBe(3);
			expect(stats.unreadCount).toBe(2);
			expect(stats.spamCount).toBe(1);
		});

		it("returns stats filtered by form ID", async () => {
			const f1 = await controller.createForm({
				name: "Form 1",
				slug: "form-1",
			});
			const f2 = await controller.createForm({
				name: "Form 2",
				slug: "form-2",
			});

			await controller.submitForm({ formId: f1.id, values: {} });
			await controller.submitForm({ formId: f1.id, values: {} });
			await controller.submitForm({ formId: f2.id, values: {} });

			const stats = await controller.getStats(f1.id);
			expect(stats.totalSubmissions).toBe(2);
		});

		it("returns zeros when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalForms).toBe(0);
			expect(stats.totalSubmissions).toBe(0);
			expect(stats.unreadCount).toBe(0);
			expect(stats.spamCount).toBe(0);
		});
	});
});
