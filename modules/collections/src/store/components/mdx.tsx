import type { MDXComponents } from "mdx/types";
import { CollectionList } from "./collection-list";
import { FeaturedCollections } from "./featured-collections";

export { CollectionList, FeaturedCollections };

export default {
	CollectionList,
	FeaturedCollections,
} satisfies MDXComponents;
