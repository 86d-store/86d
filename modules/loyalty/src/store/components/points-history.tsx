"use client";

import { useState } from "react";
import { useLoyaltyApi } from "./_hooks";
import { formatDate, formatPoints } from "./_utils";
import PointsHistoryTemplate from "./points-history.mdx";

type TransactionType = "earn" | "redeem" | "adjust" | "expire";

interface Transaction {
	id: string;
	accountId: string;
	type: TransactionType;
	points: number;
	description: string;
	orderId?: string | undefined;
	createdAt: string;
}

const TYPE_LABELS: Record<TransactionType, { label: string; color: string }> = {
	earn: {
		label: "Earned",
		color: "text-green-600 dark:text-green-400",
	},
	redeem: {
		label: "Redeemed",
		color: "text-blue-600 dark:text-blue-400",
	},
	adjust: {
		label: "Adjusted",
		color: "text-amber-600 dark:text-amber-400",
	},
	expire: {
		label: "Expired",
		color: "text-red-600 dark:text-red-400",
	},
};

export function PointsHistory({ limit = 10 }: { limit?: number | undefined }) {
	const api = useLoyaltyApi();
	const [filter, setFilter] = useState<TransactionType | "all">("all");

	const queryParams: Record<string, string | number> = { take: limit };
	if (filter !== "all") {
		queryParams.type = filter;
	}

	const { data, isLoading: loading } = api.listTransactions.useQuery(
		queryParams,
	) as {
		data:
			| { transactions: Transaction[]; total: number }
			| { error: string; status: number }
			| undefined;
		isLoading: boolean;
	};

	const isUnauthenticated =
		!loading && (data as { status?: number } | undefined)?.status === 401;

	if (isUnauthenticated) {
		return (
			<div className="rounded-xl border border-gray-200 bg-white p-6 text-center dark:border-gray-800">
				<p className="text-muted-foreground text-sm">
					Sign in to view your points history.
				</p>
			</div>
		);
	}

	if (loading) {
		return (
			<div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800">
				<div className="animate-pulse space-y-3">
					{Array.from({ length: 3 }, (_, i) => (
						<div key={i} className="flex justify-between">
							<div className="h-4 w-40 rounded bg-muted dark:bg-muted" />
							<div className="h-4 w-16 rounded bg-muted dark:bg-muted" />
						</div>
					))}
				</div>
			</div>
		);
	}

	const successData = data as
		| { transactions: Transaction[]; total: number }
		| undefined;
	const transactions = successData?.transactions ?? [];

	const filters = (
		<div className="flex gap-1">
			{(["all", "earn", "redeem", "adjust", "expire"] as const).map((type) => (
				<button
					key={type}
					type="button"
					onClick={() => setFilter(type)}
					className={`rounded-md px-2.5 py-1 font-medium text-xs capitalize transition-colors ${
						filter === type
							? "bg-background text-white dark:bg-muted"
							: "text-muted-foreground hover:bg-muted dark:hover:bg-muted"
					}`}
				>
					{type}
				</button>
			))}
		</div>
	);

	const rows =
		transactions.length === 0 ? (
			<tr>
				<td
					colSpan={4}
					className="px-4 py-8 text-center text-muted-foreground text-sm"
				>
					No transactions found.
				</td>
			</tr>
		) : (
			transactions.map((tx) => {
				const typeInfo = TYPE_LABELS[tx.type];
				const sign =
					tx.type === "earn"
						? "+"
						: tx.type === "redeem" || tx.type === "expire"
							? "\u2212"
							: "";
				return (
					<tr
						key={tx.id}
						className="border-gray-100 border-t dark:border-gray-800"
					>
						<td className="px-4 py-3">
							<span
								className={`inline-flex rounded-full px-2 py-0.5 font-medium text-xs ${typeInfo.color}`}
							>
								{typeInfo.label}
							</span>
						</td>
						<td className="px-4 py-3 text-foreground/80 text-sm">
							{tx.description}
						</td>
						<td className="px-4 py-3 text-right font-medium text-sm tabular-nums">
							<span className={typeInfo.color}>
								{sign}
								{formatPoints(Math.abs(tx.points))}
							</span>
						</td>
						<td className="px-4 py-3 text-right text-muted-foreground text-xs">
							{formatDate(tx.createdAt)}
						</td>
					</tr>
				);
			})
		);

	return <PointsHistoryTemplate filters={filters} rows={rows} />;
}
