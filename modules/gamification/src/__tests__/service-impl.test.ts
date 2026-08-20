import { createMockDataService } from "@86d-app/core/test-utils";
import { describe, expect, it } from "vitest";
import { createGamificationController } from "../service-impl";

function makeCtrl() {
	return createGamificationController(createMockDataService());
}

// ── Game CRUD ────────────────────────────────────────────────────────────────

describe("createGame", () => {
	it("creates a game with defaults", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({ name: "Spin to Win" });

		expect(game.id).toEqual(expect.any(String));
		expect(game.name).toBe("Spin to Win");
		expect(game.type).toBe("wheel");
		expect(game.isActive).toBe(true);
		expect(game.requireEmail).toBe(true);
		expect(game.requireNewsletterOptIn).toBe(false);
		expect(game.maxPlaysPerUser).toBe(1);
		expect(game.cooldownMinutes).toBe(1440);
		expect(game.totalPlays).toBe(0);
		expect(game.totalWins).toBe(0);
		expect(game.createdAt).toBeInstanceOf(Date);
		expect(game.updatedAt).toBeInstanceOf(Date);
	});

	it("accepts custom options", async () => {
		const ctrl = makeCtrl();
		const start = new Date("2026-01-01");
		const end = new Date("2026-12-31");
		const game = await ctrl.createGame({
			name: "Scratch Card",
			description: "A scratch card game",
			type: "scratch",
			isActive: false,
			requireEmail: false,
			requireNewsletterOptIn: true,
			maxPlaysPerUser: 5,
			cooldownMinutes: 60,
			startDate: start,
			endDate: end,
			settings: { color: "red" },
		});

		expect(game.type).toBe("scratch");
		expect(game.isActive).toBe(false);
		expect(game.requireEmail).toBe(false);
		expect(game.requireNewsletterOptIn).toBe(true);
		expect(game.maxPlaysPerUser).toBe(5);
		expect(game.cooldownMinutes).toBe(60);
		expect(game.startDate).toBe(start);
		expect(game.endDate).toBe(end);
		expect(game.settings).toEqual({ color: "red" });
	});
});

describe("getGame", () => {
	it("returns a created game", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({ name: "Test" });
		const fetched = await ctrl.getGame(game.id);
		expect(fetched).not.toBeNull();
		expect(fetched?.name).toBe("Test");
	});

	it("returns null for nonexistent id", async () => {
		const ctrl = makeCtrl();
		const result = await ctrl.getGame("nope");
		expect(result).toBeNull();
	});
});

describe("updateGame", () => {
	it("updates only specified fields", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Original",
			description: "desc",
		});

		const updated = await ctrl.updateGame(game.id, { name: "Changed" });

		expect(updated?.name).toBe("Changed");
		expect(updated?.description).toBe("desc");
		expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
			game.updatedAt.getTime(),
		);
	});

	it("returns null for nonexistent game", async () => {
		const ctrl = makeCtrl();
		const result = await ctrl.updateGame("nope", { name: "X" });
		expect(result).toBeNull();
	});
});

describe("deleteGame", () => {
	it("deletes an existing game", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({ name: "Delete Me" });
		const result = await ctrl.deleteGame(game.id);
		expect(result).toBe(true);

		const fetched = await ctrl.getGame(game.id);
		expect(fetched).toBeNull();
	});

	it("returns false for nonexistent game", async () => {
		const ctrl = makeCtrl();
		const result = await ctrl.deleteGame("nope");
		expect(result).toBe(false);
	});
});

describe("listGames", () => {
	it("returns all games", async () => {
		const ctrl = makeCtrl();
		await ctrl.createGame({ name: "A" });
		await ctrl.createGame({ name: "B" });
		const games = await ctrl.listGames();
		expect(games).toHaveLength(2);
	});

	it("filters by isActive", async () => {
		const ctrl = makeCtrl();
		await ctrl.createGame({ name: "Active", isActive: true });
		await ctrl.createGame({ name: "Inactive", isActive: false });

		const active = await ctrl.listGames({ isActive: true });
		expect(active).toHaveLength(1);
		expect(active[0].name).toBe("Active");
	});

	it("filters by type", async () => {
		const ctrl = makeCtrl();
		await ctrl.createGame({ name: "Wheel", type: "wheel" });
		await ctrl.createGame({ name: "Scratch", type: "scratch" });

		const wheels = await ctrl.listGames({ type: "wheel" });
		expect(wheels).toHaveLength(1);
		expect(wheels[0].name).toBe("Wheel");
	});
});

// ── Prize CRUD ───────────────────────────────────────────────────────────────

