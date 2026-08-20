"use client";

import { useState } from "react";
import { extractError, type PriceList, usePriceListsApi } from "./_shared";

function slugify(name: string): string {
	return name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

export function PriceListCreate() {
	const api = usePriceListsApi();
	const createMutation = api.create.useMutation() as {
		mutateAsync: (opts: {
			body: Record<string, unknown>;
		}) => Promise<{ priceList?: PriceList }>;
		isPending: boolean;
	};

	const [name, setName] = useState("");
	const [slug, setSlug] = useState("");
	const [description, setDescription] = useState("");
	const [currency, setCurrency] = useState("");
	const [priority, setPriority] = useState(0);
	const [status, setStatus] = useState("active");
	const [startsAt, setStartsAt] = useState("");
	const [endsAt, setEndsAt] = useState("");
	const [customerGroupId, setCustomerGroupId] = useState("");
	const [error, setError] = useState("");

	const handleNameChange = (val: string) => {
		setName(val);
		setSlug(slugify(val));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		if (!name.trim() || !slug.trim()) {
			setError("Name and slug are required.");
			return;
		}

		try {
			const result = await createMutation.mutateAsync({
				body: {
					name: name.trim(),
					slug: slug.trim(),
					description: description.trim() || undefined,
					currency: currency.trim() || undefined,
					priority,
					status,
					startsAt: startsAt ? new Date(startsAt).toISOString() : undefined,
					endsAt: endsAt ? new Date(endsAt).toISOString() : undefined,
					customerGroupId: customerGroupId.trim() || undefined,
				},
			});

			if (result.priceList) {
				window.location.href = `/admin/price-lists/${result.priceList.id}`;
			}
		} catch (err) {
			setError(extractError(err));
		}
	};

	return (
		<div>
			<div className="mb-6">
				<a
					href="/admin/price-lists"
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					&larr; Back to price lists
				</a>
			</div>

			<h1 className="mb-6 font-bold text-2xl text-foreground">
				Create Price List
			</h1>

			{error ? (
				<div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
					{error}
				</div>
			) : null}

			<form onSubmit={handleSubmit} className="space-y-6">
				<div className="rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						Basic Information
					</h2>
					<div className="grid gap-4 sm:grid-cols-2">
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Name</span>
							<input
								type="text"
								value={name}
								onChange={(e) => handleNameChange(e.target.value)}
								placeholder="VIP Pricing"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Slug</span>
							<input
								type="text"
								value={slug}
								onChange={(e) => setSlug(e.target.value)}
								placeholder="vip-pricing"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
					</div>
					<div className="mt-4">
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								Description
							</span>
							<input
								type="text"
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Optional description"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
					</div>
				</div>

				<div className="rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						Settings
					</h2>
					<div className="grid gap-4 sm:grid-cols-3">
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								Currency (ISO 4217)
							</span>
							<input
								type="text"
								value={currency}
								onChange={(e) => setCurrency(e.target.value.toUpperCase())}
								placeholder="USD"
								maxLength={3}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								Priority (lower = higher)
							</span>
							<input
								type="number"
								value={priority}
								onChange={(e) =>
									setPriority(Number.parseInt(e.target.value, 10) || 0)
								}
								min={0}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Status</span>
							<select
								value={status}
								onChange={(e) => setStatus(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							>
								<option value="active">Active</option>
								<option value="inactive">Inactive</option>
								<option value="scheduled">Scheduled</option>
							</select>
						</label>
					</div>
					<div className="mt-4 grid gap-4 sm:grid-cols-2">
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Starts At</span>
							<input
								type="date"
								value={startsAt}
								onChange={(e) => setStartsAt(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Ends At</span>
							<input
								type="date"
								value={endsAt}
								onChange={(e) => setEndsAt(e.target.value)}
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
					</div>
					<div className="mt-4">
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								Customer Group ID
							</span>
							<input
								type="text"
								value={customerGroupId}
								onChange={(e) => setCustomerGroupId(e.target.value)}
								placeholder="Optional — restrict to specific group"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
					</div>
				</div>

				<div className="flex gap-3">
					<button
						type="submit"
						disabled={createMutation.isPending}
						className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
					>
						{createMutation.isPending ? "Creating..." : "Create Price List"}
					</button>
					<a
						href="/admin/price-lists"
						className="rounded-lg border border-border bg-card px-4 py-2 text-foreground text-sm hover:bg-muted"
					>
						Cancel
					</a>
				</div>
			</form>
		</div>
	);
}
