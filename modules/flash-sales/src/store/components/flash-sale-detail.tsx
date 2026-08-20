"use client";

import { useFlashSalesApi } from "./_hooks";
import { formatDateTime } from "./_utils";
import { Countdown } from "./countdown";
import {
	FlashSaleProductCard,
	type FlashSaleProductData,
} from "./flash-sale-product-card";

interface FlashSaleData {
	id: string;
	name: string;
	slug: string;
	description?: string;
	status: string;
	startsAt: string;
	endsAt: string;
}

const PRODUCT_SKELETON_KEYS = [
	"skel-1",
	"skel-2",
	"skel-3",
	"skel-4",
	"skel-5",
	"skel-6",
];

export function FlashSaleDetail(props: {
	slug?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const slug = props.slug ?? props.params?.slug ?? "";
	const api = useFlashSalesApi();

	const { data, isLoading } = api.getSale.useQuery({ slug }) as {
		data:
			| { sale: FlashSaleData; products: FlashSaleProductData[] }
			| { error: string }
			| undefined;
		isLoading: boolean;
	};

	if (isLoading) {
		return (
			<div className="animate-pulse">
				<div className="mb-2 h-7 w-64 rounded bg-muted" />
				<div className="mb-6 h-4 w-96 rounded bg-muted-foreground/10" />
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{PRODUCT_SKELETON_KEYS.map((key) => (
						<div key={key} className="rounded-lg border border-border p-4">
							<div className="mb-3 aspect-square rounded-md bg-muted" />
							<div className="mb-2 h-4 w-20 rounded bg-muted-foreground/10" />
							<div className="h-8 w-full rounded bg-muted" />
						</div>
					))}
				</div>
			</div>
		);
	}

	if (!data || "error" in data) {
		return (
			<div className="flex flex-col items-center justify-center py-20 text-center">
				<p className="font-medium text-foreground text-sm">
					Flash sale not found
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					This sale may have ended or doesn't exist
				</p>
				<a
					href="/flash-sales"
					className="mt-4 inline-flex items-center rounded-md border border-border px-4 py-1.5 text-foreground text-xs transition-colors hover:bg-muted"
				>
					Browse active sales
				</a>
			</div>
		);
	}

	const { sale, products } = data;

	return (
		<div>
			{/* Breadcrumb */}
			<nav className="mb-6 text-muted-foreground text-xs">
				<a
					href="/flash-sales"
					className="transition-colors hover:text-foreground"
				>
					Flash Sales
				</a>
				<span className="mx-1.5">/</span>
				<span className="text-foreground">{sale.name}</span>
			</nav>

			{/* Header */}
			<div className="mb-8 flex flex-wrap items-start justify-between gap-4">
				<div>
					<h1 className="font-semibold text-2xl text-foreground">
						{sale.name}
					</h1>
					{sale.description && (
						<p className="mt-1 max-w-2xl text-muted-foreground text-sm">
							{sale.description}
						</p>
					)}
					<p className="mt-2 text-muted-foreground text-xs">
						{formatDateTime(sale.startsAt)} – {formatDateTime(sale.endsAt)}
					</p>
				</div>
				<Countdown endsAt={sale.endsAt} label="Ends in" />
			</div>

			{/* Products grid */}
			{products.length === 0 ? (
				<p className="py-12 text-center text-muted-foreground text-sm">
					No products in this sale
				</p>
			) : (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{products.map((product) => (
						<FlashSaleProductCard key={product.id} product={product} />
					))}
				</div>
			)}
		</div>
	);
}
