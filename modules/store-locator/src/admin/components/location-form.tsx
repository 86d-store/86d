"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";

function useStoreLocatorAdminApi() {
	const client = useModuleClient();
	const api = client.module("store-locator").admin;

	return {
		getLocation: api["/admin/store-locator/locations/:id"],
		createLocation: api["/admin/store-locator/locations/create"],
		updateLocation: api["/admin/store-locator/locations/:id/update"],
		listLocations: api["/admin/store-locator/locations"],
		getStats: api["/admin/store-locator/stats"],
	};
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "body" in err) {
		const body = (err as { body: { message?: string } }).body;
		return body.message ?? "An error occurred";
	}
	return "An error occurred";
}

interface LocationFormData {
	name: string;
	slug: string;
	description: string;
	address: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	latitude: string;
	longitude: string;
	phone: string;
	email: string;
	website: string;
	imageUrl: string;
	region: string;
	pickupEnabled: boolean;
	isFeatured: boolean;
}

const emptyForm: LocationFormData = {
	name: "",
	slug: "",
	description: "",
	address: "",
	city: "",
	state: "",
	postalCode: "",
	country: "",
	latitude: "",
	longitude: "",
	phone: "",
	email: "",
	website: "",
	imageUrl: "",
	region: "",
	pickupEnabled: false,
	isFeatured: false,
};

