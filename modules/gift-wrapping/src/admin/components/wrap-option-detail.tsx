"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import WrapOptionDetailTemplate from "./wrap-option-detail.mdx";

interface WrapOptionData {
	id: string;
	name: string;
	description?: string;
	priceInCents: number;
	imageUrl?: string;
	active: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
}

const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
const labelCls = "mb-1 block font-medium text-foreground text-sm";

function formatPrice(cents: number) {
	return cents === 0
		? "Free"
		: new Intl.NumberFormat(undefined, {
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

function useGiftWrappingDetailApi(id: string) {
	const client = useModuleClient();
	return {
		detail: client.module("gift-wrapping").admin["/admin/gift-wrapping/:id"],
		update:
			client.module("gift-wrapping").admin["/admin/gift-wrapping/:id/update"],
		id,
	};
}

interface EditSheetProps {
	option: WrapOptionData;
	onSaved: () => void;
	onCancel: () => void;
	api: ReturnType<typeof useGiftWrappingDetailApi>;
}

function EditSheet({ option, onSaved, onCancel, api }: EditSheetProps) {
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
	const [name, setName] = useState(option.name);
	const [description, setDescription] = useState(option.description ?? "");
	const [price, setPrice] = useState(
		String((option.priceInCents / 100).toFixed(2)),
	);
	const [sortOrder, setSortOrder] = useState(String(option.sortOrder));
	const [active, setActive] = useState(option.active);
	const [error, setError] = useState("");

	const updateMutation = api.update.useMutation({
		onSuccess: () => {
			void api.detail.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		if (!name.trim()) {
			setError("Name is required.");
			return;
		}
		const parsedPrice = Math.round(Number.parseFloat(price) * 100);
		updateMutation.mutate({
			params: { id: option.id },
			body: {
				name: name.trim(),
				description: description.trim() || undefined,
				priceInCents: parsedPrice,
				sortOrder: Number.parseInt(sortOrder, 10) || 0,
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
					<h2 className="font-semibold text-foreground text-lg">Edit Option</h2>
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
							<label htmlFor="gwd-name" className={labelCls}>
								Name
							</label>
							<input
								id="gwd-name"
								ref={firstInputRef}
								className={inputCls}
								value={name}
								onChange={(e) => setName(e.target.value)}
							/>
						</div>
						<div>
							<label htmlFor="gwd-desc" className={labelCls}>
								Description
							</label>
							<input
								id="gwd-desc"
								className={inputCls}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
							/>
						</div>
						<div className="grid gap-4 sm:grid-cols-2">
							<div>
								<label htmlFor="gwd-price" className={labelCls}>
									Price ($)
								</label>
								<input
									id="gwd-price"
									type="number"
									step="0.01"
									min="0"
									className={inputCls}
									value={price}
									onChange={(e) => setPrice(e.target.value)}
								/>
							</div>
							<div>
								<label htmlFor="gwd-sort" className={labelCls}>
									Sort order
								</label>
								<input
									id="gwd-sort"
									type="number"
									min="0"
									className={inputCls}
									value={sortOrder}
									onChange={(e) => setSortOrder(e.target.value)}
								/>
							</div>
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

export function WrapOptionDetail({ id }: { id: string }) {
	const api = useGiftWrappingDetailApi(id);
	const [showEdit, setShowEdit] = useState(false);

	const { data, isLoading: loading } = api.detail.useQuery({
		id: api.id,
	}) as {
		data: { option: WrapOptionData } | undefined;
		isLoading: boolean;
	};

	const option = data?.option;

	if (loading) {
		return (
			<WrapOptionDetailTemplate>
				<div className="space-y-3">
					{["a", "b", "c"].map((k) => (
						<div
							key={k}
							className="h-12 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			</WrapOptionDetailTemplate>
		);
	}

	if (!option) {
		return (
			<WrapOptionDetailTemplate>
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">Option not found.</p>
				</div>
			</WrapOptionDetailTemplate>
		);
	}

	return (
		<WrapOptionDetailTemplate>
			{showEdit ? (
				<EditSheet
					option={option}
					onSaved={() => setShowEdit(false)}
					onCancel={() => setShowEdit(false)}
					api={api}
				/>
			) : null}

			<div className="rounded-lg border border-border bg-card p-5">
				<div className="flex items-start justify-between gap-4">
					<div className="space-y-1">
						<div className="flex items-center gap-2">
							<h2 className="font-semibold text-foreground text-lg">
								{option.name}
							</h2>
							<span
								className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
									option.active
										? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
										: "bg-muted text-muted-foreground"
								}`}
							>
								{option.active ? "Active" : "Inactive"}
							</span>
						</div>
						{option.description ? (
							<p className="text-muted-foreground text-sm">
								{option.description}
							</p>
						) : null}
						<div className="flex flex-wrap gap-4 pt-2 text-muted-foreground text-xs">
							<span>
								Price:{" "}
								<strong className="text-foreground">
									{formatPrice(option.priceInCents)}
								</strong>
							</span>
							<span>
								Sort:{" "}
								<strong className="text-foreground">{option.sortOrder}</strong>
							</span>
							<span>
								Created:{" "}
								<strong className="text-foreground">
									{new Date(option.createdAt).toLocaleDateString()}
								</strong>
							</span>
						</div>
					</div>
					<button
						type="button"
						onClick={() => setShowEdit(true)}
						className="shrink-0 rounded-lg border border-border px-3 py-1.5 text-foreground text-sm hover:bg-muted"
					>
						Edit
					</button>
				</div>
				{option.imageUrl ? (
					<div className="mt-4 overflow-hidden rounded-lg border border-border">
						<img
							src={option.imageUrl}
							alt={option.name}
							className="h-48 w-full object-cover"
						/>
					</div>
				) : null}
			</div>
		</WrapOptionDetailTemplate>
	);
}
