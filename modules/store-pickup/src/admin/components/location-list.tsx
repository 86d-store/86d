"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import LocationListTemplate from "./location-list.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocationItem {
	id: string;
	name: string;
	address: string;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string;
	email?: string;
	preparationMinutes: number;
	active: boolean;
	sortOrder: number;
}

interface SummaryData {
	totalLocations: number;
	activeLocations: number;
	totalWindows: number;
	activeWindows: number;
	totalPickups: number;
	scheduledPickups: number;
	preparingPickups: number;
	readyPickups: number;
	completedPickups: number;
	cancelledPickups: number;
	blackoutDates: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
const labelCls = "mb-1 block font-medium text-foreground text-sm";

const SKELETON_IDS = ["a", "b", "c"] as const;

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

// ─── API hook ─────────────────────────────────────────────────────────────────

function useLocationsApi() {
	const client = useModuleClient();
	return {
		list: client.module("store-pickup").admin["/admin/store-pickup/locations"],
		create:
			client.module("store-pickup").admin[
				"/admin/store-pickup/locations/create"
			],
		update:
			client.module("store-pickup").admin[
				"/admin/store-pickup/locations/:id/update"
			],
		remove:
			client.module("store-pickup").admin[
				"/admin/store-pickup/locations/:id/delete"
			],
		summary: client.module("store-pickup").admin["/admin/store-pickup/summary"],
	};
}

// ─── Location sheet ───────────────────────────────────────────────────────────

interface LocationSheetProps {
	location?: LocationItem;
	onSaved: () => void;
	onCancel: () => void;
}

function LocationSheet({ location, onSaved, onCancel }: LocationSheetProps) {
	const api = useLocationsApi();
	const isEditing = !!location;

	const [name, setName] = useState(location?.name ?? "");
	const [address, setAddress] = useState(location?.address ?? "");
	const [city, setCity] = useState(location?.city ?? "");
	const [state, setState] = useState(location?.state ?? "");
	const [postalCode, setPostalCode] = useState(location?.postalCode ?? "");
	const [country, setCountry] = useState(location?.country ?? "US");
	const [phone, setPhone] = useState(location?.phone ?? "");
	const [email, setEmail] = useState(location?.email ?? "");
	const [prepMins, setPrepMins] = useState(
		String(location?.preparationMinutes ?? 30),
	);
	const [active, setActive] = useState(location?.active ?? true);
	const [error, setError] = useState("");

	const createMutation = api.create.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const updateMutation = api.update.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onCancel();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onCancel]);
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (!name.trim()) {
			setError("Name is required");
			return;
		}
		if (
			!address.trim() ||
			!city.trim() ||
			!state.trim() ||
			!postalCode.trim()
		) {
			setError("Full address is required");
			return;
		}

		const body = {
			name: name.trim(),
			address: address.trim(),
			city: city.trim(),
			state: state.trim(),
			postalCode: postalCode.trim(),
			country: country.trim() || "US",
			...(phone.trim() ? { phone: phone.trim() } : {}),
			...(email.trim() ? { email: email.trim() } : {}),
			preparationMinutes: Number.parseInt(prepMins, 10) || 0,
			active,
		};

		if (isEditing) {
			updateMutation.mutate({ params: { id: location.id }, body });
		} else {
			createMutation.mutate({ body });
		}
	}

	return (
		<div className="fixed inset-0 z-50 flex justify-end">
			<button
				type="button"
				className="absolute inset-0 cursor-default bg-black/40"
				aria-label="Close panel"
				onClick={onCancel}
			/>
			<div
				role="dialog"
				aria-modal="true"
				className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-border border-l bg-background shadow-2xl"
			>
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						{isEditing ? "Edit Location" : "New Location"}
					</h2>
					<button
						type="button"
						onClick={onCancel}
						className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
						aria-label="Close"
					>
						✕
					</button>
				</div>

				<form
					onSubmit={handleSubmit}
					className="flex flex-1 flex-col gap-5 px-6 py-6"
				>
					{error ? (
						<div
							role="alert"
							className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-destructive text-sm"
						>
							{error}
						</div>
					) : null}

					<div className="space-y-4">
						<div>
							<label htmlFor="ll-name" className={labelCls}>
								Name <span className="text-destructive">*</span>
							</label>
							<input
								id="ll-name"
								ref={firstInputRef}
								className={inputCls}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Main Store"
							/>
						</div>
						<div>
							<label htmlFor="ll-address" className={labelCls}>
								Street address <span className="text-destructive">*</span>
							</label>
							<input
								id="ll-address"
								className={inputCls}
								value={address}
								onChange={(e) => setAddress(e.target.value)}
								placeholder="123 Main St"
							/>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label htmlFor="ll-city" className={labelCls}>
									City <span className="text-destructive">*</span>
								</label>
								<input
									id="ll-city"
									className={inputCls}
									value={city}
									onChange={(e) => setCity(e.target.value)}
									placeholder="Springfield"
								/>
							</div>
							<div>
								<label htmlFor="ll-state" className={labelCls}>
									State <span className="text-destructive">*</span>
								</label>
								<input
									id="ll-state"
									className={inputCls}
									value={state}
									onChange={(e) => setState(e.target.value)}
									placeholder="IL"
								/>
							</div>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label htmlFor="ll-zip" className={labelCls}>
									Postal code <span className="text-destructive">*</span>
								</label>
								<input
									id="ll-zip"
									className={inputCls}
									value={postalCode}
									onChange={(e) => setPostalCode(e.target.value)}
									placeholder="62701"
								/>
							</div>
							<div>
								<label htmlFor="ll-country" className={labelCls}>
									Country
								</label>
								<input
									id="ll-country"
									className={inputCls}
									value={country}
									onChange={(e) => setCountry(e.target.value)}
									placeholder="US"
									maxLength={2}
								/>
							</div>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label htmlFor="ll-phone" className={labelCls}>
									Phone
								</label>
								<input
									id="ll-phone"
									type="tel"
									className={inputCls}
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
									placeholder="(555) 000-0000"
								/>
							</div>
							<div>
								<label htmlFor="ll-email" className={labelCls}>
									Email
								</label>
								<input
									id="ll-email"
									type="email"
									className={inputCls}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									placeholder="pickup@store.com"
								/>
							</div>
						</div>
						<div>
							<label htmlFor="ll-prep" className={labelCls}>
								Preparation time (minutes)
							</label>
							<input
								id="ll-prep"
								type="number"
								min="0"
								className={inputCls}
								value={prepMins}
								onChange={(e) => setPrepMins(e.target.value)}
							/>
						</div>
						<label className="flex cursor-pointer items-center gap-3">
							<input
								type="checkbox"
								checked={active}
								onChange={(e) => setActive(e.target.checked)}
								className="h-4 w-4 rounded border-border accent-foreground"
							/>
							<span className="text-foreground text-sm">Active</span>
						</label>
					</div>

					<div className="mt-auto flex justify-end gap-2 border-border border-t pt-4">
						<button
							type="button"
							onClick={onCancel}
							className="rounded-lg border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="submit"
							disabled={isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{isPending
								? isEditing
									? "Saving..."
									: "Creating..."
								: isEditing
									? "Save Changes"
									: "Add Location"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LocationList() {
	const api = useLocationsApi();
	const [activeFilter, setActiveFilter] = useState("");
	const [showCreate, setShowCreate] = useState(false);
	const [editLocation, setEditLocation] = useState<LocationItem | null>(null);

	const { data: listData, isLoading: loading } = api.list.useQuery({
		take: "50",
		...(activeFilter ? { active: activeFilter } : {}),
	}) as {
		data: { locations: LocationItem[] } | undefined;
		isLoading: boolean;
	};

	const { data: summaryData } = api.summary.useQuery({}) as {
		data: { summary: SummaryData } | undefined;
	};

	const deleteMutation = api.remove.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			void api.summary.invalidate();
		},
	});

	const locations = listData?.locations ?? [];
	const summary = summaryData?.summary;

	const handleDelete = (loc: LocationItem) => {
		if (
			!window.confirm(
				`Delete location "${loc.name}"? This also removes all pickup windows and blackout dates.`,
			)
		)
			return;
		deleteMutation.mutate({ params: { id: loc.id } });
	};

	return (
		<LocationListTemplate>
			{/* Sheet overlays */}
			{showCreate ? (
				<LocationSheet
					onSaved={() => setShowCreate(false)}
					onCancel={() => setShowCreate(false)}
				/>
			) : null}
			{editLocation ? (
				<LocationSheet
					location={editLocation}
					onSaved={() => setEditLocation(null)}
					onCancel={() => setEditLocation(null)}
				/>
			) : null}

			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<h2 className="font-semibold text-foreground text-lg">Locations</h2>
				<button
					type="button"
					onClick={() => setShowCreate(true)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					Add Location
				</button>
			</div>

			{/* Summary cards */}
			{summary ? (
				<div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs">Locations</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{summary.totalLocations}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs">Active</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{summary.activeLocations}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs">Scheduled</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{summary.scheduledPickups}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="text-muted-foreground text-xs">Ready</p>
						<p className="mt-1 font-bold text-2xl text-green-600">
							{summary.readyPickups}
						</p>
					</div>
				</div>
			) : null}

			{/* Filter */}
			<div className="mb-4">
				<select
					value={activeFilter}
					onChange={(e) => setActiveFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
				>
					<option value="">All</option>
					<option value="true">Active</option>
					<option value="false">Inactive</option>
				</select>
			</div>

			{/* List */}
			{loading ? (
				<div className="space-y-3">
					{SKELETON_IDS.map((id) => (
						<div
							key={`loc-skel-${id}`}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : locations.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-10 text-center">
					<p className="font-medium text-foreground text-sm">
						No locations yet
					</p>
					<p className="mt-1 text-muted-foreground text-xs">
						Add a pickup location to get started
					</p>
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
					>
						Add Location
					</button>
				</div>
			) : (
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-border border-b bg-muted">
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Name
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Address
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Prep
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{locations.map((loc) => (
								<tr
									key={loc.id}
									className="transition-colors hover:bg-muted/50"
								>
									<td className="px-4 py-2 font-medium text-foreground">
										{loc.name}
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{loc.address}, {loc.city}, {loc.state} {loc.postalCode}
									</td>
									<td className="px-4 py-2 text-muted-foreground text-xs">
										{loc.preparationMinutes} min
									</td>
									<td className="px-4 py-2">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												loc.active
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{loc.active ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="px-4 py-2">
										<div className="flex gap-1">
											<button
												type="button"
												onClick={() => setEditLocation(loc)}
												className="rounded px-2 py-1 text-xs hover:bg-muted"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => handleDelete(loc)}
												disabled={deleteMutation.isPending}
												className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
											>
												Delete
											</button>
										</div>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</LocationListTemplate>
	);
}
