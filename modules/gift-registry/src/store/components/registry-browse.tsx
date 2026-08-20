"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import RegistryBrowseTemplate from "./registry-browse.mdx";

interface RegistryListItem {
	id: string;
	customerName: string;
	title: string;
	type: string;
	slug: string;
	coverImageUrl?: string;
	eventDate?: string;
	itemCount: number;
	purchasedCount: number;
}

const TYPE_LABELS: Record<string, string> = {
	wedding: "Wedding",
	baby: "Baby",
	birthday: "Birthday",
	housewarming: "Housewarming",
	holiday: "Holiday",
	other: "Other",
};

function useRegistryStoreApi() {
	const client = useModuleClient();
	return {
		browse: client.module("gift-registry").store["/gift-registry"],
	};
}

export function RegistryBrowse() {
	const api = useRegistryStoreApi();

	const { data, isLoading: loading } = api.browse.useQuery({}) as {
		data: { registries: RegistryListItem[] } | undefined;
		isLoading: boolean;
	};

	const registries = data?.registries ?? [];

	return (
		<RegistryBrowseTemplate
			registries={registries}
			loading={loading}
			typeLabels={TYPE_LABELS}
		/>
	);
}
