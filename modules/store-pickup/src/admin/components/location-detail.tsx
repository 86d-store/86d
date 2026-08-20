"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import LocationDetailTemplate from "./location-detail.mdx";

// ─── Types ────────────────────────────────────────────────────────────────────

interface LocationData {
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
}

interface WindowItem {
	id: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	capacity: number;
	active: boolean;
}

interface BlackoutItem {
	id: string;
	date: string;
	reason?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DAY_NAMES = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];

const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
const labelCls = "mb-1 block font-medium text-foreground text-sm";

const WIN_SKELETON_IDS = ["a", "b", "c"] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

// ─── API hook ─────────────────────────────────────────────────────────────────

function useLocationDetailApi(locationId: string) {
	const client = useModuleClient();
	return {
		location:
			client.module("store-pickup").admin["/admin/store-pickup/locations/:id"],
		updateLocation:
			client.module("store-pickup").admin[
				"/admin/store-pickup/locations/:id/update"
			],
		windows: client.module("store-pickup").admin["/admin/store-pickup/windows"],
		createWindow:
			client.module("store-pickup").admin["/admin/store-pickup/windows/create"],
		updateWindow:
			client.module("store-pickup").admin[
				"/admin/store-pickup/windows/:id/update"
			],
		deleteWindow:
			client.module("store-pickup").admin[
				"/admin/store-pickup/windows/:id/delete"
			],
		blackouts:
			client.module("store-pickup").admin["/admin/store-pickup/blackouts"],
		createBlackout:
			client.module("store-pickup").admin[
				"/admin/store-pickup/blackouts/create"
			],
		deleteBlackout:
			client.module("store-pickup").admin[
				"/admin/store-pickup/blackouts/:id/delete"
			],
		locationId,
	};
}

// ─── Location edit sheet ──────────────────────────────────────────────────────

interface LocationEditSheetProps {
	location: LocationData;
	onSaved: () => void;
	onCancel: () => void;
	api: ReturnType<typeof useLocationDetailApi>;
}

