"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import TaxRatesTemplate from "./tax-rates.mdx";

interface TaxRateData {
	id: string;
	name: string;
	country: string;
	state: string;
	city: string;
	postalCode: string;
	rate: number;
	type: "percentage" | "fixed";
	categoryId: string;
	enabled: boolean;
	priority: number;
	compound: boolean;
	inclusive: boolean;
	createdAt: string;
	updatedAt: string;
}

interface TaxCategoryData {
	id: string;
	name: string;
	description?: string;
	createdAt: string;
}

const COMMON_COUNTRIES = [
	{ code: "US", name: "United States" },
	{ code: "CA", name: "Canada" },
	{ code: "GB", name: "United Kingdom" },
	{ code: "DE", name: "Germany" },
	{ code: "FR", name: "France" },
	{ code: "AU", name: "Australia" },
	{ code: "JP", name: "Japan" },
];

interface TaxSettings {
	status: "connected" | "not_configured" | "error";
	error?: string | undefined;
	accountName?: string | undefined;
	configured: boolean;
	sandbox: boolean;
	apiKeyMasked: string | null;
}

function useTaxAdminApi() {
	const client = useModuleClient();
	return {
		getSettings: client.module("tax").admin["/admin/tax/settings"],
		listRates: client.module("tax").admin["/admin/tax/rates"],
		createRate: client.module("tax").admin["/admin/tax/rates/create"],
		updateRate: client.module("tax").admin["/admin/tax/rates/:id/update"],
		deleteRate: client.module("tax").admin["/admin/tax/rates/:id/delete"],
		listCategories: client.module("tax").admin["/admin/tax/categories"],
		createCategory: client.module("tax").admin["/admin/tax/categories/create"],
		deleteCategory:
			client.module("tax").admin["/admin/tax/categories/:id/delete"],
	};
}

function TaxJarStatus({ settings }: { settings: TaxSettings | undefined }) {
	if (!settings) return null;

	const statusColor =
		settings.status === "connected"
			? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
			: settings.status === "error"
				? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
				: "bg-muted text-muted-foreground";

	const statusLabel =
		settings.status === "connected"
			? "Connected"
			: settings.status === "error"
				? "Error"
				: "Not configured";

	return (
		<div className="rounded-lg border border-border bg-card p-5">
			<h3 className="mb-3 font-semibold text-foreground text-sm">
				TaxJar integration
			</h3>
			<div className="divide-y divide-border">
				<div className="flex items-center justify-between py-2">
					<span className="text-muted-foreground text-sm">Status</span>
					<div className="flex items-center gap-2">
						<span
							className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${statusColor}`}
						>
							{statusLabel}
						</span>
						{settings.accountName && (
							<span className="text-foreground text-sm">
								{settings.accountName}
							</span>
						)}
					</div>
				</div>
				{settings.apiKeyMasked && (
					<div className="flex items-center justify-between py-2">
						<span className="text-muted-foreground text-sm">API key</span>
						<div className="flex items-center gap-2">
							<span
								className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
									settings.sandbox
										? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
										: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
								}`}
							>
								{settings.sandbox ? "sandbox" : "production"}
							</span>
							<span className="font-mono text-foreground text-xs">
								{settings.apiKeyMasked}
							</span>
						</div>
					</div>
				)}
			</div>

			{settings.status === "error" && settings.error && (
				<div className="mt-3 rounded-md bg-red-50 p-3 text-red-800 text-sm dark:bg-red-900/20 dark:text-red-300">
					{settings.error}
				</div>
			)}

			{settings.status === "not_configured" && (
				<div className="mt-3 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
					Add your TaxJar API key to the module configuration to enable
					real-time tax calculation. Without it, manual tax rates below will be
					used instead.
				</div>
			)}
		</div>
	);
}

