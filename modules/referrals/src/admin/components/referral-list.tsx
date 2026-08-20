"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import ReferralListTemplate from "./referral-list.mdx";

interface ReferralItem {
	id: string;
	referrerCustomerId: string;
	refereeCustomerId: string;
	refereeEmail: string;
	status: string;
	referrerRewarded: boolean;
	refereeRewarded: boolean;
	completedAt?: string | null;
	createdAt: string;
}

interface ReferralStats {
	totalCodes: number;
	totalReferrals: number;
	completedReferrals: number;
	pendingReferrals: number;
	conversionRate: number;
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

const STATUS_COLORS: Record<string, string> = {
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	completed:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	expired: "bg-muted text-muted-foreground",
	revoked: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function useReferralsAdminApi() {
	const client = useModuleClient();
	return {
		list: client.module("referrals").admin["/admin/referrals"],
		stats: client.module("referrals").admin["/admin/referrals/stats"],
		complete: client.module("referrals").admin["/admin/referrals/:id/complete"],
		revoke: client.module("referrals").admin["/admin/referrals/:id/revoke"],
	};
}

export function ReferralList() {
	const api = useReferralsAdminApi();
	const [statusFilter, setStatusFilter] = useState("");
	const [page, setPage] = useState(1);

	const queryInput = {
		page,
		limit: 25,
		...(statusFilter ? { status: statusFilter } : {}),
	};

	const {
		data,
		isLoading: loading,
		isError: referralsError,
		refetch: refetchReferrals,
	} = api.list.useQuery(queryInput) as {
		data: { referrals: ReferralItem[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats: ReferralStats } | undefined;
	};

	const completeMutation = api.complete.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.stats.invalidate();
		},
	});

	const revokeMutation = api.revoke.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.stats.invalidate();
		},
	});

	if (referralsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load referrals
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchReferrals()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const referrals = data?.referrals ?? [];
	const stats = statsData?.stats;

	return (
		<ReferralListTemplate
			referrals={referrals}
			stats={stats}
			loading={loading}
			statusFilter={statusFilter}
			onStatusFilterChange={setStatusFilter}
			page={page}
			onPageChange={setPage}
			statusColors={STATUS_COLORS}
			timeAgo={timeAgo}
			onComplete={(id: string) => completeMutation.mutate({ id })}
			onRevoke={(id: string) => revokeMutation.mutate({ id })}
		/>
	);
}
