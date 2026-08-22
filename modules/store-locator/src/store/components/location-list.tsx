"use client";

import { useState } from "react";
import { useStoreLocatorApi } from "./_hooks";
import LocationListTemplate from "./location-list.mdx";

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
	phone?: string;
	email?: string;
	imageUrl?: string;
	isActive: boolean;
	isFeatured: boolean;
	pickupEnabled: boolean;
}

interface RegionData {
	regions: string[];
	countries: string[];
}

export function LocationList({ limit }: { limit?: number }) {
	const api = useStoreLocatorApi();
	const [country, setCountry] = useState("");

	const { data: regionData } = api.getRegions.useQuery({}) as {
		data: RegionData | undefined;
	};

	const { data, isLoading } = api.listLocations.useQuery({
		country: country || undefined,
		limit: limit ? String(limit) : undefined,
	}) as {
		data: { locations: LocationData[] } | undefined;
		isLoading: boolean;
	};

	const locations = data?.locations ?? [];
	const countries = regionData?.countries ?? [];

	if (isLoading) {
		return (
			<div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
				<div className="mb-6 h-8 w-48 animate-pulse rounded-lg bg-muted" />
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }, (_, i) => `skel-${i}`).map((key) => (
						<div
							key={key}
							className="flex flex-col gap-3 rounded-xl border border-border p-5"
						>
							<div className="h-40 animate-pulse rounded-lg bg-muted" />
							<div className="h-5 w-2/3 animate-pulse rounded bg-muted" />
							<div className="h-4 w-full animate-pulse rounded bg-muted" />
							<div className="h-4 w-1/2 animate-pulse rounded bg-muted" />
						</div>
					))}
				</div>
			</div>
		);
	}

	return (
		<LocationListTemplate
			locations={locations}
			countries={countries}
			selectedCountry={country}
			onCountryChange={setCountry}
		/>
	);
}
