import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createSocialSharingController } from "../service-impl";

function createMockEvents(): ScopedEventEmitter & {
	emitted: Array<{ type: string; payload: unknown }>;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	return {
		emitted,
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn(() => () => {}),
		off: vi.fn(),
	};
}

// ---------------------------------------------------------------------------
// share.created
// ---------------------------------------------------------------------------

describe("share.created event", () => {
	it("emits when a share event is recorded", async () => {
		const events = createMockEvents();
		const ctrl = createSocialSharingController(createMockDataService(), events);

		const share = await ctrl.recordShare({
			targetType: "product",
			targetId: "prod-1",
			network: "twitter",
			url: "https://example.com/1",
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("share.created");
		expect(events.emitted[0].payload).toEqual({
			shareEventId: share.id,
			targetType: "product",
			targetId: "prod-1",
			network: "twitter",
		});
	});

	it("emits for each share individually", async () => {
		const events = createMockEvents();
		const ctrl = createSocialSharingController(createMockDataService(), events);

		await ctrl.recordShare({
			targetType: "product",
			targetId: "prod-1",
			network: "twitter",
			url: "https://example.com/1",
		});
		await ctrl.recordShare({
			targetType: "product",
			targetId: "prod-1",
			network: "facebook",
			url: "https://example.com/1",
		});

		expect(events.emitted).toHaveLength(2);
		expect(events.emitted[0].type).toBe("share.created");
		expect(events.emitted[1].type).toBe("share.created");
	});

	it("includes correct network in payload", async () => {
		const events = createMockEvents();
		const ctrl = createSocialSharingController(createMockDataService(), events);

		await ctrl.recordShare({
			targetType: "collection",
			targetId: "col-1",
			network: "pinterest",
			url: "https://example.com/col",
		});

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.network).toBe("pinterest");
		expect(payload.targetType).toBe("collection");
	});
});

// ---------------------------------------------------------------------------
// share.settings.updated
// ---------------------------------------------------------------------------

describe("share.settings.updated event", () => {
	it("emits when settings are updated", async () => {
		const events = createMockEvents();
		const ctrl = createSocialSharingController(createMockDataService(), events);

		await ctrl.updateSettings({
			enabledNetworks: ["twitter", "facebook"],
		});

		expect(events.emitted).toHaveLength(1);
		expect(events.emitted[0].type).toBe("share.settings.updated");
		expect(events.emitted[0].payload).toEqual({
			enabledNetworks: ["twitter", "facebook"],
		});
	});

	it("emits on each settings update", async () => {
		const events = createMockEvents();
		const ctrl = createSocialSharingController(createMockDataService(), events);

		await ctrl.updateSettings({ enabledNetworks: ["twitter"] });
		await ctrl.updateSettings({ enabledNetworks: ["facebook"] });

		expect(events.emitted).toHaveLength(2);
		expect(events.emitted[0].type).toBe("share.settings.updated");
		expect(events.emitted[1].type).toBe("share.settings.updated");
	});

	it("includes updated networks in payload", async () => {
		const events = createMockEvents();
		const ctrl = createSocialSharingController(createMockDataService(), events);

		await ctrl.updateSettings({
			enabledNetworks: ["whatsapp", "email", "copy-link"],
		});

		const payload = events.emitted[0].payload as Record<string, unknown>;
		expect(payload.enabledNetworks).toEqual(["whatsapp", "email", "copy-link"]);
	});
});

// ---------------------------------------------------------------------------
// No events without emitter
// ---------------------------------------------------------------------------

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createSocialSharingController(createMockDataService());

		const share = await ctrl.recordShare({
			targetType: "product",
			targetId: "prod-1",
			network: "twitter",
			url: "https://example.com/1",
		});
		await ctrl.updateSettings({ enabledNetworks: ["twitter"] });

		expect(share.id).toBeTruthy();
	});
});

// ---------------------------------------------------------------------------
// Full lifecycle event sequence
// ---------------------------------------------------------------------------

describe("full lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createSocialSharingController(createMockDataService(), events);

		await ctrl.recordShare({
			targetType: "product",
			targetId: "prod-1",
			network: "twitter",
			url: "https://example.com/1",
		});
		await ctrl.recordShare({
			targetType: "product",
			targetId: "prod-1",
			network: "facebook",
			url: "https://example.com/1",
		});
		await ctrl.updateSettings({ enabledNetworks: ["twitter"] });

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"share.created",
			"share.created",
			"share.settings.updated",
		]);
	});
});
