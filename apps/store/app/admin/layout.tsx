import { getSession } from "auth/actions";
import { verifyStoreAdminAccess } from "auth/store-access";
import { redirect } from "next/navigation";
import { AdminShell } from "~/components/admin/shell";
import { getAdminNavGroups } from "~/lib/admin-registry";

export const metadata = {
	title: "Store Admin",
};

export default async function AdminLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getSession();
	if (!session) redirect("/auth/signin");

	const access = verifyStoreAdminAccess(session.user);
	if (!access.hasAccess) {
		return (
			<div className="flex min-h-svh items-center justify-center bg-background p-4">
				<div className="mx-auto max-w-md text-center">
					<p className="font-bold font-mono text-6xl text-muted-foreground">
						403
					</p>
					<h1 className="mt-4 font-semibold text-foreground text-xl">
						Access denied
					</h1>
					<p className="mt-2 text-muted-foreground text-sm">
						You don&apos;t have permission to access this store&apos;s admin
						panel. Contact the store owner to request access.
					</p>
					<a
						href="/"
						className="mt-6 inline-block rounded-md bg-foreground px-4 py-2 font-medium text-background text-sm transition-colors hover:bg-foreground/90"
					>
						Go to storefront
					</a>
				</div>
			</div>
		);
	}

	const navGroups = getAdminNavGroups();
	return <AdminShell navGroups={navGroups}>{children}</AdminShell>;
}