describe("addPrize", () => {
	it("creates a prize with defaults", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({ name: "Game" });
		const prize = await ctrl.addPrize(game.id, {
			name: "10% Off",
			value: "10",
			probability: 50,
		});

		expect(prize.id).toEqual(expect.any(String));
		expect(prize.gameId).toBe(game.id);
		expect(prize.name).toBe("10% Off");
		expect(prize.type).toBe("discount-percent");
		expect(prize.value).toBe("10");
		expect(prize.probability).toBe(50);
		expect(prize.maxWins).toBe(-1);
		expect(prize.currentWins).toBe(0);
		expect(prize.isActive).toBe(true);
	});

	it("accepts custom options", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({ name: "Game" });
		const prize = await ctrl.addPrize(game.id, {
			name: "Free Product",
			value: "SKU-123",
			probability: 5,
			type: "free-product",
			maxWins: 10,
			discountCode: "FREE10",
			productId: "prod-1",
			isActive: false,
		});

		expect(prize.type).toBe("free-product");
		expect(prize.maxWins).toBe(10);
		expect(prize.discountCode).toBe("FREE10");
		expect(prize.productId).toBe("prod-1");
		expect(prize.isActive).toBe(false);
	});
});

describe("updatePrize", () => {
	it("updates only specified fields", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({ name: "Game" });
		const prize = await ctrl.addPrize(game.id, {
			name: "Original",
			value: "10",
			probability: 50,
		});

		const updated = await ctrl.updatePrize(prize.id, { name: "Updated" });
		expect(updated?.name).toBe("Updated");
		expect(updated?.value).toBe("10");
		expect(updated?.probability).toBe(50);
	});

	it("returns null for nonexistent prize", async () => {
		const ctrl = makeCtrl();
		const result = await ctrl.updatePrize("nope", { name: "X" });
		expect(result).toBeNull();
	});
});

describe("removePrize", () => {
	it("removes an existing prize", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({ name: "Game" });
		const prize = await ctrl.addPrize(game.id, {
			name: "Prize",
			value: "5",
			probability: 50,
		});
		const result = await ctrl.removePrize(prize.id);
		expect(result).toBe(true);

		const list = await ctrl.listPrizes(game.id);
		expect(list).toHaveLength(0);
	});

	it("returns false for nonexistent prize", async () => {
		const ctrl = makeCtrl();
		const result = await ctrl.removePrize("nope");
		expect(result).toBe(false);
	});
});

describe("listPrizes", () => {
	it("returns prizes for a game", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({ name: "Game" });
		await ctrl.addPrize(game.id, {
			name: "A",
			value: "1",
			probability: 50,
		});
		await ctrl.addPrize(game.id, {
			name: "B",
			value: "2",
			probability: 50,
		});

		const prizes = await ctrl.listPrizes(game.id);
		expect(prizes).toHaveLength(2);
	});
});

// ── Play Logic ───────────────────────────────────────────────────────────────

