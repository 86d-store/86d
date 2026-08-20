<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/logo" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  Dynamic Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk.

# Auth

Authentication and authorization package for the 86d platform. Built on [better-auth](https://www.better-auth.com/) with Prisma adapter, email/password authentication, session cookie caching, and role-based admin access.

## Installation

```sh
npm install auth
```

### Peer Dependencies

- `next` (optional) — required for `auth/actions` server-side session retrieval

## Usage

### API Route Handler

Create a catch-all API route for authentication:

```ts
// app/api/auth/[...all]/route.ts
import { handler } from "auth";

export const { GET, POST } = handler;
```

### Get Session (Server Action)

```ts
import { getSession } from "auth/actions";

const session = await getSession();
if (session) {
  console.log(session.user.id);
}
```

### Check Store Admin Access

```ts
import { verifyStoreAdminAccess } from "auth/store-access";

const result = verifyStoreAdminAccess(user);
if (result.hasAccess) {
  // user has admin role
}
```

## API Reference

### `auth`

The better-auth instance configured with:

- **Database**: Prisma adapter with PostgreSQL provider
- **Secret**: The validated `BETTER_AUTH_SECRET`, passed explicitly
- **Email/Password**: Enabled
- **Session**: Cookie caching with 5-minute TTL
- **Plugins**: Admin (role-based access)

### `handler`

Next.js route handler — destructure `GET` and `POST` for your auth route.

### `getSession(): Promise<Session | null>`

Server-side function that reads the current session from Next.js request headers. Returns `null` if no active session.

### `verifyStoreAdminAccess(user): StoreAccessResult`

Checks whether a user has store admin access based on their role.

| Parameter | Type | Description |
|---|---|---|
| `user.id` | `string` | User ID |
| `user.role` | `string \| null \| undefined` | User role from better-auth admin plugin |

Returns `{ hasAccess: boolean, role?: string }`.

## Types

```ts
type Session = typeof auth.$Infer.Session;

interface StoreAccessResult {
  hasAccess: boolean;
  role?: string | undefined;
}
```

## Notes

- Only the `"admin"` role grants store admin access.
- Production startup rejects a missing or weak `BETTER_AUTH_SECRET`. Development and test use the environment package's explicit local-only fallback.
- Session cookie cache reduces database lookups for 5 minutes per session.
- The `db` workspace package provides the Prisma client used by the auth adapter.
