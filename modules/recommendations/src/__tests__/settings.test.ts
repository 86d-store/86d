import { describe, expect, it } from "vitest";

/**
 * Tests for the recommendations settings logic.
 *
 * Verifies correct AI provider configuration status reporting,
 * API key masking, and module factory wiring.
 */

interface SettingsOptions {
	openaiApiKey?: string;
	openrouterApiKey?: string;
	embeddingModel?: string;
}

function maskKey(key: string): string {
	if (key.length <= 8) return `${key.slice(0, 2)}••••••`;
	return `${key.slice(0, 4)}${"•".repeat(Math.min(key.length - 4, 20))}`;
}

/** Mirrors the logic inside getSettings endpoint without the HTTP wrapper. */
function getSettings(options: SettingsOptions) {
	const aiConfigured = Boolean(
		options.openaiApiKey || options.openrouterApiKey,
	);

	return {
		ai: {
			configured: aiConfigured,
			provider: options.openaiApiKey
				? "openai"
				: options.openrouterApiKey
					? "openrouter"
					: null,
			model: options.embeddingModel ?? "text-embedding-3-small",
			apiKey: options.openaiApiKey
				? maskKey(options.openaiApiKey)
				: options.openrouterApiKey
					? maskKey(options.openrouterApiKey)
					: null,
		},
	};
}

describe("recommendations — settings", () => {
	describe("AI provider detection", () => {
		it("reports OpenAI as configured when openaiApiKey is set", () => {
			const result = getSettings({ openaiApiKey: "sk-test-1234567890" });
			expect(result.ai.configured).toBe(true);
			expect(result.ai.provider).toBe("openai");
		});

		it("reports OpenRouter as configured when openrouterApiKey is set", () => {
			const result = getSettings({ openrouterApiKey: "sk-or-test-123" });
			expect(result.ai.configured).toBe(true);
			expect(result.ai.provider).toBe("openrouter");
		});

		it("prefers OpenAI when both keys are provided", () => {
			const result = getSettings({
				openaiApiKey: "sk-openai-key",
				openrouterApiKey: "sk-or-key",
			});
			expect(result.ai.provider).toBe("openai");
		});

		it("reports not configured when no keys are provided", () => {
			const result = getSettings({});
			expect(result.ai.configured).toBe(false);
			expect(result.ai.provider).toBeNull();
			expect(result.ai.apiKey).toBeNull();
		});

		it("reports not configured for empty string keys", () => {
			const result = getSettings({
				openaiApiKey: "",
				openrouterApiKey: "",
			});
			expect(result.ai.configured).toBe(false);
		});
	});

	describe("API key masking", () => {
		it("masks long keys showing first 4 characters", () => {
			const result = getSettings({ openaiApiKey: "sk-test-1234567890" });
			expect(result.ai.apiKey).toBe(`sk-t${"•".repeat(14)}`);
			expect(result.ai.apiKey).not.toContain("1234567890");
		});

		it("masks short keys showing first 2 characters", () => {
			const result = getSettings({ openaiApiKey: "sk-abc" });
			expect(result.ai.apiKey).toBe("sk••••••");
		});

		it("does not expose raw key in output", () => {
			const key = "sk-proj-very-secret-key-here-12345";
			const result = getSettings({ openaiApiKey: key });
			expect(result.ai.apiKey).not.toBe(key);
			expect(result.ai.apiKey).not.toContain("secret");
		});
	});

	describe("model defaults", () => {
		it("defaults to text-embedding-3-small when no model specified", () => {
			const result = getSettings({ openaiApiKey: "sk-test-key-123" });
			expect(result.ai.model).toBe("text-embedding-3-small");
		});

		it("uses custom model when specified", () => {
			const result = getSettings({
				openaiApiKey: "sk-test-key-123",
				embeddingModel: "text-embedding-ada-002",
			});
			expect(result.ai.model).toBe("text-embedding-ada-002");
		});

		it("defaults model even when not configured", () => {
			const result = getSettings({});
			expect(result.ai.model).toBe("text-embedding-3-small");
		});
	});
});

describe("recommendations — module factory wiring", () => {
	it("settings endpoint is always registered", async () => {
		const { default: recommendations } = await import("../index");
		const mod = recommendations({});
		expect(mod.endpoints?.admin).toHaveProperty(
			"/admin/recommendations/settings",
		);
	});

	it("settings page is registered in admin pages", async () => {
		const { default: recommendations } = await import("../index");
		const mod = recommendations({});
		const paths = mod.admin?.pages?.map((p) => p.path) ?? [];
		expect(paths).toContain("/admin/recommendations/settings");
	});

	it("main recommendations page is always registered", async () => {
		const { default: recommendations } = await import("../index");
		const mod = recommendations({});
		const paths = mod.admin?.pages?.map((p) => p.path) ?? [];
		expect(paths).toContain("/admin/recommendations");
	});

	it("creates embedding provider when openaiApiKey is set", async () => {
		const { default: recommendations } = await import("../index");
		const mod = recommendations({ openaiApiKey: "sk-test-1234567890" });
		expect(mod.init).toBeDefined();
	});

	it("creates embedding provider when openrouterApiKey is set", async () => {
		const { default: recommendations } = await import("../index");
		const mod = recommendations({
			openrouterApiKey: "sk-or-test-1234567890",
		});
		expect(mod.init).toBeDefined();
	});
});
