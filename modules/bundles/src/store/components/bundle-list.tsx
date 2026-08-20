"use client";

import { useBundleApi } from "./_hooks";
import { formatDiscount } from "./_utils";
import BundleListTemplate from "./bundle-list.mdx";

interface BundleItem {
	id: string;
	productId: string;
	variantId?: string;
	quantity: number;
}

interface Bundle {
	id: string;
	name: string;
	slug: string;
	description?: string;
	discountType: "fixed" | "percentage";
	discountValue: number;
	imageUrl?: string;
	items: BundleItem[];
}

export function BundleList() {
	const api = useBundleApi();
	const { data, isLoading } = api.list.useQuery({}) as {
		data: { bundles: Bundle[] } | undefined;
		isLoading: boolean;
	};

	const bundles = data?.bundles ?? [];

	return (
		<BundleListTemplate
			bundles={bundles}
			loading={isLoading}
			formatDiscount={formatDiscount}
		/>
	);
}
