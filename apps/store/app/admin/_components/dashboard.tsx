"use client";

import { useDashboard } from "../_hooks/use-dashboard";
import { DashboardView } from "./dashboard-view";

export function Dashboard() {
	const dashboard = useDashboard();
	return <DashboardView {...dashboard} />;
}
