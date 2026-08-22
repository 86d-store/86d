"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useCallback, useEffect, useRef, useState } from "react";
import ShippingAdminTemplate from "./shipping-admin.mdx";

interface ShippingZone {
	id: string;
	name: string;
	countries: string[];
	isActive: boolean;
}

interface ShippingRate {
	id: string;
	zoneId: string;
	name: string;
	price: number;
	minOrderAmount?: number | null;
	maxOrderAmount?: number | null;
	minWeight?: number | null;
	maxWeight?: number | null;
	isActive: boolean;
}

function formatPrice(cents: number): string {
	return new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
	}).format(cents / 100);
}

function extractError(error: Error | null, fallback: string): string {
	if (!error) return fallback;
	const body = (
		error as Error & { body?: { error?: string | { message?: string } } }
	).body;
	if (typeof body?.error === "string") return body.error;
	if (typeof body?.error?.message === "string") return body.error.message;
	return fallback;
}

interface SettingsData {
	status: "connected" | "not_configured" | "error";
	error?: string | undefined;
	accountName?: string | undefined;
	configured: boolean;
	apiConfigured: boolean;
	webhookConfigured: boolean;
	testMode: boolean;
	apiKeyMasked: string | null;
	originConfigured: boolean;
}

interface ShippingOriginAddress {
	name?: string | undefined;
	company?: string | undefined;
	street1: string;
	street2?: string | undefined;
	city: string;
	state: string;
	postalCode: string;
	country: string;
	phone?: string | undefined;
}

interface ShippingConnectionData {
	id: string;
	name: string;
	provider: string;
	mode: string;
	health: string;
	lifecycle: string;
	originAddress: ShippingOriginAddress;
}

const DEFAULT_ORIGIN: ShippingOriginAddress = {
	street1: "",
	city: "",
	state: "",
	postalCode: "",
	country: "US",
};

function useShippingAdminApi() {
	const client = useModuleClient();
	return {
		getSettings: client.module("shipping").admin["/admin/shipping/settings"],
		getConnection:
			client.module("shipping").admin["/admin/shipping/connection"],
		updateConnectionOrigin:
			client.module("shipping").admin["/admin/shipping/connection/origin"],
		listZones: client.module("shipping").admin["/admin/shipping/zones"],
		createZone: client.module("shipping").admin["/admin/shipping/zones/create"],
		updateZone:
			client.module("shipping").admin["/admin/shipping/zones/:id/update"],
		deleteZone:
			client.module("shipping").admin["/admin/shipping/zones/:id/delete"],
		listRates:
			client.module("shipping").admin["/admin/shipping/zones/:id/rates"],
		addRate:
			client.module("shipping").admin["/admin/shipping/zones/:id/rates/add"],
		updateRate:
			client.module("shipping").admin["/admin/shipping/rates/:id/update"],
		deleteRate:
			client.module("shipping").admin["/admin/shipping/rates/:id/delete"],
	};
}

function ConnectionStatus({ settings }: { settings: SettingsData }) {
	if (settings.status === "connected") {
		return (
			<div className="mb-4 flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-900/20">
				<div className="size-2 rounded-full bg-green-500" />
				<div className="flex-1">
					<p className="font-medium text-green-800 text-sm dark:text-green-300">
						EasyPost connected
						{settings.accountName ? ` — ${settings.accountName}` : ""}
					</p>
					<p className="text-green-700 text-xs dark:text-green-400">
						{settings.testMode ? "Test mode" : "Live mode"}
						{settings.apiKeyMasked ? ` · ${settings.apiKeyMasked}` : ""}
					</p>
				</div>
			</div>
		);
	}

	if (settings.status === "error") {
		return (
			<div className="mb-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
				<div className="size-2 rounded-full bg-red-500" />
				<div className="flex-1">
					<p className="font-medium text-red-800 text-sm dark:text-red-300">
						EasyPost connection error
					</p>
					<p className="text-red-700 text-xs dark:text-red-400">
						{settings.error ?? "Unable to verify credentials"}
					</p>
				</div>
			</div>
		);
	}

	return (
		<div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-muted/30 p-3">
			<div className="size-2 rounded-full bg-muted-foreground" />
			<div className="flex-1">
				<p className="font-medium text-foreground text-sm">
					EasyPost not configured
				</p>
				<p className="text-muted-foreground text-xs">
					Set both <code className="text-xs">easypostApiKey</code> and{" "}
					<code className="text-xs">easypostWebhookSecret</code> to enable live
					rates and authenticated tracking updates.
				</p>
			</div>
		</div>
	);
}

