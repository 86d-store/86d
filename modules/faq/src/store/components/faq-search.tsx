"use client";

import { useState } from "react";
import { useFaqApi } from "./_hooks";
import FaqSearchTemplate from "./faq-search.mdx";

export function FaqSearch({
	placeholder,
}: {
	placeholder?: string | undefined;
}) {
	const api = useFaqApi();
	const [query, setQuery] = useState("");
	const [debouncedQuery, setDebouncedQuery] = useState("");
	const [debounceTimer, setDebounceTimer] = useState<ReturnType<
		typeof setTimeout
	> | null>(null);

	const { data, isLoading } = debouncedQuery
		? (api.search.useQuery({ q: debouncedQuery }) as {
				data:
					| {
							items: Array<{
								id: string;
								question: string;
								answer: string;
								slug: string;
							}>;
							query: string;
					  }
					| undefined;
				isLoading: boolean;
			})
		: { data: undefined, isLoading: false };

	const handleChange = (value: string) => {
		setQuery(value);
		if (debounceTimer) clearTimeout(debounceTimer);
		const timer = setTimeout(() => {
			setDebouncedQuery(value.trim());
		}, 300);
		setDebounceTimer(timer);
	};

	const results = data?.items ?? [];

	return (
		<FaqSearchTemplate
			query={query}
			onChange={handleChange}
			results={results}
			isLoading={isLoading}
			hasSearched={debouncedQuery.length > 0}
			placeholder={placeholder ?? "Search frequently asked questions..."}
		/>
	);
}
