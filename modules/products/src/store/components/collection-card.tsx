"use client";

import type { CollectionCardData } from "./_types";
import CollectionCardTemplate from "./collection-card.mdx";

export interface CollectionCardProps {
	collection: CollectionCardData;
}

export function CollectionCard({ collection }: CollectionCardProps) {
	return <CollectionCardTemplate collection={collection} />;
}
