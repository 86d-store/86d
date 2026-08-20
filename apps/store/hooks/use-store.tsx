"use client";

import { useStoreContext } from "@86d-app/core/client/store-context";
import type { RootStore } from "~/lib/store";

/**
 * Hook to access the MobX root store from store-level components.
 * Module components should use useStoreContext() from @86d-app/core/client directly.
 */
export function useStore(): RootStore {
	return useStoreContext<RootStore>();
}
