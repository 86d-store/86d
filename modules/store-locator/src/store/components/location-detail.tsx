"use client";

import { useStoreLocatorApi } from "./_hooks";
import LocationDetailTemplate from "./location-detail.mdx";

interface DayHours {
	open: string;
	close: string;
	closed?: boolean;
}

interface LocationData {
	id: string;
	name: string;
	slug: string;
	description?: string;
	address: string;
	city: string;
	state?: string;
	postalCode?: string;
	country: string;
	latitude: number;
	longitude: number;
	phone?: string;
	email?: string;
	website?: string;
	imageUrl?: string;
	hours?: Record<string, DayHours>;
	amenities?: string[];
	isFeatured: boolean;
	pickupEnabled: boolean;
}

interface HoursData {
	open: boolean;
	currentDay: string;
	hours?: DayHours;
}

export function LocationDetail(props: {
	slug?: string | undefined;
	params?: Record<string, string> | undefined;
}) {
	const slug = props.slug ?? props.params?.slug ?? "";
	const api = useStoreLocatorApi();

	const { data, isLoading } = api.getLocation.useQuery({
		slug,
	}) as {
		data: { location: LocationData } | undefined;
		isLoading: boolean;
	};

	const location = data?.location;

	const { data: hoursData } = api.checkHours.useQuery(
		location ? { id: location.id } : {},
	) as {
		data: HoursData | undefined;
	};

	if (isLoading) {
		return (
			<div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="mb-4 h-8 w-2/3 animate-pulse rounded-lg bg-muted" />
				<div className="mb-6 h-5 w-1/3 animate-pulse rounded bg-muted" />
				<div className="mb-6 h-56 animate-pulse rounded-xl bg-muted" />
				<div className="grid gap-4 sm:grid-cols-2">
					<div className="flex flex-col gap-3 rounded-xl border border-border p-5">
						<div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
						<div className="h-4 w-full animate-pulse rounded bg-muted" />
						<div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
						<div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
					</div>
					<div className="flex flex-col gap-3 rounded-xl border border-border p-5">
						<div className="h-5 w-1/2 animate-pulse rounded bg-muted" />
						{[...Array(7)].map((_, i) => (
							<div key={i} className="flex justify-between gap-2">
								<div className="h-4 w-20 animate-pulse rounded bg-muted" />
								<div className="h-4 w-24 animate-pulse rounded bg-muted" />
							</div>
						))}
					</div>
				</div>
			</div>
		);
	}
	if (!location)
		return <p className="text-muted-foreground">Location not found.</p>;

	return (
		<LocationDetailTemplate
			location={location}
			isOpen={hoursData?.open}
			currentDay={hoursData?.currentDay}
		/>
	);
}
