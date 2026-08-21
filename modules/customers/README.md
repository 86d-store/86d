<p align="center">
  <a href="https://86d.app">
    <img src="https://86d.app/icon" height="96" alt="86d" />
  </a>
</p>

<p align="center">
  The Modern Foundation for Commerce
</p>

<p align="center">
  <a href="https://x.com/86d_app"><strong>X</strong></a> ·
  <a href="https://www.linkedin.com/company/86d"><strong>LinkedIn</strong></a>
</p>
<br/>

> [!WARNING]
> This project is under active development and is not ready for production use. Please proceed with caution. Use at your own risk. 

📚 **Documentation:** [86d.app/docs/modules/customers](https://86d.app/docs/modules/customers)

# Customers Module

Customer profile and address management. Authenticated customers can view and edit their profile and saved addresses. Admins have full read/write access to all customer records.

## Installation

```sh
npm install @86d-app/customers
```

## Usage

```ts
import customers from "@86d-app/customers";

const module = customers({
  autoCreateOnSignup: true,
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `autoCreateOnSignup` | `boolean` | `true` | Automatically create a customer record when a user signs up |

## Store Endpoints

All store endpoints require an authenticated session.

> [!IMPORTANT]
> Profile and address endpoints resolve the trusted Better Auth session through
> the Store Customer binding. Verified email is required, the session supplies
> audit correlation, and raw authentication user IDs are never used as Customer
> IDs.

| Method | Path | Description |
|---|---|---|
| `GET` | `/customers/me` | Get the authenticated customer's profile |
| `PUT` | `/customers/me/update` | Update the authenticated customer's profile |
| `GET` | `/customers/me/addresses` | List all addresses for the authenticated customer |
| `POST` | `/customers/me/addresses/create` | Add a new address |
| `PUT` | `/customers/me/addresses/:id` | Update an existing address |
| `DELETE` | `/customers/me/addresses/:id/delete` | Delete an address |

## Store Customer identity binding

`customers.identity.resolve@1.0.0` and
`createStoreCustomerIdentityService()` provide the owner-local foundation for
resolving a verified authentication principal to a distinct Store Customer.
The raw auth subject is hashed and never becomes the Customer ID. Identity and
normalized-email claims are row-locked, creation is idempotent, and the durable
binding records its verified email, source, correlation ID, and initial audit
principal. Missing transaction or locking support fails closed.

This path accepts only server-derived authentication identity. An unverified
email is rejected. It deliberately cannot claim a guest Order or history: that
requires a future Orders-owned typed capability that verifies the scoped guest
proof and records an idempotent claim audit. Matching an email string alone is
never sufficient.

Customers-owned loyalty endpoints are not registered. The standalone Loyalty
module is the sole active loyalty authority; Customers loyalty source remains
compatibility code only. Obsolete Customers loyalty admin and Storefront
components are not exported; loyalty presentation must use the Loyalty Module.

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/customers` | List all customers (paginated, searchable) |
| `GET` | `/admin/customers/:id` | Get a customer by ID |
| `PUT` | `/admin/customers/:id/update` | Update a customer |
| `DELETE` | `/admin/customers/:id/delete` | Delete a customer |

## Controller API

```ts
interface CustomerController {
  /** Look up a customer by their ID */
  getById(id: string): Promise<Customer | null>;

  /** Look up a customer by their email address */
  getByEmail(email: string): Promise<Customer | null>;

  /** Create a new customer record */
  create(params: {
    id?: string;
    email: string;
    firstName: string;
    lastName: string;
    phone?: string;
    dateOfBirth?: Date;
    metadata?: Record<string, unknown>;
  }): Promise<Customer>;

  /** Update an existing customer's profile fields */
  update(
    id: string,
    params: {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      dateOfBirth?: Date | null;
      metadata?: Record<string, unknown>;
    },
  ): Promise<Customer | null>;

  /** Hard-delete a customer */
  delete(id: string): Promise<void>;

  /** List customers with optional search and pagination */
  list(params: {
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<{ customers: Customer[]; total: number }>;

  /** Get all saved addresses for a customer */
  listAddresses(customerId: string): Promise<CustomerAddress[]>;

  /** Get a single address by ID */
  getAddress(id: string): Promise<CustomerAddress | null>;

  /** Add an address to a customer's account */
  createAddress(params: {
    customerId: string;
    type?: "billing" | "shipping";
    firstName: string;
    lastName: string;
    company?: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;           // ISO 3166-1 alpha-2 (e.g. "US")
    phone?: string;
    isDefault?: boolean;
  }): Promise<CustomerAddress>;

  /** Update fields on an existing address */
  updateAddress(
    id: string,
    params: {
      type?: "billing" | "shipping";
      firstName?: string;
      lastName?: string;
      company?: string | null;
      line1?: string;
      line2?: string | null;
      city?: string;
      state?: string;
      postalCode?: string;
      country?: string;
      phone?: string | null;
      isDefault?: boolean;
    },
  ): Promise<CustomerAddress | null>;

  /** Remove an address */
  deleteAddress(id: string): Promise<void>;

  /**
   * Mark an address as default for its type.
   * Automatically clears the previous default of the same type.
   */
  setDefaultAddress(
    customerId: string,
    addressId: string,
  ): Promise<CustomerAddress | null>;
}
```

## Types

```ts
interface Customer {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  dateOfBirth?: Date;
  metadata?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

interface CustomerAddress {
  id: string;
  customerId: string;
  type: "billing" | "shipping";
  firstName: string;
  lastName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;             // ISO 3166-1 alpha-2
  phone?: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Store Components

### AccountProfile

Displays the authenticated customer's profile (name, email, phone) with inline editing support for updating personal information.

#### Props

None. The component manages its own state and fetches data via the module client.

#### Usage in MDX

```mdx
<AccountProfile />
```

Use this component on a customer account or profile settings page.

### AddressBook

Manages the authenticated customer's saved addresses with full CRUD support for creating, editing, and deleting billing and shipping addresses.

#### Props

None. The component manages its own state and fetches data via the module client.

#### Usage in MDX

```mdx
<AddressBook />
```

Use this component on a customer account page to let users manage their saved addresses.

## Notes

- Store profile and address endpoints resolve the active session through the Store Customer identity binding.
- Address ownership is verified before any update or delete operation — customers cannot modify each other's addresses.
- `setDefaultAddress` is idempotent: calling it on an already-default address is a no-op.
- Each customer can have one default billing address and one default shipping address independently.
