"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchApi } from "./_hooks";

interface SearchBarProps {
	placeholder?: string | undefined;
	onSearch?: ((query: string) => void) | undefined;
}

export function SearchBar({
	placeholder = "Search...",
	onSearch,
}: SearchBarProps) {
	const api = useSearchApi();
	const [query, setQuery] = useState("");
	const [suggestions, setSuggestions] = useState<string[]>([]);
	const [showSuggestions, setShowSuggestions] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const { data: suggestData } =
		query.trim().length >= 2
			? (api.suggest.useQuery({ q: query.trim(), limit: "8" }) as {
					data: { suggestions: string[] } | undefined;
				})
			: { data: undefined };

	useEffect(() => {
		if (suggestData?.suggestions) {
			setSuggestions(suggestData.suggestions);
		} else {
			setSuggestions([]);
		}
	}, [suggestData]);

	const handleSubmit = useCallback(
		(term: string) => {
			const trimmed = term.trim();
			if (trimmed.length === 0) return;
			setShowSuggestions(false);
			setSelectedIndex(-1);
			onSearch?.(trimmed);
		},
		[onSearch],
	);

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "ArrowDown") {
			e.preventDefault();
			setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setSelectedIndex((i) => Math.max(i - 1, -1));
		} else if (e.key === "Enter") {
			e.preventDefault();
			if (selectedIndex >= 0 && suggestions[selectedIndex]) {
				setQuery(suggestions[selectedIndex]);
				handleSubmit(suggestions[selectedIndex]);
			} else {
				handleSubmit(query);
			}
		} else if (e.key === "Escape") {
			setShowSuggestions(false);
			setSelectedIndex(-1);
		}
	};

	// Close suggestions on click outside
	useEffect(() => {
		const handleClick = (e: MouseEvent) => {
			if (
				containerRef.current &&
				!containerRef.current.contains(e.target as Node)
			) {
				setShowSuggestions(false);
			}
		};
		document.addEventListener("mousedown", handleClick);
		return () => document.removeEventListener("mousedown", handleClick);
	}, []);

	return (
		<div ref={containerRef} className="relative w-full">
			<div className="relative">
				<svg
					className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground"
					xmlns="http://www.w3.org/2000/svg"
					fill="none"
					viewBox="0 0 24 24"
					strokeWidth={2}
					stroke="currentColor"
					aria-hidden="true"
				>
					<title>Search</title>
					<path
						strokeLinecap="round"
						strokeLinejoin="round"
						d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
					/>
				</svg>
				<input
					ref={inputRef}
					type="search"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setShowSuggestions(true);
						setSelectedIndex(-1);
					}}
					onFocus={() => setShowSuggestions(true)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="w-full rounded-lg border border-border bg-background py-2.5 pr-4 pl-10 text-foreground text-sm placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
					aria-label="Search"
					aria-autocomplete="list"
					aria-expanded={showSuggestions && suggestions.length > 0}
					role="combobox"
				/>
			</div>

			{showSuggestions && suggestions.length > 0 && (
				<div
					role="listbox"
					className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-border bg-background shadow-lg"
				>
					{suggestions.map((suggestion, index) => (
						<div
							key={suggestion}
							role="option"
							tabIndex={-1}
							aria-selected={index === selectedIndex}
							className={`cursor-pointer px-4 py-2 text-sm ${
								index === selectedIndex
									? "bg-muted text-foreground"
									: "text-foreground hover:bg-muted/50"
							}`}
							onMouseDown={(e) => {
								e.preventDefault();
								setQuery(suggestion);
								handleSubmit(suggestion);
							}}
							onMouseEnter={() => setSelectedIndex(index)}
						>
							{suggestion}
						</div>
					))}
				</div>
			)}
		</div>
	);
}