describe("play", () => {
	it("throws when game not found", async () => {
		const ctrl = makeCtrl();
		await expect(ctrl.play("nonexistent", {})).rejects.toThrow(
			"Game not found",
		);
	});

	it("throws when game is inactive", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Inactive",
			isActive: false,
		});
		await expect(ctrl.play(game.id, {})).rejects.toThrow("Game is not active");
	});

	it("throws when game has not started", async () => {
		const ctrl = makeCtrl();
		const future = new Date(Date.now() + 86400000);
		const game = await ctrl.createGame({
			name: "Future",
			requireEmail: false,
			startDate: future,
		});
		await expect(ctrl.play(game.id, {})).rejects.toThrow(
			"Game has not started yet",
		);
	});

	it("throws when game has ended", async () => {
		const ctrl = makeCtrl();
		const past = new Date(Date.now() - 86400000);
		const game = await ctrl.createGame({
			name: "Ended",
			requireEmail: false,
			endDate: past,
		});
		await expect(ctrl.play(game.id, {})).rejects.toThrow("Game has ended");
	});

	it("throws when email is required but not provided", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Email Required",
			requireEmail: true,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await expect(ctrl.play(game.id, {})).rejects.toThrow(
			"Email is required to play",
		);
	});

	it("throws when max plays reached", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Max Plays",
			requireEmail: false,
			maxPlaysPerUser: 1,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { email: "user@test.com" });
		await expect(
			ctrl.play(game.id, { email: "user@test.com" }),
		).rejects.toThrow("Maximum plays reached");
	});

	it("throws when cooldown has not elapsed", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Cooldown",
			requireEmail: false,
			maxPlaysPerUser: 10,
			cooldownMinutes: 60,
		});

		await ctrl.play(game.id, { email: "user@test.com" });
		await expect(
			ctrl.play(game.id, { email: "user@test.com" }),
		).rejects.toThrow("Cooldown period has not elapsed");
	});

	it("returns a losing play when no prizes exist", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "No Prizes",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});

		const play = await ctrl.play(game.id, { email: "user@test.com" });
		expect(play.result).toBe("lose");
		expect(play.prizeId).toBeUndefined();
	});

	it("returns a winning play when prize has 100% probability", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Always Win",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		const prize = await ctrl.addPrize(game.id, {
			name: "Sure Thing",
			value: "100",
			probability: 100,
		});

		const play = await ctrl.play(game.id, { email: "user@test.com" });
		expect(play.result).toBe("win");
		expect(play.prizeId).toBe(prize.id);
		expect(play.prizeName).toBe("Sure Thing");
		expect(play.prizeValue).toBe("100");
	});

	it("increments game counters on play", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Counter Test",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, {});
		await ctrl.play(game.id, {});

		const updated = await ctrl.getGame(game.id);
		expect(updated?.totalPlays).toBe(2);
	});

	it("increments prize currentWins on win", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Prize Counter",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Prize",
			value: "10",
			probability: 100,
		});

		await ctrl.play(game.id, {});
		await ctrl.play(game.id, {});

		const prizes = await ctrl.listPrizes(game.id);
		expect(prizes[0].currentWins).toBe(2);
	});

	it("skips prizes that have reached maxWins", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Max Wins",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Limited Prize",
			value: "10",
			probability: 100,
			maxWins: 1,
		});

		const play1 = await ctrl.play(game.id, {});
		expect(play1.result).toBe("win");

		const play2 = await ctrl.play(game.id, {});
		expect(play2.result).toBe("lose");
	});

	it("skips inactive prizes", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Inactive Prize",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Disabled",
			value: "10",
			probability: 100,
			isActive: false,
		});

		const play = await ctrl.play(game.id, {});
		expect(play.result).toBe("lose");
	});

	it("records play metadata", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Metadata",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});

		const play = await ctrl.play(game.id, {
			email: "user@test.com",
			customerId: "cust-1",
			ipAddress: "127.0.0.1",
			userAgent: "TestAgent/1.0",
		});

		expect(play.email).toBe("user@test.com");
		expect(play.customerId).toBe("cust-1");
		expect(play.ipAddress).toBe("127.0.0.1");
		expect(play.userAgent).toBe("TestAgent/1.0");
		expect(play.isRedeemed).toBe(false);
	});

	it("enforces max plays by customerId", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Customer ID Max",
			requireEmail: false,
			maxPlaysPerUser: 1,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { customerId: "cust-1" });
		await expect(ctrl.play(game.id, { customerId: "cust-1" })).rejects.toThrow(
			"Maximum plays reached",
		);
	});

	it("allows different users to play separately", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Multi-user",
			requireEmail: false,
			maxPlaysPerUser: 1,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { email: "a@test.com" });
		const play2 = await ctrl.play(game.id, { email: "b@test.com" });
		expect(play2.email).toBe("b@test.com");
	});
});

// ── Redeem ───────────────────────────────────────────────────────────────────

describe("redeemPrize", () => {
	it("redeems a winning play", async () => {
		const ctrl = makeCtrl();
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

		const play = await ctrl.play(game.id, {});
		const redeemed = await ctrl.redeemPrize(play.id);

		expect(redeemed).not.toBeNull();
		expect(redeemed?.isRedeemed).toBe(true);
		expect(redeemed?.redeemedAt).toBeInstanceOf(Date);
	});

	it("returns null for nonexistent play", async () => {
		const ctrl = makeCtrl();
		const result = await ctrl.redeemPrize("nonexistent");
		expect(result).toBeNull();
	});

	it("returns null for a losing play", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Lose",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		const play = await ctrl.play(game.id, {});
		expect(play.result).toBe("lose");

		const result = await ctrl.redeemPrize(play.id);
		expect(result).toBeNull();
	});

	it("returns null for already redeemed play", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Double Redeem",
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
		const secondAttempt = await ctrl.redeemPrize(play.id);
		expect(secondAttempt).toBeNull();
	});
});

// ── Play History ─────────────────────────────────────────────────────────────

