"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

function useStoreLocatorAdminApi() {
	const client = useModuleClient();
	const api = client.module("store-locator").admin;

	return {
		listLocations: api["/admin/store-locator/locations"],
		getStats: api["/admin/store-locator/stats"],
		deleteLocation: api["/admin/store-locator/locations/:id/delete"],
	};
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "body" in err) {
		const body = (err as { body: { message?: string } }).body;
		return body?.message ?? "An error occurred";
	}
	return "An error occurred";
}

export function LocationList() {
	const api = useStoreLocatorAdminApi();
	const [countryFilter, setCountryFilter] = useState("");
	const [error, setError] = useState("");

	interface LocationItem {
		id: string;
		name: string;
		city: string;
		country: string;
		isActive: boolean;
		isFeatured: boolean;
		pickupEnabled: boolean;
	}

	interface ListResult {
		locations?: LocationItem[] | undefined;
	}

	const { data, isLoading } = api.listLocations.useQuery({
		query: {
			...(countryFilter && { country: countryFilter }),
		},
	}) as { data: ListResult | undefined; isLoading: boolean };

	const deleteMutation = api.deleteLocation.useMutation({
		onSuccess: () => {
			api.listLocations.invalidate();
			api.getStats.invalidate();
		},
		onError: (err: unknown) => setError(extractError(err)),
	});

	const handleDelete = (id: string, name: string) => {
		if (confirm(`Delete location "${name}"? This cannot be undone.`)) {
			deleteMutation.mutate({ params: { id } });
		}
	};

	if (isLoading) {
		return (
			<div className="p-6 text-muted-foreground">Loading locations...</div>
		);
	}

	const locations = data?.locations ?? [];

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="font-bold text-2xl">Store Locations</h1>
				<a
					href="/admin/store-locator/new"
					className="rounded-md bg-foreground px-4 py-2 text-background text-sm"
				>
					Add Location
				</a>
			</div>

			{error && (
				<div className="rounded-md bg-red-50 p-3 text-red-700 text-sm">
					{error}
				</div>
			)}

			<div className="flex gap-3">
				<input
					type="text"
					placeholder="Filter by country..."
					value={countryFilter}
					onChange={(e) => setCountryFilter(e.target.value)}
					className="rounded-md border px-3 py-2 text-sm"
				/>
			</div>

			{locations.length === 0 ? (
				<div className="rounded-md border p-8 text-center text-muted-foreground">
					No locations found. Add your first store location.
				</div>
			) : (
				<div className="overflow-hidden rounded-md border">
					<table className="w-full text-sm">
						<thead className="bg-muted">
							<tr>
								<th scope="col" className="px-4 py-3 text-left font-medium">
									Name
								</th>
								<th scope="col" className="px-4 py-3 text-left font-medium">
									City
								</th>
								<th scope="col" className="px-4 py-3 text-left font-medium">
									Country
								</th>
								<th scope="col" className="px-4 py-3 text-left font-medium">
									Status
								</th>
								<th scope="col" className="px-4 py-3 text-left font-medium">
									Pickup
								</th>
								<th scope="col" className="px-4 py-3 text-right font-medium">
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y">
							{locations.map((loc) => (
								<tr key={loc.id} className="hover:bg-muted/50">
									<td className="px-4 py-3">
										<a
											href={`/admin/store-locator/${loc.id}`}
											className="font-medium hover:underline"
										>
											{loc.name}
										</a>
										{loc.isFeatured && (
											<span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-amber-700 text-xs">
												Featured
											</span>
										)}
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{loc.city}
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{loc.country}
									</td>
									<td className="px-4 py-3">
										<span
											className={`rounded-full px-2 py-0.5 text-xs ${
												loc.isActive
													? "bg-green-100 text-green-700"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{loc.isActive ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{loc.pickupEnabled ? "Yes" : "No"}
									</td>
									<td className="px-4 py-3 text-right">
										<button
											type="button"
											onClick={() => handleDelete(loc.id, loc.name)}
											disabled={deleteMutation.isPending}
											className="text-red-600 hover:text-red-800 disabled:opacity-50"
										>
											Delete
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
