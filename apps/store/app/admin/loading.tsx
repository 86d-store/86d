import { DashboardView } from "./_components/dashboard-view";
import { createDashboardLoading } from "./_hooks/dashboard-data";

export default function AdminLoading() {
	return <DashboardView model={createDashboardLoading()} isRefreshing />;
}
