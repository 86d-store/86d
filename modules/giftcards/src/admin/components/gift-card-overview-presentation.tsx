import { Alert, AlertDescription, AlertTitle } from "@86d-app/ui/alert";
import { Button } from "@86d-app/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@86d-app/ui/card";
import { Skeleton } from "@86d-app/ui/shadcn/skeleton";
import { Text } from "@86d-app/ui/text";
import { View } from "@86d-app/ui/view";
import type {
	GiftCardAdminRecord,
	GiftCardAdminStats,
	GiftCardAdminTransaction,
} from "./gift-card-admin-types";
import {
	formatGiftCardCurrency,
	formatGiftCardDate,
	formatGiftCardTransactionType,
} from "./gift-card-format";
import { GiftCardStatusBadge } from "./gift-card-status-badge";

export function ReadOnlyNotice() {
	return (
		<Alert data-testid="gift-card-read-only-notice">
			<AlertTitle>Read-only view</AlertTitle>
			<AlertDescription>
				Issuing cards, adding funds, changing statuses, and deletion are
				unavailable. You can review balances and transaction history here.
			</AlertDescription>
		</Alert>
	);
}

export function GiftCardStatsPanel({
	stats,
	isLoading,
	isError,
}: {
	stats: GiftCardAdminStats | undefined;
	isLoading: boolean;
	isError: boolean;
}) {
	if (isLoading) {
		return (
			<View
				className="grid grid-cols-2 gap-4 lg:grid-cols-4"
				data-testid="gift-card-stats-loading"
				aria-label="Loading gift card summaries"
			>
				{["one", "two", "three", "four"].map((key) => (
					<Card key={key} size="sm">
						<CardContent className="gap-3">
							<Skeleton className="h-3 w-20" />
							<Skeleton className="h-8 w-12" />
						</CardContent>
					</Card>
				))}
			</View>
		);
	}

	if (isError || !stats) {
		return (
			<Alert
				variant="destructive"
				role="alert"
				data-testid="gift-card-stats-error"
			>
				<AlertTitle>Gift card summaries are unavailable</AlertTitle>
				<AlertDescription>
					The card list may still be available below. Refresh the page to try
					again.
				</AlertDescription>
			</Alert>
		);
	}

	const summaries = [
		{ label: "Total cards", value: stats.totalIssued },
		{ label: "Active", value: stats.totalActive },
		{ label: "Depleted", value: stats.totalDepleted },
		{
			label: "Disabled or expired",
			value: stats.totalDisabled + stats.totalExpired,
		},
	];

	return (
		<View
			className="grid grid-cols-2 gap-4 lg:grid-cols-4"
			data-testid="gift-card-stats"
		>
			{summaries.map((summary) => (
				<Card key={summary.label} size="sm">
					<CardContent className="gap-1.5">
						<Text className="text-muted-foreground text-xs uppercase tracking-wide">
							{summary.label}
						</Text>
						<Text className="font-semibold text-2xl text-foreground tabular-nums">
							{summary.value}
						</Text>
					</CardContent>
				</Card>
			))}
		</View>
	);
}

export function GiftCardListError() {
	return (
		<Alert
			variant="destructive"
			role="alert"
			data-testid="gift-card-list-error"
		>
			<AlertTitle>Gift cards are unavailable</AlertTitle>
			<AlertDescription>
				Your records have not changed. Refresh the page to try again.
			</AlertDescription>
		</Alert>
	);
}

function DetailSkeleton() {
	return (
		<View
			className="space-y-5"
			data-testid="gift-card-detail-loading"
			aria-label="Loading gift card details"
		>
			<Skeleton className="h-10 w-32" />
			<Skeleton className="h-20 w-full" />
			<Card>
				<CardContent className="gap-5">
					<Skeleton className="h-5 w-56" />
					<View className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						{["one", "two", "three", "four"].map((key) => (
							<View key={key} className="space-y-2">
								<Skeleton className="h-3 w-24" />
								<Skeleton className="h-5 w-32" />
							</View>
						))}
					</View>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<Skeleton className="h-5 w-36" />
				</CardHeader>
				<CardContent>
					{["one", "two", "three"].map((key) => (
						<Skeleton key={key} className="h-14 w-full" />
					))}
				</CardContent>
			</Card>
		</View>
	);
}

function BackToListButton({ onClose }: { onClose: () => void }) {
	return (
		<Button
			type="button"
			variant="ghost"
			onClick={onClose}
			data-testid="gift-card-detail-back"
		>
			← Back to list
		</Button>
	);
}

function DetailError({ onClose }: { onClose: () => void }) {
	return (
		<View className="space-y-5" data-testid="gift-card-detail-error">
			<BackToListButton onClose={onClose} />
			<Alert variant="destructive" role="alert">
				<AlertTitle>Gift card details are unavailable</AlertTitle>
				<AlertDescription>
					Your records have not changed. Return to the list and try again.
				</AlertDescription>
			</Alert>
		</View>
	);
}

function DetailNotFound({ onClose }: { onClose: () => void }) {
	return (
		<View className="space-y-5" data-testid="gift-card-detail-empty">
			<BackToListButton onClose={onClose} />
			<Card>
				<CardContent className="items-center py-8 text-center">
					<Text variant="p" className="font-medium text-foreground text-sm">
						Gift card not found
					</Text>
					<Text
						variant="p"
						className="text-pretty text-muted-foreground text-sm"
					>
						Return to the list to choose another record.
					</Text>
				</CardContent>
			</Card>
		</View>
	);
}

