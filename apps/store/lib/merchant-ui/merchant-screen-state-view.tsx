"use client";

import type { MerchantScreenState } from "~/lib/merchant-ui/screen-states";

export interface MerchantScreenStateViewProps {
	state: MerchantScreenState;
	noun: { singular: string; plural: string };
	createLabel: string;
	onCreate?: () => void;
	errorMessage?: string;
	permissionMessage?: string;
	providerMessage?: string;
}

/**
 * Shared five-state renderer for locked Store Admin reference surfaces.
 * Merchant copy only — never names providers or architecture vocabulary.
 */
export function MerchantScreenStateView({
	state,
	noun,
	createLabel,
	onCreate,
	errorMessage = "Something went wrong loading this page. Try again in a moment.",
	permissionMessage = "You do not have permission to view this. Ask a store owner or admin to grant access.",
	providerMessage = "This capability is temporarily unavailable. Your data is safe. Try again shortly.",
}: MerchantScreenStateViewProps) {
	if (state === "loading") {
		return (
			<div
				data-testid="merchant-state-loading"
				data-merchant-state="loading"
				className="flex flex-col gap-3"
				aria-busy="true"
			>
				<div className="h-9 w-64 animate-pulse rounded-md bg-muted" />
				<div className="h-10 w-full animate-pulse rounded-md bg-muted" />
				<div className="h-48 w-full animate-pulse rounded-md bg-muted" />
			</div>
		);
	}

	if (state === "empty") {
		return (
			<div
				data-testid="merchant-state-empty"
				data-merchant-state="empty"
				className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-12 text-center"
			>
				<h2 className="font-medium text-lg">No {noun.plural} yet</h2>
				<p className="max-w-sm text-muted-foreground text-sm">
					Create the first {noun.singular} to get started.
				</p>
				{onCreate ? (
					<button
						type="button"
						className="rounded-md bg-primary px-3 py-2 text-primary-foreground text-sm"
						onClick={onCreate}
					>
						{createLabel}
					</button>
				) : null}
			</div>
		);
	}

	if (state === "error") {
		return (
			<div
				data-testid="merchant-state-error"
				data-merchant-state="error"
				role="alert"
				className="rounded-md border border-destructive/40 bg-destructive/10 p-4"
			>
				<p className="font-medium">Could not load {noun.plural}</p>
				<p className="text-muted-foreground text-sm">{errorMessage}</p>
			</div>
		);
	}

	if (state === "permission") {
		return (
			<div
				data-testid="merchant-state-permission"
				data-merchant-state="permission"
				role="status"
				className="rounded-md border p-4"
			>
				<p className="font-medium">Permission needed</p>
				<p className="text-muted-foreground text-sm">{permissionMessage}</p>
			</div>
		);
	}

	return (
		<div
			data-testid="merchant-state-provider"
			data-merchant-state="provider"
			role="status"
			className="rounded-md border p-4"
		>
			<p className="font-medium">Temporarily unavailable</p>
			<p className="text-muted-foreground text-sm">{providerMessage}</p>
		</div>
	);
}
