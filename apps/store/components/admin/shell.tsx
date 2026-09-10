"use client";

import { SidebarProvider } from "@86d-app/ui/shadcn/sidebar";
import type { AdminNavGroup } from "~/lib/admin-registry";
import { useAdminNavigation } from "./_hooks/use-admin-navigation";
import Template from "./shell.mdx";

export interface AdminShellProps {
	navGroups: AdminNavGroup[];
	children: React.ReactNode;
}

function AdminShellContent({ navGroups, children }: AdminShellProps) {
	const navigation = useAdminNavigation(navGroups);
	return <Template {...navigation}>{children}</Template>;
}

export function AdminShell(props: AdminShellProps) {
	return (
		<SidebarProvider className="h-svh min-h-0 overflow-hidden antialiased motion-reduce:[&_[data-slot=sidebar-container]]:transition-none motion-reduce:[&_[data-slot=sidebar-gap]]:transition-none">
			<AdminShellContent {...props} />
		</SidebarProvider>
	);
}
