"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";

function useRedirectsApi() {
	const client = useModuleClient();
	return {
		list: client.module("redirects").admin["/admin/redirects"],
		stats: client.module("redirects").admin["/admin/redirects/stats"],
		create: client.module("redirects").admin["/admin/redirects/create"],
		delete: client.module("redirects").admin["/admin/redirects/:id/delete"],
		bulkDelete:
			client.module("redirects").admin["/admin/redirects/bulk-delete"],
		test: client.module("redirects").admin["/admin/redirects/test"],
	};
}

interface Redirect {
	id: string;
	sourcePath: string;
	targetPath: string;
	statusCode: number;
	isActive: boolean;
	isRegex: boolean;
	preserveQueryString: boolean;
	note?: string;
	hitCount: number;
	lastHitAt?: string;
	createdAt: string;
}

interface RedirectStats {
	totalRedirects: number;
	activeRedirects: number;
	totalHits: number;
}

const STATUS_LABELS: Record<number, string> = {
	301: "301 Permanent",
	302: "302 Temporary",
	307: "307 Temporary",
	308: "308 Permanent",
};

export function RedirectsAdmin() {
	const api = useRedirectsApi();
	const [search, setSearch] = useState("");
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [testPath, setTestPath] = useState("");
	const [testResult, setTestResult] = useState<string | null>(null);

	const {
		data,
		isLoading,
		isError: redirectsError,
		refetch,
	} = api.list.useQuery({
		...(search ? { search } : {}),
	}) as {
		data: { redirects?: Redirect[]; total?: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: RedirectStats } | undefined;
	};

	const deleteMutation = api.delete.useMutation() as {
		mutateAsync: (params: { params: { id: string } }) => Promise<unknown>;
	};

	const bulkDeleteMutation = api.bulkDelete.useMutation() as {
		mutateAsync: (params: { body: { ids: string[] } }) => Promise<unknown>;
	};

	const testMutation = api.test.useMutation() as {
		mutateAsync: (params: { body: { path: string } }) => Promise<{
			matched: boolean;
			redirect?: { targetPath: string; statusCode: number };
		}>;
	};

	if (redirectsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load redirects
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => void refetch()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const redirects = data?.redirects ?? [];
	const stats = statsData?.stats;

	async function handleDelete(id: string) {
		await deleteMutation.mutateAsync({ params: { id } });
		refetch();
	}

	async function handleBulkDelete() {
		if (selected.size === 0) return;
		await bulkDeleteMutation.mutateAsync({
			body: { ids: [...selected] },
		});
		setSelected(new Set());
		refetch();
	}

	async function handleTest() {
		if (!testPath) return;
		const result = await testMutation.mutateAsync({
			body: { path: testPath },
		});
		if (result.matched && result.redirect) {
			setTestResult(
				`${result.redirect.statusCode} → ${result.redirect.targetPath}`,
			);
		} else {
			setTestResult("No matching redirect found");
		}
	}

	function toggleSelect(id: string) {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Redirects</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage URL redirects for SEO and URL migration
					</p>
				</div>
			</div>

			{stats && (
				<div className="mb-6 grid grid-cols-3 gap-4">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-2xl text-foreground">
							{stats.totalRedirects}
						</p>
						<p className="text-muted-foreground text-sm">Total Redirects</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-2xl text-foreground">
							{stats.activeRedirects}
						</p>
						<p className="text-muted-foreground text-sm">Active</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-2xl text-foreground">
							{stats.totalHits}
						</p>
						<p className="text-muted-foreground text-sm">Total Hits</p>
					</div>
				</div>
			)}

			{/* Test redirect */}
			<div className="mb-6 flex gap-2">
				<input
					type="text"
					value={testPath}
					onChange={(e) => setTestPath(e.target.value)}
					placeholder="Test a path, e.g. /old-page"
					className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
				/>
				<button
					type="button"
					onClick={handleTest}
					className="rounded-md bg-secondary px-4 py-2 font-medium text-secondary-foreground text-sm hover:bg-secondary/80"
				>
					Test
				</button>
				{testResult && (
					<span className="self-center text-muted-foreground text-sm">
						{testResult}
					</span>
				)}
			</div>

			{/* Search + bulk actions */}
			<div className="mb-4 flex items-center gap-2">
				<input
					type="text"
					value={search}
					onChange={(e) => setSearch(e.target.value)}
					placeholder="Search redirects..."
					className="flex-1 rounded-md border border-input bg-background px-3 py-2 text-sm"
				/>
				{selected.size > 0 && (
					<button
						type="button"
						onClick={handleBulkDelete}
						className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/80"
					>
						Delete {selected.size}
					</button>
				)}
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={`skel-${i}`}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : redirects.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No redirects created yet. Add a redirect to manage URL changes.
					</p>
				</div>
			) : (
				<div className="rounded-lg border border-border bg-card">
					<table className="w-full">
						<thead>
							<tr className="border-border border-b text-left">
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									<input
										type="checkbox"
										checked={
											redirects.length > 0 && selected.size === redirects.length
										}
										onChange={() => {
											if (selected.size === redirects.length) {
												setSelected(new Set());
											} else {
												setSelected(new Set(redirects.map((r) => r.id)));
											}
										}}
									/>
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Source
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Target
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Type
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Hits
								</th>
								<th
									scope="col"
									className="px-4 py-3 font-medium text-muted-foreground text-xs uppercase tracking-wider"
								>
									Actions
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{redirects.map((redirect) => (
								<tr key={redirect.id} className="hover:bg-muted/50">
									<td className="px-4 py-3">
										<input
											type="checkbox"
											checked={selected.has(redirect.id)}
											onChange={() => toggleSelect(redirect.id)}
										/>
									</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-1">
											<code className="text-foreground text-sm">
												{redirect.sourcePath}
											</code>
											{redirect.isRegex && (
												<span className="ml-1 rounded bg-purple-100 px-1 py-0.5 font-mono text-purple-700 text-xs dark:bg-purple-900/30 dark:text-purple-400">
													regex
												</span>
											)}
										</div>
									</td>
									<td className="px-4 py-3">
										<code className="text-muted-foreground text-sm">
											{redirect.targetPath}
										</code>
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{STATUS_LABELS[redirect.statusCode] ?? redirect.statusCode}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												redirect.isActive
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
											}`}
										>
											{redirect.isActive ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{redirect.hitCount}
									</td>
									<td className="px-4 py-3">
										<button
											type="button"
											onClick={() => handleDelete(redirect.id)}
											className="text-destructive text-sm hover:underline"
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
		</div>
	);
}