function LocationEditSheet({
	location,
	onSaved,
	onCancel,
	api,
}: LocationEditSheetProps) {
	const firstInputRef = useRef<HTMLInputElement>(null);
	useEffect(() => {
		firstInputRef.current?.focus();
	}, []);
	const [name, setName] = useState(location.name);
	const [address, setAddress] = useState(location.address);
	const [city, setCity] = useState(location.city);
	const [state, setState] = useState(location.state);
	const [postalCode, setPostalCode] = useState(location.postalCode);
	const [country, setCountry] = useState(location.country);
	const [phone, setPhone] = useState(location.phone ?? "");
	const [email, setEmail] = useState(location.email ?? "");
	const [prepMins, setPrepMins] = useState(String(location.preparationMinutes));
	const [active, setActive] = useState(location.active);
	const [error, setError] = useState("");

	const updateMutation = api.updateLocation.useMutation({
		onSuccess: () => {
			void api.location.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onCancel();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onCancel]);

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (!name.trim() || !address.trim()) {
			setError("Name and address are required");
			return;
		}
		updateMutation.mutate({
			params: { id: location.id },
			body: {
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
			},
		});
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
						Edit Location
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
							<label htmlFor="led-name" className={labelCls}>
								Name
							</label>
							<input
								ref={firstInputRef}
								id="led-name"
								className={inputCls}
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div>
							<label htmlFor="led-address" className={labelCls}>
								Street address
							</label>
							<input
								id="led-address"
								className={inputCls}
								value={address}
								onChange={(e) => setAddress(e.target.value)}
							/>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label htmlFor="led-city" className={labelCls}>
									City
								</label>
								<input
									id="led-city"
									className={inputCls}
									value={city}
									onChange={(e) => setCity(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="led-state" className={labelCls}>
									State
								</label>
								<input
									id="led-state"
									className={inputCls}
									value={state}
									onChange={(e) => setState(e.target.value)}
								/>
							</div>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label htmlFor="led-zip" className={labelCls}>
									Postal code
								</label>
								<input
									id="led-zip"
									className={inputCls}
									value={postalCode}
									onChange={(e) => setPostalCode(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="led-country" className={labelCls}>
									Country
								</label>
								<input
									id="led-country"
									className={inputCls}
									value={country}
									maxLength={2}
									onChange={(e) => setCountry(e.target.value)}
								/>
							</div>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label htmlFor="led-phone" className={labelCls}>
									Phone
								</label>
								<input
									id="led-phone"
									type="tel"
									className={inputCls}
									value={phone}
									onChange={(e) => setPhone(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="led-email" className={labelCls}>
									Email
								</label>
								<input
									id="led-email"
									type="email"
									className={inputCls}
									value={email}
									onChange={(e) => setEmail(e.target.value)}
								/>
							</div>
						</div>
						<div>
							<label htmlFor="led-prep" className={labelCls}>
								Preparation time (minutes)
							</label>
							<input
								id="led-prep"
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
							disabled={updateMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{updateMutation.isPending ? "Saving..." : "Save Changes"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ─── Window sheet ─────────────────────────────────────────────────────────────

interface WindowSheetProps {
	locationId: string;
	window?: WindowItem;
	onSaved: () => void;
	onCancel: () => void;
	api: ReturnType<typeof useLocationDetailApi>;
}

function WindowSheet({
	locationId,
	window: win,
	onSaved,
	onCancel,
	api,
}: WindowSheetProps) {
	const isEditing = !!win;
	const [dayOfWeek, setDayOfWeek] = useState(String(win?.dayOfWeek ?? 1));
	const [startTime, setStartTime] = useState(win?.startTime ?? "09:00");
	const [endTime, setEndTime] = useState(win?.endTime ?? "17:00");
	const [capacity, setCapacity] = useState(String(win?.capacity ?? 10));
	const [active, setActive] = useState(win?.active ?? true);
	const [error, setError] = useState("");

	const createMutation = api.createWindow.useMutation({
		onSuccess: () => {
			void api.windows.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const updateMutation = api.updateWindow.useMutation({
		onSuccess: () => {
			void api.windows.invalidate();
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

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
		if (!timePattern.test(startTime) || !timePattern.test(endTime)) {
			setError("Times must be in HH:MM format");
			return;
		}

		if (isEditing) {
			updateMutation.mutate({
				params: { id: win.id },
				body: {
					dayOfWeek: Number.parseInt(dayOfWeek, 10),
					startTime,
					endTime,
					capacity: Number.parseInt(capacity, 10) || 1,
					active,
				},
			});
		} else {
			createMutation.mutate({
				body: {
					locationId,
					dayOfWeek: Number.parseInt(dayOfWeek, 10),
					startTime,
					endTime,
					capacity: Number.parseInt(capacity, 10) || 1,
					active,
				},
			});
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
				className="relative flex h-full w-full max-w-sm flex-col overflow-y-auto border-border border-l bg-background shadow-2xl"
			>
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						{isEditing ? "Edit Window" : "New Window"}
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
							<label htmlFor="ws-day" className={labelCls}>
								Day
							</label>
							<select
								id="ws-day"
								className={inputCls}
								value={dayOfWeek}
								onChange={(e) => setDayOfWeek(e.target.value)}
							>
								{DAY_NAMES.map((d, i) => (
									<option key={d} value={i}>
										{d}
									</option>
								))}
							</select>
						</div>
						<div className="grid gap-3 sm:grid-cols-2">
							<div>
								<label htmlFor="ws-start" className={labelCls}>
									Start time
								</label>
								<input
									id="ws-start"
									type="time"
									className={inputCls}
									value={startTime}
									onChange={(e) => setStartTime(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="ws-end" className={labelCls}>
									End time
								</label>
								<input
									id="ws-end"
									type="time"
									className={inputCls}
									value={endTime}
									onChange={(e) => setEndTime(e.target.value)}
								/>
							</div>
						</div>
						<div>
							<label htmlFor="ws-cap" className={labelCls}>
								Capacity (orders per slot)
							</label>
							<input
								id="ws-cap"
								type="number"
								min="1"
								className={inputCls}
								value={capacity}
								onChange={(e) => setCapacity(e.target.value)}
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
									: "Adding..."
								: isEditing
									? "Save Changes"
									: "Add Window"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LocationDetail({ locationId }: { locationId: string }) {
	const api = useLocationDetailApi(locationId);
	const [showEditLocation, setShowEditLocation] = useState(false);
	const [showCreateWindow, setShowCreateWindow] = useState(false);
	const [editWindow, setEditWindow] = useState<WindowItem | null>(null);
	const [blackoutDate, setBlackoutDate] = useState("");
	const [blackoutReason, setBlackoutReason] = useState("");

	const { data: locData, isLoading: loadingLoc } = api.location.useQuery({
		id: locationId,
	}) as {
		data: { location: LocationData } | undefined;
		isLoading: boolean;
	};

	const { data: winData, isLoading: loadingWin } = api.windows.useQuery({
		locationId,
	}) as {
		data: { windows: WindowItem[] } | undefined;
		isLoading: boolean;
	};

	const { data: blackoutData, isLoading: loadingBlackouts } =
		api.blackouts.useQuery({ locationId }) as {
			data: { blackouts: BlackoutItem[] } | undefined;
			isLoading: boolean;
		};

	const deleteWindowMutation = api.deleteWindow.useMutation({
		onSuccess: () => void api.windows.invalidate(),
	});

	const createBlackoutMutation = api.createBlackout.useMutation({
		onSuccess: () => {
			void api.blackouts.invalidate();
			setBlackoutDate("");
			setBlackoutReason("");
		},
	});

	const deleteBlackoutMutation = api.deleteBlackout.useMutation({
		onSuccess: () => void api.blackouts.invalidate(),
	});

	const location = locData?.location;
	const windows = winData?.windows ?? [];
	const blackouts = blackoutData?.blackouts ?? [];

	if (loadingLoc) {
		return (
			<LocationDetailTemplate>
				<div className="space-y-3">
					{WIN_SKELETON_IDS.map((id) => (
						<div
							key={`ld-skel-${id}`}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			</LocationDetailTemplate>
		);
	}

	if (!location) {
		return (
			<LocationDetailTemplate>
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">Location not found.</p>
				</div>
			</LocationDetailTemplate>
		);
	}

	return (
		<LocationDetailTemplate>
			{/* Sheet overlays */}
			{showEditLocation ? (
				<LocationEditSheet
					location={location}
					onSaved={() => setShowEditLocation(false)}
					onCancel={() => setShowEditLocation(false)}
					api={api}
				/>
			) : null}
			{showCreateWindow ? (
				<WindowSheet
					locationId={locationId}
					onSaved={() => setShowCreateWindow(false)}
					onCancel={() => setShowCreateWindow(false)}
					api={api}
				/>
			) : null}
			{editWindow ? (
				<WindowSheet
					locationId={locationId}
					window={editWindow}
					onSaved={() => setEditWindow(null)}
					onCancel={() => setEditWindow(null)}
					api={api}
				/>
			) : null}

			{/* Location info card */}
			<div className="mb-6 rounded-lg border border-border bg-card p-4">
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<h2 className="font-semibold text-foreground text-lg">
								{location.name}
							</h2>
							<span
								className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
									location.active
										? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
										: "bg-muted text-muted-foreground"
								}`}
							>
								{location.active ? "Active" : "Inactive"}
							</span>
						</div>
						<p className="text-muted-foreground text-sm">
							{location.address}, {location.city}, {location.state}{" "}
							{location.postalCode}
						</p>
						{location.phone ? (
							<p className="text-muted-foreground text-xs">{location.phone}</p>
						) : null}
						{location.email ? (
							<p className="text-muted-foreground text-xs">{location.email}</p>
						) : null}
						<p className="text-muted-foreground text-xs">
							Prep time:{" "}
							<strong className="text-foreground">
								{location.preparationMinutes} min
							</strong>
						</p>
					</div>
					<button
						type="button"
						onClick={() => setShowEditLocation(true)}
						className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
					>
						Edit
					</button>
				</div>
			</div>

			{/* Pickup Windows section */}
			<div className="mb-6">
				<div className="mb-4 flex items-center justify-between">
					<h3 className="font-semibold text-foreground">Pickup Windows</h3>
					<button
						type="button"
						onClick={() => setShowCreateWindow(true)}
						className="rounded-lg bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90"
					>
						Add Window
					</button>
				</div>

				{loadingWin ? (
					<div className="space-y-2">
						{WIN_SKELETON_IDS.map((id) => (
							<div
								key={`win-skel-${id}`}
								className="h-12 animate-pulse rounded-lg border border-border bg-muted/30"
							/>
						))}
					</div>
				) : windows.length === 0 ? (
					<div className="rounded-lg border border-border bg-card p-6 text-center">
						<p className="text-muted-foreground text-sm">
							No pickup windows configured.
						</p>
						<button
							type="button"
							onClick={() => setShowCreateWindow(true)}
							className="mt-3 rounded-lg bg-foreground px-3 py-1.5 font-medium text-background text-sm hover:opacity-90"
						>
							Add Window
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
										Day
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Window
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Capacity
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
								{windows.map((w) => (
									<tr
										key={w.id}
										className="transition-colors hover:bg-muted/50"
									>
										<td className="px-4 py-2 text-foreground text-sm">
											{DAY_NAMES[w.dayOfWeek]}
										</td>
										<td className="px-4 py-2 text-foreground text-sm">
											{w.startTime} – {w.endTime}
										</td>
										<td className="px-4 py-2 text-muted-foreground text-sm">
											{w.capacity}
										</td>
										<td className="px-4 py-2">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
													w.active
														? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
														: "bg-muted text-muted-foreground"
												}`}
											>
												{w.active ? "Active" : "Inactive"}
											</span>
										</td>
										<td className="px-4 py-2">
											<div className="flex gap-1">
												<button
													type="button"
													onClick={() => setEditWindow(w)}
													className="rounded px-2 py-1 text-xs hover:bg-muted"
												>
													Edit
												</button>
												<button
													type="button"
													onClick={() => {
														if (window.confirm("Delete this pickup window?")) {
															deleteWindowMutation.mutate({
																params: { id: w.id },
															});
														}
													}}
													disabled={deleteWindowMutation.isPending}
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
			</div>

			{/* Blackout dates section */}
			<div>
				<h3 className="mb-4 font-semibold text-foreground">Blackout Dates</h3>

				{/* Add blackout form */}
				<div className="mb-4 flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
					<div className="flex-1">
						<label htmlFor="bo-date" className={labelCls}>
							Date
						</label>
						<input
							id="bo-date"
							type="date"
							className={inputCls}
							value={blackoutDate}
							onChange={(e) => setBlackoutDate(e.target.value)}
						/>
					</div>
					<div className="flex-1">
						<label htmlFor="bo-reason" className={labelCls}>
							Reason (optional)
						</label>
						<input
							id="bo-reason"
							className={inputCls}
							value={blackoutReason}
							onChange={(e) => setBlackoutReason(e.target.value)}
							placeholder="Holiday, renovation, etc."
						/>
					</div>
					<button
						type="button"
						disabled={!blackoutDate || createBlackoutMutation.isPending}
						onClick={() => {
							if (!blackoutDate) return;
							createBlackoutMutation.mutate({
								body: {
									locationId,
									date: blackoutDate,
									...(blackoutReason.trim()
										? { reason: blackoutReason.trim() }
										: {}),
								},
							});
						}}
						className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
					>
						{createBlackoutMutation.isPending ? "Adding..." : "Add Blackout"}
					</button>
				</div>

				{loadingBlackouts ? (
					<div className="h-12 animate-pulse rounded-lg border border-border bg-muted/30" />
				) : blackouts.length === 0 ? (
					<div className="rounded-lg border border-border bg-card p-6 text-center">
						<p className="text-muted-foreground text-sm">
							No blackout dates set.
						</p>
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
										Date
									</th>
									<th
										scope="col"
										className="px-4 py-2 font-medium text-muted-foreground"
									>
										Reason
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
								{blackouts.map((b) => (
									<tr
										key={b.id}
										className="transition-colors hover:bg-muted/50"
									>
										<td className="px-4 py-2 font-medium text-foreground">
											{b.date}
										</td>
										<td className="px-4 py-2 text-muted-foreground text-xs">
											{b.reason ?? "—"}
										</td>
										<td className="px-4 py-2">
											<button
												type="button"
												onClick={() => {
													if (window.confirm("Remove this blackout date?")) {
														deleteBlackoutMutation.mutate({
															params: { id: b.id },
														});
													}
												}}
												disabled={deleteBlackoutMutation.isPending}
												className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
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
		</LocationDetailTemplate>
	);
}
