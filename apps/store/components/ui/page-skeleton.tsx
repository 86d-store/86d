/**
 * Generic page-level skeleton for store (customer-facing) module pages.
 * Approximates a content page: heading → description → content cards.
 */
export function StorePageSkeleton() {
	return (
		<div className="animate-pulse space-y-8 py-10" aria-hidden="true">
			{/* Page heading */}
			<div className="space-y-3">
				<div className="h-8 w-56 rounded-lg bg-muted" />
				<div className="h-4 w-80 rounded bg-muted" />
			</div>

			{/* Content grid */}
			<div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				{[1, 2, 3, 4, 5, 6].map((n) => (
					<div
						key={n}
						className="space-y-3 rounded-xl border border-border p-4"
					>
						<div className="aspect-[4/3] w-full rounded-lg bg-muted" />
						<div className="h-4 w-3/4 rounded bg-muted" />
						<div className="h-3.5 w-full rounded bg-muted" />
						<div className="h-3.5 w-1/2 rounded bg-muted" />
					</div>
				))}
			</div>
		</div>
	);
}