describe("getPlayHistory", () => {
	it("returns all plays for a game", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "History",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { email: "a@test.com" });
		await ctrl.play(game.id, { email: "b@test.com" });

		const history = await ctrl.getPlayHistory({ gameId: game.id });
		expect(history).toHaveLength(2);
	});

	it("filters by email", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Email Filter",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { email: "a@test.com" });
		await ctrl.play(game.id, { email: "b@test.com" });

		const history = await ctrl.getPlayHistory({
			gameId: game.id,
			email: "a@test.com",
		});
		expect(history).toHaveLength(1);
		expect(history[0].email).toBe("a@test.com");
	});

	it("filters by customerId", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Customer Filter",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { customerId: "c1" });
		await ctrl.play(game.id, { customerId: "c2" });

		const history = await ctrl.getPlayHistory({
			gameId: game.id,
			customerId: "c1",
		});
		expect(history).toHaveLength(1);
	});
});

// ── Stats ────────────────────────────────────────────────────────────────────

describe("getGameStats", () => {
	it("returns zeros for nonexistent game", async () => {
		const ctrl = makeCtrl();
		const stats = await ctrl.getGameStats("nope");
		expect(stats).toEqual({
			totalPlays: 0,
			totalWins: 0,
			winRate: 0,
			prizeBreakdown: [],
		});
	});

	it("calculates correct stats with plays", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Stats",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		const prize = await ctrl.addPrize(game.id, {
			name: "Prize A",
			value: "10",
			probability: 100,
		});

		await ctrl.play(game.id, { email: "a@test.com" });
		await ctrl.play(game.id, { email: "b@test.com" });

		const stats = await ctrl.getGameStats(game.id);
		expect(stats.totalPlays).toBe(2);
		expect(stats.totalWins).toBe(2);
		expect(stats.winRate).toBe(1);
		expect(stats.prizeBreakdown).toHaveLength(1);
		expect(stats.prizeBreakdown[0].prizeId).toBe(prize.id);
		expect(stats.prizeBreakdown[0].prizeName).toBe("Prize A");
		expect(stats.prizeBreakdown[0].wins).toBe(2);
	});

	it("calculates win rate correctly with mixed results", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Mixed",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Limited",
			value: "5",
			probability: 100,
			maxWins: 1,
		});

		await ctrl.play(game.id, {});
		await ctrl.play(game.id, {});

		const stats = await ctrl.getGameStats(game.id);
		expect(stats.totalPlays).toBe(2);
		expect(stats.totalWins).toBe(1);
		expect(stats.winRate).toBe(0.5);
	});
});

// ── canPlay ──────────────────────────────────────────────────────────────────

describe("canPlay", () => {
	it("returns not allowed for nonexistent game", async () => {
		const ctrl = makeCtrl();
		const result = await ctrl.canPlay("nope", {});
		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Game not found");
	});

	it("returns not allowed for inactive game", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Inactive",
			isActive: false,
		});
		const result = await ctrl.canPlay(game.id, {});
		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Game is not active");
	});

	it("returns not allowed before start date", async () => {
		const ctrl = makeCtrl();
		const future = new Date(Date.now() + 86400000);
		const game = await ctrl.createGame({
			name: "Future",
			requireEmail: false,
			startDate: future,
		});
		const result = await ctrl.canPlay(game.id, {});
		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Game has not started yet");
	});

	it("returns not allowed after end date", async () => {
		const ctrl = makeCtrl();
		const past = new Date(Date.now() - 86400000);
		const game = await ctrl.createGame({
			name: "Ended",
			requireEmail: false,
			endDate: past,
		});
		const result = await ctrl.canPlay(game.id, {});
		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Game has ended");
	});

	it("returns not allowed when email required but missing", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Email Required",
			requireEmail: true,
		});
		const result = await ctrl.canPlay(game.id, {});
		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Email is required to play");
	});

	it("returns not allowed when max plays reached", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Max",
			requireEmail: false,
			maxPlaysPerUser: 1,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { email: "user@test.com" });
		const result = await ctrl.canPlay(game.id, { email: "user@test.com" });
		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Maximum plays reached");
	});

	it("returns not allowed with nextPlayAt during cooldown", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Cooldown Check",
			requireEmail: false,
			maxPlaysPerUser: 10,
			cooldownMinutes: 60,
		});

		await ctrl.play(game.id, { email: "user@test.com" });
		const result = await ctrl.canPlay(game.id, { email: "user@test.com" });
		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Cooldown period has not elapsed");
		expect(result.nextPlayAt).toBeInstanceOf(Date);
	});

	it("returns allowed for a valid play", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Valid",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		const result = await ctrl.canPlay(game.id, {});
		expect(result.allowed).toBe(true);
	});

	it("returns allowed when no identifier provided", async () => {
		const ctrl = makeCtrl();
		const game = await ctrl.createGame({
			name: "Anonymous",
			requireEmail: false,
			maxPlaysPerUser: 1,
		});
		const result = await ctrl.canPlay(game.id, {});
		expect(result.allowed).toBe(true);
	});
});
