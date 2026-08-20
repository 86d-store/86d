/**
 * Store admin access is determined by the user's role from the better-auth
 * admin plugin. Users with the "admin" role have access to the store admin.
 */
interface StoreAccessResult {
	hasAccess: boolean;
	role?: string | undefined;
}

export function verifyStoreAdminAccess(user: {
	id: string;
	role?: string | null | undefined;
}): StoreAccessResult {
	const isAdmin = user.role === "admin";
	return {
		hasAccess: isAdmin,
		...(user.role != null && { role: user.role }),
	};
}
