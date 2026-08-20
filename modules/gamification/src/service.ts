import type { ModuleController } from "@86d-app/core/types/module";

export type GameType = "wheel" | "scratch" | "slot";

export type PrizeType =
	| "discount-percent"
	| "discount-fixed"
	| "free-shipping"
	| "free-product"
	| "custom";

export type Game = {
	id: string;
	name: string;
	description?: string | undefined;
	type: GameType;
	isActive: boolean;
	requireEmail: boolean;
	requireNewsletterOptIn: boolean;
	maxPlaysPerUser: number;
	cooldownMinutes: number;
	totalPlays: number;
	totalWins: number;
	startDate?: Date | undefined;
	endDate?: Date | undefined;
	settings: Record<string, unknown>;
	createdAt: Date;
	updatedAt: Date;
};

export type Prize = {
	id: string;
	gameId: string;
	name: string;
	description?: string | undefined;
	type: PrizeType;
	value: string;
	probability: number;
	maxWins: number;
	currentWins: number;
	discountCode?: string | undefined;
	productId?: string | undefined;
	isActive: boolean;
	createdAt: Date;
};

export type Play = {
	id: string;
	gameId: string;
	email?: string | undefined;
	customerId?: string | undefined;
	result: "win" | "lose";
	prizeId?: string | undefined;
	prizeName?: string | undefined;
	prizeValue?: string | undefined;
	isRedeemed: boolean;
	redeemedAt?: Date | undefined;
	ipAddress?: string | undefined;
	userAgent?: string | undefined;
	createdAt: Date;
};

export type GameStats = {
	totalPlays: number;
	totalWins: number;
	winRate: number;
	prizeBreakdown: Array<{
		prizeId: string;
		prizeName: string;
		wins: number;
	}>;
};

export type CanPlayResult = {
	allowed: boolean;
	reason?: string | undefined;
	nextPlayAt?: Date | undefined;
};

export type GamificationController = ModuleController & {
	createGame(params: {
		name: string;
		description?: string | undefined;
		type?: GameType | undefined;
		isActive?: boolean | undefined;
		requireEmail?: boolean | undefined;
		requireNewsletterOptIn?: boolean | undefined;
		maxPlaysPerUser?: number | undefined;
		cooldownMinutes?: number | undefined;
		startDate?: Date | undefined;
		endDate?: Date | undefined;
		settings?: Record<string, unknown> | undefined;
	}): Promise<Game>;

	getGame(id: string): Promise<Game | null>;

	updateGame(
		id: string,
		params: {
			name?: string | undefined;
			description?: string | undefined;
			type?: GameType | undefined;
			isActive?: boolean | undefined;
			requireEmail?: boolean | undefined;
			requireNewsletterOptIn?: boolean | undefined;
			maxPlaysPerUser?: number | undefined;
			cooldownMinutes?: number | undefined;
			startDate?: Date | undefined;
			endDate?: Date | undefined;
			settings?: Record<string, unknown> | undefined;
		},
	): Promise<Game | null>;

	deleteGame(id: string): Promise<boolean>;

	listGames(params?: {
		type?: GameType | undefined;
		isActive?: boolean | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Game[]>;

	addPrize(
		gameId: string,
		params: {
			name: string;
			description?: string | undefined;
			type?: PrizeType | undefined;
			value: string;
			probability: number;
			maxWins?: number | undefined;
			discountCode?: string | undefined;
			productId?: string | undefined;
			isActive?: boolean | undefined;
		},
	): Promise<Prize>;

	updatePrize(
		id: string,
		params: {
			name?: string | undefined;
			description?: string | undefined;
			type?: PrizeType | undefined;
			value?: string | undefined;
			probability?: number | undefined;
			maxWins?: number | undefined;
			discountCode?: string | undefined;
			productId?: string | undefined;
			isActive?: boolean | undefined;
		},
	): Promise<Prize | null>;

	removePrize(id: string): Promise<boolean>;

	listPrizes(gameId: string): Promise<Prize[]>;

	play(
		gameId: string,
		params: {
			email?: string | undefined;
			customerId?: string | undefined;
			ipAddress?: string | undefined;
			userAgent?: string | undefined;
		},
	): Promise<Play>;

	redeemPrize(playId: string): Promise<Play | null>;

	getPlayHistory(params?: {
		gameId?: string | undefined;
		email?: string | undefined;
		customerId?: string | undefined;
		take?: number | undefined;
		skip?: number | undefined;
	}): Promise<Play[]>;

	getGameStats(gameId: string): Promise<GameStats>;

	canPlay(
		gameId: string,
		params: {
			email?: string | undefined;
			customerId?: string | undefined;
			ipAddress?: string | undefined;
		},
	): Promise<CanPlayResult>;
};
