"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import Image from "next/image";
import Link from "next/link";

interface AuctionItem {
	id: string;
	title: string;
	productName: string;
	imageUrl?: string;
	type: string;
	status: string;
	currentBid: number;
	bidCount: number;
	buyNowPrice: number;
	endsAt: string;
}

function useAuctionsStoreApi() {
	const client = useModuleClient();
	return {
		list: client.module("auctions").store["/auctions"],
	};
}

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		minimumFractionDigits: 0,
		maximumFractionDigits: 0,
	}).format(cents / 100);
}

function getTimeLeft(endsAt: string): string {
	const diffMs = new Date(endsAt).getTime() - Date.now();
	if (diffMs <= 0) return "Ended";
	const h = Math.floor(diffMs / 3_600_000);
	const m = Math.floor((diffMs % 3_600_000) / 60_000);
	if (h > 24) return `${Math.floor(h / 24)}d ${h % 24}h`;
	if (h > 0) return `${h}h ${m}m`;
	return `${m}m`;
}

export interface AuctionsHomepageSectionProps {
	/** Max number of auctions to display. Defaults to 4. */
	limit?: number;
}

/**
 * Compact active-auctions section for embedding in the store homepage.
 * Returns null when there are no active auctions — no skeleton, no empty state —
 * so the homepage layout is unaffected when no auctions are running.
 */
export function AuctionsHomepageSection({
	limit = 4,
}: AuctionsHomepageSectionProps) {
	const api = useAuctionsStoreApi();

	const { data, isLoading } = api.list.useQuery({ status: "active" }) as {
		data: { auctions: AuctionItem[] } | undefined;
		isLoading: boolean;
	};

	if (isLoading || !data || data.auctions.length === 0) return null;

	const visible = data.auctions.slice(0, limit);

	return (
		<section aria-label="Live auctions">
			{/* Header */}
			<div className="mb-5 flex items-center justify-between">
				<div className="flex items-center gap-2.5">
					<span className="relative flex size-2.5">
						<span className="absolute inline-flex size-full animate-ping rounded-full bg-red-400 opacity-75" />
						<span className="relative inline-flex size-2.5 rounded-full bg-red-500" />
					</span>
					<h2 className="font-semibold text-foreground text-lg tracking-tight">
						Live auctions
					</h2>
					<span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-red-700 text-xs dark:border-red-900/40 dark:bg-red-950/20 dark:text-red-400">
						{data.auctions.length} active
					</span>
				</div>
				<Link
					href="/auctions"
					className="text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					View all
					<span aria-hidden="true"> →</span>
				</Link>
			</div>

			{/* Grid */}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{visible.map((auction) => {
					const timeLeft = getTimeLeft(auction.endsAt);
					const ending = timeLeft !== "Ended" && !timeLeft.includes("d");

					return (
						<Link
							key={auction.id}
							href={`/auctions/${auction.id}`}
							className="group overflow-hidden rounded-xl border border-border bg-background transition-shadow hover:shadow-md"
						>
							{/* Image */}
							<div className="relative aspect-[4/3] overflow-hidden bg-muted">
								{auction.imageUrl ? (
									<Image
										src={auction.imageUrl}
										alt={auction.title}
										fill
										className="object-cover transition-transform duration-300 group-hover:scale-105"
										sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 20vw"
									/>
								) : (
									<div className="flex size-full items-center justify-center">
										<svg
											xmlns="http://www.w3.org/2000/svg"
											width="32"
											height="32"
											viewBox="0 0 24 24"
											fill="none"
											stroke="currentColor"
											strokeWidth="1.5"
											className="text-muted-foreground/30"
											aria-hidden="true"
										>
											<path d="m14.5 4-9 9 6 6 9-9-6-6z" />
											<path d="M4 20h4M20 4l-4 4" />
										</svg>
									</div>
								)}
								{/* Time badge */}
								<span
									className={`absolute top-2 right-2 rounded-full px-2 py-0.5 font-medium text-xs ${
										ending
											? "bg-red-500 text-white"
											: "bg-background/90 text-foreground backdrop-blur-sm"
									}`}
								>
									{timeLeft}
								</span>
							</div>

							{/* Info */}
							<div className="p-3">
								<p className="truncate font-medium text-foreground text-sm">
									{auction.title || auction.productName}
								</p>
								<div className="mt-1.5 flex items-baseline justify-between">
									<div>
										<p className="text-muted-foreground text-xs">Current bid</p>
										<p className="font-semibold text-foreground text-sm">
											{formatPrice(auction.currentBid)}
										</p>
									</div>
									<span className="text-muted-foreground text-xs">
										{auction.bidCount} bid{auction.bidCount !== 1 ? "s" : ""}
									</span>
								</div>
							</div>
						</Link>
					);
				})}
			</div>
		</section>
	);
}
