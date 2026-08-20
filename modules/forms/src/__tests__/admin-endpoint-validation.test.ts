import { describe, expect, it } from "vitest";
import { createForm } from "../admin/endpoints/create-form";
import { updateForm } from "../admin/endpoints/update-form";

describe("forms admin endpoint validation", () => {
	it("sanitizes create-form text fields before controller execution", () => {
		const parsed = createForm.options.body.parse({
			name: "  <b>Contact</b>  ",
			slug: " <script>alert(1)</script>contact-us ",
			description: "<p>Need <strong>help</strong></p>",
			fields: [
				{
					name: " <b>fullName</b> ",
					label: " <i>Full Name</i> ",
					type: "select",
					required: true,
					placeholder: " <span>Your name</span> ",
					defaultValue: "<em>Guest</em>",
					options: [" <b>VIP</b> ", " <script>x</script>Standard "],
					pattern: "^[A-Za-z ]+$",
					position: 0,
				},
			],
			submitLabel: " <strong>Send</strong> ",
			successMessage: " <div>Thanks!</div> ",
			notifyEmail: "admin@example.com",
			maxSubmissions: 25,
		});

		expect(parsed).toMatchObject({
			name: "Contact",
			slug: "contact-us",
			description: "Need help",
			submitLabel: "Send",
			successMessage: "Thanks!",
		});
		expect(parsed.fields?.[0]).toMatchObject({
			name: "fullName",
			label: "Full Name",
			placeholder: "Your name",
			defaultValue: "Guest",
			options: ["VIP", "Standard"],
		});
	});

	it("rejects oversized create-form arrays", () => {
		const oversizedFields = Array.from({ length: 101 }, (_, index) => ({
			name: `field-${index}`,
			label: `Field ${index}`,
			type: "text" as const,
			required: false,
			position: index,
		}));

		expect(() =>
			createForm.options.body.parse({
				name: "Contact",
				slug: "contact",
				fields: oversizedFields,
			}),
		).toThrow(/100/);
	});

	it("sanitizes update-form payloads and bounds route params", () => {
		const params = updateForm.options.params.parse({ id: "form_123" });
		const body = updateForm.options.body.parse({
			name: "<b>Updated Contact</b>",
			slug: " <script>alert(1)</script>updated-contact ",
			description: "<p>Updated <em>details</em></p>",
			fields: [
				{
					name: " message ",
					label: "<strong>Message</strong>",
					type: "textarea",
					required: true,
					placeholder: "<div>Tell us more</div>",
					position: 1,
				},
			],
			submitLabel: "<span>Save</span>",
			successMessage: "<div>Updated!</div>",
			isActive: true,
			notifyEmail: "ops@example.com",
			maxSubmissions: 10,
		});

		expect(params.id).toBe("form_123");
		expect(body).toMatchObject({
			name: "Updated Contact",
			slug: "updated-contact",
			description: "Updated details",
			submitLabel: "Save",
			successMessage: "Updated!",
		});
		expect(body.fields?.[0]).toMatchObject({
			name: "message",
			label: "Message",
			placeholder: "Tell us more",
		});
	});

	it("rejects oversized update-form identifiers and strings", () => {
		expect(() =>
			updateForm.options.params.parse({ id: "x".repeat(201) }),
		).toThrow(/200/);

		expect(() =>
			updateForm.options.body.parse({
				successMessage: "x".repeat(501),
			}),
		).toThrow(/500/);
	});
});
