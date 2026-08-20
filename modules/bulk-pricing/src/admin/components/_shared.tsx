"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";

export function useBulkPricingApi() {
	const client = useModuleClient();
	return {
		list: client.module("bulk-pricing").admin["/admin/bulk-pricing/rules"],
		createRule:
			client.module("bulk-pricing").admin["/admin/bulk-pricing/rules/create"],
		updateRule:
			client.module("bulk-pricing").admin[
				"/admin/bulk-pricing/rules/:id/update"
			],
		deleteRule:
			client.module("bulk-pricing").admin[
				"/admin/bulk-pricing/rules/:id/delete"
			],
	};
}

export interface BulkPriceRule {
	id: string;
	name?: string;
	description?: string;
	scope?: "product" | "variant" | "collection" | "global";
	targetId?: string;
	priority?: number;
	active: boolean;
	startsAt?: string;
	endsAt?: string;
	createdAt: string;
}

export function RuleSheet({ rule, onSaved, onCancel }: RuleSheetProps) {
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
	const api = useBulkPricingApi();
	const isEditing = !!rule;

	const [name, setName] = useState(rule?.name ?? "");
	const [description, setDescription] = useState(rule?.description ?? "");
	const [scope, setScope] = useState<
		"product" | "variant" | "collection" | "global"
	>(rule?.scope ?? "product");
	const [targetId, setTargetId] = useState(rule?.targetId ?? "");
	const [priority, setPriority] = useState(String(rule?.priority ?? 0));
	const [active, setActive] = useState(rule?.active ?? true);
	const [error, setError] = useState("");

	const createMutation = api.createRule.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const updateMutation = api.updateRule.useMutation({
		onSuccess: () => {
			void api.list.invalidate();
			onSaved();
		},
		onError: (err: Error) => setError(extractError(err)),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");

		const body = {
			name: name.trim() || undefined,
			description: description.trim() || undefined,
			scope,
			targetId: targetId.trim() || undefined,
			priority: Number.parseInt(priority, 10) || undefined,
			active,
		};

		if (isEditing) {
			updateMutation.mutate({ params: { id: rule.id }, body });
		} else {
			createMutation.mutate({ body: { ...body, scope } });
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
						{isEditing ? "Edit Rule" : "New Pricing Rule"}
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
							<label htmlFor="bp-name" className={labelCls}>
								Name
							</label>
							<input
								id="bp-name"
								ref={firstInputRef}
								className={inputCls}
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Volume Discount"
							/>
						</div>
						<div>
							<label htmlFor="bp-desc" className={labelCls}>
								Description
							</label>
							<input
								id="bp-desc"
								className={inputCls}
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Optional description"
							/>
						</div>
						<div>
							<label htmlFor="bp-scope" className={labelCls}>
								Scope
							</label>
							<select
								id="bp-scope"
								className={inputCls}
								value={scope}
								onChange={(e) =>
									setScope(
										e.target.value as
											| "product"
											| "variant"
											| "collection"
											| "global",
									)
								}
							>
								<option value="product">Product</option>
								<option value="variant">Variant</option>
								<option value="collection">Collection</option>
								<option value="global">Global</option>
							</select>
						</div>
						{scope !== "global" ? (
							<div>
								<label htmlFor="bp-target" className={labelCls}>
									Target ID
								</label>
								<input
									id="bp-target"
									className={inputCls}
									value={targetId}
									onChange={(e) => setTargetId(e.target.value)}
									placeholder="Product / variant / collection ID"
								/>
							</div>
						) : null}
						<div>
							<label htmlFor="bp-priority" className={labelCls}>
								Priority
							</label>
							<input
								id="bp-priority"
								type="number"
								min="0"
								className={inputCls}
								value={priority}
								onChange={(e) => setPriority(e.target.value)}
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
									: "Create Rule"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}

export interface RuleSheetProps {
	rule?: BulkPriceRule;
	onSaved: () => void;
	onCancel: () => void;
}

export function extractError(err: unknown): string {
	if (err && typeof err === "object" && "message" in err) {
		return String((err as { message: string }).message);
	}
	return "An unexpected error occurred";
}

export const labelCls = "mb-1 block font-medium text-foreground text-sm";

export const inputCls =
	"w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1 disabled:opacity-50";
