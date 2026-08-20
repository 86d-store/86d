import { SignUpForm } from "~/components/auth/signup-form";

export const metadata = {
	title: "Create Account — 86d Store",
};

export default function SignUpPage() {
	return (
		<div className="rounded-xl border border-border bg-background p-6 shadow-sm">
			<div className="mb-6">
				<h1 className="font-semibold text-foreground text-xl">
					Create an account
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Sign up to track orders, save favorites, and checkout faster.
				</p>
			</div>
			<SignUpForm />
			<p className="mt-4 text-center text-muted-foreground text-sm">
				Already have an account?{" "}
				<a
					href="/auth/signin"
					className="text-foreground underline underline-offset-4 transition-colors hover:text-foreground/80"
				>
					Sign in
				</a>
			</p>
		</div>
	);
}
