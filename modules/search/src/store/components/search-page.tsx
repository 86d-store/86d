"use client";

import { useCallback, useState } from "react";
import { SearchBar } from "./search-bar";
import { SearchResults } from "./search-results";

export function SearchPage({ sessionId }: { sessionId?: string | undefined }) {
	const [query, setQuery] = useState("");

	const handleSearch = useCallback((term: string) => {
		setQuery(term);
	}, []);

	return (
		<div className="mx-auto max-w-2xl px-4 py-8">
			<h1 className="mb-6 font-semibold text-2xl text-foreground">Search</h1>
			<SearchBar
				placeholder="Search products, articles..."
				onSearch={handleSearch}
			/>
			<div className="mt-6">
				<SearchResults query={query} sessionId={sessionId} />
			</div>
		</div>
	);
}
