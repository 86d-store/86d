"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import RegistryPageTemplate from "./registry-page.mdx";

interface RegistryData {
	id: string;
	customerName: string;
	title: string;
	description?: string;
	type: string;
	slug: string;
	coverImageUrl?: string;
	eventDate?: string;
	thankYouMessage?: string;
	itemCount: number;
	purchasedCount: number;
}

interface ItemData {
	id: string;
	productId: string;
	productName: string;
	variantName?: string;
	imageUrl?: string;
	priceInCents: number;
	quantityDesired: number;
	quantityReceived: number;
	priority: string;
	note?: string;
}

const PRIORITY_LABELS: Record<string, string> = {
	must_have: "Must Have",
	nice_to_have: "Nice to Have",
	dream: "Dream",
};

function useRegistryPageApi() {
	const client = useModuleClient();
	return {
		get: client.module("gift-registry").store["/gift-registry/:slug"],
	};
}

export function RegistryPage(props: {
	slug?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const slug = props.slug ?? props.params?.slug ?? "";
	const api = useRegistryPageApi();

	const { data, isLoading: loading } = api.get.useQuery({ slug }) as {
		data: { registry: RegistryData; items: ItemData[] } | undefined;
		isLoading: boolean;
	};

	return (
		<RegistryPageTemplate
			registry={data?.registry}
			items={data?.items ?? []}
			loading={loading}
			priorityLabels={PRIORITY_LABELS}
		/>
	);
}
