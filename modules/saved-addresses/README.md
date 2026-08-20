

# @86d-app/saved-addresses

📚 **Documentation:** [86d.app/docs/modules/saved-addresses](https://86d.app/docs/modules/saved-addresses)

Customer address book module for 86d. Lets customers save, manage, and select default shipping and billing addresses.

## Installation

```bash
86d module add saved-addresses
```

## Configuration

```json
{
  "modules": ["saved-addresses"],
  "moduleOptions": {
    "saved-addresses": {
      "maxAddresses": "20"
    }
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxAddresses` | `string` | `"20"` | Maximum addresses a customer can save |

## Store endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/addresses` | List customer's addresses |
| POST | `/addresses/create` | Create a new address |
| GET | `/addresses/default` | Get default shipping address |
| GET | `/addresses/default-billing` | Get default billing address |
| GET | `/addresses/:id` | Get address by ID |
| POST | `/addresses/:id/update` | Update an address |
| POST | `/addresses/:id/delete` | Delete an address |
| POST | `/addresses/:id/set-default` | Set as default shipping |
| POST | `/addresses/:id/set-default-billing` | Set as default billing |

## Admin endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/admin/saved-addresses` | List all addresses (filterable) |
| GET | `/admin/saved-addresses/summary` | Address stats by country |
| POST | `/admin/saved-addresses/:id/delete` | Delete any address |

## Controller API

```typescript
interface SavedAddressesController {
  create(customerId: string, input: AddressInput): Promise<Address>;
  update(customerId: string, addressId: string, input: Partial<AddressInput>): Promise<Address | null>;
  delete(customerId: string, addressId: string): Promise<boolean>;
  getById(customerId: string, addressId: string): Promise<Address | null>;
  listByCustomer(customerId: string, params?): Promise<Address[]>;
  getDefault(customerId: string): Promise<Address | null>;
  getDefaultBilling(customerId: string): Promise<Address | null>;
  setDefault(customerId: string, addressId: string): Promise<boolean>;
  setDefaultBilling(customerId: string, addressId: string): Promise<boolean>;
  countByCustomer(customerId: string): Promise<number>;
  listAll(params?): Promise<{ items: Address[]; total: number }>;
  getSummary(): Promise<AddressSummary>;
}
```

## Types

```typescript
interface Address {
  id: string;
  customerId: string;
  label?: string;
  firstName: string;
  lastName: string;
  company?: string;
  line1: string;
  line2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;       // ISO 3166-1 alpha-2
  phone?: string;
  isDefault: boolean;
  isDefaultBilling: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

## Components

### Store

- **AddressBook** — Customer-facing address management. Card grid with add/edit form, default shipping/billing selection, delete with confirmation. Requires `customerId` prop.

### Admin

- **AddressOverview** — Admin address list with summary stats (total addresses, country breakdown), filterable table with pagination, and delete actions.

## Notes

- First address is automatically set as both default shipping and billing
- Setting a new default clears the previous one (per customer)
- All mutations verify ownership — mismatched customer IDs return 404
- Country uses ISO 3166-1 alpha-2 codes (2 characters max)
