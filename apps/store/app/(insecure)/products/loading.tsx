import { Skeleton } from "~/components/ui/skeleton";

export default function ProductsLoading() {
	return (
		<div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8 lg:py-12">
			{/* Header */}
			<div className="mb-8 sm:mb-10">
				<Skeleton className="h-8 w-28 sm:h-9 sm:w-32" />
				<Skeleton className="mt-1.5 h-4 w-40" />
			</div>

			{/* Filter chips row */}
			<div className="mb-6 flex gap-2 overflow-hidden">
				{Array.from({ length: 5 }).map((_, i) => (
					<Skeleton
						key={`chip-${i}`}
						className="h-8 shrink-0 rounded-full"
						style={{ width: `${60 + i * 10}px` }}
					/>
				))}
			</div>

			{/* Product grid */}
			<div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
				{Array.from({ length: 12 }).map((_, i) => (
					<div key={`card-${i}`} className="flex flex-col">
						<Skeleton className="aspect-[3/4] w-full rounded-lg" />
						<div className="mt-3 flex flex-col gap-1.5">
							<Skeleton className="h-4 w-3/4" />
							<Skeleton className="h-4 w-1/4" />
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
