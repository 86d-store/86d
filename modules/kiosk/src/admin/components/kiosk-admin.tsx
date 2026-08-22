"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import KioskAdminTemplate from "./kiosk-admin.mdx";

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded bg-muted ${className}`}
			aria-hidden="true"
		/>
	);
}

function useKioskAdminApi() {
	const client = useModuleClient();
	return {
		getStats: client.module("kiosk").admin["/admin/kiosk/stats"],
	};
}

export function KioskAdmin() {
	const api = useKioskAdminApi();
	const {
		data,
		isLoading: loading,
		isError: statsError,
		refetch: refetchStats,
	} = api.getStats.useQuery({}) as {
		data:
			| {
					stats: {
						totalStations: number;
						onlineStations: number;
						totalSessions: number;
						completedSessions: number;
						totalRevenue: number;
					};
			  }
			| undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	if (statsError) {
		return (
			<div>
				<h1 className="mb-4 font-bold text-2xl text-foreground">
					Kiosk Overview
				</h1>
				<div
					role="alert"
					className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
				>
					<p className="font-semibold text-destructive">
						Failed to load kiosk stats
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Check your connection and try again.
					</p>
					<button
						type="button"
						onClick={() => refetchStats()}
						className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
					>
						Try again
					</button>
				</div>
			</div>
		);
	}

	const stats = data?.stats;

	return (
		<KioskAdminTemplate>
			{loading ? (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
					{Array.from({ length: 4 }, (_, i) => `skel-${i}`).map((key) => (
						<div key={key} className="rounded-md border border-border p-4">
							<Skeleton className="mb-2 h-3 w-14" />
							<Skeleton className="h-7 w-20" />
						</div>
					))}
				</div>
			) : !stats ? (
				<p className="text-muted-foreground text-sm">No data available.</p>
			) : (
				<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
					<div className="rounded-md border border-border p-4">
						<p className="text-muted-foreground text-xs">Stations</p>
						<p className="font-semibold text-2xl text-foreground">
							{stats.totalStations}
						</p>
					</div>
					<div className="rounded-md border border-border p-4">
						<p className="text-muted-foreground text-xs">Online</p>
						<p className="font-semibold text-2xl text-foreground">
							{stats.onlineStations}
						</p>
					</div>
					<div className="rounded-md border border-border p-4">
						<p className="text-muted-foreground text-xs">Sessions</p>
						<p className="font-semibold text-2xl text-foreground">
							{stats.totalSessions}
						</p>
					</div>
					<div className="rounded-md border border-border p-4">
						<p className="text-muted-foreground text-xs">Revenue</p>
						<p className="font-semibold text-2xl text-foreground">
							${stats.totalRevenue.toFixed(2)}
						</p>
					</div>
				</div>
			)}
		</KioskAdminTemplate>
	);
}
