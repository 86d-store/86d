"use client";

import { useState } from "react";
import { useVendorsStoreApi } from "./_hooks";
import VendorDirectoryTemplate from "./vendor-directory.mdx";

interface Vendor {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	logo?: string | undefined;
	city?: string | undefined;
	state?: string | undefined;
	country?: string | undefined;
	status: string;
}

const PAGE_SIZE = 24;

export function VendorDirectory() {
	const api = useVendorsStoreApi();
	const [page, setPage] = useState(1);

	const { data, isLoading } = api.listVendors.useQuery({
		take: String(PAGE_SIZE),
		skip: String((page - 1) * PAGE_SIZE),
	}) as {
		data: { vendors: Vendor[] } | undefined;
		isLoading: boolean;
	};

	const vendors = data?.vendors ?? [];
	const hasMore = vendors.length === PAGE_SIZE;

	return (
		<VendorDirectoryTemplate
			isLoading={isLoading}
			vendors={vendors}
			page={page}
			hasMore={hasMore}
			onNextPage={() => setPage((p) => p + 1)}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
		/>
	);
}
