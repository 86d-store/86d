"use client";

import { useVendorsStoreApi } from "./_hooks";
import VendorProfileTemplate from "./vendor-profile.mdx";

interface Vendor {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	logo?: string | undefined;
	banner?: string | undefined;
	website?: string | undefined;
	city?: string | undefined;
	state?: string | undefined;
	country?: string | undefined;
	status: string;
}

interface VendorProduct {
	id: string;
	vendorId: string;
	productId: string;
	status: string;
}

export function VendorProfile(props: {
	slug?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const slug = props.slug ?? props.params?.slug ?? "";
	const api = useVendorsStoreApi();

	const { data: vendorData, isLoading: vendorLoading } = api.getVendor.useQuery(
		{ params: { slug } },
	) as {
		data: { vendor: Vendor | null } | undefined;
		isLoading: boolean;
	};

	const vendor = vendorData?.vendor;

	const { data: productsData, isLoading: productsLoading } =
		api.vendorProducts.useQuery(
			vendor
				? { params: { vendorId: vendor.id }, take: "20", skip: "0" }
				: null,
		) as {
			data: { products: VendorProduct[] } | undefined;
			isLoading: boolean;
		};

	const products = productsData?.products ?? [];
	const isLoading = vendorLoading || productsLoading;

	return (
		<VendorProfileTemplate
			isLoading={isLoading}
			notFound={!vendorLoading && !vendor}
			vendor={vendor}
			products={products}
			location={
				vendor
					? [vendor.city, vendor.state, vendor.country]
							.filter(Boolean)
							.join(", ")
					: ""
			}
		/>
	);
}
