"use client";

import { ModuleClientProvider } from "@86d-app/core/client/provider";
import { StoreContextProvider } from "@86d-app/core/client/store-context";
import { modules } from "generated/api";
import { store } from "~/lib/store";

export type { RootStore } from "~/lib/store";

export function StoreQueryProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ModuleClientProvider
			baseURL="/api"
			modules={modules}
			credentials="same-origin"
		>
			<StoreContextProvider store={store}>{children}</StoreContextProvider>
		</ModuleClientProvider>
	);
}
