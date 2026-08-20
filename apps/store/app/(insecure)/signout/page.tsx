"use client";

import { useEffect, useState } from "react";
import { buttonVariants } from "~/components/ui/button";

export default function SignOutPage() {
	const [error, setError] = useState(false);

	useEffect(() => {
		async function performSignOut() {
			try {
				const res = await fetch("/api/auth/sign-out", { method: "POST" });
				if (res.ok) {
					window.location.href = "/auth/signin";
				} else {
					setError(true);
				}
			} catch {
				setError(true);
			}
		}
		performSignOut();
	}, []);

	if (error) {
		return (
			<div className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
				<div className="w-full max-w-sm text-center">
					<h1 className="mb-2 font-semibold text-foreground text-xl">
						Sign out failed
					</h1>
					<p className="mb-6 text-muted-foreground text-sm">
						Something went wrong. Please try again.
					</p>
					<a href="/" className={buttonVariants()}>
						Go to home
					</a>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-svh items-center justify-center bg-background px-4 py-8">
			<div className="w-full max-w-sm text-center">
				<div className="mb-4 flex justify-center">
					<div className="h-6 w-6 animate-spin rounded-full border-2 border-foreground border-t-transparent" />
				</div>
				<p className="text-muted-foreground text-sm">Signing out...</p>
			</div>
		</div>
	);
}
