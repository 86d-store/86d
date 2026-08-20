"use client";

import { ProductForm } from "./product-form";

export function ProductNew() {
	return (
		<div>
			<div className="mb-6 flex items-center gap-3">
				<a
					href="/admin/products"
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
					<span className="sr-only">Back to products</span>
				</a>
				<h1 className="font-semibold text-foreground text-lg">New product</h1>
			</div>
			<ProductForm
				onNavigate={(path) => {
					window.location.href = path;
				}}
			/>
		</div>
	);
}
