"use client";

import { useState } from "react";
import { toast } from "sonner";

export function SignUpForm() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const form = new FormData(e.currentTarget);
		try {
			const res = await fetch("/api/auth/sign-up/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: form.get("name"),
					email: form.get("email"),
					password: form.get("password"),
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(
					(data as { message?: string })?.message ?? "Could not create account",
				);
			}

			toast.success("Account created successfully");
			window.location.href = "/";
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form className="flex flex-col gap-4" onSubmit={handleSubmit}>
			{error ? (
				<div
					role="alert"
					className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-destructive text-sm"
				>
					{error}
				</div>
			) : null}
			<div>
				<label htmlFor="name" className="font-medium text-sm">
					Name
				</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					autoComplete="name"
					className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-ring transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-offset-2 focus:ring-offset-background"
				/>
			</div>
			<div>
				<label htmlFor="email" className="font-medium text-sm">
					Email
				</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					autoComplete="email"
					className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-ring transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-offset-2 focus:ring-offset-background"
				/>
			</div>
			<div>
				<label htmlFor="password" className="font-medium text-sm">
					Password
				</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					minLength={8}
					autoComplete="new-password"
					className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-ring transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-offset-2 focus:ring-offset-background"
				/>
			</div>
			<button
				type="submit"
				disabled={loading}
				className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
			>
				{loading ? "Creating account\u2026" : "Create account"}
			</button>
		</form>
	);
}
