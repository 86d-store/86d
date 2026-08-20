"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm({ show86dSso = false }: { show86dSso?: boolean }) {
	const searchParams = useSearchParams();
	const redirectTo = searchParams.get("redirect") ?? "/";
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState("");

	async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setLoading(true);
		setError("");

		const form = new FormData(e.currentTarget);
		try {
			const res = await fetch("/api/auth/sign-in/email", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					email: form.get("email"),
					password: form.get("password"),
				}),
			});

			if (!res.ok) {
				const data = await res.json().catch(() => null);
				throw new Error(
					(data as { message?: string })?.message ??
						"Invalid email or password",
				);
			}

			toast.success("Signed in successfully");
			window.location.href = redirectTo;
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setLoading(false);
		}
	}

	function handleSsoSignIn() {
		const callbackUrl = encodeURIComponent(redirectTo);
		window.location.href = `/api/auth/sign-in/social?provider=86d&callbackURL=${callbackUrl}`;
	}

	return (
		<div className="flex flex-col gap-4">
			{show86dSso ? (
				<>
					<button
						type="button"
						onClick={handleSsoSignIn}
						className="flex w-full items-center justify-center gap-2 rounded-md border border-input bg-background px-4 py-2 font-medium text-sm shadow-sm transition-colors hover:bg-accent"
					>
						<svg
							width="18"
							height="18"
							viewBox="0 0 24 24"
							fill="none"
							xmlns="http://www.w3.org/2000/svg"
							aria-hidden="true"
						>
							<rect
								width="24"
								height="24"
								rx="4"
								fill="currentColor"
								fillOpacity="0.1"
							/>
							<text
								x="12"
								y="16"
								textAnchor="middle"
								fontSize="10"
								fontWeight="bold"
								fill="currentColor"
							>
								86d
							</text>
						</svg>
						Sign in with 86d.app
					</button>
					<div className="relative flex items-center">
						<div className="flex-1 border-border border-t" />
						<span className="mx-3 text-muted-foreground text-xs">or</span>
						<div className="flex-1 border-border border-t" />
					</div>
				</>
			) : null}
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
				<div>
					<label htmlFor="password" className="font-medium text-sm">
						Password
					</label>
					<input
						id="password"
						name="password"
						type="password"
						required
						autoComplete="current-password"
						className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm outline-none ring-ring transition-colors placeholder:text-muted-foreground focus:ring-2 focus:ring-offset-2 focus:ring-offset-background"
					/>
				</div>
				<button
					type="submit"
					disabled={loading}
					className="w-full rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm shadow-sm transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50"
				>
					{loading ? "Signing in\u2026" : "Sign in"}
				</button>
			</form>
		</div>
	);
}
