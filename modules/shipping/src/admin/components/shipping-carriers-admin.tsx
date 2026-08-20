"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import ShippingCarriersAdminTemplate from "./shipping-carriers-admin.mdx";

interface ShippingCarrier {
	id: string;
	name: string;
	code: string;
	trackingUrlTemplate?: string | null;
	isActive: boolean;
}

interface ShippingMethod {
	id: string;
	name: string;
	description?: string | null;
	estimatedDaysMin: number;
	estimatedDaysMax: number;
	isActive: boolean;
	sortOrder: number;
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

function useCarriersApi() {
	const client = useModuleClient();
	return {
		listCarriers: client.module("shipping").admin["/admin/shipping/carriers"],
		createCarrier:
			client.module("shipping").admin["/admin/shipping/carriers/create"],
		updateCarrier:
			client.module("shipping").admin["/admin/shipping/carriers/:id/update"],
		deleteCarrier:
			client.module("shipping").admin["/admin/shipping/carriers/:id/delete"],
		listMethods: client.module("shipping").admin["/admin/shipping/methods"],
		createMethod:
			client.module("shipping").admin["/admin/shipping/methods/create"],
		updateMethod:
			client.module("shipping").admin["/admin/shipping/methods/:id/update"],
		deleteMethod:
			client.module("shipping").admin["/admin/shipping/methods/:id/delete"],
	};
}

interface CarrierForm {
	name: string;
	code: string;
	trackingUrlTemplate: string;
	isActive: boolean;
}

interface MethodForm {
	name: string;
	description: string;
	estimatedDaysMin: string;
	estimatedDaysMax: string;
	isActive: boolean;
	sortOrder: string;
}

const DEFAULT_CARRIER: CarrierForm = {
	name: "",
	code: "",
	trackingUrlTemplate: "",
	isActive: true,
};

const DEFAULT_METHOD: MethodForm = {
	name: "",
	description: "",
	estimatedDaysMin: "1",
	estimatedDaysMax: "5",
	isActive: true,
	sortOrder: "0",
};

function CarrierRow({
	carrier,
	onDelete,
}: {
	carrier: ShippingCarrier;
	onDelete: () => void;
}) {
	return (
		<tr className="transition-colors hover:bg-muted/20">
			<td className="px-4 py-3">
				<span className="font-medium text-foreground text-sm">
					{carrier.name}
				</span>
			</td>
			<td className="px-4 py-3">
				<code className="rounded bg-muted px-1.5 py-0.5 font-mono text-foreground text-xs">
					{carrier.code}
				</code>
			</td>
			<td className="hidden px-4 py-3 md:table-cell">
				{carrier.trackingUrlTemplate ? (
					<span
						className="max-w-[200px] truncate text-muted-foreground text-xs"
						title={carrier.trackingUrlTemplate}
					>
						{carrier.trackingUrlTemplate}
					</span>
				) : (
					<span className="text-muted-foreground/50 text-xs">—</span>
				)}
			</td>
			<td className="px-4 py-3">
				{carrier.isActive ? (
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
					onClick={onDelete}
					className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
				>
					Delete
				</button>
			</td>
		</tr>
	);
}

function MethodRow({
	method,
	onDelete,
}: {
	method: ShippingMethod;
	onDelete: () => void;
}) {
	return (
		<tr className="transition-colors hover:bg-muted/20">
			<td className="px-4 py-3">
				<span className="font-medium text-foreground text-sm">
					{method.name}
				</span>
				{method.description && (
					<p className="mt-0.5 text-muted-foreground text-xs">
						{method.description}
					</p>
				)}
			</td>
			<td className="px-4 py-3 text-foreground text-sm tabular-nums">
				{method.estimatedDaysMin === method.estimatedDaysMax
					? `${method.estimatedDaysMin} day${method.estimatedDaysMin !== 1 ? "s" : ""}`
					: `${method.estimatedDaysMin}–${method.estimatedDaysMax} days`}
			</td>
			<td className="hidden px-4 py-3 text-muted-foreground text-sm tabular-nums md:table-cell">
				{method.sortOrder}
			</td>
			<td className="px-4 py-3">
				{method.isActive ? (
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
					onClick={onDelete}
					className="rounded px-2 py-1 text-muted-foreground text-xs hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
				>
					Delete
				</button>
			</td>
		</tr>
	);
}

export function ShippingCarriersAdmin() {
	const api = useCarriersApi();

	const carrierNameRef = useRef<HTMLInputElement>(null);
	const [showCreateCarrier, setShowCreateCarrier] = useState(false);
	const [carrierForm, setCarrierForm] = useState<CarrierForm>(DEFAULT_CARRIER);

	const methodNameRef = useRef<HTMLInputElement>(null);
	const [showCreateMethod, setShowCreateMethod] = useState(false);
	const [methodForm, setMethodForm] = useState<MethodForm>(DEFAULT_METHOD);

	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const { data: carriersData, isLoading: loadingCarriers } =
		api.listCarriers.useQuery() as {
			data: { carriers: ShippingCarrier[] } | undefined;
			isLoading: boolean;
		};

	const { data: methodsData, isLoading: loadingMethods } =
		api.listMethods.useQuery() as {
			data: { methods: ShippingMethod[] } | undefined;
			isLoading: boolean;
		};

	const carriers = carriersData?.carriers ?? [];
	const methods = methodsData?.methods ?? [];

	const anyModalOpen = showCreateCarrier || showCreateMethod;
	useEffect(() => {
		if (!showCreateCarrier) return;
		carrierNameRef.current?.focus();
	}, [showCreateCarrier]);
	useEffect(() => {
		if (!showCreateMethod) return;
		methodNameRef.current?.focus();
	}, [showCreateMethod]);
	useEffect(() => {
		if (!anyModalOpen) return;
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") {
				setShowCreateCarrier(false);
				setShowCreateMethod(false);
			}
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [anyModalOpen]);

	const createCarrierMutation = api.createCarrier.useMutation({
		onSuccess: () => {
			setShowCreateCarrier(false);
			setCarrierForm(DEFAULT_CARRIER);
			void api.listCarriers.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create carrier"));
		},
		onSettled: () => setSaving(false),
	});

	const deleteCarrierMutation = api.deleteCarrier.useMutation({
		onSettled: () => void api.listCarriers.invalidate(),
	});

	const createMethodMutation = api.createMethod.useMutation({
		onSuccess: () => {
			setShowCreateMethod(false);
			setMethodForm(DEFAULT_METHOD);
			void api.listMethods.invalidate();
		},
		onError: (err: Error) => {
			setError(extractError(err, "Failed to create method"));
		},
		onSettled: () => setSaving(false),
	});

	const deleteMethodMutation = api.deleteMethod.useMutation({
		onSettled: () => void api.listMethods.invalidate(),
	});

	function handleCreateCarrier(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError("");
		createCarrierMutation.mutate({
			name: carrierForm.name,
			code: carrierForm.code,
			...(carrierForm.trackingUrlTemplate && {
				trackingUrlTemplate: carrierForm.trackingUrlTemplate,
			}),
			isActive: carrierForm.isActive,
		});
	}

	function handleDeleteCarrier(id: string) {
		if (!confirm("Delete this carrier?")) return;
		deleteCarrierMutation.mutate({ params: { id } });
	}

	function handleCreateMethod(e: React.FormEvent) {
		e.preventDefault();
		setSaving(true);
		setError("");
		createMethodMutation.mutate({
			name: methodForm.name,
			...(methodForm.description && {
				description: methodForm.description,
			}),
			estimatedDaysMin: Number(methodForm.estimatedDaysMin),
			estimatedDaysMax: Number(methodForm.estimatedDaysMax),
			isActive: methodForm.isActive,
			sortOrder: Number(methodForm.sortOrder),
		});
	}

	function handleDeleteMethod(id: string) {
		if (!confirm("Delete this shipping method?")) return;
		deleteMethodMutation.mutate({ params: { id } });
	}

	const loading = loadingCarriers || loadingMethods;

	const skeletonRows = (cols: number, rows = 3) =>
		Array.from({ length: rows }).map((_, i) => (
			<tr key={`skeleton-${i}`}>
				{Array.from({ length: cols }).map((_, j) => (
					<td key={`skeleton-cell-${j}`} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		));

	return (
		<ShippingCarriersAdminTemplate
			subtitle={`${carriers.length} carrier${carriers.length !== 1 ? "s" : ""}, ${methods.length} method${methods.length !== 1 ? "s" : ""}`}
			onAddCarrier={() => {
				setCarrierForm(DEFAULT_CARRIER);
				setError("");
				setShowCreateCarrier(true);
			}}
			onAddMethod={() => {
				setMethodForm(DEFAULT_METHOD);
				setError("");
				setShowCreateMethod(true);
			}}
			content={
				<>
					{/* Carriers Table */}
					<div className="overflow-hidden rounded-lg border border-border bg-card">
						<div className="border-border border-b bg-muted/30 px-4 py-2.5">
							<h2 className="font-semibold text-foreground text-sm">
								Carriers
							</h2>
						</div>
						<table className="w-full">
							<thead>
								<tr className="border-border border-b bg-muted/50">
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Name
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Code
									</th>
									<th
										scope="col"
										className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
									>
										Tracking URL
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
									skeletonRows(5)
								) : carriers.length === 0 ? (
									<tr>
										<td colSpan={5} className="px-4 py-12 text-center">
											<p className="font-medium text-foreground text-sm">
												No carriers
											</p>
											<p className="mt-1 text-muted-foreground text-xs">
												Add carriers like FedEx, UPS, or USPS to assign to
												shipments
											</p>
										</td>
									</tr>
								) : (
									carriers.map((c) => (
										<CarrierRow
											key={c.id}
											carrier={c}
											onDelete={() => handleDeleteCarrier(c.id)}
										/>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Methods Table */}
					<div className="mt-6 overflow-hidden rounded-lg border border-border bg-card">
						<div className="border-border border-b bg-muted/30 px-4 py-2.5">
							<h2 className="font-semibold text-foreground text-sm">
								Shipping methods
							</h2>
						</div>
						<table className="w-full">
							<thead>
								<tr className="border-border border-b bg-muted/50">
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Method
									</th>
									<th
										scope="col"
										className="px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide"
									>
										Delivery
									</th>
									<th
										scope="col"
										className="hidden px-4 py-3 text-left font-semibold text-muted-foreground text-xs uppercase tracking-wide md:table-cell"
									>
										Order
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
									skeletonRows(5)
								) : methods.length === 0 ? (
									<tr>
										<td colSpan={5} className="px-4 py-12 text-center">
											<p className="font-medium text-foreground text-sm">
												No shipping methods
											</p>
											<p className="mt-1 text-muted-foreground text-xs">
												Define methods like Standard, Express, or Overnight with
												estimated delivery windows
											</p>
										</td>
									</tr>
								) : (
									methods.map((m) => (
										<MethodRow
											key={m.id}
											method={m}
											onDelete={() => handleDeleteMethod(m.id)}
										/>
									))
								)}
							</tbody>
						</table>
					</div>

					{/* Create Carrier Modal */}
					{showCreateCarrier && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
							<div
								role="dialog"
								aria-modal="true"
								className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
							>
								<h2 className="mb-4 font-semibold text-foreground text-lg">
									Add carrier
								</h2>
								{error && (
									<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
										{error}
									</p>
								)}
								<form onSubmit={handleCreateCarrier} className="space-y-4">
									<div>
										<label
											htmlFor="carrier-name"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Carrier name <span className="text-red-500">*</span>
										</label>
										<input
											ref={carrierNameRef}
											id="carrier-name"
											required
											value={carrierForm.name}
											onChange={(e) =>
												setCarrierForm((f) => ({
													...f,
													name: e.target.value,
												}))
											}
											placeholder="e.g. FedEx, UPS, USPS"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="carrier-code"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Code <span className="text-red-500">*</span>
										</label>
										<input
											id="carrier-code"
											required
											value={carrierForm.code}
											onChange={(e) =>
												setCarrierForm((f) => ({
													...f,
													code: e.target.value,
												}))
											}
											placeholder="e.g. fedex, ups, usps"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
										<p className="mt-1 text-muted-foreground text-xs">
											Unique identifier. Use lowercase with no spaces.
										</p>
									</div>
									<div>
										<label
											htmlFor="carrier-tracking-url"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Tracking URL template
										</label>
										<input
											id="carrier-tracking-url"
											value={carrierForm.trackingUrlTemplate}
											onChange={(e) =>
												setCarrierForm((f) => ({
													...f,
													trackingUrlTemplate: e.target.value,
												}))
											}
											placeholder="e.g. https://www.fedex.com/tracking?tracknumbers={tracking}"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
										<p className="mt-1 text-muted-foreground text-xs">
											Use{" "}
											<code className="rounded bg-muted px-1 text-xs">
												{"{tracking}"}
											</code>{" "}
											as placeholder for the tracking number.
										</p>
									</div>
									<label className="flex cursor-pointer items-center gap-2 text-foreground text-sm">
										<input
											type="checkbox"
											checked={carrierForm.isActive}
											onChange={(e) =>
												setCarrierForm((f) => ({
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
											onClick={() => setShowCreateCarrier(false)}
											className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={saving}
											className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
										>
											{saving ? "Adding…" : "Add carrier"}
										</button>
									</div>
								</form>
							</div>
						</div>
					)}

					{/* Create Method Modal */}
					{showCreateMethod && (
						<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
							<div
								role="dialog"
								aria-modal="true"
								className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-xl"
							>
								<h2 className="mb-4 font-semibold text-foreground text-lg">
									Add shipping method
								</h2>
								{error && (
									<p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-red-700 text-sm dark:bg-red-900/20 dark:text-red-400">
										{error}
									</p>
								)}
								<form onSubmit={handleCreateMethod} className="space-y-4">
									<div>
										<label
											htmlFor="method-name"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Method name <span className="text-red-500">*</span>
										</label>
										<input
											ref={methodNameRef}
											id="method-name"
											required
											value={methodForm.name}
											onChange={(e) =>
												setMethodForm((f) => ({
													...f,
													name: e.target.value,
												}))
											}
											placeholder="e.g. Standard Shipping, Express (2-day)"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div>
										<label
											htmlFor="method-description"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Description
										</label>
										<input
											id="method-description"
											value={methodForm.description}
											onChange={(e) =>
												setMethodForm((f) => ({
													...f,
													description: e.target.value,
												}))
											}
											placeholder="Optional description"
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
									</div>
									<div className="grid grid-cols-2 gap-3">
										<div>
											<label
												htmlFor="method-min-days"
												className="mb-1 block font-medium text-foreground text-sm"
											>
												Min days <span className="text-red-500">*</span>
											</label>
											<input
												id="method-min-days"
												required
												type="number"
												min={0}
												max={365}
												value={methodForm.estimatedDaysMin}
												onChange={(e) =>
													setMethodForm((f) => ({
														...f,
														estimatedDaysMin: e.target.value,
													}))
												}
												className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
											/>
										</div>
										<div>
											<label
												htmlFor="method-max-days"
												className="mb-1 block font-medium text-foreground text-sm"
											>
												Max days <span className="text-red-500">*</span>
											</label>
											<input
												id="method-max-days"
												required
												type="number"
												min={0}
												max={365}
												value={methodForm.estimatedDaysMax}
												onChange={(e) =>
													setMethodForm((f) => ({
														...f,
														estimatedDaysMax: e.target.value,
													}))
												}
												className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
											/>
										</div>
									</div>
									<div>
										<label
											htmlFor="method-sort-order"
											className="mb-1 block font-medium text-foreground text-sm"
										>
											Sort order
										</label>
										<input
											id="method-sort-order"
											type="number"
											min={0}
											value={methodForm.sortOrder}
											onChange={(e) =>
												setMethodForm((f) => ({
													...f,
													sortOrder: e.target.value,
												}))
											}
											className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
										/>
										<p className="mt-1 text-muted-foreground text-xs">
											Lower numbers appear first.
										</p>
									</div>
									<label className="flex cursor-pointer items-center gap-2 text-foreground text-sm">
										<input
											type="checkbox"
											checked={methodForm.isActive}
											onChange={(e) =>
												setMethodForm((f) => ({
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
											onClick={() => setShowCreateMethod(false)}
											className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
										>
											Cancel
										</button>
										<button
											type="submit"
											disabled={saving}
											className="rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
										>
											{saving ? "Adding…" : "Add method"}
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
