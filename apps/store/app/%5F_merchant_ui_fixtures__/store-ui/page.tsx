"use client";

import { CircleAlertIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { AdminShell } from "~/components/admin/shell";
import { PageState } from "~/components/page-state";
import { StoreNavbar } from "~/components/store-navbar";
import { getAdminNavGroups } from "~/lib/admin-registry";
import { AccountShell } from "../../(insecure)/account/_components/account-shell";
import { DashboardFixture } from "./_components/dashboard-fixture";

export default function StoreUiFixture() {
	const params = useSearchParams();
	const [retries, setRetries] = useState(0);
	const surface = params.get("surface");

	if (surface === "account") {
		return (
			<AccountShell
				userName="Alex Morgan"
				userEmail="alex.morgan.with.a.long.email@example.com"
			>
				<h2>Recent orders</h2>
			</AccountShell>
		);
	}

	if (surface === "recovery") {
		return (
			<PageState
				title="We couldn’t load this page"
				description={
					retries > 0
						? "The page is ready to load again."
						: "Try loading the page again, or return to your dashboard."
				}
				icon={<CircleAlertIcon aria-hidden="true" />}
				actionHref="/admin"
				actionLabel="Back to dashboard"
				onRetry={() => setRetries((value) => value + 1)}
			/>
		);
	}

	if (surface === "navbar") {
		return (
			<>
				<StoreNavbar
					config={{
						name: "Everyday objects",
						logo: {
							light: "/assets/icon/light.svg",
							dark: "/assets/icon/dark.svg",
						},
					}}
					navItems={[
						{ label: "Shop", href: "/products" },
						{ label: "Collections", href: "/collections" },
						{ label: "Journal", href: "/blog" },
						{ label: "About", href: "/about" },
					]}
				/>
				<main className="mx-auto max-w-7xl p-6">
					<h1>Explore the store</h1>
				</main>
			</>
		);
	}

	return (
		<AdminShell navGroups={getAdminNavGroups()}>
			<DashboardFixture state={params.get("state")} />
		</AdminShell>
	);
}
