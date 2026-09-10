import { getSession } from "auth/actions";
import { redirect } from "next/navigation";
import { AccountShell } from "./_components/account-shell";

export const metadata = {
	title: "My account",
};

export default async function AccountLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await getSession();
	if (!session) redirect("/auth/signin");

	return (
		<AccountShell
			userName={session.user.name ?? session.user.email}
			userEmail={session.user.email}
		>
			{children}
		</AccountShell>
	);
}
