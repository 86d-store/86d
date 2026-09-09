import { getSession } from "auth/actions";
import { verifyStoreAdminAccess } from "auth/store-access";
import { LockKeyholeIcon } from "lucide-react";
import { redirect } from "next/navigation";
import { AdminShell } from "~/components/admin/shell";
import { PageState } from "~/components/page-state";
import { getAdminNavGroups } from "~/lib/admin-registry";

export const metadata = {
	title: "Store admin",
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
			<PageState
				title="Store admin access needed"
				description="Ask the store owner to give your account access to store admin. You can still visit the storefront."
				icon={<LockKeyholeIcon aria-hidden="true" />}
				actionHref="/"
				actionLabel="Go to storefront"
			/>
		);
	}

	const navGroups = getAdminNavGroups();
	return <AdminShell navGroups={navGroups}>{children}</AdminShell>;
}
