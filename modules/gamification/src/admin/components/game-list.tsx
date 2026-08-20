"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import GameListTemplate from "./game-list.mdx";

interface Game {
	id: string;
	name: string;
	description: string;
	type: string;
	isActive: boolean;
	requireEmail: boolean;
	requireNewsletterOptIn: boolean;
	maxPlaysPerUser: number;
	cooldownMinutes: number;
	startDate?: string;
	endDate?: string;
	totalPlays: number;
	totalWins: number;
	createdAt: string;
}

interface Prize {
	id: string;
	gameId: string;
	name: string;
	description: string;
	type: string;
	value: string;
	probability: number;
	maxWins: number;
	currentWins: number;
	isActive: boolean;
}

interface GameStats {
	totalPlays: number;
	totalWins: number;
	winRate: number;
	prizeBreakdown: Array<{
		prizeId: string;
		prizeName: string;
		wins: number;
	}>;
}

const PRIZE_TYPE_LABELS: Record<string, string> = {
	"discount-percent": "% Discount",
	"discount-fixed": "Fixed Discount",
	"free-shipping": "Free Shipping",
	"free-product": "Free Product",
	custom: "Custom",
};

function formatNumber(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "body" in err) {
		const body = (err as { body: { message?: string } }).body;
		return body?.message ?? "An error occurred";
	}
	return "An error occurred";
}

function useGamificationApi() {
	const client = useModuleClient();
	const api = client.module("gamification").admin;
	return {
		listGames: api["/admin/gamification/games"],
		getGame: api["/admin/gamification/games/:id"],
		updateGame: api["/admin/gamification/games/:id/update"],
		deleteGame: api["/admin/gamification/games/:id/delete"],
		listPrizes: api["/admin/gamification/games/:id/prizes"],
		addPrize: api["/admin/gamification/games/:id/prizes/add"],
		updatePrize: api["/admin/gamification/prizes/:id/update"],
		deletePrize: api["/admin/gamification/prizes/:id/delete"],
		getStats: api["/admin/gamification/games/:id/stats"],
	};
}

