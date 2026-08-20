import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGamificationController } from "../service-impl";

/**
 * Store endpoint integration tests for the gamification module.
 *
 * These tests verify the business logic in store-facing endpoints:
 *
 * 1. get-game: returns game by id, null for missing
 * 2. play: succeeds on active game, throws on inactive/not started/ended, respects maxPlaysPerUser
 * 3. can-play: returns allowed:true for valid, allowed:false with reason for inactive/ended/max plays
 * 4. redeem-prize: redeems winning play, returns null for losing/already redeemed
 */

type DataService = ReturnType<typeof createMockDataService>;

// ── Tests ──────────────────────────────────────────────────────────

describe("store endpoint: get-game — retrieve game by id", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns a game by id", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({ name: "Spin to Win" });
		const fetched = await ctrl.getGame(game.id);

		expect(fetched).not.toBeNull();
		expect(fetched?.id).toBe(game.id);
		expect(fetched?.name).toBe("Spin to Win");
		expect(fetched?.type).toBe("wheel");
		expect(fetched?.isActive).toBe(true);
	});

	it("returns null for a non-existent game id", async () => {
		const ctrl = createGamificationController(data);

		const result = await ctrl.getGame("nonexistent-id");

		expect(result).toBeNull();
	});

	it("returns the correct game when multiple games exist", async () => {
		const ctrl = createGamificationController(data);

		const game1 = await ctrl.createGame({ name: "Wheel Game" });
		const game2 = await ctrl.createGame({ name: "Scratch Card" });

		const fetched = await ctrl.getGame(game2.id);

		expect(fetched).not.toBeNull();
		expect(fetched?.name).toBe("Scratch Card");
		expect(fetched?.id).toBe(game2.id);
		expect(fetched?.id).not.toBe(game1.id);
	});

	it("returns game with all expected fields", async () => {
		const ctrl = createGamificationController(data);

		const start = new Date("2026-01-01");
		const end = new Date("2026-12-31");
		const game = await ctrl.createGame({
			name: "Full Game",
			description: "A complete game",
			type: "scratch",
			requireEmail: true,
			maxPlaysPerUser: 3,
			cooldownMinutes: 120,
			startDate: start,
			endDate: end,
			settings: { theme: "holiday" },
		});

		const fetched = await ctrl.getGame(game.id);

		expect(fetched?.description).toBe("A complete game");
		expect(fetched?.type).toBe("scratch");
		expect(fetched?.requireEmail).toBe(true);
		expect(fetched?.maxPlaysPerUser).toBe(3);
		expect(fetched?.cooldownMinutes).toBe(120);
		expect(fetched?.startDate).toEqual(start);
		expect(fetched?.endDate).toEqual(end);
		expect(fetched?.settings).toEqual({ theme: "holiday" });
		expect(fetched?.totalPlays).toBe(0);
		expect(fetched?.totalWins).toBe(0);
		expect(fetched?.createdAt).toBeInstanceOf(Date);
		expect(fetched?.updatedAt).toBeInstanceOf(Date);
	});
});

