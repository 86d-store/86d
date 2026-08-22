"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import GamificationAdminTemplate from "./gamification-admin.mdx";

interface Game {
	id: string;
	name: string;
	type: string;
	isActive: boolean;
	totalPlays: number;
	totalWins: number;
	createdAt: string;
}

const PAGE_SIZE = 20;

function formatNumber(n: number): string {
	return new Intl.NumberFormat("en-US").format(n);
}

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "body" in err) {
		const body = (err as { body: { message?: string } }).body;
		return body.message ?? "An error occurred";
	}
	return "An error occurred";
}

const TYPE_LABELS: Record<string, string> = {
	wheel: "Spin the Wheel",
	scratch: "Scratch Card",
	slot: "Slot Machine",
};

const TYPE_COLORS: Record<string, string> = {
	wheel: "bg-purple-50 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
	scratch: "bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
	slot: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

function useGamificationApi() {
	const client = useModuleClient();
	const api = client.module("gamification").admin;
	return {
		listGames: api["/admin/gamification/games"],
		createGame: api["/admin/gamification/games/create"],
		deleteGame: api["/admin/gamification/games/:id/delete"],
		getStats: api["/admin/gamification/games/:id/stats"],
	};
}

export function GamificationAdmin() {
	const api = useGamificationApi();
	const [skip, setSkip] = useState(0);
	const [typeFilter, setTypeFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [newName, setNewName] = useState("");
	const [newType, setNewType] = useState("wheel");
	const [error, setError] = useState("");
	const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

	const queryParams: Record<string, string> = {
		limit: String(PAGE_SIZE),
		page: String(Math.floor(skip / PAGE_SIZE) + 1),
	};
	if (typeFilter) queryParams.type = typeFilter;

	const { data: listData, isLoading } = api.listGames.useQuery(queryParams) as {
		data: { games: Game[]; total: number } | undefined;
		isLoading: boolean;
	};

	const games = listData?.games ?? [];
	const total = listData?.total ?? 0;

	const totalPlays = games.reduce((sum, g) => sum + g.totalPlays, 0);
	const totalWins = games.reduce((sum, g) => sum + g.totalWins, 0);
	const activeCount = games.filter((g) => g.isActive).length;

	const createMutation = api.createGame.useMutation({
		onSettled: () => void api.listGames.invalidate(),
		onError: (err: Error) => setError(extractError(err)),
	});

	const deleteMutation = api.deleteGame.useMutation({
		onSettled: () => {
			setDeleteConfirm(null);
			void api.listGames.invalidate();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const handleCreate = () => {
		if (!newName.trim()) return;
		setError("");
		createMutation.mutate({ name: newName.trim(), type: newType });
		setNewName("");
		setShowCreate(false);
	};

	const handleDelete = (id: string) => {
		setError("");
		deleteMutation.mutate({ params: { id } });
	};

	const typeBadge = (type: string) => (
		<span
			className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${TYPE_COLORS[type] ?? "bg-muted text-muted-foreground"}`}
		>
			{TYPE_LABELS[type] ?? type}
		</span>
	);

	const summaryCards = (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Total Games
				</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{formatNumber(total)}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Active Games
				</p>
				<p className="mt-1 font-semibold text-2xl text-emerald-600 dark:text-emerald-400">
					{formatNumber(activeCount)}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Total Plays
				</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{formatNumber(totalPlays)}
				</p>
			</div>
			<div className="rounded-lg border border-border bg-card p-4">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Total Wins
				</p>
				<p className="mt-1 font-semibold text-2xl text-foreground">
					{formatNumber(totalWins)}
				</p>
			</div>
		</div>
	);

	const tableContent = isLoading ? (
		<div className="animate-pulse px-5 py-3">
			<div className="mb-3 h-8 w-full rounded bg-muted" />
			{(["k0", "k1", "k2", "k3", "k4"] as const).map((key) => (
				<div
					key={key}
					className="flex items-center gap-4 border-border border-t py-3"
				>
					<div className="h-4 w-36 rounded bg-muted" />
					<div className="h-5 w-20 rounded-full bg-muted" />
					<div className="h-5 w-16 rounded-full bg-muted" />
					<div className="h-4 w-12 rounded bg-muted" />
					<div className="ml-auto h-4 w-24 rounded bg-muted" />
				</div>
			))}
		</div>
	) : games.length === 0 ? (
		<div className="px-5 py-8 text-center text-muted-foreground text-sm">
			No games created yet. Create your first game to start engaging customers.
		</div>
	) : (
		<>
			<div className="hidden md:block">
				<table className="w-full text-left text-sm">
					<thead className="border-border border-b bg-muted/50">
						<tr>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Name
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Type
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Status
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Plays
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Wins
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Created
							</th>
							<th
								scope="col"
								className="px-5 py-2.5 font-medium text-muted-foreground"
							>
								Actions
							</th>
						</tr>
					</thead>
					<tbody className="divide-y divide-border">
						{games.map((game) => (
							<tr key={game.id} className="hover:bg-muted/20">
								<td className="px-5 py-3">
									<a
										href={`/admin/gamification/games`}
										className="font-medium text-foreground hover:underline"
									>
										{game.name}
									</a>
								</td>
								<td className="px-5 py-3">{typeBadge(game.type)}</td>
								<td className="px-5 py-3">
									<span
										className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${
											game.isActive
												? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
												: "bg-muted text-muted-foreground"
										}`}
									>
										{game.isActive ? "Active" : "Inactive"}
									</span>
								</td>
								<td className="px-5 py-3 text-muted-foreground">
									{formatNumber(game.totalPlays)}
								</td>
								<td className="px-5 py-3 text-muted-foreground">
									{formatNumber(game.totalWins)}
								</td>
								<td className="px-5 py-3 text-muted-foreground">
									{formatDate(game.createdAt)}
								</td>
								<td className="px-5 py-3">
									{deleteConfirm === game.id ? (
										<span className="space-x-2">
											<button
												type="button"
												onClick={() => handleDelete(game.id)}
												className="font-medium text-destructive text-xs hover:opacity-80"
											>
												Confirm
											</button>
											<button
												type="button"
												onClick={() => setDeleteConfirm(null)}
												className="text-muted-foreground text-xs hover:text-foreground"
											>
												Cancel
											</button>
										</span>
									) : (
										<button
											type="button"
											onClick={() => setDeleteConfirm(game.id)}
											className="text-muted-foreground text-xs hover:text-destructive"
										>
											Delete
										</button>
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>

			<div className="divide-y divide-border md:hidden">
				{games.map((game) => (
					<div key={game.id} className="px-5 py-3">
						<div className="flex items-start justify-between">
							<div>
								<p className="font-medium text-foreground text-sm">
									{game.name}
								</p>
								<div className="mt-1 flex items-center gap-2">
									{typeBadge(game.type)}
									<span
										className={`inline-block rounded-full px-2 py-0.5 font-medium text-xs ${
											game.isActive
												? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
												: "bg-muted text-muted-foreground"
										}`}
									>
										{game.isActive ? "Active" : "Inactive"}
									</span>
								</div>
								<p className="mt-1 text-muted-foreground text-xs">
									{formatNumber(game.totalPlays)} plays &middot;{" "}
									{formatNumber(game.totalWins)} wins
								</p>
							</div>
							{deleteConfirm === game.id ? (
								<span className="space-x-2">
									<button
										type="button"
										onClick={() => handleDelete(game.id)}
										className="font-medium text-destructive text-xs"
									>
										Confirm
									</button>
									<button
										type="button"
										onClick={() => setDeleteConfirm(null)}
										className="text-muted-foreground text-xs"
									>
										Cancel
									</button>
								</span>
							) : (
								<button
									type="button"
									onClick={() => setDeleteConfirm(game.id)}
									className="text-muted-foreground text-xs hover:text-destructive"
								>
									Delete
								</button>
							)}
						</div>
					</div>
				))}
			</div>

			{total > PAGE_SIZE && (
				<div className="flex items-center justify-between border-border border-t px-5 py-3">
					<span className="text-muted-foreground text-sm">
						Showing {skip + 1}&ndash;{Math.min(skip + PAGE_SIZE, total)} of{" "}
						{total}
					</span>
					<span className="space-x-2">
						<button
							type="button"
							onClick={() => setSkip((s) => Math.max(0, s - PAGE_SIZE))}
							disabled={skip === 0}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Previous
						</button>
						<button
							type="button"
							onClick={() => setSkip((s) => s + PAGE_SIZE)}
							disabled={skip + PAGE_SIZE >= total}
							className="rounded border border-border px-2.5 py-1 text-xs hover:bg-muted disabled:opacity-40"
						>
							Next
						</button>
					</span>
				</div>
			)}
		</>
	);

	return (
		<GamificationAdminTemplate
			summaryCards={summaryCards}
			error={error}
			typeFilter={typeFilter}
			onTypeChange={setTypeFilter}
			showCreate={showCreate}
			onToggleCreate={() => setShowCreate((v) => !v)}
			newName={newName}
			onNewNameChange={setNewName}
			newType={newType}
			onNewTypeChange={setNewType}
			onCreate={handleCreate}
			tableContent={tableContent}
		/>
	);
}
