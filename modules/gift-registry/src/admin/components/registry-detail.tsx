"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import RegistryDetailTemplate from "./registry-detail.mdx";

interface RegistryData {
	id: string;
	customerName: string;
	title: string;
	description?: string;
	type: string;
	slug: string;
	visibility: string;
	status: string;
	eventDate?: string;
	thankYouMessage?: string;
	itemCount: number;
	purchasedCount: number;
	createdAt: string;
}

interface ItemData {
	id: string;
	productName: string;
	variantName?: string;
	imageUrl?: string;
	priceInCents: number;
	quantityDesired: number;
	quantityReceived: number;
	priority: string;
	note?: string;
}

interface PurchaseData {
	id: string;
	purchaserName: string;
	quantity: number;
	amountInCents: number;
	giftMessage?: string;
	isAnonymous: boolean;
	createdAt: string;
}

const PRIORITY_LABELS: Record<string, string> = {
	must_have: "Must Have",
	nice_to_have: "Nice to Have",
	dream: "Dream",
};

function useRegistryDetailApi() {
	const client = useModuleClient();
	return {
		get: client.module("gift-registry").admin["/admin/gift-registry/:id"],
	};
}

export function RegistryDetail({ id }: { id: string }) {
	const api = useRegistryDetailApi();

	const { data, isLoading: loading } = api.get.useQuery({ id }) as {
		data:
			| {
					registry: RegistryData;
					items: ItemData[];
					recentPurchases: PurchaseData[];
			  }
			| undefined;
		isLoading: boolean;
	};

	return (
		<RegistryDetailTemplate
			registry={data?.registry}
			items={data?.items ?? []}
			purchases={data?.recentPurchases ?? []}
			loading={loading}
			priorityLabels={PRIORITY_LABELS}
		/>
	);
}