describe("store endpoint: play — play a game", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("succeeds on an active game with a 100% prize", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Active Game",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "10% Off",
			value: "10",
			probability: 100,
		});

		const play = await ctrl.play(game.id, { email: "player@test.com" });

		expect(play.id).toBeDefined();
		expect(play.gameId).toBe(game.id);
		expect(play.result).toBe("win");
		expect(play.prizeName).toBe("10% Off");
		expect(play.prizeValue).toBe("10");
		expect(play.isRedeemed).toBe(false);
		expect(play.email).toBe("player@test.com");
		expect(play.createdAt).toBeInstanceOf(Date);
	});

	it("returns a losing play when no prizes exist", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "No Prizes",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});

		const play = await ctrl.play(game.id, {});

		expect(play.result).toBe("lose");
		expect(play.prizeId).toBeUndefined();
		expect(play.prizeName).toBeUndefined();
	});

	it("throws when game is inactive", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Inactive Game",
			isActive: false,
		});

		await expect(ctrl.play(game.id, {})).rejects.toThrow("Game is not active");
	});

	it("throws when game has not started yet", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Future Game",
			requireEmail: false,
			startDate: new Date("2099-01-01"),
		});

		await expect(ctrl.play(game.id, {})).rejects.toThrow(
			"Game has not started yet",
		);
	});

	it("throws when game has ended", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Ended Game",
			requireEmail: false,
			endDate: new Date("2000-01-01"),
		});

		await expect(ctrl.play(game.id, {})).rejects.toThrow("Game has ended");
	});

	it("throws when game is not found", async () => {
		const ctrl = createGamificationController(data);

		await expect(ctrl.play("nonexistent-id", {})).rejects.toThrow(
			"Game not found",
		);
	});

	it("throws when email is required but not provided", async () => {
		const ctrl = createGamificationController(data);

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

	it("respects maxPlaysPerUser — throws after limit reached", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Limited Plays",
			requireEmail: false,
			maxPlaysPerUser: 2,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { email: "user@test.com" });
		await ctrl.play(game.id, { email: "user@test.com" });

		await expect(
			ctrl.play(game.id, { email: "user@test.com" }),
		).rejects.toThrow("Maximum plays reached");
	});

	it("allows different users to play independently under maxPlaysPerUser", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Per User Limit",
			requireEmail: false,
			maxPlaysPerUser: 1,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { email: "user-a@test.com" });
		const play = await ctrl.play(game.id, { email: "user-b@test.com" });

		expect(play.email).toBe("user-b@test.com");
	});

	it("increments game totalPlays and totalWins counters", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Counter Game",
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
		await ctrl.play(game.id, {});

		const updated = await ctrl.getGame(game.id);
		expect(updated?.totalPlays).toBe(2);
		expect(updated?.totalWins).toBe(2);
	});

	it("skips inactive prizes during selection", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Inactive Prize Game",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Disabled Prize",
			value: "50",
			probability: 100,
			isActive: false,
		});

		const play = await ctrl.play(game.id, {});

		expect(play.result).toBe("lose");
	});

	it("skips prizes that have reached maxWins", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "MaxWins Prize Game",
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

		const first = await ctrl.play(game.id, {});
		expect(first.result).toBe("win");

		const second = await ctrl.play(game.id, {});
		expect(second.result).toBe("lose");
	});

	it("throws during cooldown period", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Cooldown Game",
			requireEmail: false,
			maxPlaysPerUser: 10,
			cooldownMinutes: 60,
		});

		await ctrl.play(game.id, { email: "user@test.com" });

		await expect(
			ctrl.play(game.id, { email: "user@test.com" }),
		).rejects.toThrow("Cooldown period has not elapsed");
	});
});

