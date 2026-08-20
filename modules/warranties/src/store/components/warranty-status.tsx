"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import WarrantyStatusTemplate from "./warranty-status.mdx";

interface RegistrationData {
	id: string;
	productName: string;
	status: string;
	purchaseDate: string;
	expiresAt: string;
	serialNumber?: string;
}

function useWarrantyApi() {
	const client = useModuleClient();
	return {
		list: client.module("warranties").store["/warranties"],
	};
}

export function WarrantyStatus() {
	const api = useWarrantyApi();

	const { data, isLoading: loading } = api.list.useQuery({}) as {
		data: { registrations: RegistrationData[] } | undefined;
		isLoading: boolean;
	};

	const registrations = data?.registrations ?? [];

	return (
		<WarrantyStatusTemplate registrations={registrations} loading={loading} />
	);
}
