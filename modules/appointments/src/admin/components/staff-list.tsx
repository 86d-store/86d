"use client";

import { useState } from "react";
import { extractError, useAppointmentsApi } from "./_shared";

interface Staff {
	id: string;
	name: string;
	email: string;
	bio?: string;
	status: string;
	createdAt: string;
	updatedAt: string;
}

export function StaffList() {
	const api = useAppointmentsApi();
	const [showCreate, setShowCreate] = useState(false);
	const [staffName, setStaffName] = useState("");
	const [staffEmail, setStaffEmail] = useState("");
	const [staffBio, setStaffBio] = useState("");
	const [error, setError] = useState("");

	const { data, isLoading } = api.listStaff.useQuery({}) as {
		data: { staff?: Staff[] } | undefined;
		isLoading: boolean;
	};

	const createMutation = api.createStaff.useMutation() as {
		mutateAsync: (opts: { body: Record<string, unknown> }) => Promise<unknown>;
		isPending: boolean;
	};
	const deleteMutation = api.deleteStaff.useMutation() as {
		mutateAsync: (opts: { params: { id: string } }) => Promise<unknown>;
		isPending: boolean;
	};

	const staff = data?.staff ?? [];

	const handleCreate = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		if (!staffName.trim() || !staffEmail.trim()) {
			setError("Name and email are required.");
			return;
		}
		try {
			await createMutation.mutateAsync({
				body: {
					name: staffName.trim(),
					email: staffEmail.trim(),
					bio: staffBio.trim() || undefined,
				},
			});
			setStaffName("");
			setStaffEmail("");
			setStaffBio("");
			setShowCreate(false);
			window.location.reload();
		} catch (err) {
			setError(extractError(err));
		}
	};

	const handleDelete = async (id: string) => {
		if (!confirm("Delete this staff member?")) return;
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
					<h1 className="font-bold text-2xl text-foreground">Staff</h1>
					<p className="mt-1 text-muted-foreground text-sm">
						Manage appointment staff members
					</p>
				</div>
				<button
					type="button"
					onClick={() => setShowCreate(!showCreate)}
					className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90"
				>
					{showCreate ? "Cancel" : "Add Staff"}
				</button>
			</div>

			{/* Create form */}
			{showCreate ? (
				<div className="mb-6 rounded-lg border border-border bg-card p-5">
					<h2 className="mb-4 font-semibold text-foreground text-sm">
						New Staff Member
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
									value={staffName}
									onChange={(e) => setStaffName(e.target.value)}
									placeholder="Jane Smith"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
							<label className="block">
								<span className="mb-1 block font-medium text-sm">Email</span>
								<input
									type="email"
									value={staffEmail}
									onChange={(e) => setStaffEmail(e.target.value)}
									placeholder="jane@example.com"
									className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
								/>
							</label>
						</div>
						<label className="block">
							<span className="mb-1 block font-medium text-sm">Bio</span>
							<input
								type="text"
								value={staffBio}
								onChange={(e) => setStaffBio(e.target.value)}
								placeholder="Optional bio"
								className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
							/>
						</label>
						<button
							type="submit"
							disabled={createMutation.isPending}
							className="rounded-lg bg-foreground px-4 py-2 font-medium text-background text-sm hover:opacity-90 disabled:opacity-50"
						>
							{createMutation.isPending ? "Creating..." : "Add Staff Member"}
						</button>
					</form>
				</div>
			) : null}

			{/* Staff list */}
			{isLoading ? (
				<div className="space-y-3">
					{(["k0", "k1", "k2"] as const).map((key) => (
						<div
							key={key}
							className="h-16 animate-pulse rounded-lg border border-border bg-muted/30"
						/>
					))}
				</div>
			) : staff.length === 0 ? (
				<div className="rounded-lg border border-border bg-card p-8 text-center">
					<p className="text-muted-foreground text-sm">
						No staff members yet. Add one to get started.
					</p>
				</div>
			) : (
				<div className="space-y-3">
					{staff.map((s) => (
						<div
							key={s.id}
							className="rounded-lg border border-border bg-card p-4"
						>
							<div className="flex items-start justify-between gap-4">
								<div className="min-w-0 flex-1">
									<div className="flex items-center gap-2">
										<p className="font-medium text-foreground text-sm">
											{s.name}
										</p>
										<span
											className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${
												s.status === "active"
													? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
													: "bg-muted text-muted-foreground"
											}`}
										>
											{s.status}
										</span>
									</div>
									<div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted-foreground text-xs">
										<span>{s.email}</span>
										{s.bio ? <span>{s.bio}</span> : null}
									</div>
								</div>
								<button
									type="button"
									onClick={() => handleDelete(s.id)}
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
