"use client";

import { usePriceListsStoreApi } from "./_hooks";
import { formatCurrency } from "./_utils";
import PriceListTableTemplate from "./price-list-table.mdx";

interface PriceList {
	id: string;
	name: string;
	slug: string;
	description?: string | undefined;
	currency?: string | undefined;
	status: string;
}

interface PriceEntry {
	id: string;
	productId: string;
	price: number;
	compareAtPrice?: number | undefined;
	minQuantity?: number | undefined;
	maxQuantity?: number | undefined;
}

export function PriceListTable(props: {
	slug?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const slug = props.slug ?? props.params?.slug ?? "";
	const api = usePriceListsStoreApi();

	const query = api.getPriceList.useQuery({ params: { slug } }) as {
		data:
			| { priceList: PriceList; entries: PriceEntry[] }
			| { error: string; status: number }
			| undefined;
		isLoading: boolean;
	};

	const successData = query.data as
		| { priceList: PriceList; entries: PriceEntry[] }
		| undefined;
	const priceList = successData?.priceList;
	const entries = successData?.entries ?? [];
	const currency = priceList?.currency ?? "USD";

	return (
		<PriceListTableTemplate
			isLoading={query.isLoading}
			notFound={!query.isLoading && !priceList}
			priceList={priceList}
			entries={entries}
			formatCurrency={(cents: number) => formatCurrency(cents, currency)}
		/>
	);
}
