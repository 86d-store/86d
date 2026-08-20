"use client";

import { useState } from "react";
import { toast } from "sonner";

export function ResetPasswordForm() {
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");
	const [sent, setSent] = useState(false);

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const form = new FormData(e.currentTarget);
		try {
			const res = await fetch("/api/auth/forget-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email: form.get("email") }),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(
					(data as { message?: string })?.message ??
						"Could not send reset link",
				);
			}

			setSent(true);
			toast.success("Check your email for a reset link");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setLoading(false);
		}
	}

	if (sent) {
		return (
			<div className="rounded-md border border-border bg-muted/50 px-4 py-6 text-center text-sm">
				<p className="font-medium">Check your email</p>
				<p className="mt-1 text-muted-foreground">
					If an account exists with that email, you&apos;ll receive a password
					reset link.
				</p>
			</div>
		);
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
			<button
				type="submit"
				disabled={loading}
				className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
			>
				{loading ? "Sending\u2026" : "Reset password"}
			</button>
		</form>
	);
}