function OriginWarningBanner() {
	return (
		<div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
			<div className="size-2 rounded-full bg-amber-500" />
			<div className="flex-1">
				<p className="font-medium text-amber-900 text-sm dark:text-amber-300">
					Ship-from address required
				</p>
				<p className="text-amber-800 text-xs dark:text-amber-400">
					EasyPost credentials are configured, but live shipping quotes need a
					complete ship-from address below.
				</p>
			</div>
		</div>
	);
}

function ShipFromAddressForm({
	initial,
	saving,
	saved,
	error,
	onSave,
}: {
	initial: ShippingOriginAddress;
	saving: boolean;
	saved: boolean;
	error: string;
	onSave: (origin: ShippingOriginAddress) => void;
}) {
	const [form, setForm] = useState<ShippingOriginAddress>(initial);

	useEffect(() => {
		setForm(initial);
	}, [initial]);

	return (
		<div className="mb-6 rounded-lg border border-border bg-card p-4">
			<div className="mb-4">
				<h2 className="font-semibold text-foreground text-sm">
					Ship-from address
				</h2>
				<p className="mt-1 text-muted-foreground text-xs">
					Server-owned origin used for live carrier quotes. Required fields:
					street, city, state, postal code, and country.
				</p>
			</div>
			{error && (
				<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
					{error}
				</p>
			)}
			{saved && (
				<p className="mb-3 rounded-md bg-green-50 px-3 py-2 text-green-700 text-sm dark:bg-green-900/20 dark:text-green-400">
					Ship-from address saved.
				</p>
			)}
			<form
				onSubmit={(e) => {
					e.preventDefault();
					onSave(form);
				}}
				className="grid gap-3 sm:grid-cols-2"
			>
				<div>
					<label
						htmlFor="ship-origin-name"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Name
					</label>
					<input
						id="ship-origin-name"
						value={form.name ?? ""}
						onChange={(e) =>
							setForm((current) => ({ ...current, name: e.target.value }))
						}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div>
					<label
						htmlFor="ship-origin-company"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Company
					</label>
					<input
						id="ship-origin-company"
						value={form.company ?? ""}
						onChange={(e) =>
							setForm((current) => ({ ...current, company: e.target.value }))
						}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div className="sm:col-span-2">
					<label
						htmlFor="ship-origin-street1"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Street address <span className="text-red-500">*</span>
					</label>
					<input
						id="ship-origin-street1"
						required
						value={form.street1}
						onChange={(e) =>
							setForm((current) => ({ ...current, street1: e.target.value }))
						}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div className="sm:col-span-2">
					<label
						htmlFor="ship-origin-street2"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Street address 2
					</label>
					<input
						id="ship-origin-street2"
						value={form.street2 ?? ""}
						onChange={(e) =>
							setForm((current) => ({ ...current, street2: e.target.value }))
						}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div>
					<label
						htmlFor="ship-origin-city"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						City <span className="text-red-500">*</span>
					</label>
					<input
						id="ship-origin-city"
						required
						value={form.city}
						onChange={(e) =>
							setForm((current) => ({ ...current, city: e.target.value }))
						}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div>
					<label
						htmlFor="ship-origin-state"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						State / province <span className="text-red-500">*</span>
					</label>
					<input
						id="ship-origin-state"
						required
						value={form.state}
						onChange={(e) =>
							setForm((current) => ({ ...current, state: e.target.value }))
						}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div>
					<label
						htmlFor="ship-origin-postal"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Postal code <span className="text-red-500">*</span>
					</label>
					<input
						id="ship-origin-postal"
						required
						value={form.postalCode}
						onChange={(e) =>
							setForm((current) => ({ ...current, postalCode: e.target.value }))
						}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div>
					<label
						htmlFor="ship-origin-country"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Country <span className="text-red-500">*</span>
					</label>
					<input
						id="ship-origin-country"
						required
						maxLength={2}
						value={form.country}
						onChange={(e) =>
							setForm((current) => ({
								...current,
								country: e.target.value.toUpperCase(),
							}))
						}
						placeholder="US"
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div className="sm:col-span-2">
					<label
						htmlFor="ship-origin-phone"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Phone
					</label>
					<input
						id="ship-origin-phone"
						value={form.phone ?? ""}
						onChange={(e) =>
							setForm((current) => ({ ...current, phone: e.target.value }))
						}
						className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
					/>
				</div>
				<div className="flex justify-end sm:col-span-2">
					<button
						type="submit"
						disabled={saving}
						className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
					>
						{saving ? "Saving…" : "Save ship-from address"}
					</button>
				</div>
			</form>
		</div>
	);
}

