"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import AuctionPageTemplate from "./auction-page.mdx";

interface AuctionData {
	id: string;
	title: string;
	description?: string;
	productName: string;
	imageUrl?: string;
	type: string;
	status: string;
	startingPrice: number;
	currentBid: number;
	bidCount: number;
	buyNowPrice: number;
	endsAt: string;
}

interface BidItem {
	id: string;
	amount: number;
	customerName?: string;
	isWinning: boolean;
	createdAt: string;
}

function useAuctionPageApi() {
	const client = useModuleClient();
	return {
		detail: client.module("auctions").store["/auctions/:id"],
		bids: client.module("auctions").store["/auctions/:id/bids"],
		placeBid: client.module("auctions").store["/auctions/bids/place"],
		buyNow: client.module("auctions").store["/auctions/buy-now"],
	};
}

export function AuctionPage(props: {
	auctionId?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const auctionId = props.auctionId ?? props.params?.id ?? "";
	const api = useAuctionPageApi();
	const [bidAmount, setBidAmount] = useState("");
	const [maxAutoBid, setMaxAutoBid] = useState("");
	const [bidError, setBidError] = useState("");
	const [bidSuccess, setBidSuccess] = useState("");

	const {
		data: auctionData,
		isLoading: loading,
		refetch: refetchAuction,
	} = api.detail.useQuery({
		id: auctionId,
	}) as {
		data: { auction: AuctionData } | undefined;
		isLoading: boolean;
		refetch: () => void;
	};

	const { data: bidsData, refetch: refetchBids } = api.bids.useQuery({
		id: auctionId,
		take: "10",
	}) as {
		data: { bids: BidItem[] } | undefined;
		refetch: () => void;
	};

	const placeBidMutation = api.placeBid.useMutation({
		onSuccess: () => {
			setBidAmount("");
			setMaxAutoBid("");
			setBidError("");
			setBidSuccess("Bid placed successfully!");
			void refetchAuction();
			void refetchBids();
			setTimeout(() => setBidSuccess(""), 3000);
		},
		onError: (err: { message?: string }) => {
			setBidError(err.message ?? "Failed to place bid. Please try again.");
		},
	});

	const buyNowMutation = api.buyNow.useMutation({
		onSuccess: () => {
			setBidError("");
			setBidSuccess("Purchase successful! Check your orders.");
			void refetchAuction();
		},
		onError: (err: { message?: string }) => {
			setBidError(
				err.message ?? "Failed to complete purchase. Please try again.",
			);
		},
	});

	const auction = auctionData?.auction;

	const handlePlaceBid = (e: React.FormEvent) => {
		e.preventDefault();
		const amount = Math.round(parseFloat(bidAmount) * 100);
		if (!amount || amount < 1) {
			setBidError("Please enter a valid bid amount.");
			return;
		}
		setBidError("");
		const maxAuto = maxAutoBid
			? Math.round(parseFloat(maxAutoBid) * 100)
			: undefined;
		placeBidMutation.mutate({
			auctionId,
			amount,
			...(maxAuto ? { maxAutoBid: maxAuto } : {}),
		});
	};

	const handleBuyNow = () => {
		setBidError("");
		buyNowMutation.mutate({ auctionId });
	};

	const minBidCents = auction ? auction.currentBid + 1 : 0;
	const minBidDollars = (minBidCents / 100).toFixed(2);
	const isActive = auction?.status === "active";
	const isPending = placeBidMutation.isPending || buyNowMutation.isPending;

	return (
		<AuctionPageTemplate
			auction={auction}
			bids={bidsData?.bids ?? []}
			loading={loading}
			bidAmount={bidAmount}
			maxAutoBid={maxAutoBid}
			onBidAmountChange={setBidAmount}
			onMaxAutoBidChange={setMaxAutoBid}
			onPlaceBid={handlePlaceBid}
			onBuyNow={handleBuyNow}
			bidError={bidError}
			bidSuccess={bidSuccess}
			isPending={isPending}
			isActive={isActive}
			minBidDollars={minBidDollars}
		/>
	);
}