describe("store endpoint: can-play — check play eligibility", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("returns allowed:true for a valid active game", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Open Game",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});

		const result = await ctrl.canPlay(game.id, {});

		expect(result.allowed).toBe(true);
		expect(result.reason).toBeUndefined();
	});

	it("returns allowed:true with email when email is required", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Email Game",
			requireEmail: true,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});

		const result = await ctrl.canPlay(game.id, { email: "player@test.com" });

		expect(result.allowed).toBe(true);
	});

	it("returns allowed:false with reason for non-existent game", async () => {
		const ctrl = createGamificationController(data);

		const result = await ctrl.canPlay("nonexistent-id", {});

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Game not found");
	});

	it("returns allowed:false with reason for inactive game", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Inactive",
			isActive: false,
		});

		const result = await ctrl.canPlay(game.id, {});

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Game is not active");
	});

	it("returns allowed:false with reason when game has not started", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Future Game",
			requireEmail: false,
			startDate: new Date("2099-01-01"),
		});

		const result = await ctrl.canPlay(game.id, {});

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Game has not started yet");
	});

	it("returns allowed:false with reason when game has ended", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Ended Game",
			requireEmail: false,
			endDate: new Date("2000-01-01"),
		});

		const result = await ctrl.canPlay(game.id, {});

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Game has ended");
	});

	it("returns allowed:false when email is required but missing", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Email Needed",
			requireEmail: true,
		});

		const result = await ctrl.canPlay(game.id, {});

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Email is required to play");
	});

	it("returns allowed:false with reason when max plays reached", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Maxed Out",
			requireEmail: false,
			maxPlaysPerUser: 1,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { email: "user@test.com" });
		const result = await ctrl.canPlay(game.id, { email: "user@test.com" });

		expect(result.allowed).toBe(false);
		expect(result.reason).toBe("Maximum plays reached");
	});

	it("returns allowed:false with reason and nextPlayAt during cooldown", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Cooldown Game",
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

	it("returns allowed:true when no identifier is provided even with maxPlaysPerUser", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Anonymous OK",
			requireEmail: false,
			maxPlaysPerUser: 1,
		});

		const result = await ctrl.canPlay(game.id, {});

		expect(result.allowed).toBe(true);
	});

	it("returns allowed:true for a different user when another user has maxed out", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Multi User",
			requireEmail: false,
			maxPlaysPerUser: 1,
			cooldownMinutes: 0,
		});

		await ctrl.play(game.id, { email: "user-a@test.com" });

		const resultA = await ctrl.canPlay(game.id, { email: "user-a@test.com" });
		expect(resultA.allowed).toBe(false);

		const resultB = await ctrl.canPlay(game.id, { email: "user-b@test.com" });
		expect(resultB.allowed).toBe(true);
	});
});

describe("store endpoint: redeem-prize — redeem a winning play", () => {
	let data: DataService;

	beforeEach(() => {
		data = createMockDataService();
	});

	it("redeems a winning play successfully", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Redeem Game",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Free Shipping",
			value: "free-ship",
			probability: 100,
			type: "free-shipping",
		});

		const play = await ctrl.play(game.id, { email: "winner@test.com" });
		expect(play.result).toBe("win");

		const redeemed = await ctrl.redeemPrize(play.id);

		expect(redeemed).not.toBeNull();
		expect(redeemed?.isRedeemed).toBe(true);
		expect(redeemed?.redeemedAt).toBeInstanceOf(Date);
		expect(redeemed?.id).toBe(play.id);
		expect(redeemed?.prizeId).toBe(play.prizeId);
		expect(redeemed?.email).toBe("winner@test.com");
	});

	it("returns null for a losing play", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Losing Game",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});

		const play = await ctrl.play(game.id, {});
		expect(play.result).toBe("lose");

		const result = await ctrl.redeemPrize(play.id);

		expect(result).toBeNull();
	});

	it("returns null for an already redeemed play", async () => {
		const ctrl = createGamificationController(data);

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

	it("returns null for a non-existent play id", async () => {
		const ctrl = createGamificationController(data);

		const result = await ctrl.redeemPrize("nonexistent-play-id");

		expect(result).toBeNull();
	});

	it("does not affect other plays when one is redeemed", async () => {
		const ctrl = createGamificationController(data);

		const game = await ctrl.createGame({
			name: "Multi Play Redeem",
			requireEmail: false,
			maxPlaysPerUser: 0,
			cooldownMinutes: 0,
		});
		await ctrl.addPrize(game.id, {
			name: "Prize",
			value: "15",
			probability: 100,
		});

		const play1 = await ctrl.play(game.id, { email: "a@test.com" });
		const play2 = await ctrl.play(game.id, { email: "b@test.com" });

		await ctrl.redeemPrize(play1.id);

		// play2 should still be redeemable
		const redeemed2 = await ctrl.redeemPrize(play2.id);
		expect(redeemed2).not.toBeNull();
		expect(redeemed2?.isRedeemed).toBe(true);
	});
});