function RateRow({
	rate,
	onDelete,
}: {
	rate: ShippingRate;
	onDelete: () => void;
}) {
	const conditions: string[] = [];
	if (rate.minOrderAmount != null)
		conditions.push(`min order ${formatPrice(rate.minOrderAmount)}`);
	if (rate.maxOrderAmount != null)
		conditions.push(`max order ${formatPrice(rate.maxOrderAmount)}`);
	if (rate.minWeight != null) conditions.push(`min ${rate.minWeight}g`);
	if (rate.maxWeight != null) conditions.push(`max ${rate.maxWeight}g`);

	return (
		<tr className="transition-colors hover:bg-muted/20">
			<td className="py-2 pr-4 pl-12 text-foreground text-sm">{rate.name}</td>
			<td className="px-4 py-2 text-right text-foreground text-sm tabular-nums">
				{formatPrice(rate.price)}
			</td>
			<td className="hidden px-4 py-2 text-muted-foreground text-xs md:table-cell">
				{conditions.length > 0 ? conditions.join(", ") : "—"}
			</td>
			<td className="px-4 py-2">
				{rate.isActive ? (
					<span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
						Active
					</span>
				) : (
					<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
						Inactive
					</span>
				)}
			</td>
			<td className="px-4 py-2 text-right">
				<button
					type="button"
					onClick={onDelete}
					className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
				>
					Delete
				</button>
			</td>
		</tr>
	);
}

interface ZoneRowProps {
	zone: ShippingZone;
	rates: ShippingRate[];
	loadingRates: boolean;
	expanded: boolean;
	onToggle: () => void;
	onDeleteZone: () => void;
	onDeleteRate: (rateId: string) => void;
	onAddRate: () => void;
}

