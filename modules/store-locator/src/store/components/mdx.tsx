"use client";

import type { MDXComponents } from "mdx/types";
import { LocationDetail } from "./location-detail";
import { LocationList } from "./location-list";

export { LocationDetail, LocationList };

export default {
	LocationDetail,
	LocationList,
} satisfies MDXComponents;
