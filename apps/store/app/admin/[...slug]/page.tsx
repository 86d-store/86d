import { notFound } from "next/navigation";
import { getAdminRoute } from "~/lib/admin-registry";
import { AdminModuleRouteClient } from "./admin-module-route-client";

type Props = { params: Promise<{ slug: string[] }> };

export default async function AdminCatchAllPage({ params }: Props) {
	const { slug } = await params;
	const path = `/admin/${slug.join("/")}`;
	const match = getAdminRoute(path);
	if (!match) {
		notFound();
	}
	return (
		<AdminModuleRouteClient
			moduleId={match.moduleId}
			component={match.component}
			params={match.params}
		/>
	);
}
