import { ResetPasswordForm } from "~/components/auth/reset-password-form";

export const metadata = {
	title: "Reset Password — 86d Store",
};

export default function ResetPasswordPage() {
	return (
		<div className="rounded-xl border border-border bg-background p-6 shadow-sm">
			<div className="mb-6">
				<h1 className="font-semibold text-foreground text-xl">
					Reset your password
				</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Enter your email and we&apos;ll send you a link to reset your
					password.
				</p>
			</div>
			<ResetPasswordForm />
			<p className="mt-4 text-center text-muted-foreground text-sm">
				Remember your password?{" "}
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
