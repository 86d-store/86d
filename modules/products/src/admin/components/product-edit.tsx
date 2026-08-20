"use client";

import { ProductForm } from "./product-form";

interface ProductEditProps {
	params?: Record<string, string>;
}

export function ProductEdit({ params }: ProductEditProps) {
	const productId = params?.id;

	if (!productId) {
		return (
			<div className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground">
				<p className="font-medium">Product not found</p>
				<p className="mt-1 text-sm">No product ID was provided.</p>
				<a
					href="/admin/products"
					className="mt-3 inline-block text-sm underline"
				>
					Back to products
				</a>
			</div>
		);
	}

	return (
		<div>
			<div className="mb-6 flex items-center gap-3">
				<a
					href={`/admin/products/${productId}`}
					className="text-muted-foreground transition-colors hover:text-foreground"
				>
					<svg
						xmlns="http://www.w3.org/2000/svg"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2"
						strokeLinecap="round"
						strokeLinejoin="round"
						aria-hidden="true"
					>
						<path d="m15 18-6-6 6-6" />
					</svg>
					<span className="sr-only">Back to product</span>
				</a>
				<h1 className="font-semibold text-foreground text-lg">Edit product</h1>
			</div>
			<ProductForm
				productId={productId}
				onNavigate={(path) => {
					window.location.href = path;
				}}
			/>
		</div>
	);
}
