"use client";

import { useBundleApi } from "./_hooks";
import { formatDiscount } from "./_utils";
import BundleDetailTemplate from "./bundle-detail.mdx";

interface BundleItem {
	id: string;
	productId: string;
	variantId?: string;
	quantity: number;
	productName?: string | undefined;
	productSlug?: string | undefined;
	productImageUrl?: string | undefined;
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

export function BundleDetail(props: {
	slug?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const slug = props.slug ?? props.params?.slug ?? "";
	const api = useBundleApi();
	const { data, isLoading } = api.get.useQuery({
		params: { slug },
	}) as {
		data: { bundle: Bundle } | undefined;
		isLoading: boolean;
	};

	const bundle = data?.bundle;

	return (
		<BundleDetailTemplate
			bundle={bundle}
			loading={isLoading}
			formatDiscount={formatDiscount}
		/>
	);
}
