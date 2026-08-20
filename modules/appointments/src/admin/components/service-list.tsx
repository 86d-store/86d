"use client";

import { useState } from "react";
import { extractError, useAppointmentsApi } from "./_shared";

interface Service {
	id: string;
	name: string;
	slug: string;
	description?: string;
	duration: number;
	price: number;
	currency: string;
	status: string;
	maxCapacity?: number;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

function slugify(text: string): string {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
}

function formatDuration(minutes: number) {
	if (minutes < 60) return `${minutes}m`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

function formatCurrency(amount: number, currency = "USD") {
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency,
	}).format(amount / 100);
}

export function ServiceList() {
	const api = useAppointmentsApi();
	const [showCreate, setShowCreate] = useState(false);
	const [svcName, setSvcName] = useState("");
	const [svcSlug, setSvcSlug] = useState("");
	const [svcDuration, setSvcDuration] = useState(60);
	const [svcPrice, setSvcPrice] = useState(0);
	const [svcDescription, setSvcDescription] = useState("");
	const [error, setError] = useState("");

	const { data, isLoading } = api.listServices.useQuery({}) as {
		data: { services?: Service[] } | undefined;
		isLoading: boolean;
	};

	const createMutation = api.createService.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};
	const deleteMutation = api.deleteService.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	const services = data?.services ?? [];

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!svcName.trim()) {
			setError("Service name is required.");
			return;
		}
		try {
			await createMutation.mutateAsync({
				body: {
					name: svcName.trim(),
					slug: svcSlug.trim() || slugify(svcName),
					duration: svcDuration,
					price: svcPrice,
					description: svcDescription.trim() || undefined,
				},
			});
			setSvcName("");
			setSvcSlug("");
			setSvcDuration(60);
			setSvcPrice(0);
			setSvcDescription("");
			setShowCreate(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Delete this service?")) return;
		try {
			await deleteMutation.mutateAsync({ params: { id } });
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Services</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage appointment services
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					{showCreate ? "Cancel" : "Add Service"}
				</button>
			</div>

			{/* Create form */}
			{showCreate ? (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						New Service
					</h2>
					{error ? (
						<div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 text-sm dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
							{error}
						</div>
					) : null}
					<form onSubmit={handleCreate} className="space-y-4">
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Name</span>
								<input
									type="text"
									value={svcName}
									onChange={(e) => {
										setSvcName(e.target.value);
										if (!svcSlug) setSvcSlug(slugify(e.target.value));
									}}
									placeholder="Haircut"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Slug</span>
								<input
									type="text"
									value={svcSlug}
									onChange={(e) => setSvcSlug(e.target.value)}
									placeholder="haircut"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Duration (minutes)
								</span>
								<input
									type="number"
									value={svcDuration}
									onChange={(e) =>
										setSvcDuration(Number.parseInt(e.target.value, 10) || 0)
									}
									min={1}
									max={1440}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">
									Price (cents)
								</span>
								<input
									type="number"
									value={svcPrice}
									onChange={(e) =>
										setSvcPrice(Number.parseInt(e.target.value, 10) || 0)
									}
									min={0}
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">
								Description
							</span>
							<input
								type="text"
								value={svcDescription}
								onChange={(e) => setSvcDescription(e.target.value)}
								placeholder="Optional description"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<button
							type="submit"
							disabled={createMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Create Service"}
						</button>
					</form>
				</div>
			) : null}

			{/* Service list */}
			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={`skel-${i}`}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : services.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No services yet. Create one to get started.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{services.map((svc) => (
						<div
							key={svc.id}
							className="rounded-lg border border-border bg-card p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground text-sm">
											{svc.name}
										</p>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												svc.status === "active"
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{svc.status}
										</span>
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
										<span>{formatDuration(svc.duration)}</span>
										<span>{formatCurrency(svc.price, svc.currency)}</span>
										{svc.description ? <span>{svc.description}</span> : null}
										{svc.maxCapacity ? (
											<span>Max {svc.maxCapacity} slots</span>
										) : null}
									</div>
								</div>
								<button
									type="button"
									onClick={() => handleDelete(svc.id)}
									className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
								>
									Delete
								</button>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
