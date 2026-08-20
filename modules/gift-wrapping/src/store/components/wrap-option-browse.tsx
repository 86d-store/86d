"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import WrapOptionBrowseTemplate from "./wrap-option-browse.mdx";

interface WrapOptionItem {
	id: string;
	name: string;
	description?: string;
	priceInCents: number;
	imageUrl?: string;
}

function useGiftWrappingStoreApi() {
	const client = useModuleClient();
	return {
		options: client.module("gift-wrapping").store["/gift-wrapping/options"],
	};
}

export function WrapOptionBrowse() {
	const api = useGiftWrappingStoreApi();

	const { data, isLoading: loading } = api.options.useQuery({}) as {
		data: { options: WrapOptionItem[] } | undefined;
		isLoading: boolean;
	};

	const options = data?.options ?? [];

	return <WrapOptionBrowseTemplate options={options} loading={loading} />;
}
