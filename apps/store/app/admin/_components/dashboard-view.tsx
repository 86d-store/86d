import type { DashboardViewModel } from "../_hooks/dashboard-data";
import DashboardTemplate from "./dashboard.mdx";

export interface DashboardViewProps {
	model: DashboardViewModel;
	isRefreshing: boolean;
	onRefresh?: () => void;
}

export function DashboardView(props: DashboardViewProps) {
	return <DashboardTemplate {...props} />;
}
