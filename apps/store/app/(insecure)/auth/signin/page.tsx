import { Suspense } from "react";
import { SignInForm } from "~/components/auth/signin-form";

export const metadata = {
	title: "Sign in — 86d Store",
};

const show86dSso = Boolean(
	process.env["86D_ADMIN_OAUTH_CLIENT_ID"] &&
		process.env["86D_ADMIN_OAUTH_CLIENT_SECRET"],
);

export default function SignInPage() {
	return (
		<div className="rounded-xl border border-border bg-background p-6 shadow-sm">
			<div className="mb-6">
				<h1 className="font-semibold text-foreground text-xl">Sign in</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Enter your credentials to access your account.
				</p>
			</div>
			<Suspense>
				<SignInForm show86dSso={show86dSso} />
			</Suspense>
			<div className="mt-4 flex items-center justify-between text-sm">
				<a
					href="/auth/reset"
					className="text-muted-foreground transition-colors hover:text-foreground"
				>
					Forgot password?
				</a>
				<a
					href="/auth/signup"
					className="text-foreground underline underline-offset-4 transition-colors hover:text-foreground/80"
				>
					Create account
				</a>
			</div>
		</div>
	);
}
