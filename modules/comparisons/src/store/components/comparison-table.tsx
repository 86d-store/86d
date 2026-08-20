"use client";

import { useState } from "react";
import { useComparisonApi } from "./_hooks";
import { collectAttributeKeys, extractError, formatPrice } from "./_utils";
import ComparisonTableTemplate from "./comparison-table.mdx";

export function ComparisonTable({
	customerId,
	sessionId,
	title,
}: {
	customerId?: string | undefined;
	sessionId?: string | undefined;
	title?: string | undefined;
}) {
	const api = useComparisonApi();
	const [error, setError] = useState("");

	const queryParams = customerId ? {} : sessionId ? { sessionId } : {};

	const { data, isLoading } = api.listComparison.useQuery(queryParams) as {
		data:
			| {
					items: Array<{
						id: string;
						productId: string;
						productName: string;
						productSlug: string;
						productImage?: string;
						productPrice?: number;
						productCategory?: string;
						attributes?: Record<string, string>;
					}>;
					total: number;
			  }
			| undefined;
		isLoading: boolean;
	};

	const removeMutation = api.removeProduct.useMutation({
		onSettled: () => {
			void api.listComparison.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to remove product."));
		},
	});

	const handleRemove = (productId: string) => {
		setError("");
		removeMutation.mutate(
			sessionId && !customerId ? { productId, sessionId } : { productId },
		);
	};

	const items = data?.items ?? [];
	const attributeKeys = collectAttributeKeys(items);

	if (!isLoading && items.length === 0) {
		return (
			<section className="py-6">
				<h2 className="mb-4 font-semibold text-foreground text-lg">
					{title ?? "Compare Products"}
				</h2>
				<p className="text-muted-foreground text-sm">
					No products added to comparison yet. Browse products and click
					"Compare" to add them.
				</p>
			</section>
		);
	}

	return (
		<ComparisonTableTemplate
			title={title ?? "Compare Products"}
			items={items}
			attributeKeys={attributeKeys}
			isLoading={isLoading}
			error={error}
			onRemove={handleRemove}
			formatPrice={formatPrice}
		/>
	);
}
