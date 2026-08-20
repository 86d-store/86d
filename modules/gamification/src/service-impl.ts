import type { ScopedEventEmitter } from "@86d-app/core/events";
import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Game,
	GameType,
	GamificationController,
	Play,
	Prize,
	PrizeType,
} from "./service";

export function createGamificationController(
	data: ModuleDataService,
	events?: ScopedEventEmitter | undefined,
): GamificationController {
	/** Find plays matching an identifier for a specific game. */
	async function findPlaysForIdentifier(
		gameId: string,
		params: {
			email?: string | undefined;
			customerId?: string | undefined;
			ipAddress?: string | undefined;
		},
	): Promise<Play[]> {
		const allPlays = await data.findMany("play", {
			where: { gameId },
		});
		const plays = allPlays as unknown as Play[];

		return plays.filter((p) => {
			if (params.email && p.email === params.email) return true;
			if (params.customerId && p.customerId === params.customerId) return true;
			if (params.ipAddress && p.ipAddress === params.ipAddress) return true;
			return false;
		});
	}

	return {
		// ── Game CRUD ─────────────────────────────────────────────────────

		async createGame(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const game: Game = {
				id,
				name: params.name,
				description: params.description,
				type: (params.type ?? "wheel") as GameType,
				isActive: params.isActive ?? true,
				requireEmail: params.requireEmail ?? true,
				requireNewsletterOptIn: params.requireNewsletterOptIn ?? false,
				maxPlaysPerUser: params.maxPlaysPerUser ?? 1,
				cooldownMinutes: params.cooldownMinutes ?? 1440,
				totalPlays: 0,
				totalWins: 0,
				startDate: params.startDate,
				endDate: params.endDate,
				settings: params.settings ?? {},
				createdAt: now,
				updatedAt: now,
			};
			await data.upsert("game", id, game as Record<string, unknown>);
			void events?.emit("game.created", { gameId: id, name: game.name });
			return game;
		},

		async getGame(id) {
			const raw = await data.get("game", id);
			if (!raw) return null;
			return raw as unknown as Game;
		},

		async updateGame(id, params) {
			const existing = await data.get("game", id);
			if (!existing) return null;

			const game = existing as unknown as Game;
			const updated: Game = {
				...game,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.description !== undefined
					? { description: params.description }
					: {}),
				...(params.type !== undefined ? { type: params.type } : {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
				...(params.requireEmail !== undefined
					? { requireEmail: params.requireEmail }
					: {}),
				...(params.requireNewsletterOptIn !== undefined
					? { requireNewsletterOptIn: params.requireNewsletterOptIn }
					: {}),
				...(params.maxPlaysPerUser !== undefined
					? { maxPlaysPerUser: params.maxPlaysPerUser }
					: {}),
				...(params.cooldownMinutes !== undefined
					? { cooldownMinutes: params.cooldownMinutes }
					: {}),
				...(params.startDate !== undefined
					? { startDate: params.startDate }
					: {}),
				...(params.endDate !== undefined ? { endDate: params.endDate } : {}),
				...(params.settings !== undefined ? { settings: params.settings } : {}),
				updatedAt: new Date(),
			};
			await data.upsert("game", id, updated as Record<string, unknown>);
			void events?.emit("game.updated", { gameId: id, name: updated.name });
			return updated;
		},

		async deleteGame(id) {
			const existing = await data.get("game", id);
			if (!existing) return false;
			await data.delete("game", id);
			void events?.emit("game.deleted", { gameId: id });
			return true;
		},

		async listGames(params) {
			const where: Record<string, unknown> = {};
			if (params?.isActive !== undefined) where.isActive = params.isActive;

			const all = await data.findMany("game", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			let games = all as unknown as Game[];

			// Type filtering must remain client-side
			if (params?.type) {
				const t = params.type;
				games = games.filter((g) => g.type === t);
			}
			return games;
		},

		// ── Prize CRUD ────────────────────────────────────────────────────

		async addPrize(gameId, params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const prize: Prize = {
				id,
				gameId,
				name: params.name,
				description: params.description,
				type: (params.type ?? "discount-percent") as PrizeType,
				value: params.value,
				probability: params.probability,
				maxWins: params.maxWins ?? -1,
				currentWins: 0,
				discountCode: params.discountCode,
				productId: params.productId,
				isActive: params.isActive ?? true,
				createdAt: now,
			};
			await data.upsert("prize", id, prize as Record<string, unknown>);
			return prize;
		},

		async updatePrize(id, params) {
			const existing = await data.get("prize", id);
			if (!existing) return null;

			const prize = existing as unknown as Prize;
			const updated: Prize = {
				...prize,
				...(params.name !== undefined ? { name: params.name } : {}),
				...(params.description !== undefined
					? { description: params.description }
					: {}),
				...(params.type !== undefined ? { type: params.type } : {}),
				...(params.value !== undefined ? { value: params.value } : {}),
				...(params.probability !== undefined
					? { probability: params.probability }
					: {}),
				...(params.maxWins !== undefined ? { maxWins: params.maxWins } : {}),
				...(params.discountCode !== undefined
					? { discountCode: params.discountCode }
					: {}),
				...(params.productId !== undefined
					? { productId: params.productId }
					: {}),
				...(params.isActive !== undefined ? { isActive: params.isActive } : {}),
			};
			await data.upsert("prize", id, updated as Record<string, unknown>);
			return updated;
		},

		async removePrize(id) {
			const existing = await data.get("prize", id);
			if (!existing) return false;
			await data.delete("prize", id);
			return true;
		},

		async listPrizes(gameId) {
			const all = await data.findMany("prize", {
				where: { gameId },
			});
			return all as unknown as Prize[];
		},

		// ── Play Logic ────────────────────────────────────────────────────

		async play(gameId, params) {
			const gameRaw = await data.get("game", gameId);
			if (!gameRaw) throw new Error("Game not found");
			const game = gameRaw as unknown as Game;

			// Check active
			if (!game.isActive) throw new Error("Game is not active");

			// Check date range
			const now = new Date();
			if (game.startDate && now < game.startDate) {
				throw new Error("Game has not started yet");
			}
			if (game.endDate && now > game.endDate) {
				throw new Error("Game has ended");
			}

			// Check email requirement
			if (game.requireEmail && !params.email) {
				throw new Error("Email is required to play");
			}

			// Check cooldown and max plays
			const identifier = {
				email: params.email,
				customerId: params.customerId,
				ipAddress: params.ipAddress,
			};
			const hasIdentifier =
				identifier.email || identifier.customerId || identifier.ipAddress;

			if (hasIdentifier) {
				const userPlays = await findPlaysForIdentifier(gameId, identifier);

				// Max plays check
				if (
					game.maxPlaysPerUser > 0 &&
					userPlays.length >= game.maxPlaysPerUser
				) {
					throw new Error("Maximum plays reached");
				}

				// Cooldown check
				if (game.cooldownMinutes > 0 && userPlays.length > 0) {
					const lastPlay = userPlays.reduce((latest, p) =>
						p.createdAt > latest.createdAt ? p : latest,
					);
					const cooldownMs = game.cooldownMinutes * 60 * 1000;
					const elapsed = now.getTime() - lastPlay.createdAt.getTime();
					if (elapsed < cooldownMs) {
						throw new Error("Cooldown period has not elapsed");
					}
				}
			}

			// Select prize based on probability weights
			const allPrizes = await data.findMany("prize", {
				where: { gameId },
			});
			const prizes = (allPrizes as unknown as Prize[]).filter((p) => {
				if (!p.isActive) return false;
				if (p.maxWins !== -1 && p.currentWins >= p.maxWins) return false;
				return true;
			});

			let selectedPrize: Prize | null = null;

			if (prizes.length > 0) {
				// Calculate total probability weight
				const totalWeight = prizes.reduce((sum, p) => sum + p.probability, 0);

				if (totalWeight > 0) {
					const roll = Math.random() * 100;
					let cumulative = 0;

					for (const prize of prizes) {
						cumulative += prize.probability;
						if (roll < cumulative) {
							selectedPrize = prize;
							break;
						}
					}
				}
			}

			const playId = crypto.randomUUID();
			const result: "win" | "lose" = selectedPrize ? "win" : "lose";
			const play: Play = {
				id: playId,
				gameId,
				email: params.email,
				customerId: params.customerId,
				result,
				prizeId: selectedPrize?.id,
				prizeName: selectedPrize?.name,
				prizeValue: selectedPrize?.value,
				isRedeemed: false,
				ipAddress: params.ipAddress,
				userAgent: params.userAgent,
				createdAt: now,
			};
			await data.upsert("play", playId, play as Record<string, unknown>);

			// Update prize currentWins
			if (selectedPrize) {
				const updatedPrize: Prize = {
					...selectedPrize,
					currentWins: selectedPrize.currentWins + 1,
				};
				await data.upsert(
					"prize",
					selectedPrize.id,
					updatedPrize as Record<string, unknown>,
				);
			}

			// Update game counters
			const updatedGame: Game = {
				...game,
				totalPlays: game.totalPlays + 1,
				totalWins: result === "win" ? game.totalWins + 1 : game.totalWins,
				updatedAt: now,
			};
			await data.upsert("game", gameId, updatedGame as Record<string, unknown>);

			// Emit events
			if (result === "win") {
				void events?.emit("game.won", {
					playId,
					gameId,
					prizeId: selectedPrize?.id,
					prizeName: selectedPrize?.name,
					email: params.email,
				});
			} else {
				void events?.emit("game.lost", {
					playId,
					gameId,
					email: params.email,
				});
			}
			void events?.emit("game.played", {
				playId,
				gameId,
				result,
				email: params.email,
			});

			return play;
		},

		async redeemPrize(playId) {
			const existing = await data.get("play", playId);
			if (!existing) return null;

			const play = existing as unknown as Play;
			if (play.result !== "win") return null;
			if (play.isRedeemed) return null;

			const now = new Date();
			const updated: Play = {
				...play,
				isRedeemed: true,
				redeemedAt: now,
			};
			await data.upsert("play", playId, updated as Record<string, unknown>);
			void events?.emit("prize.redeemed", {
				playId,
				gameId: play.gameId,
				prizeId: play.prizeId,
				email: play.email,
			});
			return updated;
		},

		async getPlayHistory(params) {
			const where: Record<string, unknown> = {};
			if (params?.gameId) where.gameId = params.gameId;

			const all = await data.findMany("play", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			let plays = all as unknown as Play[];

			// Email/customerId filtering client-side
			if (params?.email) {
				const email = params.email;
				plays = plays.filter((p) => p.email === email);
			}
			if (params?.customerId) {
				const cid = params.customerId;
				plays = plays.filter((p) => p.customerId === cid);
			}
			return plays;
		},

		async getGameStats(gameId) {
			const gameRaw = await data.get("game", gameId);
			if (!gameRaw) {
				return { totalPlays: 0, totalWins: 0, winRate: 0, prizeBreakdown: [] };
			}
			const game = gameRaw as unknown as Game;

			const allPlays = await data.findMany("play", {
				where: { gameId },
			});
			const plays = allPlays as unknown as Play[];

			const wins = plays.filter((p) => p.result === "win");
			const breakdownMap = new Map<
				string,
				{ prizeId: string; prizeName: string; wins: number }
			>();
			for (const w of wins) {
				if (w.prizeId) {
					const existing = breakdownMap.get(w.prizeId);
					if (existing) {
						existing.wins++;
					} else {
						breakdownMap.set(w.prizeId, {
							prizeId: w.prizeId,
							prizeName: w.prizeName ?? "Unknown",
							wins: 1,
						});
					}
				}
			}

			return {
				totalPlays: game.totalPlays,
				totalWins: game.totalWins,
				winRate: game.totalPlays > 0 ? game.totalWins / game.totalPlays : 0,
				prizeBreakdown: Array.from(breakdownMap.values()),
			};
		},

		async canPlay(gameId, params) {
			const gameRaw = await data.get("game", gameId);
			if (!gameRaw) return { allowed: false, reason: "Game not found" };
			const game = gameRaw as unknown as Game;

			if (!game.isActive)
				return { allowed: false, reason: "Game is not active" };

			const now = new Date();
			if (game.startDate && now < game.startDate) {
				return { allowed: false, reason: "Game has not started yet" };
			}
			if (game.endDate && now > game.endDate) {
				return { allowed: false, reason: "Game has ended" };
			}

			if (game.requireEmail && !params.email) {
				return { allowed: false, reason: "Email is required to play" };
			}

			const hasIdentifier =
				params.email || params.customerId || params.ipAddress;
			if (!hasIdentifier) return { allowed: true };

			const userPlays = await findPlaysForIdentifier(gameId, params);

			if (
				game.maxPlaysPerUser > 0 &&
				userPlays.length >= game.maxPlaysPerUser
			) {
				return { allowed: false, reason: "Maximum plays reached" };
			}

			if (game.cooldownMinutes > 0 && userPlays.length > 0) {
				const lastPlay = userPlays.reduce((latest, p) =>
					p.createdAt > latest.createdAt ? p : latest,
				);
				const cooldownMs = game.cooldownMinutes * 60 * 1000;
				const elapsed = now.getTime() - lastPlay.createdAt.getTime();
				if (elapsed < cooldownMs) {
					const nextPlayAt = new Date(
						lastPlay.createdAt.getTime() + cooldownMs,
					);
					return {
						allowed: false,
						reason: "Cooldown period has not elapsed",
						nextPlayAt,
					};
				}
			}

			return { allowed: true };
		},
	};
}
