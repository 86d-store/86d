"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import Link from "next/link";
import type { CollectionCardData } from "./_types";
import { CollectionCard } from "./collection-card";
import CollectionGridTemplate from "./collection-grid.mdx";

export interface CollectionGridProps {
	title?: string;
	featured?: boolean;
}

export function CollectionGrid({
	title = "Collections",
	featured,
}: CollectionGridProps) {
	const client = useModuleClient();
	const listCollections = client.module("products").store["/collections"];

	const queryInput: Record<string, unknown> = {};
	if (featured) queryInput.featured = "true";

	const { data, isLoading, isError, refetch } = listCollections.useQuery(
		queryInput,
	) as {
		data: { collections: CollectionCardData[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const collections = data?.collections ?? [];

	if (isError) {
		return (
			<section className="py-12 sm:py-14">
				<div
					role="alert"
					className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-6 text-center"
				>
					<p className="font-medium text-destructive text-sm">
						Failed to load collections
					</p>
					<button
						type="button"
						onClick={() => refetch()}
						className="mt-2 font-medium text-destructive text-sm underline underline-offset-4"
					>
						Try again
					</button>
				</div>
			</section>
		);
	}

	if (isLoading) {
		return (
			<section className="py-12 sm:py-14">
				<div className="mb-6">
					<h2 className="font-display font-semibold text-foreground text-lg tracking-tight sm:text-xl">
						{title}
					</h2>
				</div>
				<div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 3 }, (_, i) => `collection-grid-skel-${i}`).map(
						(id) => (
							<div key={id}>
								<div className="aspect-[16/10] animate-pulse rounded-lg bg-muted" />
								<div className="mt-3 space-y-1.5">
									<div className="h-3.5 w-1/2 animate-pulse rounded bg-muted-foreground/10" />
									<div className="h-3 w-3/4 animate-pulse rounded bg-muted-foreground/10" />
								</div>
							</div>
						),
					)}
				</div>
			</section>
		);
	}

	if (collections.length === 0) return null;

	const viewAllLink = (
		<Link
			href="/collections"
			className="text-muted-foreground text-sm transition-colors hover:text-foreground"
		>
			View all
		</Link>
	);

	const gridContent = (
		<div className="grid grid-cols-1 gap-x-4 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
			{collections.map((collection) => (
				<CollectionCard key={collection.id} collection={collection} />
			))}
		</div>
	);

	return (
		<CollectionGridTemplate
			title={title}
			viewAllLink={viewAllLink}
			gridContent={gridContent}
		/>
	);
}