export function GameList() {
	const api = useGamificationApi();
	const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [showAddPrize, setShowAddPrize] = useState(false);
	const [prizeName, setPrizeName] = useState("");
	const [prizeType, setPrizeType] = useState("discount-percent");
	const [prizeValue, setPrizeValue] = useState("");
	const [prizeProbability, setPrizeProbability] = useState("10");

	const { data: gamesData, isLoading: gamesLoading } = api.listGames.useQuery({
		limit: "100",
	}) as {
		data: { games: Game[]; total: number } | undefined;
		isLoading: boolean;
	};

	const games = gamesData?.games ?? [];

	const { data: gameDetail } = api.getGame.useQuery(
		selectedGameId ? { params: { id: selectedGameId } } : null,
	) as { data: { game: Game | null; prizes: Prize[] } | undefined };

	const { data: statsData } = api.getStats.useQuery(
		selectedGameId ? { params: { id: selectedGameId } } : null,
	) as { data: { stats: GameStats } | undefined };

	const selectedGame = gameDetail?.game ?? null;
	const prizes = gameDetail?.prizes ?? [];
	const stats = statsData?.stats ?? null;

	const addPrizeMutation = api.addPrize.useMutation({
		onSettled: () => {
			void api.getGame.invalidate();
			void api.getStats.invalidate();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const deletePrizeMutation = api.deletePrize.useMutation({
		onSettled: () => {
			void api.getGame.invalidate();
			void api.getStats.invalidate();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const toggleActiveMutation = api.updateGame.useMutation({
		onSettled: () => {
			void api.listGames.invalidate();
			void api.getGame.invalidate();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const handleAddPrize = () => {
		if (!selectedGameId || !prizeName.trim() || !prizeValue.trim()) return;
		setError("");
		addPrizeMutation.mutate({
			params: { id: selectedGameId },
			name: prizeName.trim(),
			type: prizeType,
			value: prizeValue.trim(),
			probability: Number(prizeProbability),
		});
		setPrizeName("");
		setPrizeValue("");
		setPrizeProbability("10");
		setShowAddPrize(false);
	};

	const handleDeletePrize = (prizeId: string) => {
		setError("");
		deletePrizeMutation.mutate({ params: { id: prizeId } });
	};

	const handleToggleActive = (game: Game) => {
		setError("");
		toggleActiveMutation.mutate({
			params: { id: game.id },
			isActive: !game.isActive,
		});
	};

	const gameListContent = gamesLoading ? (
		<div className="animate-pulse divide-y divide-border">
			{Array.from({ length: 4 }).map((_, i) => (
				<div key={i} className="flex items-center justify-between px-5 py-3">
					<div>
						<div className="h-4 w-36 rounded bg-muted" />
						<div className="mt-1.5 h-3 w-48 rounded bg-muted" />
					</div>
					<div className="h-5 w-16 rounded-full bg-muted" />
				</div>
			))}
		</div>
	) : games.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No games found. Create a game from the Gamification dashboard.
		</div>
	) : (
		<div className="divide-y divide-border">
			{games.map((game) => (
				<button
					key={game.id}
					type="button"
					onClick={() => setSelectedGameId(game.id)}
					className={`flex w-full items-center justify-between px-5 py-3 text-left hover:bg-muted/20 ${selectedGameId === game.id ? "bg-muted/30" : ""}`}
				>
					<div>
						<p className="font-medium text-foreground text-sm">{game.name}</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							{game.type} &middot; {formatNumber(game.totalPlays)} plays
							&middot; {formatNumber(game.totalWins)} wins
						</p>
					</div>
					<span
						className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${
							game.isActive
								? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
								: "bg-muted text-muted-foreground"
						}`}
					>
						{game.isActive ? "Active" : "Inactive"}
					</span>
				</button>
			))}
		</div>
	);

	const detailContent = selectedGame ? (
		<div className="space-y-5">
			<div className="flex items-center justify-between">
				<div>
					<h3 className="font-semibold text-foreground text-lg">
						{selectedGame.name}
					</h3>
					{selectedGame.description && (
						<p className="mt-0.5 text-muted-foreground text-sm">
							{selectedGame.description}
						</p>
					)}
				</div>
				<button
					type="button"
					onClick={() => handleToggleActive(selectedGame)}
					className={`rounded px-3 py-1 font-medium text-xs ${
						selectedGame.isActive
							? "bg-muted text-muted-foreground hover:bg-muted"
							: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900 dark:text-emerald-300"
					}`}
				>
					{selectedGame.isActive ? "Deactivate" : "Activate"}
				</button>
			</div>

			{stats && (
				<div className="grid grid-cols-3 gap-3">
					<div className="rounded-lg border border-border p-3">
						<p className="text-muted-foreground text-xs">Total Plays</p>
						<p className="font-semibold text-foreground text-lg">
							{formatNumber(stats.totalPlays)}
						</p>
					</div>
					<div className="rounded-lg border border-border p-3">
						<p className="text-muted-foreground text-xs">Total Wins</p>
						<p className="font-semibold text-foreground text-lg">
							{formatNumber(stats.totalWins)}
						</p>
					</div>
					<div className="rounded-lg border border-border p-3">
						<p className="text-muted-foreground text-xs">Win Rate</p>
						<p className="font-semibold text-foreground text-lg">
							{(stats.winRate * 100).toFixed(1)}%
						</p>
					</div>
				</div>
			)}

			<div className="rounded-lg border border-border">
				<div className="flex items-center justify-between border-border border-b px-4 py-2.5">
					<h4 className="font-medium text-foreground text-sm">Prizes</h4>
					<button
						type="button"
						onClick={() => setShowAddPrize((v) => !v)}
						className="rounded bg-foreground px-2.5 py-1 font-medium text-background text-xs hover:opacity-90"
					>
						{showAddPrize ? "Cancel" : "Add Prize"}
					</button>
				</div>

				{showAddPrize && (
					<div className="border-border border-b px-4 py-3">
						<div className="grid grid-cols-2 gap-3">
							<div>
								<label
									htmlFor="prize-name"
									className="mb-1 block text-muted-foreground text-xs"
								>
									Name
								</label>
								<input
									id="prize-name"
									type="text"
									value={prizeName}
									onChange={(e) => setPrizeName(e.target.value)}
									className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm"
									placeholder="e.g. 20% Off"
								/>
							</div>
							<div>
								<label
									htmlFor="prize-type"
									className="mb-1 block text-muted-foreground text-xs"
								>
									Type
								</label>
								<select
									id="prize-type"
									value={prizeType}
									onChange={(e) => setPrizeType(e.target.value)}
									className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm"
								>
									<option value="discount-percent">% Discount</option>
									<option value="discount-fixed">Fixed Discount</option>
									<option value="free-shipping">Free Shipping</option>
									<option value="free-product">Free Product</option>
									<option value="custom">Custom</option>
								</select>
							</div>
							<div>
								<label
									htmlFor="prize-value"
									className="mb-1 block text-muted-foreground text-xs"
								>
									Value
								</label>
								<input
									id="prize-value"
									type="text"
									value={prizeValue}
									onChange={(e) => setPrizeValue(e.target.value)}
									className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm"
									placeholder="e.g. 20"
								/>
							</div>
							<div>
								<label
									htmlFor="prize-probability"
									className="mb-1 block text-muted-foreground text-xs"
								>
									Probability (%)
								</label>
								<input
									id="prize-probability"
									type="number"
									min="0"
									max="100"
									value={prizeProbability}
									onChange={(e) => setPrizeProbability(e.target.value)}
									className="w-full rounded border border-border bg-background px-2.5 py-1.5 text-sm"
								/>
							</div>
						</div>
						<button
							type="button"
							onClick={handleAddPrize}
							className="mt-3 rounded bg-foreground px-3 py-1.5 font-medium text-background text-xs hover:opacity-90"
						>
							Add Prize
						</button>
					</div>
				)}

				{prizes.length === 0 ? (
					<div className="px-4 py-6 text-center text-muted-foreground text-sm">
						No prizes configured. Add prizes to define what customers can win.
					</div>
				) : (
					<div className="divide-y divide-border">
						{prizes.map((prize) => (
							<div
								key={prize.id}
								className="flex items-center justify-between px-4 py-2.5"
							>
								<div>
									<p className="font-medium text-foreground text-sm">
										{prize.name}
									</p>
									<p className="text-muted-foreground text-xs">
										{PRIZE_TYPE_LABELS[prize.type] ?? prize.type}: {prize.value}{" "}
										&middot; {prize.probability}% chance &middot;{" "}
										{prize.currentWins}/
										{prize.maxWins === -1 ? "∞" : prize.maxWins} wins
									</p>
								</div>
								<button
									type="button"
									onClick={() => handleDeletePrize(prize.id)}
									className="text-muted-foreground text-xs hover:text-destructive"
								>
									Remove
								</button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	) : (
		<div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
			Select a game to view its details and prizes.
		</div>
	);

	return (
		<GameListTemplate
			error={error}
			gameListContent={gameListContent}
			detailContent={detailContent}
		/>
	);
}
