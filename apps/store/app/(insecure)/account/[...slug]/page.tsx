import { notFound } from "next/navigation";
import { getStoreRoute } from "~/lib/store-registry";
import { StoreModuleRouteClient } from "../../[...slug]/store-module-route-client";

type Props = { params: Promise<{ slug: string[] }> };

export default async function AccountModulePage({ params }: Props) {
	const { slug } = await params;
	const path = `/account/${slug.join("/")}`;
	const match = getStoreRoute(path);

	if (!match) {
		notFound();
	}

	const { moduleId, component, params: routeParams } = match;

	return (
		<StoreModuleRouteClient
			moduleId={moduleId}
			component={component}
			params={routeParams}
		/>
	);
}
