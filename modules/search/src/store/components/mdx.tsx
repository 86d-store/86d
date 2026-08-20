"use client";

import type { MDXComponents } from "mdx/types";
import { SearchBar } from "./search-bar";
import { SearchPage } from "./search-page";
import { SearchResults } from "./search-results";

export default {
	SearchBar,
	SearchResults,
	SearchPage,
} satisfies MDXComponents;
