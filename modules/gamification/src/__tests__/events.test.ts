import type { ScopedEventEmitter } from "@86d-app/core/events";
import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it, vi } from "vitest";
import { createGamificationController } from "../service-impl";

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
// game.created
// ---------------------------------------------------------------------------

describe("game.created event", () => {
	it("emits when a game is created", async () => {
		const events = createMockEvents();
		const ctrl = createGamificationController(createMockDataService(), events);

		const game = await ctrl.createGame({ name: "Test Game" });

		const created = events.emitted.filter((e) => e.type === "game.created");
		expect(created).toHaveLength(1);
		expect(created[0].payload).toEqual({
			gameId: game.id,
			name: "Test Game",
		});
	});
});

// ---------------------------------------------------------------------------
// game.updated
// ---------------------------------------------------------------------------

describe("game.updated event", () => {
	it("emits when a game is updated", async () => {
		const events = createMockEvents();
		const ctrl = createGamificationController(createMockDataService(), events);

		const game = await ctrl.createGame({ name: "Original" });
		events.emitted.length = 0;

		await ctrl.updateGame(game.id, { name: "Updated" });

		const updated = events.emitted.filter((e) => e.type === "game.updated");
		expect(updated).toHaveLength(1);
		expect(updated[0].payload).toEqual({
			gameId: game.id,
			name: "Updated",
		});
	});

	it("does not emit when game not found", async () => {
		const events = createMockEvents();
		const ctrl = createGamificationController(createMockDataService(), events);

		await ctrl.updateGame("nonexistent", { name: "X" });

		const updated = events.emitted.filter((e) => e.type === "game.updated");
		expect(updated).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// game.deleted
// ---------------------------------------------------------------------------

describe("game.deleted event", () => {
	it("emits when a game is deleted", async () => {
		const events = createMockEvents();
		const ctrl = createGamificationController(createMockDataService(), events);

		const game = await ctrl.createGame({ name: "Delete Me" });
		events.emitted.length = 0;

		await ctrl.deleteGame(game.id);

		const deleted = events.emitted.filter((e) => e.type === "game.deleted");
		expect(deleted).toHaveLength(1);
		expect(deleted[0].payload).toEqual({ gameId: game.id });
	});

	it("does not emit when game not found", async () => {
		const events = createMockEvents();
		const ctrl = createGamificationController(createMockDataService(), events);

		await ctrl.deleteGame("nonexistent");

		const deleted = events.emitted.filter((e) => e.type === "game.deleted");
		expect(deleted).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// game.played, game.won, game.lost
// ---------------------------------------------------------------------------

describe("game.played event", () => {
	it("emits game.played and game.won on winning play", async () => {
		const events = createMockEvents();
		const ctrl = createGamificationController(createMockDataService(), events);

		const game = await ctrl.createGame({
			name: "Win Game",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Prize",
			value: "10",
			probability: 100,
		});
		events.emitted.length = 0;

		const play = await ctrl.play(game.id, { email: "user@test.com" });

		const played = events.emitted.filter((e) => e.type === "game.played");
		expect(played).toHaveLength(1);
		expect((played[0].payload as Record<string, unknown>).result).toBe("win");

		const won = events.emitted.filter((e) => e.type === "game.won");
		expect(won).toHaveLength(1);
		expect((won[0].payload as Record<string, unknown>).playId).toBe(play.id);

		const lost = events.emitted.filter((e) => e.type === "game.lost");
		expect(lost).toHaveLength(0);
	});

	it("emits game.played and game.lost on losing play", async () => {
		const events = createMockEvents();
		const ctrl = createGamificationController(createMockDataService(), events);

		const game = await ctrl.createGame({
			name: "Lose Game",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		events.emitted.length = 0;

		await ctrl.play(game.id, { email: "user@test.com" });

		const played = events.emitted.filter((e) => e.type === "game.played");
		expect(played).toHaveLength(1);
		expect((played[0].payload as Record<string, unknown>).result).toBe("lose");

		const lost = events.emitted.filter((e) => e.type === "game.lost");
		expect(lost).toHaveLength(1);

		const won = events.emitted.filter((e) => e.type === "game.won");
		expect(won).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// prize.redeemed
// ---------------------------------------------------------------------------

describe("prize.redeemed event", () => {
	it("emits when a prize is redeemed", async () => {
		const events = createMockEvents();
		const ctrl = createGamificationController(createMockDataService(), events);

		const game = await ctrl.createGame({
			name: "Redeem",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Prize",
			value: "10",
			probability: 100,
		});
		const play = await ctrl.play(game.id, { email: "user@test.com" });
		events.emitted.length = 0;

		await ctrl.redeemPrize(play.id);

		const redeemed = events.emitted.filter((e) => e.type === "prize.redeemed");
		expect(redeemed).toHaveLength(1);
		expect((redeemed[0].payload as Record<string, unknown>).playId).toBe(
			play.id,
		);
	});

	it("does not emit when redemption fails", async () => {
		const events = createMockEvents();
		const ctrl = createGamificationController(createMockDataService(), events);

		await ctrl.redeemPrize("nonexistent");

		const redeemed = events.emitted.filter((e) => e.type === "prize.redeemed");
		expect(redeemed).toHaveLength(0);
	});
});

// ---------------------------------------------------------------------------
// No events without emitter
// ---------------------------------------------------------------------------

describe("no events without emitter", () => {
	it("works without event emitter", async () => {
		const ctrl = createGamificationController(createMockDataService());

		const game = await ctrl.createGame({
			name: "No Events",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Prize",
			value: "5",
			probability: 100,
		});
		await ctrl.play(game.id, {});
		await ctrl.updateGame(game.id, { name: "Updated" });
		await expect(ctrl.deleteGame(game.id)).resolves.toBe(true);

		// No errors thrown
	});
});

// ---------------------------------------------------------------------------
// Full lifecycle
// ---------------------------------------------------------------------------

describe("full lifecycle event sequence", () => {
	it("emits events in correct order", async () => {
		const events = createMockEvents();
		const ctrl = createGamificationController(createMockDataService(), events);

		const game = await ctrl.createGame({
			name: "Lifecycle",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Prize",
			value: "10",
			probability: 100,
		});
		const play = await ctrl.play(game.id, {});
		await ctrl.redeemPrize(play.id);
		await ctrl.updateGame(game.id, { name: "Changed" });
		await ctrl.deleteGame(game.id);

		const types = events.emitted.map((e) => e.type);
		expect(types).toEqual([
			"game.created",
			"game.won",
			"game.played",
			"prize.redeemed",
			"game.updated",
			"game.deleted",
		]);
	});
});
