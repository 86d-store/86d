"use client";

import { makeAutoObservable, runInAction } from "mobx";
import { createContext, type ReactNode, useContext, useEffect } from "react";

export interface TargetReference {
	type: "account" | "business" | "store";
	id: string;
}

export interface EffectiveAuthorityProjection {
	target: TargetReference;
	permissions: Record<string, string[]>;
	owner: boolean;
	roles: string[];
}

export type AuthorityTarget = Pick<TargetReference, "id"> & {
	type: "account" | "business" | "store";
};

export interface EffectiveAuthorityState {
	isLoading: boolean;
	isOwner: boolean;
	hasPermission(category: string, action: string): boolean;
}

export function createUserStore() {
	return makeAutoObservable({
		permissions: {} as Record<string, string[]>,
		isOwner: false,
		roles: [] as string[],
		target: null as TargetReference | null,
		isLoading: true,

		setAuthority(authority: EffectiveAuthorityProjection | null) {
			this.permissions = authority?.permissions ?? {};
			this.isOwner = authority?.owner ?? false;
			this.roles = authority?.roles ?? [];
			this.target = authority?.target ?? null;
			this.isLoading = false;
		},

		setPermissions(permissions: Record<string, string[]>) {
			this.permissions = permissions;
			this.isLoading = false;
		},

		setLoading(loading: boolean) {
			this.isLoading = loading;
		},

		hasPermission(category: string, action: string) {
			return this.permissions[category]?.includes(action) ?? false;
		},

		reset() {
			this.permissions = {};
			this.isOwner = false;
			this.roles = [];
			this.target = null;
			this.isLoading = true;
		},
	});
}

export type UserStore = ReturnType<typeof createUserStore>;

export const UserContext = createContext<UserStore | null>(null);

export function useUser() {
	const context = useContext(UserContext);
	if (!context) {
		throw new Error("useUser must be used within a UserProvider");
	}
	return context;
}

/** Reads the active projection or an exact canonical Business/Store target. */
export function useAuthorityForTarget(
	target?: AuthorityTarget,
): EffectiveAuthorityState {
	const user = useUser();
	if (!target) return user;
	const matches =
		user.target?.type === target.type && user.target.id === target.id;
	if (matches) return user;
	return {
		isLoading: user.isLoading,
		isOwner: false,
		hasPermission: () => false,
	};
}

const store = createUserStore();

export function UserProvider({
	children,
	authority,
	isLoading,
}: {
	children: ReactNode;
	authority?: EffectiveAuthorityProjection | null;
	isLoading?: boolean;
}) {
	useEffect(() => {
		runInAction(() => {
			if (isLoading === true) {
				store.setLoading(true);
				return;
			}
			if (authority !== undefined) {
				store.setAuthority(authority);
				return;
			}
			if (isLoading === false) {
				store.setLoading(false);
			}
		});
	}, [authority, isLoading]);

	return <UserContext value={store}>{children}</UserContext>;
}
