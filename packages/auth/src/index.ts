import { randomUUID } from "node:crypto";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { toNextJsHandler } from "better-auth/next-js";
import { admin, genericOAuth } from "better-auth/plugins";
import { db } from "db";
import {
	account,
	invitation,
	passkey,
	session,
	user,
	verification,
} from "db/schema/tables";
import env from "env";

const apiUrl = env["86D_API_URL"];

export interface ManagedAdminOAuthEnvironment {
	apiUrl: string;
	clientId?: string | undefined;
	clientSecret?: string | undefined;
	/** Intentionally ignored: machine credentials can never authenticate people. */
	legacyApiKey?: string | undefined;
	/** Intentionally ignored: workload credentials can never authenticate people. */
	workloadCredential?: string | undefined;
}

export function resolveManagedAdminOAuthConfig(
	environment: ManagedAdminOAuthEnvironment,
): {
	discoveryUrl: string;
	clientId: string;
	clientSecret: string;
} | null {
	if (!environment.clientId || !environment.clientSecret) return null;
	return {
		discoveryUrl: `${environment.apiUrl.replace(/\/$/, "")}/.well-known/openid-configuration`,
		clientId: environment.clientId,
		clientSecret: environment.clientSecret,
	};
}

const managedAdminOAuth = resolveManagedAdminOAuthConfig({
	apiUrl,
	clientId: env["86D_ADMIN_OAUTH_CLIENT_ID"],
	clientSecret: env["86D_ADMIN_OAUTH_CLIENT_SECRET"],
});

/**
 * Map an IdP profile to a local user record.
 * Grants "admin" role only when the IdP explicitly provided store:admin scope
 * or set the profile role to "admin".
 */
export function mapSsoProfileToUser(
	profile: Record<string, unknown>,
): Record<string, string> {
	const grantedScopes =
		typeof profile.scope === "string"
			? profile.scope.split(" ")
			: Array.isArray(profile.scope)
				? (profile.scope as string[])
				: [];
	const hasAdminRole =
		profile.role === "admin" || grantedScopes.includes("store:admin");

	const user: Record<string, string> = {
		name: profile.name as string,
		email: profile.email as string,
		role: hasAdminRole ? "admin" : "user",
	};
	if (profile.picture) {
		user.image = profile.picture as string;
	}
	return user;
}

/**
 * Human Store Admin SSO is deliberately configured with a dedicated OAuth
 * client. Neither the managed workload credential nor the legacy Store API
 * key is valid human identity material.
 */
const socialProviders = managedAdminOAuth
	? [
			genericOAuth({
				config: [
					{
						providerId: "86d",
						discoveryUrl: managedAdminOAuth.discoveryUrl,
						clientId: managedAdminOAuth.clientId,
						clientSecret: managedAdminOAuth.clientSecret,
						scopes: ["openid", "profile", "email", "store:admin"],
						mapProfileToUser: mapSsoProfileToUser,
					},
				],
			}),
		]
	: [];

function createAuth(secret: string) {
	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",
			schema: {
				user,
				session,
				account,
				verification,
				passkey,
				invitation,
			},
		}),
		secret,
		emailAndPassword: { enabled: true },
		session: {
			cookieCache: { enabled: true, maxAge: 60 * 5 },
		},
		rateLimit: {
			window: 60,
			max: 100,
			customRules: {
				"/sign-in/email": {
					window: 60,
					max: 40,
				},
			},
		},
		advanced: {
			database: {
				generateId: () => randomUUID(),
			},
		},
		plugins: [admin(), ...socialProviders],
	});
}

type AuthInstance = ReturnType<typeof createAuth>;

/** True when `BETTER_AUTH_SECRET` is set and safe for the current NODE_ENV. */
export const isAuthEnabled = env.BETTER_AUTH_SECRET !== undefined;

export const auth: AuthInstance | null = env.BETTER_AUTH_SECRET
	? createAuth(env.BETTER_AUTH_SECRET)
	: null;

export type Session = AuthInstance["$Infer"]["Session"];

function authDisabledResponse(): Response {
	return Response.json(
		{
			error: "AUTH_DISABLED",
			message:
				"Authentication is disabled until BETTER_AUTH_SECRET is configured.",
		},
		{ status: 503 },
	);
}

const nextHandler = auth ? toNextJsHandler(auth) : null;

export const handler = {
	GET: (request: Request) =>
		nextHandler ? nextHandler.GET(request) : authDisabledResponse(),
	POST: (request: Request) =>
		nextHandler ? nextHandler.POST(request) : authDisabledResponse(),
};
