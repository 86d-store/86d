/**
 * Generic page-level skeleton shown while admin module JS bundles load.
 * Matches the structural pattern of a typical admin list page:
 * header → filter bar → table rows.
 */
export function AdminPageSkeleton() {
	return (
		<div className="animate-pulse space-y-6 p-6" aria-hidden="true">
			{/* Header row: title + action button */}
			<div className="flex items-center justify-between">
				<div className="h-7 w-40 rounded-md bg-muted" />
				<div className="h-9 w-28 rounded-md bg-muted" />
			</div>

			{/* Filter / search bar */}
			<div className="flex gap-3">
				<div className="h-9 w-64 rounded-md bg-muted" />
				<div className="h-9 w-32 rounded-md bg-muted" />
				<div className="h-9 w-32 rounded-md bg-muted" />
			</div>

			{/* Table */}
			<div className="overflow-hidden rounded-lg border border-border">
				{/* Column headers */}
				<div className="flex gap-4 border-border border-b bg-muted/30 px-4 py-3">
					<div className="h-3.5 w-[120px] shrink-0 rounded bg-muted" />
					<div className="h-3.5 w-[200px] shrink-0 rounded bg-muted" />
					<div className="h-3.5 w-[80px] shrink-0 rounded bg-muted" />
					<div className="h-3.5 w-[80px] shrink-0 rounded bg-muted" />
				</div>

				{/* Rows */}
				{[1, 2, 3, 4, 5, 6].map((n) => (
					<div
						key={n}
						className="grid grid-cols-4 gap-4 border-border border-b px-4 py-4 last:border-0"
					>
						<div className="h-4 w-3/4 rounded bg-muted" />
						<div className="h-4 w-full rounded bg-muted" />
						<div className="h-4 w-1/2 rounded bg-muted" />
						<div className="h-4 w-1/3 rounded bg-muted" />
					</div>
				))}
			</div>
		</div>
	);
}
