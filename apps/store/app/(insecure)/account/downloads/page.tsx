"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { DownloadIcon } from "lucide-react";
import { useState } from "react";
import { StatusBadge } from "~/components/status-badge";
import { Button, buttonVariants } from "~/components/ui/button";
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "~/components/ui/empty";
import { Skeleton } from "~/components/ui/skeleton";

// ── Types ───────────────────────────────────────────────────────────────────

interface DownloadToken {
	id: string;
	fileId: string;
	fileName: string;
	token: string;
	email: string;
	status: string;
	downloadCount: number;
	maxDownloads: number | null;
	expiresAt: string | null;
	createdAt: string;
}

interface Customer {
	id: string;
	email: string;
	firstName?: string | undefined;
	lastName?: string | undefined;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(iso));
}

// ── Downloads Page ──────────────────────────────────────────────────────────

export default function DownloadsPage() {
	const client = useModuleClient();

	const customerApi = client.module("customers").store["/customers/me"];
	const { data: customerData } = customerApi.useQuery() as {
		data: { customer: Customer } | undefined;
	};

	const email = customerData?.customer?.email;

	const downloadsApi =
		client.module("digital-downloads").store["/downloads/me"];
	const {
		data: downloadsData,
		isLoading,
		isError,
		refetch,
	} = downloadsApi.useQuery(email ? { email } : undefined, {
		enabled: !!email,
	}) as {
		data: { tokens: DownloadToken[] } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const downloadApi =
		client.module("digital-downloads").store["/downloads/:token"];

	const tokens = downloadsData?.tokens ?? [];
	const [downloadError, setDownloadError] = useState("");

	async function handleDownload(token: string) {
		setDownloadError("");
		try {
			const result = (await downloadApi.fetch({
				params: { token },
			})) as { url?: string };
			const url = result?.url;
			if (url) {
				window.open(url, "_blank", "noopener,noreferrer");
			}
		} catch {
			setDownloadError("Failed to start download. Please try again.");
		}
	}

	function isDownloadable(token: DownloadToken): boolean {
		if (token.status !== "active") return false;
		if (
			token.maxDownloads !== null &&
			token.downloadCount >= token.maxDownloads
		)
			return false;
		if (token.expiresAt && new Date(token.expiresAt) < new Date()) return false;
		return true;
	}

	return (
		<div>
			<div className="mb-6">
				<h2 className="font-bold font-display text-foreground text-xl tracking-tight sm:text-2xl">
					My Downloads
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Access your purchased digital files.
				</p>
			</div>

			{downloadError && (
				<div
					className="mb-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
					role="alert"
				>
					{downloadError}
				</div>
			)}

			{isError ? (
				<div
					className="rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
					role="alert"
				>
					<p>Failed to load your downloads.</p>
					<button
						type="button"
						onClick={() => refetch()}
						className="mt-1 font-medium underline"
					>
						Try again
					</button>
				</div>
			) : isLoading || !email ? (
				<div className="flex flex-col gap-3">
					{[1, 2, 3].map((n) => (
						<Skeleton key={n} className="h-20 rounded-xl" />
					))}
				</div>
			) : tokens.length === 0 ? (
				<Empty>
					<EmptyHeader>
						<EmptyMedia variant="icon">
							<DownloadIcon />
						</EmptyMedia>
						<EmptyTitle>No downloads yet</EmptyTitle>
						<EmptyDescription>
							Your digital purchases will appear here.
						</EmptyDescription>
					</EmptyHeader>
					<EmptyContent>
						<a href="/products" className={buttonVariants()}>
							Browse products
						</a>
					</EmptyContent>
				</Empty>
			) : (
				<div className="flex flex-col gap-3">
					{tokens.map((token) => {
						const canDownload = isDownloadable(token);
						const statusLabel =
							token.status === "active" &&
							token.maxDownloads !== null &&
							token.downloadCount >= token.maxDownloads
								? "limit_reached"
								: token.status === "active" &&
										token.expiresAt &&
										new Date(token.expiresAt) < new Date()
									? "expired"
									: token.status;
						return (
							<div
								key={token.id}
								className="flex items-center justify-between gap-4 rounded-xl border border-border p-4"
							>
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground text-sm">
											{token.fileName}
										</p>
										<StatusBadge status={statusLabel} />
									</div>
									<div className="mt-1 flex items-center gap-3 text-muted-foreground text-xs">
										<span>
											{token.downloadCount}
											{token.maxDownloads !== null
												? ` / ${token.maxDownloads}`
												: ""}{" "}
											downloads
										</span>
										{token.expiresAt && (
											<span>Expires {formatDate(token.expiresAt)}</span>
										)}
										<span>Added {formatDate(token.createdAt)}</span>
									</div>
								</div>
								<Button
									disabled={!canDownload}
									onClick={() => handleDownload(token.token)}
									className="shrink-0"
								>
									Download
								</Button>
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
}
