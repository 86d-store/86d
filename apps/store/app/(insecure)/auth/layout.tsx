import { getSession } from "auth/actions";
import { redirect } from "next/navigation";

interface AuthLayoutProps {
	children: React.ReactNode;
}

export default async function AuthLayout({ children }: AuthLayoutProps) {
	const session = await getSession();
	if (session) redirect("/admin");

	return (
		<div className="flex min-h-svh items-center justify-center bg-muted px-4 py-8">
			<div className="flex w-full max-w-sm flex-col gap-4">
				<div className="text-center">
					<a href="/" className="inline-block">
						<img
							src="/assets/logo/light.svg"
							alt="Store"
							className="mx-auto h-8 w-auto dark:hidden"
						/>
						<img
							src="/assets/logo/dark.svg"
							alt="Store"
							className="mx-auto hidden h-8 w-auto dark:block"
						/>
					</a>
				</div>
				{children}
			</div>
		</div>
	);
}