function ZoneRow({
	zone,
	rates,
	loadingRates,
	expanded,
	onToggle,
	onDeleteZone,
	onAddRate,
	onDeleteRate,
}: ZoneRowProps) {
	return (
		<>
			<tr
				className="cursor-pointer transition-colors hover:bg-muted/30"
				onClick={onToggle}
			>
				<td className="px-4 py-3">
					<div className="flex items-center gap-2">
						<svg
							xmlns="http://www.w3.org/2000/svg"
							width="12"
							height="12"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
							className={`flex-shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
						>
							<polyline points="9 18 15 12 9 6" />
						</svg>
						<span className="font-medium text-foreground text-sm">
							{zone.name}
						</span>
					</div>
				</td>
				<td className="hidden px-4 py-3 text-muted-foreground text-sm sm:table-cell">
					{zone.countries.length === 0
						? "All countries"
						: zone.countries.join(", ")}
				</td>
				<td className="px-4 py-3 text-muted-foreground text-sm">
					{rates.length} rate{rates.length !== 1 ? "s" : ""}
				</td>
				<td className="px-4 py-3">
					{zone.isActive ? (
						<span className="rounded-full bg-green-100 px-2 py-0.5 font-medium text-green-800 text-xs dark:bg-green-900/30 dark:text-green-400">
							Active
						</span>
					) : (
						<span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
							Inactive
						</span>
					)}
				</td>
				<td className="px-4 py-3 text-right">
					<button
						type="button"
						onClick={(e) => {
							e.stopPropagation();
							onDeleteZone();
						}}
						className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
					>
						Delete
					</button>
				</td>
			</tr>
			{expanded && (
				<tr>
					<td
						colSpan={5}
						className="border-border border-t bg-muted/10 px-4 py-3"
					>
						<div className="overflow-hidden rounded-md border border-border">
							<table className="w-full">
								<thead>
									<tr className="border-border border-b bg-muted/50">
										<th
											scope="col"
											className="py-2 pr-4 pl-12 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
										>
											Rate name
										</th>
										<th
											scope="col"
											className="px-4 py-2 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
										>
											Price
										</th>
										<th
											scope="col"
											className="hidden px-4 py-2 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
										>
											Conditions
										</th>
										<th
											scope="col"
											className="px-4 py-2 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
										>
											Status
										</th>
										<th
											scope="col"
											className="px-4 py-2 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
										>
											Actions
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{loadingRates ? (
										(["k0", "k1"] as const).map((rowKey) => (
											<tr key={rowKey}>
												{(["c0", "c1", "c2", "c3", "c4"] as const).map(
													(cellKey) => (
														<td key={cellKey} className="px-4 py-2">
															<div className="h-3 w-16 animate-pulse rounded bg-muted" />
														</td>
													),
												)}
											</tr>
										))
									) : rates.length === 0 ? (
										<tr>
											<td
												colSpan={5}
												className="py-4 text-center text-muted-foreground text-sm"
											>
												No rates yet
											</td>
										</tr>
									) : (
										rates.map((r) => (
											<RateRow
												key={r.id}
												rate={r}
												onDelete={() => onDeleteRate(r.id)}
											/>
										))
									)}
								</tbody>
							</table>
						</div>
						<button
							type="button"
							onClick={onAddRate}
							className="mt-2 rounded-md border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
						>
							+ Add rate
						</button>
					</td>
				</tr>
			)}
		</>
	);
}

interface ZoneForm {
	name: string;
	countries: string;
	isActive: boolean;
}

interface RateForm {
	name: string;
	price: string;
	minOrderAmount: string;
	maxOrderAmount: string;
	minWeight: string;
	maxWeight: string;
	isActive: boolean;
}

const DEFAULT_ZONE: ZoneForm = { name: "", countries: "", isActive: true };
const DEFAULT_RATE: RateForm = {
	name: "",
	price: "",
	minOrderAmount: "",
	maxOrderAmount: "",
	minWeight: "",
	maxWeight: "",
	isActive: true,
};

export function ShippingAdmin() {
	const api = useShippingAdminApi();
	const [ratesByZone, setRatesByZone] = useState<
		Record<string, ShippingRate[]>
	>({});
	const [loadingRates, setLoadingRates] = useState<Record<string, boolean>>({});
	const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());

	// Create zone modal
	const zoneNameRef = useRef<HTMLInputElement>(null);
	const [showCreateZone, setShowCreateZone] = useState(false);
	const [zoneForm, setZoneForm] = useState<ZoneForm>(DEFAULT_ZONE);

	// Add rate modal
	const rateNameRef = useRef<HTMLInputElement>(null);
	const [addRateZoneId, setAddRateZoneId] = useState<string | null>(null);
	const [rateForm, setRateForm] = useState<RateForm>(DEFAULT_RATE);

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [originSaving, setOriginSaving] = useState(false);
	const [originSaved, setOriginSaved] = useState(false);
	const [originError, setOriginError] = useState("");

	const { data: settingsData } = api.getSettings.useQuery() as {
		data: SettingsData | undefined;
	};

	const { data: connectionData } = api.getConnection.useQuery() as {
		data: { connection: ShippingConnectionData | null } | undefined;
	};

	const connectionOrigin =
		connectionData?.connection?.originAddress ?? DEFAULT_ORIGIN;

	const updateOriginMutation = api.updateConnectionOrigin.useMutation({
		onSuccess: () => {
			void api.getConnection.invalidate();
			void api.getSettings.invalidate();
			setOriginSaving(false);
			setOriginSaved(true);
			setOriginError("");
			setTimeout(() => setOriginSaved(false), 2000);
		},
		onError: (err: Error) => {
			setOriginError(extractError(err, "Failed to save ship-from address"));
			setOriginSaving(false);
		},
	});

	const { data: zonesData, isLoading: loading } = api.listZones.useQuery() as {
		data: { zones: ShippingZone[] } | undefined;
		isLoading: boolean;
	};

	const zones = zonesData?.zones ?? [];

	const fetchRates = useCallback(
		async (zoneId: string) => {
			setLoadingRates((prev) => ({ ...prev, [zoneId]: true }));
			try {
				const data = (await api.listRates.fetch({
					params: { id: zoneId },
				})) as {
					rates: ShippingRate[];
				};
				setRatesByZone((prev) => ({ ...prev, [zoneId]: data.rates }));
			} finally {
				setLoadingRates((prev) => ({ ...prev, [zoneId]: false }));
			}
		},
		[api.listRates],
	);

	function toggleZone(zoneId: string) {
		setExpandedZones((prev) => {
			const next = new Set(prev);
			if (next.has(zoneId)) {
				next.delete(zoneId);
			} else {
				next.add(zoneId);
				if (!ratesByZone[zoneId]?.length) {
					void fetchRates(zoneId);
				}
			}
			return next;
		});
	}

	const anyModalOpen = showCreateZone || !!addRateZoneId;
	useEffect(() => {
		if (!showCreateZone) return;
		zoneNameRef.current?.focus();
	}, [showCreateZone]);
	useEffect(() => {
		if (!addRateZoneId) return;
		rateNameRef.current?.focus();
	}, [addRateZoneId]);
	useEffect(() => {
		if (!anyModalOpen) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setShowCreateZone(false);
				setAddRateZoneId(null);
			}
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [anyModalOpen]);

	const createZoneMutation = api.createZone.useMutation({
		onSuccess: () => {
			setShowCreateZone(false);
			setZoneForm(DEFAULT_ZONE);
			void api.listZones.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create zone"));
		},
		onSettled: () => {
			setSaving(false);
		},
	});

	const deleteZoneMutation = api.deleteZone.useMutation({
		onSettled: () => {
			void api.listZones.invalidate();
		},
	});

	const addRateMutation = api.addRate.useMutation({
		onSuccess: () => {
			if (addRateZoneId) {
				void fetchRates(addRateZoneId);
			}
			setAddRateZoneId(null);
			setRateForm(DEFAULT_RATE);
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to add rate"));
		},
		onSettled: () => {
			setSaving(false);
		},
	});

	const deleteRateMutation = api.deleteRate.useMutation();

	function handleCreateZone(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError("");
		const countries = zoneForm.countries
			.split(",")
			.map((c) => c.trim().toUpperCase())
			.filter(Boolean);
		createZoneMutation.mutate({
			name: zoneForm.name,
			countries,
			isActive: zoneForm.isActive,
		});
	}

	function handleDeleteZone(zoneId: string) {
		if (!confirm("Delete this zone and all its rates?")) return;
		deleteZoneMutation.mutate({ params: { id: zoneId } });
	}

	function handleAddRate(e: React.FormEvent) {
		e.preventDefault();
		if (!addRateZoneId) return;
		setSaving(true);
		setError("");
		const body: Record<string, unknown> = {
			params: { id: addRateZoneId },
			name: rateForm.name,
			price: Math.round(Number(rateForm.price) * 100),
			isActive: rateForm.isActive,
		};
		if (rateForm.minOrderAmount)
			body.minOrderAmount = Math.round(Number(rateForm.minOrderAmount) * 100);
		if (rateForm.maxOrderAmount)
			body.maxOrderAmount = Math.round(Number(rateForm.maxOrderAmount) * 100);
		if (rateForm.minWeight) body.minWeight = Number(rateForm.minWeight);
		if (rateForm.maxWeight) body.maxWeight = Number(rateForm.maxWeight);
		addRateMutation.mutate(body);
	}

	async function handleDeleteRate(zoneId: string, rateId: string) {
		if (!confirm("Delete this rate?")) return;
		await deleteRateMutation.mutate({ params: { id: rateId } });
		void fetchRates(zoneId);
	}

	function handleSaveOrigin(origin: ShippingOriginAddress) {
		setOriginSaving(true);
		setOriginError("");
		const body: Record<string, string> = {
			street1: origin.street1,
			city: origin.city,
			state: origin.state,
			postalCode: origin.postalCode,
			country: origin.country,
		};
		if (origin.name?.trim()) body.name = origin.name.trim();
		if (origin.company?.trim()) body.company = origin.company.trim();
		if (origin.street2?.trim()) body.street2 = origin.street2.trim();
		if (origin.phone?.trim()) body.phone = origin.phone.trim();
		updateOriginMutation.mutate(body);
	}

	const subtitle = `${zones.length} zone${zones.length !== 1 ? "s" : ""}`;

	return (
		<ShippingAdminTemplate
			subtitle={subtitle}
			onAddZone={() => {
				setZoneForm(DEFAULT_ZONE);
				setShowCreateZone(true);
			}}
			content={
				<>
					{settingsData && <ConnectionStatus settings={settingsData} />}
					{settingsData?.configured && !settingsData.originConfigured && (
						<OriginWarningBanner />
					)}
					<ShipFromAddressForm
						initial={connectionOrigin}
						saving={originSaving}
						saved={originSaved}
						error={originError}
						onSave={handleSaveOrigin}
					/>
					<div className="overflow-hidden rounded-lg border border-border bg-card">
						<table className="w-full">
							<thead>
								<tr className="border-border border-b bg-muted/50">
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Zone
									</th>
									<th
										scope="col"
										className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide sm:table-cell"
									>
										Countries
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Rates
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Status
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Actions
									</th>
								</tr>
							</thead>
							<tbody className="divide-y divide-border">
								{loading ? (
									(["k0", "k1", "k2"] as const).map((rowKey) => (
										<tr key={rowKey}>
											{(["c0", "c1", "c2", "c3", "c4"] as const).map(
												(cellKey) => (
													<td key={cellKey} className="px-4 py-3">
														<div className="h-4 w-24 animate-pulse rounded bg-muted" />
													</td>
												),
											)}
										</tr>
									))
								) : zones.length === 0 ? (
									<tr>
										<td colSpan={5} className="px-4 py-12 text-center">
											<p className="font-medium text-foreground text-sm">
												No shipping zones
											</p>
											<p className="mt-1 text-muted-foreground text-xs">
												Create zones and add rates to enable shipping at
												checkout
											</p>
										</td>
									</tr>
								) : (
									zones.map((zone) => (
										<ZoneRow
											key={zone.id}
											zone={zone}
											rates={ratesByZone[zone.id] ?? []}
											loadingRates={!!loadingRates[zone.id]}
											expanded={expandedZones.has(zone.id)}
											onToggle={() => toggleZone(zone.id)}
											onDeleteZone={() => handleDeleteZone(zone.id)}
											onDeleteRate={(rateId) =>
												void handleDeleteRate(zone.id, rateId)
											}
											onAddRate={() => {
												setAddRateZoneId(zone.id);
												setRateForm(DEFAULT_RATE);
											}}
										/>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Create Zone Modal */}
					{showCreateZone && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
							<div
								role="dialog"
								aria-modal="true"
								className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
							>
								<h2 className="mb-4 font-semibold text-foreground text-lg">
									Create shipping zone
								</h2>
								{error && (
									<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
										{error}
									</p>
								)}
								<form
									onSubmit={(e) => handleCreateZone(e)}
									className="space-y-4"
								>
									<div>
										<label
											htmlFor="ship-zone-name"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Zone name <span className="text-red-500">*</span>
										</label>
										<input
											ref={zoneNameRef}
											id="ship-zone-name"
											required
											value={zoneForm.name}
											onChange={(e) =>
												setZoneForm((f) => ({ ...f, name: e.target.value }))
											}
											placeholder="e.g. United States, Europe, Rest of World"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="ship-zone-countries"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Countries
										</label>
										<input
											id="ship-zone-countries"
											value={zoneForm.countries}
											onChange={(e) =>
												setZoneForm((f) => ({
													...f,
													countries: e.target.value,
												}))
											}
											placeholder="US, CA, MX (leave empty for all countries)"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
										<p className="mt-1 text-muted-foreground text-xs">
											Comma-separated ISO 3166-1 alpha-2 codes. Leave blank to
											match all destinations.
										</p>
									</div>
									<label className="flex cursor-pointer items-center gap-2 text-foreground text-sm">
										<input
											type="checkbox"
											checked={zoneForm.isActive}
											onChange={(e) =>
												setZoneForm((f) => ({
													...f,
													isActive: e.target.checked,
												}))
											}
											className="rounded"
										/>
										Active
									</label>
									<div className="flex justify-end gap-3 pt-2">
										<button
											type="button"
											onClick={() => setShowCreateZone(false)}
											className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={saving}
											className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
										>
											{saving ? "Creating…" : "Create zone"}
										</button>
									</div>
								</form>
							</div>
						</div>
					)}

					{/* Add Rate Modal */}
					{addRateZoneId && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
							<div
								role="dialog"
								aria-modal="true"
								className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
							>
								<h2 className="mb-4 font-semibold text-foreground text-lg">
									Add shipping rate
								</h2>
								{error && (
									<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
										{error}
									</p>
								)}
								<form onSubmit={(e) => handleAddRate(e)} className="space-y-4">
									<div>
										<label
											htmlFor="ship-rate-name"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Rate name <span className="text-red-500">*</span>
										</label>
										<input
											ref={rateNameRef}
											id="ship-rate-name"
											required
											value={rateForm.name}
											onChange={(e) =>
												setRateForm((f) => ({ ...f, name: e.target.value }))
											}
											placeholder="e.g. Standard Shipping, Express (2-day)"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="ship-rate-price"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Price (USD) <span className="text-red-500">*</span>
										</label>
										<input
											id="ship-rate-price"
											required
											type="number"
											min={0}
											step="0.01"
											value={rateForm.price}
											onChange={(e) =>
												setRateForm((f) => ({ ...f, price: e.target.value }))
											}
											placeholder="0.00"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label
												htmlFor="ship-rate-minOrder"
												className="mb-1 block font-medium text-foreground text-sm"
											>
												Min order ($)
											</label>
											<input
												id="ship-rate-minOrder"
												type="number"
												min={0}
												step="0.01"
												value={rateForm.minOrderAmount}
												onChange={(e) =>
													setRateForm((f) => ({
														...f,
														minOrderAmount: e.target.value,
													}))
												}
												placeholder="optional"
												className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
											/>
										</div>
										<div>
											<label
												htmlFor="ship-rate-maxOrder"
												className="mb-1 block font-medium text-foreground text-sm"
											>
												Max order ($)
											</label>
											<input
												id="ship-rate-maxOrder"
												type="number"
												min={0}
												step="0.01"
												value={rateForm.maxOrderAmount}
												onChange={(e) =>
													setRateForm((f) => ({
														...f,
														maxOrderAmount: e.target.value,
													}))
												}
												placeholder="optional"
												className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
											/>
										</div>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label
												htmlFor="ship-rate-minWeight"
												className="mb-1 block font-medium text-foreground text-sm"
											>
												Min weight (g)
											</label>
											<input
												id="ship-rate-minWeight"
												type="number"
												min={0}
												value={rateForm.minWeight}
												onChange={(e) =>
													setRateForm((f) => ({
														...f,
														minWeight: e.target.value,
													}))
												}
												placeholder="optional"
												className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
											/>
										</div>
										<div>
											<label
												htmlFor="ship-rate-maxWeight"
												className="mb-1 block font-medium text-foreground text-sm"
											>
												Max weight (g)
											</label>
											<input
												id="ship-rate-maxWeight"
												type="number"
												min={0}
												value={rateForm.maxWeight}
												onChange={(e) =>
													setRateForm((f) => ({
														...f,
														maxWeight: e.target.value,
													}))
												}
												placeholder="optional"
												className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
											/>
										</div>
									</div>
									<label className="flex cursor-pointer items-center gap-2 text-foreground text-sm">
										<input
											type="checkbox"
											checked={rateForm.isActive}
											onChange={(e) =>
												setRateForm((f) => ({
													...f,
													isActive: e.target.checked,
												}))
											}
											className="rounded"
										/>
										Active
									</label>
									<div className="flex justify-end gap-3 pt-2">
										<button
											type="button"
											onClick={() => setAddRateZoneId(null)}
											className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={saving}
											className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
										>
											{saving ? "Adding…" : "Add rate"}
										</button>
									</div>
								</form>
							</div>
						</div>
					)}
				</>
			}
		/>
	);
}
