import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGamificationController } from "../service-impl";

describe("gamification controller", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createGamificationController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGamificationController(mockData);
	});

	// ── Game CRUD ─────────────────────────────────────────────────────

	describe("game CRUD", () => {
		it("creates a game with defaults", async () => {
			const game = await controller.createGame({ name: "Spin & Win" });
			expect(game.id).toBeDefined();
			expect(game.name).toBe("Spin & Win");
			expect(game.type).toBe("wheel");
			expect(game.isActive).toBe(true);
			expect(game.requireEmail).toBe(true);
			expect(game.maxPlaysPerUser).toBe(1);
			expect(game.cooldownMinutes).toBe(1440);
			expect(game.totalPlays).toBe(0);
			expect(game.totalWins).toBe(0);
			expect(game.settings).toEqual({});
		});

		it("creates a game with custom options", async () => {
			const game = await controller.createGame({
				name: "Scratch It",
				type: "scratch",
				maxPlaysPerUser: 3,
				cooldownMinutes: 60,
				requireEmail: false,
				settings: { theme: "gold" },
			});
			expect(game.type).toBe("scratch");
			expect(game.maxPlaysPerUser).toBe(3);
			expect(game.cooldownMinutes).toBe(60);
			expect(game.requireEmail).toBe(false);
			expect(game.settings).toEqual({ theme: "gold" });
		});

		it("gets a game by id", async () => {
			const created = await controller.createGame({ name: "Test" });
			const found = await controller.getGame(created.id);
			expect(found).not.toBeNull();
			expect(found?.name).toBe("Test");
		});

		it("returns null for non-existent game", async () => {
			const found = await controller.getGame("nonexistent");
			expect(found).toBeNull();
		});

		it("updates a game", async () => {
			const game = await controller.createGame({ name: "Original" });
			const updated = await controller.updateGame(game.id, {
				name: "Updated",
				isActive: false,
			});
			expect(updated?.name).toBe("Updated");
			expect(updated?.isActive).toBe(false);
		});

		it("partial update preserves other fields", async () => {
			const game = await controller.createGame({
				name: "Keep",
				type: "slot",
				cooldownMinutes: 30,
			});
			const updated = await controller.updateGame(game.id, { name: "Changed" });
			expect(updated?.name).toBe("Changed");
			expect(updated?.type).toBe("slot");
			expect(updated?.cooldownMinutes).toBe(30);
		});

		it("returns null when updating non-existent game", async () => {
			const result = await controller.updateGame("nope", { name: "X" });
			expect(result).toBeNull();
		});

		it("deletes a game", async () => {
			const game = await controller.createGame({ name: "Delete Me" });
			const deleted = await controller.deleteGame(game.id);
			expect(deleted).toBe(true);
			const found = await controller.getGame(game.id);
			expect(found).toBeNull();
		});

		it("returns false when deleting non-existent game", async () => {
			const result = await controller.deleteGame("nonexistent");
			expect(result).toBe(false);
		});

		it("double delete returns false on second attempt", async () => {
			const game = await controller.createGame({ name: "Once" });
			expect(await controller.deleteGame(game.id)).toBe(true);
			expect(await controller.deleteGame(game.id)).toBe(false);
		});

		it("lists games", async () => {
			await controller.createGame({ name: "A" });
			await controller.createGame({ name: "B" });
			const all = await controller.listGames();
			expect(all).toHaveLength(2);
		});

		it("lists games filtered by type", async () => {
			await controller.createGame({ name: "Wheel", type: "wheel" });
			await controller.createGame({ name: "Scratch", type: "scratch" });
			await controller.createGame({ name: "Slot", type: "slot" });
			const wheels = await controller.listGames({ type: "wheel" });
			expect(wheels).toHaveLength(1);
			expect(wheels[0].name).toBe("Wheel");
		});

		it("lists games filtered by isActive", async () => {
			await controller.createGame({ name: "Active", isActive: true });
			await controller.createGame({ name: "Inactive", isActive: false });
			const active = await controller.listGames({ isActive: true });
			expect(active).toHaveLength(1);
			expect(active[0].name).toBe("Active");
		});
	});

	// ── Prize CRUD ────────────────────────────────────────────────────

	describe("prize CRUD", () => {
		it("adds a prize to a game", async () => {
			const game = await controller.createGame({ name: "Game" });
			const prize = await controller.addPrize(game.id, {
				name: "10% Off",
				value: "10",
				probability: 50,
				type: "discount-percent",
			});
			expect(prize.id).toBeDefined();
			expect(prize.gameId).toBe(game.id);
			expect(prize.name).toBe("10% Off");
			expect(prize.probability).toBe(50);
			expect(prize.currentWins).toBe(0);
			expect(prize.maxWins).toBe(-1);
		});

		it("updates a prize", async () => {
			const game = await controller.createGame({ name: "Game" });
			const prize = await controller.addPrize(game.id, {
				name: "Old",
				value: "5",
				probability: 25,
			});
			const updated = await controller.updatePrize(prize.id, {
				name: "New",
				probability: 75,
			});
			expect(updated?.name).toBe("New");
			expect(updated?.probability).toBe(75);
			expect(updated?.value).toBe("5"); // preserved
		});

		it("returns null when updating non-existent prize", async () => {
			const result = await controller.updatePrize("nope", { name: "X" });
			expect(result).toBeNull();
		});

		it("removes a prize", async () => {
			const game = await controller.createGame({ name: "Game" });
			const prize = await controller.addPrize(game.id, {
				name: "Gone",
				value: "5",
				probability: 10,
			});
			expect(await controller.removePrize(prize.id)).toBe(true);
			const prizes = await controller.listPrizes(game.id);
			expect(prizes).toHaveLength(0);
		});

		it("returns false when removing non-existent prize", async () => {
			expect(await controller.removePrize("nope")).toBe(false);
		});

		it("lists prizes for a game", async () => {
			const game = await controller.createGame({ name: "Game" });
			await controller.addPrize(game.id, {
				name: "A",
				value: "1",
				probability: 30,
			});
			await controller.addPrize(game.id, {
				name: "B",
				value: "2",
				probability: 20,
			});
			const prizes = await controller.listPrizes(game.id);
			expect(prizes).toHaveLength(2);
		});
	});

	// ── Play Mechanics ────────────────────────────────────────────────

	describe("play mechanics", () => {
		it("play with 100% probability prize always wins", async () => {
			const game = await controller.createGame({
				name: "Sure Win",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.addPrize(game.id, {
				name: "Prize",
				value: "10",
				probability: 100,
			});

			const play = await controller.play(game.id, {});
			expect(play.result).toBe("win");
			expect(play.prizeName).toBe("Prize");
		});

		it("play with 0% probability prizes always loses", async () => {
			const game = await controller.createGame({
				name: "No Win",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.addPrize(game.id, {
				name: "Never",
				value: "10",
				probability: 0,
			});

			const play = await controller.play(game.id, {});
			expect(play.result).toBe("lose");
		});

		it("play with no prizes always loses", async () => {
			const game = await controller.createGame({
				name: "Empty",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});

			const play = await controller.play(game.id, {});
			expect(play.result).toBe("lose");
		});

		it("play increments game totalPlays", async () => {
			const game = await controller.createGame({
				name: "Counter",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});

			await controller.play(game.id, {});
			await controller.play(game.id, {});
			const updated = await controller.getGame(game.id);
			expect(updated?.totalPlays).toBe(2);
		});

		it("winning play increments totalWins and prize currentWins", async () => {
			const game = await controller.createGame({
				name: "Win Counter",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			const prize = await controller.addPrize(game.id, {
				name: "Prize",
				value: "10",
				probability: 100,
			});

			await controller.play(game.id, {});
			const updatedGame = await controller.getGame(game.id);
			expect(updatedGame?.totalWins).toBe(1);

			const prizes = await controller.listPrizes(game.id);
			const updatedPrize = prizes.find((p) => p.id === prize.id);
			expect(updatedPrize?.currentWins).toBe(1);
		});

		it("play records email and customerId", async () => {
			const game = await controller.createGame({
				name: "Track",
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});

			const play = await controller.play(game.id, {
				email: "test@example.com",
				customerId: "cust-1",
			});
			expect(play.email).toBe("test@example.com");
			expect(play.customerId).toBe("cust-1");
		});

		it("throws when game not found", async () => {
			await expect(controller.play("nonexistent", {})).rejects.toThrow(
				"Game not found",
			);
		});

		it("throws when game is inactive", async () => {
			const game = await controller.createGame({
				name: "Off",
				isActive: false,
				requireEmail: false,
			});
			await expect(controller.play(game.id, {})).rejects.toThrow(
				"Game is not active",
			);
		});

		it("throws when email required but not provided", async () => {
			const game = await controller.createGame({
				name: "Email Required",
				requireEmail: true,
			});
			await expect(controller.play(game.id, {})).rejects.toThrow(
				"Email is required to play",
			);
		});

		it("prize with maxWins reached is excluded", async () => {
			const game = await controller.createGame({
				name: "Limited",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.addPrize(game.id, {
				name: "Limited Prize",
				value: "5",
				probability: 100,
				maxWins: 1,
			});

			// First play wins
			const first = await controller.play(game.id, {});
			expect(first.result).toBe("win");

			// Second play loses — prize maxWins reached
			const second = await controller.play(game.id, {});
			expect(second.result).toBe("lose");
		});

		it("inactive prize is excluded from selection", async () => {
			const game = await controller.createGame({
				name: "Inactive Prize",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.addPrize(game.id, {
				name: "Disabled",
				value: "5",
				probability: 100,
				isActive: false,
			});

			const play = await controller.play(game.id, {});
			expect(play.result).toBe("lose");
		});
	});

	// ── Cooldown Enforcement ──────────────────────────────────────────

	describe("cooldown enforcement", () => {
		it("enforces cooldown between plays", async () => {
			const game = await controller.createGame({
				name: "Cooldown",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 60,
			});

			await controller.play(game.id, { email: "user@test.com" });
			await expect(
				controller.play(game.id, { email: "user@test.com" }),
			).rejects.toThrow("Cooldown period has not elapsed");
		});

		it("allows play after cooldown expires", async () => {
			const game = await controller.createGame({
				name: "Expired Cooldown",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 1,
			});

			// Play once
			await controller.play(game.id, { email: "user@test.com" });

			// Manually backdate the play
			const plays = await controller.getPlayHistory({
				gameId: game.id,
				email: "user@test.com",
			});
			const play = plays[0];
			const old = new Date(Date.now() - 120_000); // 2 minutes ago
			const backdated = { ...play, createdAt: old };
			await mockData.upsert(
				"play",
				play.id,
				backdated as Record<string, unknown>,
			);

			// Now play should succeed
			const result = await controller.play(game.id, {
				email: "user@test.com",
			});
			expect(result.id).toBeDefined();
		});

		it("zero cooldown allows immediate replays", async () => {
			const game = await controller.createGame({
				name: "No Cooldown",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});

			await controller.play(game.id, { email: "user@test.com" });
			const second = await controller.play(game.id, {
				email: "user@test.com",
			});
			expect(second.id).toBeDefined();
		});
	});

	// ── Max Plays Enforcement ─────────────────────────────────────────

	describe("max plays enforcement", () => {
		it("enforces max plays per user", async () => {
			const game = await controller.createGame({
				name: "Max Plays",
				requireEmail: false,
				maxPlaysPerUser: 2,
				cooldownMinutes: 0,
			});

			await controller.play(game.id, { email: "user@test.com" });
			await controller.play(game.id, { email: "user@test.com" });
			await expect(
				controller.play(game.id, { email: "user@test.com" }),
			).rejects.toThrow("Maximum plays reached");
		});

		it("max plays tracked per user, not globally", async () => {
			const game = await controller.createGame({
				name: "Per User",
				requireEmail: false,
				maxPlaysPerUser: 1,
				cooldownMinutes: 0,
			});

			await controller.play(game.id, { email: "user1@test.com" });
			// Different user should still be able to play
			const play2 = await controller.play(game.id, {
				email: "user2@test.com",
			});
			expect(play2.id).toBeDefined();
		});

		it("maxPlaysPerUser of 0 means unlimited", async () => {
			const game = await controller.createGame({
				name: "Unlimited",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});

			for (let i = 0; i < 5; i++) {
				await controller.play(game.id, { email: "user@test.com" });
			}
			const history = await controller.getPlayHistory({
				gameId: game.id,
			});
			expect(history).toHaveLength(5);
		});
	});

	// ── Date Range Enforcement ────────────────────────────────────────

	describe("date range enforcement", () => {
		it("throws when game has not started yet", async () => {
			const game = await controller.createGame({
				name: "Future",
				requireEmail: false,
				startDate: new Date("2099-01-01"),
			});
			await expect(controller.play(game.id, {})).rejects.toThrow(
				"Game has not started yet",
			);
		});

		it("throws when game has ended", async () => {
			const game = await controller.createGame({
				name: "Past",
				requireEmail: false,
				endDate: new Date("2000-01-01"),
			});
			await expect(controller.play(game.id, {})).rejects.toThrow(
				"Game has ended",
			);
		});

		it("allows play within date range", async () => {
			const game = await controller.createGame({
				name: "Current",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
				startDate: new Date("2000-01-01"),
				endDate: new Date("2099-12-31"),
			});
			const play = await controller.play(game.id, {});
			expect(play.id).toBeDefined();
		});
	});

	// ── Redemption ────────────────────────────────────────────────────

	describe("redemption", () => {
		it("redeems a winning play", async () => {
			const game = await controller.createGame({
				name: "Redeem",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.addPrize(game.id, {
				name: "Prize",
				value: "10",
				probability: 100,
			});

			const play = await controller.play(game.id, {});
			expect(play.result).toBe("win");

			const redeemed = await controller.redeemPrize(play.id);
			expect(redeemed?.isRedeemed).toBe(true);
			expect(redeemed?.redeemedAt).toBeInstanceOf(Date);
		});

		it("cannot redeem a losing play", async () => {
			const game = await controller.createGame({
				name: "Lose",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});

			const play = await controller.play(game.id, {});
			expect(play.result).toBe("lose");

			const result = await controller.redeemPrize(play.id);
			expect(result).toBeNull();
		});

		it("cannot redeem an already-redeemed play", async () => {
			const game = await controller.createGame({
				name: "Double Redeem",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.addPrize(game.id, {
				name: "Prize",
				value: "10",
				probability: 100,
			});

			const play = await controller.play(game.id, {});
			await controller.redeemPrize(play.id);
			const second = await controller.redeemPrize(play.id);
			expect(second).toBeNull();
		});

		it("returns null for non-existent play", async () => {
			const result = await controller.redeemPrize("nonexistent");
			expect(result).toBeNull();
		});
	});

	// ── Stats ─────────────────────────────────────────────────────────

	describe("game stats", () => {
		it("calculates stats for a game", async () => {
			const game = await controller.createGame({
				name: "Stats",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.addPrize(game.id, {
				name: "Prize A",
				value: "10",
				probability: 100,
			});

			await controller.play(game.id, {});
			await controller.play(game.id, {});

			const stats = await controller.getGameStats(game.id);
			expect(stats.totalPlays).toBe(2);
			expect(stats.totalWins).toBe(2);
			expect(stats.winRate).toBe(1);
			expect(stats.prizeBreakdown).toHaveLength(1);
			expect(stats.prizeBreakdown[0].prizeName).toBe("Prize A");
			expect(stats.prizeBreakdown[0].wins).toBe(2);
		});

		it("returns zeroes for game with no plays", async () => {
			const game = await controller.createGame({ name: "Empty" });
			const stats = await controller.getGameStats(game.id);
			expect(stats.totalPlays).toBe(0);
			expect(stats.totalWins).toBe(0);
			expect(stats.winRate).toBe(0);
			expect(stats.prizeBreakdown).toHaveLength(0);
		});

		it("returns zeroes for non-existent game", async () => {
			const stats = await controller.getGameStats("nonexistent");
			expect(stats.totalPlays).toBe(0);
		});
	});

	// ── canPlay ───────────────────────────────────────────────────────

	describe("canPlay checks", () => {
		it("returns allowed for valid game", async () => {
			const game = await controller.createGame({
				name: "Playable",
				requireEmail: false,
			});
			const result = await controller.canPlay(game.id, {});
			expect(result.allowed).toBe(true);
		});

		it("returns not allowed for inactive game", async () => {
			const game = await controller.createGame({
				name: "Off",
				isActive: false,
			});
			const result = await controller.canPlay(game.id, {});
			expect(result.allowed).toBe(false);
			expect(result.reason).toBe("Game is not active");
		});

		it("returns not allowed for non-existent game", async () => {
			const result = await controller.canPlay("nope", {});
			expect(result.allowed).toBe(false);
			expect(result.reason).toBe("Game not found");
		});

		it("returns not allowed when email required but missing", async () => {
			const game = await controller.createGame({
				name: "Email Needed",
				requireEmail: true,
			});
			const result = await controller.canPlay(game.id, {});
			expect(result.allowed).toBe(false);
			expect(result.reason).toBe("Email is required to play");
		});

		it("returns not allowed when max plays reached", async () => {
			const game = await controller.createGame({
				name: "Maxed",
				requireEmail: false,
				maxPlaysPerUser: 1,
				cooldownMinutes: 0,
			});
			await controller.play(game.id, { email: "user@test.com" });
			const result = await controller.canPlay(game.id, {
				email: "user@test.com",
			});
			expect(result.allowed).toBe(false);
			expect(result.reason).toBe("Maximum plays reached");
		});

		it("returns not allowed during cooldown with nextPlayAt", async () => {
			const game = await controller.createGame({
				name: "Cooling",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 60,
			});
			await controller.play(game.id, { email: "user@test.com" });
			const result = await controller.canPlay(game.id, {
				email: "user@test.com",
			});
			expect(result.allowed).toBe(false);
			expect(result.reason).toBe("Cooldown period has not elapsed");
			expect(result.nextPlayAt).toBeInstanceOf(Date);
		});

		it("returns not allowed for future start date", async () => {
			const game = await controller.createGame({
				name: "Future",
				requireEmail: false,
				startDate: new Date("2099-01-01"),
			});
			const result = await controller.canPlay(game.id, {});
			expect(result.allowed).toBe(false);
			expect(result.reason).toBe("Game has not started yet");
		});

		it("returns not allowed for past end date", async () => {
			const game = await controller.createGame({
				name: "Past",
				requireEmail: false,
				endDate: new Date("2000-01-01"),
			});
			const result = await controller.canPlay(game.id, {});
			expect(result.allowed).toBe(false);
			expect(result.reason).toBe("Game has ended");
		});
	});

	// ── Play History ──────────────────────────────────────────────────

	describe("play history", () => {
		it("returns play history for a game", async () => {
			const game = await controller.createGame({
				name: "History",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.play(game.id, { email: "a@test.com" });
			await controller.play(game.id, { email: "b@test.com" });

			const history = await controller.getPlayHistory({
				gameId: game.id,
			});
			expect(history).toHaveLength(2);
		});

		it("filters play history by email", async () => {
			const game = await controller.createGame({
				name: "Filter",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.play(game.id, { email: "a@test.com" });
			await controller.play(game.id, { email: "b@test.com" });

			const history = await controller.getPlayHistory({
				gameId: game.id,
				email: "a@test.com",
			});
			expect(history).toHaveLength(1);
			expect(history[0].email).toBe("a@test.com");
		});

		it("returns empty array when no plays", async () => {
			const history = await controller.getPlayHistory({
				gameId: "nonexistent",
			});
			expect(history).toEqual([]);
		});
	});
});
