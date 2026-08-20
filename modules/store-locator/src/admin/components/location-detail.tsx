"use client";

import { useModuleClient } from "@86d-app/core/client/provider";

function useStoreLocatorAdminApi() {
	const client = useModuleClient();
	const api = client.module("store-locator").admin;

	return {
		getLocation: api["/admin/store-locator/locations/:id"],
	};
}

export function LocationDetail({ locationId }: { locationId: string }) {
	const api = useStoreLocatorAdminApi();

	const { data, isLoading } = api.getLocation.useQuery({
		params: { id: locationId },
	});

	if (isLoading) {
		return <div className="p-6 text-muted-foreground">Loading location...</div>;
	}

	const location = data?.location;
	if (!location) {
		return <div className="p-6 text-muted-foreground">Location not found.</div>;
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl">{location.name}</h1>
				<div className="flex gap-2">
					<span
						className={`rounded-full px-3 py-1 text-xs ${
							location.isActive
								? "bg-green-100 text-green-700"
								: "bg-muted text-muted-foreground"
						}`}
					>
						{location.isActive ? "Active" : "Inactive"}
					</span>
					{location.isFeatured && (
						<span className="rounded-full bg-amber-100 px-3 py-1 text-amber-700 text-xs">
							Featured
						</span>
					)}
					{location.pickupEnabled && (
						<span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700 text-xs">
							Pickup
						</span>
					)}
				</div>
			</div>

			{location.description && (
				<p className="text-muted-foreground">{location.description}</p>
			)}

			<div className="grid grid-cols-2 gap-6">
				<div className="space-y-4 rounded-md border p-4">
					<h2 className="font-medium">Address</h2>
					<div className="space-y-1 text-muted-foreground text-sm">
						<p>{location.address}</p>
						<p>
							{location.city}
							{location.state ? `, ${location.state}` : ""}
							{location.postalCode ? ` ${location.postalCode}` : ""}
						</p>
						<p>{location.country}</p>
						{location.region && (
							<p className="text-xs">Region: {location.region}</p>
						)}
					</div>
				</div>

				<div className="space-y-4 rounded-md border p-4">
					<h2 className="font-medium">Contact</h2>
					<div className="space-y-1 text-muted-foreground text-sm">
						{location.phone && <p>Phone: {location.phone}</p>}
						{location.email && <p>Email: {location.email}</p>}
						{location.website && <p>Website: {location.website}</p>}
					</div>
				</div>

				<div className="space-y-4 rounded-md border p-4">
					<h2 className="font-medium">Coordinates</h2>
					<div className="space-y-1 text-muted-foreground text-sm">
						<p>Latitude: {location.latitude}</p>
						<p>Longitude: {location.longitude}</p>
					</div>
				</div>
			</div>
		</div>
	);
}
