"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useState } from "react";
import { Skeleton } from "~/components/ui/skeleton";

// ── Types ───────────────────────────────────────────────────────────────────

interface Customer {
	id: string;
	email: string;
	firstName?: string | undefined;
	lastName?: string | undefined;
	phone?: string | undefined;
	dateOfBirth?: string | undefined;
}

// ── Profile Page ────────────────────────────────────────────────────────────

export default function ProfilePage() {
	const client = useModuleClient();

	const customerApi = client.module("customers").store["/customers/me"];
	const updateApi = client.module("customers").store["/customers/me/update"];

	const { data, isLoading } = customerApi.useQuery() as {
		data: { customer: Customer } | undefined;
		isLoading: boolean;
	};

	const updateMutation = updateApi.useMutation({
		onSuccess: () => {
			void customerApi.invalidate();
			setSuccess(true);
			setTimeout(() => setSuccess(false), 3000);
		},
		onError: () => {
			setError("Failed to update profile. Please try again.");
		},
	});

	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [phone, setPhone] = useState("");
	const [dateOfBirth, setDateOfBirth] = useState("");
	const [initialized, setInitialized] = useState(false);
	const [success, setSuccess] = useState(false);
	const [error, setError] = useState("");

	const customer = data?.customer;

	// Initialize form values when customer data loads
	if (customer && !initialized) {
		setFirstName(customer.firstName ?? "");
		setLastName(customer.lastName ?? "");
		setPhone(customer.phone ?? "");
		setDateOfBirth(
			customer.dateOfBirth ? customer.dateOfBirth.slice(0, 10) : "",
		);
		setInitialized(true);
	}

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setSuccess(false);

		updateMutation.mutate({
			firstName: firstName || undefined,
			lastName: lastName || undefined,
			phone: phone || null,
			dateOfBirth: dateOfBirth ? new Date(dateOfBirth).toISOString() : null,
		});
	}

	return (
		<div>
			<div className="mb-6">
				<h2 className="font-bold font-display text-foreground text-xl tracking-tight sm:text-2xl">
					Profile
				</h2>
				<p className="mt-1 text-muted-foreground text-sm">
					Manage your personal information.
				</p>
			</div>

			{isLoading ? (
				<div className="flex flex-col gap-4">
					{[1, 2, 3, 4].map((n) => (
						<Skeleton key={n} className="h-16 rounded-xl" />
					))}
				</div>
			) : (
				<form onSubmit={handleSubmit}>
					<div className="flex flex-col gap-5 rounded-xl border border-border p-5">
						{/* Email (read-only) */}
						<div>
							<label
								htmlFor="email"
								className="mb-1.5 block font-medium text-foreground text-sm"
							>
								Email
							</label>
							<input
								id="email"
								type="email"
								value={customer?.email ?? ""}
								disabled
								className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 text-muted-foreground text-sm"
							/>
							<p className="mt-1 text-muted-foreground text-xs">
								Email cannot be changed here.
							</p>
						</div>

						{/* First Name */}
						<div>
							<label
								htmlFor="firstName"
								className="mb-1.5 block font-medium text-foreground text-sm"
							>
								First name
							</label>
							<input
								id="firstName"
								type="text"
								value={firstName}
								onChange={(e) => setFirstName(e.target.value)}
								maxLength={200}
								className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm transition-colors focus:border-foreground focus:outline-none"
							/>
						</div>

						{/* Last Name */}
						<div>
							<label
								htmlFor="lastName"
								className="mb-1.5 block font-medium text-foreground text-sm"
							>
								Last name
							</label>
							<input
								id="lastName"
								type="text"
								value={lastName}
								onChange={(e) => setLastName(e.target.value)}
								maxLength={200}
								className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm transition-colors focus:border-foreground focus:outline-none"
							/>
						</div>

						{/* Phone */}
						<div>
							<label
								htmlFor="phone"
								className="mb-1.5 block font-medium text-foreground text-sm"
							>
								Phone
							</label>
							<input
								id="phone"
								type="tel"
								value={phone}
								onChange={(e) => setPhone(e.target.value)}
								placeholder="Optional"
								className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm transition-colors placeholder:text-muted-foreground focus:border-foreground focus:outline-none"
							/>
						</div>

						{/* Date of Birth */}
						<div>
							<label
								htmlFor="dateOfBirth"
								className="mb-1.5 block font-medium text-foreground text-sm"
							>
								Date of birth
							</label>
							<input
								id="dateOfBirth"
								type="date"
								value={dateOfBirth}
								onChange={(e) => setDateOfBirth(e.target.value)}
								className="w-full rounded-lg border border-border bg-background px-3 py-2 text-foreground text-sm transition-colors focus:border-foreground focus:outline-none"
							/>
						</div>
					</div>

					{/* Messages */}
					{error && (
						<div
							className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-destructive text-sm"
							role="alert"
						>
							{error}
						</div>
					)}
					{success && (
						<output className="mt-4 block rounded-lg border border-status-success/20 bg-status-success-bg px-4 py-3 text-sm text-status-success">
							Profile updated successfully.
						</output>
					)}

					{/* Submit */}
					<div className="mt-5 flex items-center justify-end gap-3">
						<a
							href="/account"
							className="rounded-lg border border-border px-4 py-2 text-foreground text-sm transition-colors hover:bg-muted"
						>
							Cancel
						</a>
						<button
							type="submit"
							disabled={updateMutation.isPending}
							className="rounded-lg bg-foreground px-5 py-2 font-semibold text-background text-sm transition-opacity hover:opacity-90 disabled:opacity-60"
						>
							{updateMutation.isPending ? "Saving..." : "Save changes"}
						</button>
					</div>
				</form>
			)}
		</div>
	);
}
