"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { Alert, AlertDescription, AlertTitle } from "@86d-app/ui/alert";
import { Button } from "@86d-app/ui/button";
import { Text } from "@86d-app/ui/text";
import { View } from "@86d-app/ui/view";
import KioskAdminTemplate from "./kiosk-admin.mdx";

function Skeleton({ className = "" }: { className?: string }) {
	return (
		<View
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

function KioskAdminUnavailable({ onRetry }: { onRetry: () => void }) {
	return (
		<Alert variant="destructive" role="alert">
			<AlertTitle>Kiosk overview is unavailable</AlertTitle>
			<AlertDescription>
				Station registration and legacy session record counts could not be
				loaded. Your records have not changed.
			</AlertDescription>
			<View className="mt-3">
				<Button
					type="button"
					variant="outline"
					onClick={onRetry}
					aria-label="Retry loading kiosk overview"
				>
					Try again
				</Button>
			</View>
		</Alert>
	);
}

export function KioskAdmin() {
	const api = useKioskAdminApi();
	const query = api.getStats.useQuery({}) as {
		data:
			| {
					stats: {
						totalStations: number;
						legacySessionRecords: number;
					};
			  }
			| undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => unknown;
	};

	if (query.isError) {
		return (
			<KioskAdminTemplate>
				<KioskAdminUnavailable onRetry={() => void query.refetch()} />
			</KioskAdminTemplate>
		);
	}

	const stats = query.data?.stats;

	return (
		<KioskAdminTemplate>
			{query.isLoading ? (
				<View className="grid grid-cols-2 gap-4 md:grid-cols-4">
					{Array.from({ length: 4 }, (_, index) => `skel-${index}`).map(
						(key) => (
							<View key={key} className="rounded-md border border-border p-4">
								<Skeleton className="mb-2 h-3 w-14" />
								<Skeleton className="h-7 w-20" />
							</View>
						),
					)}
				</View>
			) : !stats ? (
				<KioskAdminUnavailable onRetry={() => void query.refetch()} />
			) : (
				<View className="grid grid-cols-2 gap-4 md:grid-cols-4">
					<View className="rounded-md border border-border p-4">
						<Text variant="p" className="text-muted-foreground text-xs">
							Stations
						</Text>
						<Text
							variant="p"
							className="font-semibold text-2xl text-foreground tabular-nums"
						>
							{stats.totalStations}
						</Text>
					</View>
					<View className="rounded-md border border-border p-4">
						<Text variant="p" className="text-muted-foreground text-xs">
							Station health
						</Text>
						<Text
							variant="p"
							className="font-semibold text-2xl text-foreground"
						>
							Unavailable
						</Text>
					</View>
					<View className="rounded-md border border-border p-4">
						<Text variant="p" className="text-muted-foreground text-xs">
							Legacy session records
						</Text>
						<Text
							variant="p"
							className="font-semibold text-2xl text-foreground tabular-nums"
						>
							{stats.legacySessionRecords}
						</Text>
					</View>
					<View className="rounded-md border border-border p-4">
						<Text variant="p" className="text-muted-foreground text-xs">
							Checkout
						</Text>
						<Text
							variant="p"
							className="font-semibold text-2xl text-foreground"
						>
							Unavailable
						</Text>
					</View>
				</View>
			)}
		</KioskAdminTemplate>
	);
}
