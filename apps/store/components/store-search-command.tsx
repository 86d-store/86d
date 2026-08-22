"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { STORE_SEARCH_CONTRIBUTORS } from "generated/api";
import { useAnalytics } from "hooks/use-analytics";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	Command,
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "~/components/ui/command";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
} from "~/components/ui/input-group";
import { Kbd } from "~/components/ui/kbd";
import { Spinner } from "~/components/ui/spinner";

// ── Types ───────────────────────────────────────────────────────────────────

interface StoreSearchResult {
	id: string;
	label: string;
	href: string;
	image?: string;
	subtitle?: string;
	group?: string;
}

// ── Icons ────────────────────────────────────────────────────────────────────

function SearchIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.5"
			strokeLinecap="round"
			strokeLinejoin="round"
			className={className}
			aria-hidden="true"
		>
			<title>Search</title>
			<circle cx="11" cy="11" r="8" />
			<path d="m21 21-4.3-4.3" />
		</svg>
	);
}

function ArrowRightIcon() {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			width="14"
			height="14"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M5 12h14" />
			<path d="m12 5 7 7-7 7" />
		</svg>
	);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupByGroup(
	results: StoreSearchResult[],
): Map<string, StoreSearchResult[]> {
	const map = new Map<string, StoreSearchResult[]>();
	for (const r of results) {
		const g = r.group ?? "Other";
		if (!map.has(g)) map.set(g, []);
		map.get(g)?.push(r);
	}
	return map;
}

// ── Component ────────────────────────────────────────────────────────────────

export function StoreSearchCommand() {
	const [open, setOpen] = useState(false);
	const [search, setSearch] = useState("");
	const [debouncedSearch, setDebouncedSearch] = useState("");
	const router = useRouter();
	const client = useModuleClient();
	const { track } = useAnalytics();
	const lastTracked = useRef("");

	const searchParams = useMemo(
		() => ({ q: debouncedSearch.trim(), limit: "15" }),
		[debouncedSearch],
	);

	const contributorQueries = STORE_SEARCH_CONTRIBUTORS.map(
		({ moduleId, path }) =>
			client.module(moduleId).store[path].useQuery(searchParams),
	);

	const isLoading = contributorQueries.some((q) => q.isLoading);
	const isError = contributorQueries.some((q) => q.isError);

	const { results, grouped } = useMemo(() => {
		const r: StoreSearchResult[] = [];
		for (const q of contributorQueries) {
			const data = q.data as { results?: StoreSearchResult[] } | undefined;
			if (data?.results) r.push(...data.results);
		}
		return { results: r, grouped: groupByGroup(r) };
	}, [contributorQueries]);

	// Debounce search input (300ms)
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedSearch(search), 300);
		return () => clearTimeout(timer);
	}, [search]);

	// Track search when results are shown
	useEffect(() => {
		if (
			results.length > 0 &&
			debouncedSearch.trim() &&
			lastTracked.current !== debouncedSearch
		) {
			lastTracked.current = debouncedSearch;
			track({
				type: "search",
				data: { query: debouncedSearch, resultCount: results.length },
			});
		}
	}, [results.length, debouncedSearch, track]);

	// ⌘K / Ctrl+K to open
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setOpen(true);
			}
		};
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, []);

	const reset = useCallback(() => {
		setOpen(false);
		setTimeout(() => {
			setSearch("");
		}, 300);
	}, []);

	const handleSelect = useCallback(
		(href: string) => {
			reset();
			router.push(href);
		},
		[reset, router],
	);

	const handleViewAll = useCallback(() => {
		const q = debouncedSearch.trim();
		reset();
		router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
	}, [debouncedSearch, reset, router]);

	const handleTriggerClick = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		setOpen(true);
	};

	return (
		<>
			{/* Desktop: full search trigger */}
			<InputGroup
				className="hidden max-w-[10rem] transition-all duration-300 md:flex md:max-w-xs dark:hover:bg-input/60!"
				onClick={handleTriggerClick}
			>
				<InputGroupInput
					placeholder="Search…"
					readOnly
					className="pointer-events-none placeholder:transition-all placeholder:duration-300 group-hover/input-group:placeholder:text-foreground!"
				/>
				<InputGroupAddon className="pointer-events-none transition-all duration-300 group-hover/input-group:text-foreground!">
					<SearchIcon />
				</InputGroupAddon>
				<InputGroupAddon
					align="inline-end"
					className="pointer-events-none group-hover/input-group:text-foreground!"
				>
					<Kbd>&thinsp;K</Kbd>
				</InputGroupAddon>
			</InputGroup>
			{/* Mobile: icon-only trigger */}
			<button
				type="button"
				className="flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:hidden"
				onClick={handleTriggerClick}
				aria-label="Search"
			>
				<SearchIcon className="size-[18px]" />
			</button>
			<CommandDialog
				open={open}
				onOpenChange={setOpen}
				title="Search"
				description="Search products, collections, and pages."
				showCloseButton={false}
			>
				<Command shouldFilter={false} className="rounded-xl!">
					<CommandInput
						placeholder="Search products, collections, pages…"
						value={search}
						onValueChange={setSearch}
					/>
					<CommandList className="min-h-1">
						{!debouncedSearch.trim() && results.length === 0 ? (
							<div className="py-6 text-center text-muted-foreground text-sm">
								Type to search products, collections, and pages
							</div>
						) : isLoading ? (
							<div className="flex flex-row items-center justify-center gap-2 py-6 text-sm">
								<Spinner />
								<span>Searching&hellip;</span>
							</div>
						) : isError ? (
							<CommandEmpty>Something went wrong. Try again.</CommandEmpty>
						) : results.length === 0 ? (
							<CommandEmpty>No results found.</CommandEmpty>
						) : (
							<>
								{Array.from(grouped.entries()).map(([groupName, items]) => (
									<CommandGroup key={groupName} heading={groupName}>
										{items.map((item) => (
											<CommandItem
												key={item.id}
												value={`${item.label} ${item.href}`}
												onSelect={() => handleSelect(item.href)}
												className="gap-3 py-2"
											>
												{item.image ? (
													<img
														src={item.image}
														alt=""
														className="size-10 shrink-0 rounded-md bg-muted object-cover"
													/>
												) : (
													<div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground/50">
														<SearchIcon className="size-5" />
													</div>
												)}
												<span className="flex-1 truncate font-medium">
													{item.label}
												</span>
												{item.subtitle ? (
													<span className="text-muted-foreground text-sm tabular-nums">
														{item.subtitle}
													</span>
												) : null}
											</CommandItem>
										))}
									</CommandGroup>
								))}
								{debouncedSearch.trim() ? (
									<div className="border-border/50 border-t p-1.5">
										<CommandItem
											value="__view_all__"
											onSelect={handleViewAll}
											className="justify-center gap-1.5 py-2 text-muted-foreground text-sm"
										>
											View all results for &ldquo;{debouncedSearch.trim()}
											&rdquo;
											<ArrowRightIcon />
										</CommandItem>
									</div>
								) : null}
							</>
						)}
					</CommandList>
				</Command>
			</CommandDialog>
		</>
	);
}
