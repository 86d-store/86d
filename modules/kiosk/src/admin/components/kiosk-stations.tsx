"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface KioskStation {
	id: string;
	name: string;
	location?: string;
	isOnline: boolean;
	isActive: boolean;
	lastHeartbeat?: string;
	currentSessionId?: string;
	settings: Record<string, unknown>;
	createdAt: string;
	updatedAt: string;
}

interface KioskSession {
	id: string;
	stationId: string;
	status: "active" | "completed" | "abandoned" | "timed-out";
	subtotal: number;
	tax: number;
	tip: number;
	total: number;
	paymentMethod?: string;
	paymentStatus: "pending" | "paid" | "failed";
	startedAt: string;
	completedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
const labelCls = "mb-1 block font-medium text-foreground text-sm";

function formatDate(dateStr: string) {
	return new Date(dateStr).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
		hour: "2-digit",
		minute: "2-digit",
	});
}

function formatMoney(cents: number) {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

const SESSION_STATUS_COLORS: Record<string, string> = {
	active:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	completed: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
	abandoned: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
	"timed-out":
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
	paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	pending:
		"bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
	failed: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const SKELETON_IDS = ["a", "b", "c", "d"] as const;
const SESSION_SKELETON_IDS = ["a", "b", "c"] as const;

// ─── API hook ─────────────────────────────────────────────────────────────────

function useKioskApi() {
	const client = useModuleClient();
	return {
		listStations: client.module("kiosk").admin["/admin/kiosk/stations"],
		createStation: client.module("kiosk").admin["/admin/kiosk/stations/create"],
		updateStation: client.module("kiosk").admin["/admin/kiosk/stations/:id"],
		deleteStation:
			client.module("kiosk").admin["/admin/kiosk/stations/:id/delete"],
		listSessions: client.module("kiosk").admin["/admin/kiosk/sessions"],
	};
}

// ─── Station sheet ────────────────────────────────────────────────────────────

interface StationSheetProps {
	station?: KioskStation;
	onSaved: () => void;
	onCancel: () => void;
}

function StationSheet({ station, onSaved, onCancel }: StationSheetProps) {
	const api = useKioskApi();
	const isEditing = !!station;

	const [name, setName] = useState(station?.name ?? "");
	const [location, setLocation] = useState(station?.location ?? "");
	const [isActive, setIsActive] = useState(station?.isActive ?? true);
	const [error, setError] = useState("");

	const createMutation = api.createStation.useMutation({
		onSuccess: () => {
			void api.listStations.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const updateMutation = api.updateStation.useMutation({
		onSuccess: () => {
			void api.listStations.invalidate();
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
			setError("Station name is required");
			return;
		}

		if (isEditing) {
			updateMutation.mutate({
				params: { id: station.id },
				body: {
					name: name.trim(),
					location: location.trim() || undefined,
					isActive,
				},
			});
		} else {
			createMutation.mutate({
				body: {
					name: name.trim(),
					location: location.trim() || undefined,
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
				className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-border border-l bg-background shadow-2xl"
			>
				{/* Header */}
				<div className="flex shrink-0 items-center justify-between border-border border-b px-6 py-4">
					<h2 className="font-semibold text-foreground text-lg">
						{isEditing ? "Edit Station" : "New Station"}
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

				{/* Body */}
				<form
					onSubmit={handleSubmit}
					className="flex flex-1 flex-col gap-6 px-6 py-6"
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
							<label htmlFor="ks-name" className={labelCls}>
								Name <span className="text-destructive">*</span>
							</label>
							<input
								id="ks-name"
								ref={firstInputRef}
								className={inputCls}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Front Counter"
							/>
						</div>

						<div>
							<label htmlFor="ks-location" className={labelCls}>
								Location
							</label>
							<input
								id="ks-location"
								className={inputCls}
								value={location}
								onChange={(e) => setLocation(e.target.value)}
								placeholder="Lobby, Gate A, etc."
							/>
						</div>

						{isEditing ? (
							<label className="flex cursor-pointer items-center gap-3">
								<input
									type="checkbox"
									checked={isActive}
									onChange={(e) => setIsActive(e.target.checked)}
									className="h-4 w-4 rounded border-border accent-foreground"
								/>
								<span className="text-foreground text-sm">Active</span>
							</label>
						) : null}
					</div>

					{/* Footer */}
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
									: "Create Station"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

// ─── Sessions table ───────────────────────────────────────────────────────────

interface SessionsTableProps {
	stations: KioskStation[];
}

function SessionsTable({ stations }: SessionsTableProps) {
	const api = useKioskApi();
	const [stationFilter, setStationFilter] = useState("");
	const [statusFilter, setStatusFilter] = useState("");

	const { data, isLoading } = api.listSessions.useQuery({
		...(stationFilter ? { stationId: stationFilter } : {}),
		...(statusFilter
			? {
					status: statusFilter as
						| "active"
						| "completed"
						| "abandoned"
						| "timed-out",
				}
			: {}),
	}) as {
		data: { sessions?: KioskSession[]; total?: number } | undefined;
		isLoading: boolean;
	};

	const sessions = data?.sessions ?? [];

	return (
		<div>
			<div className="mb-4 flex flex-wrap gap-3">
				<select
					aria-label="Filter by station"
					value={stationFilter}
					onChange={(e) => setStationFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
				>
					<option value="">All stations</option>
					{stations.map((s) => (
						<option key={s.id} value={s.id}>
							{s.name}
						</option>
					))}
				</select>
				<select
					aria-label="Filter by status"
					value={statusFilter}
					onChange={(e) => setStatusFilter(e.target.value)}
					className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
				>
					<option value="">All statuses</option>
					<option value="active">Active</option>
					<option value="completed">Completed</option>
					<option value="abandoned">Abandoned</option>
					<option value="timed-out">Timed out</option>
				</select>
			</div>

			{isLoading ? (
				<div className="space-y-2">
					{SESSION_SKELETON_IDS.map((id) => (
						<div
							key={`sess-skel-${id}`}
							className="h-12 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : sessions.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">No sessions found.</p>
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
									Session
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Station
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
									Total
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Payment
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Started
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{sessions.map((s) => {
								const stationName = stations.find(
									(st) => st.id === s.stationId,
								)?.name;
								return (
									<tr
										key={s.id}
										className="transition-colors hover:bg-muted/50"
									>
										<td className="px-4 py-2 font-mono text-muted-foreground text-xs">
											{s.id.slice(0, 8)}…
										</td>
										<td className="px-4 py-2 text-foreground text-xs">
											{stationName ?? s.stationId.slice(0, 8)}
										</td>
										<td className="px-4 py-2">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${SESSION_STATUS_COLORS[s.status] ?? "bg-muted text-muted-foreground"}`}
											>
												{s.status}
											</span>
										</td>
										<td className="px-4 py-2 text-foreground text-xs">
											{formatMoney(s.total)}
										</td>
										<td className="px-4 py-2">
											<span
												className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${PAYMENT_STATUS_COLORS[s.paymentStatus] ?? "bg-muted text-muted-foreground"}`}
											>
												{s.paymentStatus}
											</span>
										</td>
										<td className="px-4 py-2 text-muted-foreground text-xs">
											{formatDate(s.startedAt)}
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}

// ─── Main component ───────────────────────────────────────────────────────────

type Tab = "stations" | "sessions";

export function KioskStations() {
	const api = useKioskApi();
	const [tab, setTab] = useState<Tab>("stations");
	const [activeFilter, setActiveFilter] = useState<"" | "true" | "false">("");
	const [showCreate, setShowCreate] = useState(false);
	const [editStation, setEditStation] = useState<KioskStation | null>(null);

	const { data, isLoading } = api.listStations.useQuery({
		...(activeFilter ? { isActive: activeFilter } : {}),
	}) as {
		data: { stations?: KioskStation[]; total?: number } | undefined;
		isLoading: boolean;
	};

	const deleteMutation = api.deleteStation.useMutation({
		onSuccess: () => void api.listStations.invalidate(),
	});

	const stations = data?.stations ?? [];

	const handleDelete = (station: KioskStation) => {
		if (
			!window.confirm(
				`Delete station "${station.name}"? This cannot be undone.`,
			)
		)
			return;
		deleteMutation.mutate({ params: { id: station.id } });
	};

	return (
		<div>
			{/* Sheet overlays */}
			{showCreate ? (
				<StationSheet
					onSaved={() => setShowCreate(false)}
					onCancel={() => setShowCreate(false)}
				/>
			) : null}
			{editStation ? (
				<StationSheet
					station={editStation}
					onSaved={() => setEditStation(null)}
					onCancel={() => setEditStation(null)}
				/>
			) : null}

			{/* Header */}
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Kiosk Stations</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage kiosk terminals and review sessions
					</p>
				</div>
				{tab === "stations" ? (
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
					>
						Add Station
					</button>
				) : null}
			</div>

			{/* Tabs */}
			<div className="mb-5 flex gap-1 border-border border-b">
				{(["stations", "sessions"] as Tab[]).map((t) => (
					<button
						key={t}
						type="button"
						onClick={() => setTab(t)}
						className={`px-4 py-2 text-sm capitalize transition-colors ${
							tab === t
								? "border-foreground border-b-2 font-medium text-foreground"
								: "text-muted-foreground hover:text-foreground"
						}`}
					>
						{t}
					</button>
				))}
			</div>

			{tab === "stations" ? (
				<div>
					{/* Filter */}
					<div className="mb-4">
						<select
							value={activeFilter}
							onChange={(e) =>
								setActiveFilter(e.target.value as "" | "true" | "false")
							}
							className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
						>
							<option value="">All stations</option>
							<option value="true">Active only</option>
							<option value="false">Inactive only</option>
						</select>
					</div>

					{/* Station list */}
					{isLoading ? (
						<div className="space-y-3">
							{SKELETON_IDS.map((id) => (
								<div
									key={`skel-${id}`}
									className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
								/>
							))}
						</div>
					) : stations.length === 0 ? (
						<div className="rounded-lg border border-border bg-card p-10 text-center">
							<p className="font-medium text-foreground text-sm">
								No stations yet
							</p>
							<p className="mt-1 text-muted-foreground text-xs">
								Add a station to get started
							</p>
							<button
								type="button"
								onClick={() => setShowCreate(true)}
								className="mt-4 rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
							>
								Add Station
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
											Location
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground"
										>
											Online
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground"
										>
											Active
										</th>
										<th
											scope="col"
											className="px-4 py-2 font-medium text-muted-foreground"
										>
											Last Heartbeat
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
									{stations.map((station) => (
										<tr
											key={station.id}
											className="transition-colors hover:bg-muted/50"
										>
											<td className="px-4 py-2 font-medium text-foreground">
												{station.name}
											</td>
											<td className="px-4 py-2 text-muted-foreground text-xs">
												{station.location ?? "—"}
											</td>
											<td className="px-4 py-2">
												<span
													className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium text-xs ${
														station.isOnline
															? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
															: "bg-muted text-muted-foreground"
													}`}
												>
													<span
														className={`h-1.5 w-1.5 rounded-full ${station.isOnline ? "bg-green-500" : "bg-muted"}`}
													/>
													{station.isOnline ? "Online" : "Offline"}
												</span>
											</td>
											<td className="px-4 py-2">
												<span
													className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
														station.isActive
															? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
															: "bg-muted text-muted-foreground"
													}`}
												>
													{station.isActive ? "Active" : "Inactive"}
												</span>
											</td>
											<td className="px-4 py-2 text-muted-foreground text-xs">
												{station.lastHeartbeat
													? formatDate(station.lastHeartbeat)
													: "Never"}
											</td>
											<td className="px-4 py-2">
												<div className="flex gap-1">
													<button
														type="button"
														onClick={() => setEditStation(station)}
														className="rounded px-2 py-1 text-xs hover:bg-muted"
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => handleDelete(station)}
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
				</div>
			) : (
				<SessionsTable stations={stations} />
			)}
		</div>
	);
}
