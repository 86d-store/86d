import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createGamificationController } from "../service-impl";

/**
 * Security tests for gamification module endpoints.
 *
 * These tests verify:
 * - Game state: inactive games cannot be played
 * - Play limits: max plays and cooldown enforced per user
 * - Email requirement: games requiring email reject anonymous plays
 * - Date range: games outside date range cannot be played
 * - Prize integrity: maxWins limits honored, inactive prizes excluded
 * - Redemption safety: losing plays and already-redeemed plays cannot be redeemed
 * - Data isolation: different users tracked independently
 */

describe("gamification endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createGamificationController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createGamificationController(mockData);
	});

	// ── Game State Security ──────────────────────────────────────────

	describe("game state security", () => {
		it("inactive game rejects play attempts", async () => {
			const game = await controller.createGame({
				name: "Disabled",
				isActive: false,
				requireEmail: false,
			});
			await expect(controller.play(game.id, {})).rejects.toThrow(
				"Game is not active",
			);
		});

		it("deactivated game rejects subsequent plays", async () => {
			const game = await controller.createGame({
				name: "Deactivated",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.play(game.id, {});
			await controller.updateGame(game.id, { isActive: false });
			await expect(controller.play(game.id, {})).rejects.toThrow(
				"Game is not active",
			);
		});

		it("non-existent game rejects play", async () => {
			await expect(controller.play("fake-id", {})).rejects.toThrow(
				"Game not found",
			);
		});
	});

	// ── Email Requirement Security ───────────────────────────────────

	describe("email requirement security", () => {
		it("game requiring email rejects anonymous play", async () => {
			const game = await controller.createGame({
				name: "Email Required",
				requireEmail: true,
			});
			await expect(controller.play(game.id, {})).rejects.toThrow(
				"Email is required to play",
			);
		});

		it("game requiring email accepts play with email", async () => {
			const game = await controller.createGame({
				name: "Email OK",
				requireEmail: true,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			const play = await controller.play(game.id, {
				email: "user@test.com",
			});
			expect(play.email).toBe("user@test.com");
		});
	});

	// ── Play Limit Security ──────────────────────────────────────────

	describe("play limit security", () => {
		it("user cannot exceed max plays", async () => {
			const game = await controller.createGame({
				name: "Limited",
				requireEmail: false,
				maxPlaysPerUser: 1,
				cooldownMinutes: 0,
			});
			await controller.play(game.id, { email: "user@test.com" });
			await expect(
				controller.play(game.id, { email: "user@test.com" }),
			).rejects.toThrow("Maximum plays reached");
		});

		it("different users have independent play limits", async () => {
			const game = await controller.createGame({
				name: "Independent",
				requireEmail: false,
				maxPlaysPerUser: 1,
				cooldownMinutes: 0,
			});
			await controller.play(game.id, { email: "user1@test.com" });
			const play = await controller.play(game.id, {
				email: "user2@test.com",
			});
			expect(play.id).toBeDefined();
		});

		it("cooldown prevents rapid replays", async () => {
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
	});

	// ── Prize Integrity ──────────────────────────────────────────────

	describe("prize integrity", () => {
		it("exhausted prize is excluded from winning", async () => {
			const game = await controller.createGame({
				name: "Exhausted",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.addPrize(game.id, {
				name: "Once Only",
				value: "5",
				probability: 100,
				maxWins: 1,
			});
			const first = await controller.play(game.id, {});
			expect(first.result).toBe("win");

			const second = await controller.play(game.id, {});
			expect(second.result).toBe("lose");
		});

		it("disabled prize is not awarded", async () => {
			const game = await controller.createGame({
				name: "Disabled Prize",
				requireEmail: false,
				maxPlaysPerUser: 0,
				cooldownMinutes: 0,
			});
			await controller.addPrize(game.id, {
				name: "Off",
				value: "10",
				probability: 100,
				isActive: false,
			});
			const play = await controller.play(game.id, {});
			expect(play.result).toBe("lose");
		});
	});

	// ── Redemption Safety ────────────────────────────────────────────

	describe("redemption safety", () => {
		it("losing play cannot be redeemed", async () => {
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

		it("already redeemed play cannot be redeemed again", async () => {
			const game = await controller.createGame({
				name: "Redeemed",
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

		it("non-existent play cannot be redeemed", async () => {
			const result = await controller.redeemPrize("fake-id");
			expect(result).toBeNull();
		});
	});

	// ── Date Range Security ──────────────────────────────────────────

	describe("date range security", () => {
		it("future game cannot be played", async () => {
			const game = await controller.createGame({
				name: "Future",
				requireEmail: false,
				startDate: new Date("2099-01-01"),
			});
			await expect(controller.play(game.id, {})).rejects.toThrow(
				"Game has not started yet",
			);
		});

		it("expired game cannot be played", async () => {
			const game = await controller.createGame({
				name: "Expired",
				requireEmail: false,
				endDate: new Date("2000-01-01"),
			});
			await expect(controller.play(game.id, {})).rejects.toThrow(
				"Game has ended",
			);
		});
	});
});
