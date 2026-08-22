"use client";

import { type Form, formatDate, useFormsApi } from "./_shared";

interface FormStats {
	totalForms: number;
	totalSubmissions: number;
	unreadCount: number;
	spamCount: number;
}

export function FormsList() {
	const api = useFormsApi();
	const { data, isLoading } = api.list.useQuery({}) as {
		data: { forms?: Form[] } | undefined;
		isLoading: boolean;
	};
	const { data: statsData } = api.stats.useQuery({}) as {
		data: { stats?: FormStats } | undefined;
	};

	const forms = data?.forms ?? [];
	const stats = statsData?.stats;

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Forms</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Create and manage custom forms, contact pages, and surveys
					</p>
				</div>
				<a
					href="/admin/forms/create"
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					Create form
				</a>
			</div>

			{/* Stats row */}
			{stats ? (
				<div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total Forms
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalForms}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Total Submissions
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.totalSubmissions}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Unread
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.unreadCount}
						</p>
					</div>
					<div className="rounded-lg border border-border bg-card p-4">
						<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
							Spam
						</p>
						<p className="mt-1 font-bold text-2xl text-foreground">
							{stats.spamCount}
						</p>
					</div>
				</div>
			) : null}

			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2"] as const).map((key) => (
						<div
							key={key}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : forms.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No forms yet. Create your first form to start collecting
						submissions.
					</p>
				</div>
			) : (
				<div className="overflow-hidden rounded-lg border border-border bg-card">
					<table className="w-full">
						<thead>
							<tr className="border-border border-b bg-muted/40">
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
								>
									Name
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
								>
									Slug
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
								>
									Fields
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
								>
									Status
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide"
								>
									Created
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-border">
							{forms.map((form) => (
								<tr key={form.id} className="hover:bg-muted/30">
									<td className="px-4 py-3">
										<a
											href={`/admin/forms/${form.id}`}
											className="font-medium text-foreground text-sm hover:underline"
										>
											{form.name}
										</a>
										{form.description ? (
											<p className="mt-0.5 text-muted-foreground text-xs">
												{form.description}
											</p>
										) : null}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{form.slug}
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{form.fields.length}
									</td>
									<td className="px-4 py-3">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												form.isActive
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{form.isActive ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="px-4 py-3 text-muted-foreground text-sm">
										{formatDate(form.createdAt)}
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
