import { Skeleton } from "~/components/ui/skeleton";

export default function SlugLoading() {
	return (
		<div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
			<div className="py-4 sm:py-6">
				{/* Breadcrumb */}
				<div className="mb-4 flex items-center gap-2">
					<Skeleton className="h-3.5 w-12" />
					<Skeleton className="h-3 w-1" />
					<Skeleton className="h-3.5 w-20" />
				</div>

				<div className="grid gap-8 lg:grid-cols-2 lg:gap-12">
					{/* Image gallery */}
					<div className="flex flex-col gap-3">
						<Skeleton className="aspect-square w-full rounded-lg" />
						<div className="grid grid-cols-4 gap-2">
							{(["k0", "k1", "k2", "k3"] as const).map((key) => (
								<Skeleton
									key={key}
									className="aspect-square w-full rounded-md"
								/>
							))}
						</div>
					</div>

					{/* Product info */}
					<div className="flex flex-col gap-4">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-7 w-4/5 sm:h-8" />
						<Skeleton className="h-4 w-32" />
						<Skeleton className="h-7 w-24" />
						<div className="flex flex-col gap-1.5">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-2/3" />
						</div>
						<Skeleton className="mt-2 h-11 w-full rounded-lg" />
					</div>
				</div>
			</div>
		</div>
	);
}
