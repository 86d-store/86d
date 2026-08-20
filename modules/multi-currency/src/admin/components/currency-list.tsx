"use client";

import { type Currency, useCurrencyApi } from "./_shared";

export function CurrencyList() {
	const api = useCurrencyApi();

	const { data, isLoading } = api.listCurrencies.useQuery({}) as {
		data: { currencies?: Currency[] } | undefined;
		isLoading: boolean;
	};

	const deleteMutation = api.deleteCurrency.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};
	const setBaseMutation = api.setBase.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	const currencies = data?.currencies ?? [];

	const handleDelete = async (id: string) => {
		if (!confirm("Delete this currency? This cannot be undone.")) return;
		try {
			await deleteMutation.mutateAsync({ params: { id } });
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	const handleSetBase = async (id: string) => {
		if (!confirm("Set this currency as the base currency?")) return;
		try {
			await setBaseMutation.mutateAsync({ params: { id } });
			window.location.reload();
		} catch {
			// silently handled
		}
	};

	return (
		<div>
			<div className="mb-6 flex items-center justify-between">
				<div>
					<h1 className="font-bold text-2xl text-foreground">Currencies</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage store currencies and exchange rates
					</p>
				</div>
				<a
					href="/admin/currencies/new"
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					Add Currency
				</a>
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
			) : currencies.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No currencies configured. Add your base currency to get started.
					</p>
				</div>
			) : (
				<div className="overflow-x-auto rounded-md border border-border">
					<table className="w-full text-left text-sm">
						<thead>
							<tr className="border-border border-b bg-muted">
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Currency
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Code
								</th>
								<th
									scope="col"
									className="px-4 py-2 font-medium text-muted-foreground"
								>
									Symbol
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
						<tbody className="divide-y divide-border">
							{currencies.map((c) => (
								<tr key={c.id} className="transition-colors hover:bg-muted/50">
									<td className="px-4 py-2 text-foreground">
										<div className="flex items-center gap-2">
											{c.name}
											{c.isBase ? (
												<span className="inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-800 text-xs dark:bg-indigo-900/30 dark:text-indigo-400">
													Base
												</span>
											) : null}
										</div>
									</td>
									<td className="px-4 py-2 font-mono text-foreground text-xs">
										{c.code}
									</td>
									<td className="px-4 py-2 text-foreground">{c.symbol}</td>
									<td className="px-4 py-2 font-mono text-foreground text-xs">
										{c.isBase ? "1.000000" : c.exchangeRate.toFixed(6)}
									</td>
									<td className="px-4 py-2">
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												c.isActive
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{c.isActive ? "Active" : "Inactive"}
										</span>
									</td>
									<td className="px-4 py-2">
										<div className="flex gap-1">
											<a
												href={`/admin/currencies/${c.id}`}
												className="rounded px-2 py-1 text-xs hover:bg-muted"
											>
												View
											</a>
											<a
												href={`/admin/currencies/${c.id}/edit`}
												className="rounded px-2 py-1 text-xs hover:bg-muted"
											>
												Edit
											</a>
											{!c.isBase ? (
												<>
													<button
														type="button"
														onClick={() => handleSetBase(c.id)}
														className="rounded px-2 py-1 text-xs hover:bg-muted"
													>
														Set Base
													</button>
													<button
														type="button"
														onClick={() => handleDelete(c.id)}
														className="rounded px-2 py-1 text-red-600 text-xs hover:bg-red-50 dark:hover:bg-red-900/20"
													>
														Delete
													</button>
												</>
											) : null}
										</div>
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
