"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import AuctionListingTemplate from "./auction-listing.mdx";

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

export function AuctionListing() {
	const api = useAuctionsStoreApi();

	const { data, isLoading: loading } = api.list.useQuery({
		status: "active",
	}) as {
		data: { auctions: AuctionItem[] } | undefined;
		isLoading: boolean;
	};

	const auctionsList = data?.auctions ?? [];

	return <AuctionListingTemplate auctions={auctionsList} loading={loading} />;
}
