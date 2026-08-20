import type { MDXComponents } from "mdx/types";
import { BrandList } from "./brand-list";
import { FeaturedBrands } from "./featured-brands";

export { BrandList, FeaturedBrands };

export default {
	BrandList,
	FeaturedBrands,
} satisfies MDXComponents;