export function LocationForm({ locationId }: { locationId?: string }) {
	const api = useStoreLocatorAdminApi();
	const [form, setForm] = useState<LocationFormData>(emptyForm);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const isEdit = Boolean(locationId);

	// Load existing location data for editing
	interface LocationResult {
		location?: Record<string, unknown> | undefined;
	}

	const { data: locationData, isLoading } = api.getLocation.useQuery(
		isEdit ? { params: { id: locationId ?? "" } } : undefined,
	) as { data: LocationResult | undefined; isLoading: boolean };

	const hydrated = useRef(false);
	useEffect(() => {
		if (!locationData?.location || hydrated.current) return;
		hydrated.current = true;
		const loc = locationData.location;
		setForm({
			name: loc.name as string,
			slug: loc.slug as string,
			description: loc.description as string,
			address: loc.address as string,
			city: loc.city as string,
			state: loc.state as string,
			postalCode: loc.postalCode as string,
			country: loc.country as string,
			latitude: String(loc.latitude ?? ""),
			longitude: String(loc.longitude ?? ""),
			phone: loc.phone as string,
			email: loc.email as string,
			website: loc.website as string,
			imageUrl: loc.imageUrl as string,
			region: loc.region as string,
			pickupEnabled: Boolean(loc.pickupEnabled),
			isFeatured: Boolean(loc.isFeatured),
		});
	}, [locationData]);

	const createMutation = api.createLocation.useMutation({
		onSuccess: () => {
			setSuccess("Location created successfully");
			setForm(emptyForm);
			api.listLocations.invalidate();
			api.getStats.invalidate();
		},
		onError: (err: unknown) => setError(extractError(err)),
	});

	const updateMutation = api.updateLocation.useMutation({
		onSuccess: () => {
			setSuccess("Location updated successfully");
			api.listLocations.invalidate();
			api.getStats.invalidate();
		},
		onError: (err: unknown) => setError(extractError(err)),
	});

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSuccess("");

		const lat = Number.parseFloat(form.latitude);
		const lng = Number.parseFloat(form.longitude);

		if (Number.isNaN(lat) || Number.isNaN(lng)) {
			setError("Latitude and longitude must be valid numbers");
			return;
		}

		const payload = {
			name: form.name,
			slug: form.slug,
			address: form.address,
			city: form.city,
			country: form.country,
			latitude: lat,
			longitude: lng,
			pickupEnabled: form.pickupEnabled,
			isFeatured: form.isFeatured,
			...(form.description && { description: form.description }),
			...(form.state && { state: form.state }),
			...(form.postalCode && { postalCode: form.postalCode }),
			...(form.phone && { phone: form.phone }),
			...(form.email && { email: form.email }),
			...(form.website && { website: form.website }),
			...(form.imageUrl && { imageUrl: form.imageUrl }),
			...(form.region && { region: form.region }),
		};

		if (isEdit && locationId) {
			updateMutation.mutate({ params: { id: locationId }, body: payload });
		} else {
			createMutation.mutate({ body: payload });
		}
	};

	const isPending = createMutation.isPending || updateMutation.isPending;

	const updateField = <K extends keyof LocationFormData>(
		key: K,
		value: LocationFormData[K],
	) => setForm((prev) => ({ ...prev, [key]: value }));

	if (isEdit && isLoading) {
		return <div className="p-6 text-muted-foreground">Loading location...</div>;
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<h1 className="font-bold text-2xl">
				{isEdit ? "Edit Location" : "Add Location"}
			</h1>

			{error && (
				<div className="rounded-md bg-red-50 p-3 text-red-700 text-sm">
					{error}
				</div>
			)}
			{success && (
				<div className="rounded-md bg-green-50 p-3 text-green-700 text-sm">
					{success}
				</div>
			)}

			{/* Basic Info */}
			<fieldset className="space-y-4 rounded-md border p-4">
				<legend className="px-2 font-medium text-sm">Basic Information</legend>
				<div className="grid grid-cols-2 gap-4">
					<label className="space-y-1">
						<span className="font-medium text-sm">Name *</span>
						<input
							type="text"
							required
							value={form.name}
							onChange={(e) => updateField("name", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="font-medium text-sm">Slug *</span>
						<input
							type="text"
							required
							value={form.slug}
							onChange={(e) => updateField("slug", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
				</div>
				<label className="block space-y-1">
					<span className="font-medium text-sm">Description</span>
					<textarea
						value={form.description}
						onChange={(e) => updateField("description", e.target.value)}
						rows={3}
						className="w-full rounded-md border px-3 py-2 text-sm"
					/>
				</label>
			</fieldset>

			{/* Address */}
			<fieldset className="space-y-4 rounded-md border p-4">
				<legend className="px-2 font-medium text-sm">Address</legend>
				<label className="block space-y-1">
					<span className="font-medium text-sm">Street Address *</span>
					<input
						type="text"
						required
						value={form.address}
						onChange={(e) => updateField("address", e.target.value)}
						className="w-full rounded-md border px-3 py-2 text-sm"
					/>
				</label>
				<div className="grid grid-cols-2 gap-4">
					<label className="space-y-1">
						<span className="font-medium text-sm">City *</span>
						<input
							type="text"
							required
							value={form.city}
							onChange={(e) => updateField("city", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="font-medium text-sm">State / Province</span>
						<input
							type="text"
							value={form.state}
							onChange={(e) => updateField("state", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
				</div>
				<div className="grid grid-cols-3 gap-4">
					<label className="space-y-1">
						<span className="font-medium text-sm">Postal Code</span>
						<input
							type="text"
							value={form.postalCode}
							onChange={(e) => updateField("postalCode", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="font-medium text-sm">Country *</span>
						<input
							type="text"
							required
							value={form.country}
							onChange={(e) => updateField("country", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="font-medium text-sm">Region</span>
						<input
							type="text"
							value={form.region}
							onChange={(e) => updateField("region", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
				</div>
			</fieldset>

			{/* Coordinates */}
			<fieldset className="space-y-4 rounded-md border p-4">
				<legend className="px-2 font-medium text-sm">Coordinates</legend>
				<div className="grid grid-cols-2 gap-4">
					<label className="space-y-1">
						<span className="font-medium text-sm">Latitude * (-90 to 90)</span>
						<input
							type="number"
							required
							step="any"
							min={-90}
							max={90}
							value={form.latitude}
							onChange={(e) => updateField("latitude", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="font-medium text-sm">
							Longitude * (-180 to 180)
						</span>
						<input
							type="number"
							required
							step="any"
							min={-180}
							max={180}
							value={form.longitude}
							onChange={(e) => updateField("longitude", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
				</div>
			</fieldset>

			{/* Contact */}
			<fieldset className="space-y-4 rounded-md border p-4">
				<legend className="px-2 font-medium text-sm">Contact</legend>
				<div className="grid grid-cols-3 gap-4">
					<label className="space-y-1">
						<span className="font-medium text-sm">Phone</span>
						<input
							type="tel"
							value={form.phone}
							onChange={(e) => updateField("phone", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="font-medium text-sm">Email</span>
						<input
							type="email"
							value={form.email}
							onChange={(e) => updateField("email", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
					<label className="space-y-1">
						<span className="font-medium text-sm">Website</span>
						<input
							type="url"
							value={form.website}
							onChange={(e) => updateField("website", e.target.value)}
							className="w-full rounded-md border px-3 py-2 text-sm"
						/>
					</label>
				</div>
			</fieldset>

			{/* Options */}
			<fieldset className="space-y-4 rounded-md border p-4">
				<legend className="px-2 font-medium text-sm">Options</legend>
				<div className="flex gap-6">
					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={form.pickupEnabled}
							onChange={(e) => updateField("pickupEnabled", e.target.checked)}
						/>
						<span className="text-sm">Click & Collect / Pickup</span>
					</label>
					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={form.isFeatured}
							onChange={(e) => updateField("isFeatured", e.target.checked)}
						/>
						<span className="text-sm">Featured Location</span>
					</label>
				</div>
				<label className="block space-y-1">
					<span className="font-medium text-sm">Image URL</span>
					<input
						type="url"
						value={form.imageUrl}
						onChange={(e) => updateField("imageUrl", e.target.value)}
						className="w-full rounded-md border px-3 py-2 text-sm"
					/>
				</label>
			</fieldset>

			<button
				type="submit"
				disabled={isPending}
				className="rounded-md bg-foreground px-6 py-2 text-background text-sm disabled:opacity-50"
			>
				{isPending
					? "Saving..."
					: isEdit
						? "Update Location"
						: "Create Location"}
			</button>
		</form>
	);
}
