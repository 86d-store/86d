import { headers } from "next/headers";
import { auth, type Session } from "./index";

export async function getSession(): Promise<Session | null> {
	if (!auth) return null;
	const reqHeaders = await headers();
	const session = await auth.api.getSession({
		headers: reqHeaders,
	});
	return session;
}
