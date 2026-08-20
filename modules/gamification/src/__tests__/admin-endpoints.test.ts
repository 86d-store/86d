import { describe, expect, it, vi } from "vitest";
import { addPrizeEndpoint } from "../admin/endpoints/add-prize";
import { createGameEndpoint } from "../admin/endpoints/create-game";
import { deleteGameEndpoint } from "../admin/endpoints/delete-game";
import { deletePrizeEndpoint } from "../admin/endpoints/delete-prize";
import { gameStatsEndpoint } from "../admin/endpoints/game-stats";
import { getGameAdminEndpoint } from "../admin/endpoints/get-game";
import { listGamesEndpoint } from "../admin/endpoints/list-games";
import { listPrizesEndpoint } from "../admin/endpoints/list-prizes";
import { playHistoryEndpoint } from "../admin/endpoints/play-history";
import { updateGameEndpoint } from "../admin/endpoints/update-game";
import { updatePrizeEndpoint } from "../admin/endpoints/update-prize";
import type {
	Game,
	GameStats,
	GameType,
	GamificationController,
	Play,
	Prize,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeGame(overrides: Partial<Game> = {}): Game {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Spin the Wheel",
		type: "wheel",
		isActive: true,
		requireEmail: false,
		requireNewsletterOptIn: false,
		maxPlaysPerUser: 1,
		cooldownMinutes: 0,
		totalPlays: 0,
		totalWins: 0,
		settings: {},
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makePrize(overrides: Partial<Prize> = {}): Prize {
	return {
		id: crypto.randomUUID(),
		gameId: "game_1",
		name: "10% Off",
		type: "discount-percent",
		value: "10",
		probability: 50,
		maxWins: -1,
		currentWins: 0,
		isActive: true,
		createdAt: new Date(),
		...overrides,
	};
}

function makePlay(overrides: Partial<Play> = {}): Play {
	return {
		id: crypto.randomUUID(),
		gameId: "game_1",
		result: "win",
		isRedeemed: false,
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<GamificationController> = {},
): GamificationController {
	return {
		createGame: vi.fn().mockResolvedValue(makeGame()),
		getGame: vi.fn().mockResolvedValue(null),
		updateGame: vi.fn().mockResolvedValue(null),
		deleteGame: vi.fn().mockResolvedValue(false),
		listGames: vi.fn().mockResolvedValue([]),
		addPrize: vi.fn().mockResolvedValue(makePrize()),
		updatePrize: vi.fn().mockResolvedValue(null),
		removePrize: vi.fn().mockResolvedValue(false),
		listPrizes: vi.fn().mockResolvedValue([]),
		play: vi.fn().mockResolvedValue(makePlay()),
		redeemPrize: vi.fn().mockResolvedValue(null),
		getPlayHistory: vi.fn().mockResolvedValue([]),
		getGameStats: vi.fn().mockResolvedValue({
			totalPlays: 0,
			totalWins: 0,
			winRate: 0,
			prizeBreakdown: [],
		} satisfies GameStats),
		canPlay: vi.fn().mockResolvedValue({ allowed: true }),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: GamificationController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { gamification: opts.controller ?? makeController() },
		},
	});
}

const listGamesHandler = extractHandler(listGamesEndpoint);
const createGameHandler = extractHandler(createGameEndpoint);
const getGameHandler = extractHandler(getGameAdminEndpoint);
const updateGameHandler = extractHandler(updateGameEndpoint);
const deleteGameHandler = extractHandler(deleteGameEndpoint);
const listPrizesHandler = extractHandler(listPrizesEndpoint);
const addPrizeHandler = extractHandler(addPrizeEndpoint);
const updatePrizeHandler = extractHandler(updatePrizeEndpoint);
const deletePrizeHandler = extractHandler(deletePrizeEndpoint);
const playHistoryHandler = extractHandler(playHistoryEndpoint);
const gameStatsHandler = extractHandler(gameStatsEndpoint);

// ── Games ─────────────────────────────────────────────────────────────────────

describe("admin GET /gamification/games", () => {
	it("returns empty list", async () => {
		const result = (await call(listGamesHandler)) as {
			games: Game[];
			total: number;
		};
		expect(result.games).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns games from controller", async () => {
		const games = [makeGame({ name: "Wheel" }), makeGame({ name: "Scratch" })];
		const ctrl = makeController({
			listGames: vi.fn().mockResolvedValue(games),
		});
		const result = (await call(listGamesHandler, { controller: ctrl })) as {
			games: Game[];
			total: number;
		};
		expect(result.games).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards type filter to controller", async () => {
		const ctrl = makeController();
		await call(listGamesHandler, {
			query: { type: "wheel" },
			controller: ctrl,
		});
		expect(ctrl.listGames).toHaveBeenCalledWith(
			expect.objectContaining({ type: "wheel" as GameType }),
		);
	});

	it("forwards isActive filter to controller", async () => {
		const ctrl = makeController();
		await call(listGamesHandler, {
			query: { isActive: "true" },
			controller: ctrl,
		});
		expect(ctrl.listGames).toHaveBeenCalledWith(
			expect.objectContaining({ isActive: true }),
		);
	});
});

describe("admin POST /gamification/games/create", () => {
	it("creates a game and returns it", async () => {
		const game = makeGame({ name: "Lucky Wheel" });
		const ctrl = makeController({
			createGame: vi.fn().mockResolvedValue(game),
		});
		const result = (await call(createGameHandler, {
			body: { name: "Lucky Wheel" },
			controller: ctrl,
		})) as { game: Game };
		expect(result.game.name).toBe("Lucky Wheel");
	});

	it("passes type and isActive to controller", async () => {
		const ctrl = makeController();
		await call(createGameHandler, {
			body: { name: "Scratch Card", type: "scratch", isActive: false },
			controller: ctrl,
		});
		expect(ctrl.createGame).toHaveBeenCalledWith(
			expect.objectContaining({ name: "Scratch Card", type: "scratch" }),
		);
	});
});

describe("admin GET /gamification/games/:id", () => {
	it("returns null game when not found", async () => {
		const result = (await call(getGameHandler, {
			params: { id: "missing" },
		})) as { game: null };
		expect(result.game).toBeNull();
	});

	it("returns game and prizes when found", async () => {
		const game = makeGame({ id: "game_1" });
		const prizes = [makePrize({ gameId: "game_1" })];
		const ctrl = makeController({
			getGame: vi.fn().mockResolvedValue(game),
			listPrizes: vi.fn().mockResolvedValue(prizes),
		});
		const result = (await call(getGameHandler, {
			params: { id: "game_1" },
			controller: ctrl,
		})) as { game: Game; prizes: Prize[] };
		expect(result.game.id).toBe("game_1");
		expect(result.prizes).toHaveLength(1);
	});

	it("calls listPrizes with the game id", async () => {
		const game = makeGame({ id: "game_1" });
		const ctrl = makeController({
			getGame: vi.fn().mockResolvedValue(game),
		});
		await call(getGameHandler, { params: { id: "game_1" }, controller: ctrl });
		expect(ctrl.listPrizes).toHaveBeenCalledWith("game_1");
	});
});

describe("admin PUT /gamification/games/:id/update", () => {
	it("returns null and error when game not found", async () => {
		const result = (await call(updateGameHandler, {
			params: { id: "missing" },
			body: { name: "New Name" },
		})) as { game: null; error: string };
		expect(result.game).toBeNull();
		expect(result.error).toBe("Game not found");
	});

	it("updates game and returns it", async () => {
		const game = makeGame({ name: "Updated Wheel" });
		const ctrl = makeController({
			updateGame: vi.fn().mockResolvedValue(game),
		});
		const result = (await call(updateGameHandler, {
			params: { id: game.id },
			body: { name: "Updated Wheel" },
			controller: ctrl,
		})) as { game: Game };
		expect(result.game.name).toBe("Updated Wheel");
	});

	it("passes isActive field to controller", async () => {
		const game = makeGame({ isActive: false });
		const ctrl = makeController({
			updateGame: vi.fn().mockResolvedValue(game),
		});
		await call(updateGameHandler, {
			params: { id: game.id },
			body: { isActive: false },
			controller: ctrl,
		});
		expect(ctrl.updateGame).toHaveBeenCalledWith(
			game.id,
			expect.objectContaining({ isActive: false }),
		);
	});
});

describe("admin DELETE /gamification/games/:id/delete", () => {
	it("returns deleted=false when not found", async () => {
		const result = (await call(deleteGameHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes game and returns deleted=true", async () => {
		const ctrl = makeController({
			deleteGame: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteGameHandler, {
			params: { id: "game_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── Prizes ────────────────────────────────────────────────────────────────────

describe("admin GET /gamification/games/:id/prizes", () => {
	it("returns empty list when no prizes", async () => {
		const result = (await call(listPrizesHandler, {
			params: { id: "game_1" },
		})) as { prizes: Prize[] };
		expect(result.prizes).toHaveLength(0);
	});

	it("returns prizes for game", async () => {
		const prizes = [
			makePrize({ name: "10% Off" }),
			makePrize({ name: "Free Shipping" }),
		];
		const ctrl = makeController({
			listPrizes: vi.fn().mockResolvedValue(prizes),
		});
		const result = (await call(listPrizesHandler, {
			params: { id: "game_1" },
			controller: ctrl,
		})) as { prizes: Prize[] };
		expect(result.prizes).toHaveLength(2);
	});

	it("calls listPrizes with game id", async () => {
		const ctrl = makeController();
		await call(listPrizesHandler, {
			params: { id: "game_1" },
			controller: ctrl,
		});
		expect(ctrl.listPrizes).toHaveBeenCalledWith("game_1");
	});
});

describe("admin POST /gamification/games/:id/prizes/add", () => {
	it("adds prize and returns it", async () => {
		const prize = makePrize({ name: "Free Product", type: "free-product" });
		const ctrl = makeController({
			addPrize: vi.fn().mockResolvedValue(prize),
		});
		const result = (await call(addPrizeHandler, {
			params: { id: "game_1" },
			body: {
				name: "Free Product",
				type: "free-product",
				value: "prod_1",
				probability: 5,
			},
			controller: ctrl,
		})) as { prize: Prize };
		expect(result.prize.name).toBe("Free Product");
		expect(result.prize.type).toBe("free-product");
	});

	it("calls addPrize with game id", async () => {
		const ctrl = makeController();
		await call(addPrizeHandler, {
			params: { id: "game_1" },
			body: { name: "10% Off", value: "10", probability: 50 },
			controller: ctrl,
		});
		expect(ctrl.addPrize).toHaveBeenCalledWith(
			"game_1",
			expect.objectContaining({ name: "10% Off" }),
		);
	});
});

describe("admin PUT /gamification/prizes/:id/update", () => {
	it("returns null and error when prize not found", async () => {
		const result = (await call(updatePrizeHandler, {
			params: { id: "missing" },
			body: { probability: 10 },
		})) as { prize: null; error: string };
		expect(result.prize).toBeNull();
		expect(result.error).toBe("Prize not found");
	});

	it("updates prize and returns it", async () => {
		const prize = makePrize({ probability: 25 });
		const ctrl = makeController({
			updatePrize: vi.fn().mockResolvedValue(prize),
		});
		const result = (await call(updatePrizeHandler, {
			params: { id: prize.id },
			body: { probability: 25 },
			controller: ctrl,
		})) as { prize: Prize };
		expect(result.prize.probability).toBe(25);
	});
});

describe("admin DELETE /gamification/prizes/:id/delete", () => {
	it("returns deleted=false when prize not found", async () => {
		const result = (await call(deletePrizeHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("removes prize and returns deleted=true", async () => {
		const ctrl = makeController({
			removePrize: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deletePrizeHandler, {
			params: { id: "prize_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── Play history ──────────────────────────────────────────────────────────────

describe("admin GET /gamification/games/:id/plays", () => {
	it("returns empty play history", async () => {
		const result = (await call(playHistoryHandler, {
			params: { id: "game_1" },
		})) as { plays: Play[]; total: number };
		expect(result.plays).toHaveLength(0);
		expect(result.total).toBe(0);
	});

	it("returns play history for game", async () => {
		const plays = [makePlay({ result: "win" }), makePlay({ result: "lose" })];
		const ctrl = makeController({
			getPlayHistory: vi.fn().mockResolvedValue(plays),
		});
		const result = (await call(playHistoryHandler, {
			params: { id: "game_1" },
			controller: ctrl,
		})) as { plays: Play[]; total: number };
		expect(result.plays).toHaveLength(2);
		expect(result.total).toBe(2);
	});

	it("forwards email filter to controller", async () => {
		const ctrl = makeController();
		await call(playHistoryHandler, {
			params: { id: "game_1" },
			query: { email: "alice@example.com" },
			controller: ctrl,
		});
		expect(ctrl.getPlayHistory).toHaveBeenCalledWith(
			expect.objectContaining({ gameId: "game_1", email: "alice@example.com" }),
		);
	});
});

// ── Stats ─────────────────────────────────────────────────────────────────────

describe("admin GET /gamification/games/:id/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(gameStatsHandler, {
			params: { id: "game_1" },
		})) as { stats: GameStats };
		expect(result.stats.totalPlays).toBe(0);
		expect(result.stats.winRate).toBe(0);
		expect(result.stats.prizeBreakdown).toHaveLength(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getGameStats: vi.fn().mockResolvedValue({
				totalPlays: 200,
				totalWins: 80,
				winRate: 40,
				prizeBreakdown: [
					{ prizeId: "prize_1", prizeName: "10% Off", wins: 80 },
				],
			}),
		});
		const result = (await call(gameStatsHandler, {
			params: { id: "game_1" },
			controller: ctrl,
		})) as { stats: GameStats };
		expect(result.stats.totalPlays).toBe(200);
		expect(result.stats.winRate).toBe(40);
		expect(result.stats.prizeBreakdown).toHaveLength(1);
	});

	it("calls getGameStats with game id", async () => {
		const ctrl = makeController();
		await call(gameStatsHandler, {
			params: { id: "game_1" },
			controller: ctrl,
		});
		expect(ctrl.getGameStats).toHaveBeenCalledWith("game_1");
	});
});
