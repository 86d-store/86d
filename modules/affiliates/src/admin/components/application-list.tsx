"use client";

import { type Affiliate, formatDate, useAffiliatesApi } from "./_shared";

export function ApplicationList() {
	const api = useAffiliatesApi();

	const { data, isLoading } = api.listAffiliates.useQuery({
		status: "pending",
	}) as {
		data: { affiliates?: Affiliate[]; total?: number } | undefined;
		isLoading: boolean;
	};

	const approveMutation = api.approveAffiliate.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};
	const rejectMutation = api.rejectAffiliate.useMutation() as {
		mutateAsync: (opts: {
			params: { id: string };
			body: Record<string, unknown>;
		}) => Promise<unknown>;
		isPending: boolean;
	};

	const affiliates = data?.affiliates ?? [];

	const handleApprove = async (id: string) => {
		try {
			await approveMutation.mutateAsync({
				params: { id },
				body: { id },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handleReject = async (id: string) => {
		try {
			await rejectMutation.mutateAsync({
				params: { id },
				body: { id },
			});
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	return (
		<div>
			<div className="mb-6">
				<h1 className="font-bold text-2xl text-foreground">
					Affiliate Applications
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Review pending affiliate applications
				</p>
			</div>

			{isLoading ? (
				<div className="space-y-3">
					{Array.from({ length: 3 }).map((_, i) => (
						<div
							key={`skel-${i}`}
							className="h-20 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : affiliates.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No pending applications.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{affiliates.map((aff) => (
						<div
							key={aff.id}
							className="rounded-lg border border-border bg-card p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<p className="font-medium text-foreground text-sm">
										{aff.name}
									</p>
									<div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
										<span>{aff.email}</span>
										{aff.website ? <span>{aff.website}</span> : null}
										<span>Applied: {formatDate(aff.createdAt)}</span>
									</div>
									{aff.notes ? (
										<p className="mt-2 text-foreground text-sm">{aff.notes}</p>
									) : null}
								</div>
								<div className="flex gap-1">
									<button
										type="button"
										onClick={() => handleApprove(aff.id)}
										className="rounded bg-green-50 px-3 py-1.5 font-medium text-green-700 text-xs hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400"
									>
										Approve
									</button>
									<button
										type="button"
										onClick={() => handleReject(aff.id)}
										className="rounded px-3 py-1.5 font-medium text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
									>
										Reject
									</button>
								</div>
							</div>
						</div>
					))}
				</div>
			)}
		</div>
	);
}
