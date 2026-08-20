"use client";

import { useInventoryApi } from "./_hooks";
import StockAvailabilityTemplate from "./stock-availability.mdx";

interface StockCheckResponse {
	inStock: boolean;
	available: number | null;
	allowBackorder: boolean;
}

export function StockAvailability({
	productId,
	variantId,
	showQuantity = false,
}: {
	productId: string;
	variantId?: string | undefined;
	showQuantity?: boolean | undefined;
}) {
	const api = useInventoryApi();

	const { data, isLoading } = api.checkStock.useQuery({
		productId,
		...(variantId ? { variantId } : {}),
	}) as {
		data: StockCheckResponse | undefined;
		isLoading: boolean;
	};

	if (isLoading) {
		return <div className="h-5 w-24 animate-pulse rounded bg-muted" />;
	}

	if (!data) return null;

	let status: "in-stock" | "low-stock" | "out-of-stock" | "backorder";
	if (data.inStock) {
		status =
			data.available !== null && data.available <= 5 ? "low-stock" : "in-stock";
	} else {
		status = data.allowBackorder ? "backorder" : "out-of-stock";
	}

	const quantityText =
		showQuantity && data.available !== null
			? `${data.available} available`
			: "";

	return (
		<StockAvailabilityTemplate
			status={status}
			quantityText={quantityText}
			allowBackorder={data.allowBackorder}
			isLow={status === "low-stock"}
		/>
	);
}
