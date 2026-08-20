"use client";

import { useState } from "react";
import { useComparisonApi } from "./_hooks";
import { extractError, formatPrice } from "./_utils";
import ComparisonBarTemplate from "./comparison-bar.mdx";

export function ComparisonBar({
	customerId,
	sessionId,
}: {
	customerId?: string | undefined;
	sessionId?: string | undefined;
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

	const clearMutation = api.clearComparison.useMutation({
		onSettled: () => {
			void api.listComparison.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to clear comparison."));
		},
	});

	const handleRemove = (productId: string) => {
		setError("");
		removeMutation.mutate(
			sessionId && !customerId ? { productId, sessionId } : { productId },
		);
	};

	const handleClear = () => {
		setError("");
		clearMutation.mutate(sessionId && !customerId ? { sessionId } : {});
	};

	const items = data?.items ?? [];

	if (isLoading || items.length === 0) return null;

	return (
		<ComparisonBarTemplate
			items={items}
			error={error}
			onRemove={handleRemove}
			onClear={handleClear}
			clearing={clearMutation.isPending}
			formatPrice={formatPrice}
		/>
	);
}
