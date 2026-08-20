"use client";

import type { Config } from "@86d-app/sdk/types";
import { makeAutoObservable } from "mobx";
import { createContext, useContext } from "react";
import packageJson from "../package.json";

export function createAppState(config: Config) {
	return makeAutoObservable({
		package: packageJson,
		config,
	});
}

export type AppState = ReturnType<typeof createAppState>;

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({
	children,
	config,
}: {
	children: React.ReactNode;
	config: Config;
}) {
	const appState = createAppState(config);
	return (
		<AppStateContext.Provider value={appState}>
			{children}
		</AppStateContext.Provider>
	);
}

export function useAppState() {
	const context = useContext(AppStateContext);
	if (!context) {
		throw new Error("useAppState must be used within an AppStateProvider");
	}
	return context;
}