function TransactionHistory({
	transactions,
	currency,
}: {
	transactions: GiftCardAdminTransaction[];
	currency: string;
}) {
	return (
		<Card data-testid="gift-card-transactions">
			<CardHeader className="border-b">
				<CardTitle>Transaction history</CardTitle>
			</CardHeader>
			<CardContent className="px-0">
				{transactions.length === 0 ? (
					<View
						className="px-5 py-6 text-center"
						data-testid="gift-card-transactions-empty"
					>
						<Text variant="p" className="text-muted-foreground text-sm">
							No transactions recorded.
						</Text>
					</View>
				) : (
					<ul
						className="divide-y divide-border"
						data-testid="gift-card-transactions-list"
					>
						{transactions.map((transaction) => {
							const isDebit = transaction.type === "debit";
							const isCredit = ["credit", "purchase", "topup"].includes(
								transaction.type,
							);
							return (
								<li
									key={transaction.id}
									className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-start sm:justify-between"
								>
									<View className="min-w-0">
										<Text className="block font-medium text-foreground text-sm">
											{formatGiftCardTransactionType(transaction.type)}
										</Text>
										<Text
											className={`mt-0.5 block font-medium text-sm tabular-nums ${isDebit ? "text-destructive" : isCredit ? "text-constructive" : "text-foreground"}`}
										>
											{isDebit ? "−" : isCredit ? "+" : ""}
											{formatGiftCardCurrency(
												Math.abs(transaction.amount),
												currency,
											)}
										</Text>
										{transaction.note ? (
											<Text
												variant="p"
												className="mt-1 text-pretty text-muted-foreground text-xs"
											>
												{transaction.note}
											</Text>
										) : null}
										{transaction.orderId ? (
											<Text
												variant="p"
												className="mt-1 break-all font-mono text-muted-foreground text-xs"
											>
												Order {transaction.orderId}
											</Text>
										) : null}
									</View>
									<View className="shrink-0 text-left sm:text-right">
										<Text className="block text-muted-foreground text-xs tabular-nums">
											{formatGiftCardDate(transaction.createdAt)}
										</Text>
										<Text className="mt-0.5 block text-muted-foreground text-xs tabular-nums">
											Balance{" "}
											{formatGiftCardCurrency(
												transaction.balanceAfter,
												currency,
											)}
										</Text>
									</View>
								</li>
							);
						})}
					</ul>
				)}
			</CardContent>
		</Card>
	);
}

export function GiftCardDetailContent({
	card,
	transactions,
	isLoading,
	isError,
	onClose,
}: {
	card: GiftCardAdminRecord | undefined;
	transactions: GiftCardAdminTransaction[];
	isLoading: boolean;
	isError: boolean;
	onClose: () => void;
}) {
	if (isError) return <DetailError onClose={onClose} />;
	if (isLoading) return <DetailSkeleton />;
	if (!card) return <DetailNotFound onClose={onClose} />;

	return (
		<View className="space-y-5" data-testid="gift-card-detail">
			<View className="flex items-center justify-between gap-4">
				<BackToListButton onClose={onClose} />
				<GiftCardStatusBadge status={card.status} />
			</View>

			<ReadOnlyNotice />

			<Card>
				<CardContent className="gap-4">
					<View>
						<Text className="block font-mono text-muted-foreground text-xs">
							Code
						</Text>
						<Text className="mt-0.5 block break-all font-mono font-semibold text-foreground text-lg tracking-wider">
							{card.code}
						</Text>
					</View>

					<View className="grid grid-cols-1 gap-4 sm:grid-cols-2">
						<View>
							<Text className="block text-muted-foreground text-xs">
								Initial balance
							</Text>
							<Text className="mt-0.5 block font-semibold text-foreground tabular-nums">
								{formatGiftCardCurrency(card.initialBalance, card.currency)}
							</Text>
						</View>
						<View>
							<Text className="block text-muted-foreground text-xs">
								Current balance
							</Text>
							<Text className="mt-0.5 block font-semibold text-foreground tabular-nums">
								{formatGiftCardCurrency(card.currentBalance, card.currency)}
							</Text>
						</View>
						{card.recipientEmail ? (
							<View>
								<Text className="block text-muted-foreground text-xs">
									Recipient
								</Text>
								<Text className="mt-0.5 block break-all text-foreground text-sm">
									{card.recipientEmail}
								</Text>
							</View>
						) : null}
						{card.expiresAt ? (
							<View>
								<Text className="block text-muted-foreground text-xs">
									Expires
								</Text>
								<Text className="mt-0.5 block text-foreground text-sm tabular-nums">
									{formatGiftCardDate(card.expiresAt)}
								</Text>
							</View>
						) : null}
						<View>
							<Text className="block text-muted-foreground text-xs">
								Created
							</Text>
							<Text className="mt-0.5 block text-foreground text-sm tabular-nums">
								{formatGiftCardDate(card.createdAt)}
							</Text>
						</View>
					</View>

					{card.note ? (
						<View>
							<Text className="block text-muted-foreground text-xs">Note</Text>
							<Text
								variant="p"
								className="mt-0.5 text-pretty text-muted-foreground text-sm"
							>
								{card.note}
							</Text>
						</View>
					) : null}
				</CardContent>
			</Card>

			<TransactionHistory
				transactions={transactions}
				currency={card.currency}
			/>
		</View>
	);
}
