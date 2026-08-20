"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import Image from "next/image";
import Link from "next/link";
import type { CollectionCardData, Product } from "./_types";
import CollectionDetailTemplate from "./collection-detail.mdx";
import { ProductCard } from "./product-card";

export interface CollectionDetailProps {
	slug?: string;
	params?: Record<string, string>;
}

export function CollectionDetail(props: CollectionDetailProps) {
	const slug = props.slug ?? props.params?.slug;
	const client = useModuleClient();
	const getCollection = client.module("products").store["/collections/:id"];

	const { data, isLoading, isError } = getCollection.useQuery(
		{ params: { id: slug ?? "" } },
		{ enabled: !!slug },
	) as {
		data:
			| {
					collection: CollectionCardData & { products: Product[] };
			  }
			| undefined;
		isLoading: boolean;
		isError: boolean;
	};

	const collection = data?.collection ?? null;

	if (!slug) {
		return (
			<div className="rounded-md border border-border bg-muted/30 p-4 text-muted-foreground">
				<p className="font-medium">Collection not found</p>
				<p className="mt-1 text-sm">No collection was specified.</p>
				<Link
					href="/collections"
					className="mt-3 inline-block text-sm underline"
				>
					Back to collections
				</Link>
			</div>
		);
	}

	if (isLoading) {
		return (
			<div className="py-6">
				<div className="mb-6 space-y-2">
					<div className="h-6 w-1/4 animate-pulse rounded bg-muted" />
					<div className="h-4 w-1/3 animate-pulse rounded bg-muted" />
				</div>
				<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
					{Array.from(
						{ length: 4 },
						(_, i) => `collection-detail-skel-${i}`,
					).map((id) => (
						<div key={id}>
							<div className="aspect-[3/4] animate-pulse rounded-lg bg-muted" />
							<div className="mt-3 space-y-1.5">
								<div className="h-3.5 w-3/4 animate-pulse rounded bg-muted-foreground/10" />
								<div className="h-3.5 w-1/3 animate-pulse rounded bg-muted-foreground/10" />
							</div>
						</div>
					))}
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div className="flex flex-col items-center justify-center py-24 text-center">
				<p className="font-medium text-foreground text-sm">
					Something went wrong
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					We couldn&apos;t load this collection. Please try again.
				</p>
				<Link
					href="/collections"
					className="mt-3 text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					Back to collections
				</Link>
			</div>
		);
	}

	if (!collection) {
		return (
			<div className="flex flex-col items-center justify-center py-24 text-center">
				<p className="font-medium text-foreground text-sm">
					Collection not found
				</p>
				<Link
					href="/collections"
					className="mt-2 text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					Back to collections
				</Link>
			</div>
		);
	}

	// --- Pre-computed JSX blocks for template ---

	const breadcrumbs = (
		<nav className="mb-6 flex items-center gap-1.5 text-muted-foreground text-xs">
			<Link href="/" className="transition-colors hover:text-foreground">
				Home
			</Link>
			<span className="text-border">/</span>
			<Link
				href="/collections"
				className="transition-colors hover:text-foreground"
			>
				Collections
			</Link>
			<span className="text-border">/</span>
			<span className="truncate text-foreground">{collection.name}</span>
		</nav>
	);

	const heroImage = collection.image ? (
		<div className="mb-6 aspect-[3/1] overflow-hidden rounded-lg">
			<Image
				src={collection.image}
				alt={collection.name}
				width={1200}
				height={400}
				unoptimized
				className="h-full w-full object-cover"
			/>
		</div>
	) : null;

	const description = collection.description ? (
		<p className="mt-1.5 max-w-xl text-muted-foreground text-sm leading-relaxed">
			{collection.description}
		</p>
	) : null;

	const productCount = (
		<p className="mt-1.5 text-muted-foreground/60 text-xs tabular-nums">
			{collection.products.length}{" "}
			{collection.products.length === 1 ? "product" : "products"}
		</p>
	);

	const gridContent =
		collection.products.length === 0 ? (
			<div className="flex flex-col items-center justify-center py-20 text-center">
				<p className="text-muted-foreground text-sm">
					No products in this collection yet
				</p>
			</div>
		) : (
			<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
				{collection.products.map((product) => (
					<ProductCard key={product.id} product={product} />
				))}
			</div>
		);

	return (
		<CollectionDetailTemplate
			breadcrumbs={breadcrumbs}
			heroImage={heroImage}
			name={collection.name}
			description={description}
			productCount={productCount}
			gridContent={gridContent}
		/>
	);
}