function formatRate(rate: TaxRateData): string {
	if (rate.type === "fixed") {
		return `$${rate.rate.toFixed(2)} flat`;
	}
	return `${(rate.rate * 100).toFixed(2)}%`;
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

function CreateRateForm({
	categories,
	onCreated,
}: {
	categories: TaxCategoryData[];
	onCreated: () => void;
}) {
	const api = useTaxAdminApi();
	const [open, setOpen] = useState(false);

	const createMutation = api.createRate.useMutation({
		onSuccess: () => {
			setOpen(false);
			onCreated();
		},
	});

	function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();

		const form = new FormData(e.currentTarget);
		const ratePercent = Number.parseFloat(form.get("rate") as string);

		createMutation.mutate({
			name: form.get("name") as string,
			country: form.get("country") as string,
			state: (form.get("state") as string) || undefined,
			city: (form.get("city") as string) || undefined,
			postalCode: (form.get("postalCode") as string) || undefined,
			rate: ratePercent / 100,
			type: form.get("type") as string,
			categoryId: (form.get("categoryId") as string) || undefined,
			priority: Number.parseInt(form.get("priority") as string, 10) || 0,
			compound: form.get("compound") === "on",
			inclusive: form.get("inclusive") === "on",
		});
	}

	if (!open) {
		return (
			<button
				type="button"
				onClick={() => setOpen(true)}
				className="rounded-md bg-foreground px-3 py-2 font-medium text-background text-sm transition-colors hover:opacity-90"
			>
				Add Tax Rate
			</button>
		);
	}

	return (
		<form
			onSubmit={handleSubmit}
			className="space-y-3 rounded-lg border border-border bg-card p-4"
		>
			{createMutation.isError && (
				<p className="text-red-600 text-sm" role="alert">
					{extractError(createMutation.error, "Failed to create rate.")}
				</p>
			)}
			<div className="grid grid-cols-2 gap-3">
				<div>
					<label
						htmlFor="tax-name"
						className="mb-1 block font-medium text-muted-foreground text-xs"
					>
						Name
					</label>
					<input
						id="tax-name"
						name="name"
						required
						placeholder="e.g. California Sales Tax"
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					/>
				</div>
				<div>
					<label
						htmlFor="tax-country"
						className="mb-1 block font-medium text-muted-foreground text-xs"
					>
						Country
					</label>
					<select
						id="tax-country"
						name="country"
						required
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					>
						{COMMON_COUNTRIES.map((c) => (
							<option key={c.code} value={c.code}>
								{c.name}
							</option>
						))}
					</select>
				</div>
				<div>
					<label
						htmlFor="tax-state"
						className="mb-1 block font-medium text-muted-foreground text-xs"
					>
						State/Province
					</label>
					<input
						id="tax-state"
						name="state"
						placeholder="e.g. CA (or leave blank for all)"
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					/>
				</div>
				<div>
					<label
						htmlFor="tax-city"
						className="mb-1 block font-medium text-muted-foreground text-xs"
					>
						City
					</label>
					<input
						id="tax-city"
						name="city"
						placeholder="Optional"
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					/>
				</div>
				<div>
					<label
						htmlFor="tax-postal"
						className="mb-1 block font-medium text-muted-foreground text-xs"
					>
						Postal Code
					</label>
					<input
						id="tax-postal"
						name="postalCode"
						placeholder="Optional"
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					/>
				</div>
				<div>
					<label
						htmlFor="tax-rate"
						className="mb-1 block font-medium text-muted-foreground text-xs"
					>
						Rate (%)
					</label>
					<input
						id="tax-rate"
						name="rate"
						type="number"
						step="0.01"
						min="0"
						max="100"
						required
						placeholder="e.g. 8.25"
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					/>
				</div>
				<div>
					<label
						htmlFor="tax-type"
						className="mb-1 block font-medium text-muted-foreground text-xs"
					>
						Type
					</label>
					<select
						id="tax-type"
						name="type"
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					>
						<option value="percentage">Percentage</option>
						<option value="fixed">Fixed Amount</option>
					</select>
				</div>
				<div>
					<label
						htmlFor="tax-category"
						className="mb-1 block font-medium text-muted-foreground text-xs"
					>
						Category
					</label>
					<select
						id="tax-category"
						name="categoryId"
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					>
						<option value="default">Default (all products)</option>
						{categories.map((c) => (
							<option key={c.id} value={c.id}>
								{c.name}
							</option>
						))}
					</select>
				</div>
				<div>
					<label
						htmlFor="tax-priority"
						className="mb-1 block font-medium text-muted-foreground text-xs"
					>
						Priority
					</label>
					<input
						id="tax-priority"
						name="priority"
						type="number"
						defaultValue="0"
						min="0"
						className="w-full rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					/>
				</div>
				<div className="col-span-2 flex items-center gap-4">
					<label className="flex items-center gap-2 text-sm">
						<input name="compound" type="checkbox" />
						Compound
					</label>
					<label className="flex items-center gap-2 text-sm">
						<input name="inclusive" type="checkbox" />
						Tax-inclusive pricing
					</label>
				</div>
			</div>
			<div className="flex gap-2">
				<button
					type="submit"
					disabled={createMutation.isPending}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm transition-colors hover:opacity-90 disabled:opacity-50"
				>
					{createMutation.isPending ? "Creating..." : "Create Rate"}
				</button>
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

export function TaxRates() {
	const api = useTaxAdminApi();

	const { data: settingsData } = api.getSettings.useQuery({}) as {
		data: TaxSettings | undefined;
		isLoading: boolean;
	};

	const { data: ratesData, isLoading: ratesLoading } =
		api.listRates.useQuery() as {
			data: { rates: TaxRateData[] } | undefined;
			isLoading: boolean;
		};
	const { data: categoriesData, isLoading: categoriesLoading } =
		api.listCategories.useQuery() as {
			data: { categories: TaxCategoryData[] } | undefined;
			isLoading: boolean;
		};

	const rates = ratesData?.rates ?? [];
	const categories = categoriesData?.categories ?? [];
	const loading = ratesLoading || categoriesLoading;

	const toggleMutation = api.updateRate.useMutation({
		onSuccess: () => {
			void api.listRates.invalidate();
		},
	});

	const deleteMutation = api.deleteRate.useMutation({
		onSuccess: () => {
			void api.listRates.invalidate();
		},
	});

	function handleToggle(rate: TaxRateData) {
		toggleMutation.mutate({
			params: { id: rate.id },
			enabled: !rate.enabled,
		});
	}

	function handleDelete(id: string) {
		if (!confirm("Delete this tax rate?")) return;
		deleteMutation.mutate({ params: { id } });
	}

	function handleRefresh() {
		void api.listRates.invalidate();
		void api.listCategories.invalidate();
	}

	const content = (
		<>
			<TaxJarStatus settings={settingsData} />

			<CreateRateForm categories={categories} onCreated={handleRefresh} />

			{loading ? (
				<div className="text-muted-foreground text-sm">
					Loading tax rates...
				</div>
			) : rates.length === 0 ? (
				<div className="rounded-lg border border-border border-dashed p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No tax rates configured yet. Add your first tax rate above.
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-lg border border-border">
					<table className="w-full text-sm">
						<thead>
							<tr className="border-border border-b bg-muted/30 text-left">
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
									Jurisdiction
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Rate
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Category
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
						<tbody>
							{rates.map((rate) => (
								<tr
									key={rate.id}
									className="border-border border-b last:border-0"
								>
									<td className="px-4 py-3 font-medium">{rate.name}</td>
									<td className="px-4 py-3 text-muted-foreground">
										{rate.country}
										{rate.state !== "*" ? ` / ${rate.state}` : ""}
										{rate.city !== "*" ? ` / ${rate.city}` : ""}
										{rate.postalCode !== "*" ? ` (${rate.postalCode})` : ""}
									</td>
									<td className="px-4 py-3 font-mono text-muted-foreground">
										{formatRate(rate)}
										{rate.compound ? " (compound)" : ""}
										{rate.inclusive ? " (inclusive)" : ""}
									</td>
									<td className="px-4 py-3 text-muted-foreground">
										{rate.categoryId === "default"
											? "All products"
											: (categories.find((c) => c.id === rate.categoryId)
													?.name ?? rate.categoryId)}
									</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => handleToggle(rate)}
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												rate.enabled
													? "bg-green-50 text-green-700"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{rate.enabled ? "Active" : "Disabled"}
										</button>
									</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => handleDelete(rate.id)}
											className="text-red-600 text-xs hover:text-red-800"
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

			{/* Categories section */}
			<div className="space-y-4 border-border border-t pt-4">
				<h2 className="font-semibold text-lg tracking-tight">Tax Categories</h2>
				<p className="text-muted-foreground text-sm">
					Create categories to apply different tax rates to different product
					types.
				</p>

				<CategoryManager categories={categories} onChanged={handleRefresh} />
			</div>
		</>
	);

	return <TaxRatesTemplate content={content} />;
}

function CategoryManager({
	categories,
	onChanged,
}: {
	categories: TaxCategoryData[];
	onChanged: () => void;
}) {
	const api = useTaxAdminApi();
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");

	const addMutation = api.createCategory.useMutation({
		onSuccess: () => {
			setName("");
			setDescription("");
			onChanged();
		},
	});

	const deleteMutation = api.deleteCategory.useMutation({
		onSuccess: () => {
			onChanged();
		},
	});

	function handleAdd() {
		if (!name.trim()) return;
		addMutation.mutate({
			name: name.trim(),
			description: description.trim() || undefined,
		});
	}

	function handleDelete(id: string) {
		if (
			!confirm(
				"Delete this category? Tax rates using it will fall back to default.",
			)
		)
			return;
		deleteMutation.mutate({ params: { id } });
	}

	return (
		<div className="space-y-3">
			<div className="flex items-end gap-2">
				<div>
					<input
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Category name (e.g. clothing)"
						className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					/>
				</div>
				<div>
					<input
						value={description}
						onChange={(e) => setDescription(e.target.value)}
						placeholder="Description (optional)"
						className="rounded-md border border-border bg-background px-3 py-1.5 text-sm"
					/>
				</div>
				<button
					type="button"
					onClick={handleAdd}
					disabled={addMutation.isPending || !name.trim()}
					className="rounded-md bg-foreground px-3 py-1.5 font-medium text-background text-sm transition-colors hover:opacity-90 disabled:opacity-50"
				>
					{addMutation.isPending ? "Adding..." : "Add"}
				</button>
			</div>

			{categories.length > 0 && (
				<div className="flex flex-wrap gap-2">
					{categories.map((cat) => (
						<span
							key={cat.id}
							className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-sm"
						>
							<span className="font-medium">{cat.name}</span>
							{cat.description && (
								<span className="text-muted-foreground">{cat.description}</span>
							)}
							<button
								type="button"
								onClick={() => handleDelete(cat.id)}
								aria-label="Remove category"
								className="ml-1 text-muted-foreground hover:text-red-600"
							>
								&times;
							</button>
						</span>
					))}
				</div>
			)}
		</div>
	);
}
