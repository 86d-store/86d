import { getSession } from "auth/actions";
import Image from "next/image";
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
						<Image
							src="/assets/logo/light.svg"
							alt="Store"
							width={120}
							height={32}
							unoptimized
							className="mx-auto h-8 w-auto dark:hidden"
						/>
						<Image
							src="/assets/logo/dark.svg"
							alt="Store"
							width={120}
							height={32}
							unoptimized
							className="mx-auto hidden h-8 w-auto dark:block"
						/>
					</a>
				</div>
				{children}
			</div>
		</div>
	);
}
