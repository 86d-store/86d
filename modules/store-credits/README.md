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

# Store Credits Module

📚 **Documentation:** [86d.app/docs/modules/store-credits](https://86d.app/docs/modules/store-credits)

Customer credit accounts that integrate with returns, referrals, and gift cards. Credits can be applied as payment during checkout.

## Installation

```sh
npm install @86d-app/store-credits
```

## Usage

```ts
import storeCredits from "@86d-app/store-credits";

const module = storeCredits({
  currency: "USD",
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `currency` | `string` | `"USD"` | Default currency for new credit accounts |

## Store Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/store-credits/balance` | Get the current customer's credit balance |
| `GET` | `/store-credits/transactions` | List credit transactions for the current customer |
| `POST` | `/store-credits/apply` | Apply store credit toward a purchase |

## Admin Endpoints

| Method | Path | Description |
|---|---|---|
| `GET` | `/admin/store-credits/accounts` | List all credit accounts (paginated, filterable by status) |
| `GET` | `/admin/store-credits/accounts/:customerId` | Get a customer's credit account |
| `POST` | `/admin/store-credits/accounts/:customerId/adjust` | Manually credit or debit a customer's account |
| `POST` | `/admin/store-credits/accounts/:customerId/freeze` | Freeze a credit account |
| `POST` | `/admin/store-credits/accounts/:customerId/unfreeze` | Unfreeze a credit account |
| `GET` | `/admin/store-credits/summary` | Get aggregate credit summary (total accounts, outstanding balance) |
| `GET` | `/admin/store-credits/transactions` | List all transactions across accounts |

## Controller API

The `StoreCreditController` interface is exported for inter-module use (e.g. checkout debiting credits).

```ts
interface StoreCreditController {
  getOrCreateAccount(customerId: string): Promise<CreditAccount>;
  getAccount(customerId: string): Promise<CreditAccount | null>;
  getAccountById(id: string): Promise<CreditAccount | null>;
  freezeAccount(customerId: string): Promise<CreditAccount>;
  unfreezeAccount(customerId: string): Promise<CreditAccount>;

  credit(params: CreditParams): Promise<CreditTransaction>;
  debit(params: DebitParams): Promise<CreditTransaction>;

  getBalance(customerId: string): Promise<number>;
  listTransactions(accountId: string, params?: {
    type?: CreditTransactionType;
    reason?: CreditReason;
    take?: number;
    skip?: number;
  }): Promise<CreditTransaction[]>;

  listAccounts(params?: {
    status?: AccountStatus;
    take?: number;
    skip?: number;
  }): Promise<CreditAccount[]>;
  getSummary(): Promise<CreditSummary>;
}
```

## Types

```ts
type AccountStatus = "active" | "frozen" | "closed";

type CreditTransactionType = "credit" | "debit";

type CreditReason =
  | "return_refund"
  | "order_payment"
  | "admin_adjustment"
  | "referral_reward"
  | "gift_card_conversion"
  | "promotional"
  | "other";

interface CreditAccount {
  id: string;
  customerId: string;
  balance: number;
  lifetimeCredited: number;
  lifetimeDebited: number;
  currency: string;
  status: AccountStatus;
  createdAt: Date;
  updatedAt: Date;
}

interface CreditTransaction {
  id: string;
  accountId: string;
  type: CreditTransactionType;
  amount: number;
  balanceAfter: number;
  reason: CreditReason;
  description: string;
  referenceType?: string;
  referenceId?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

interface CreditSummary {
  totalAccounts: number;
  totalOutstandingBalance: number;
  totalLifetimeCredited: number;
  totalLifetimeDebited: number;
}
```

## Store Components

### StoreCreditApply

Allows customers to apply their store credit balance toward an order during checkout. Displays the current balance, calculates the maximum applicable amount based on the order total, and fires a callback after credits are applied.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `customerId` | `string` | Yes | The ID of the customer whose store credits to apply. |
| `orderTotal` | `number` | No | The order total in cents. When provided, limits the applied amount to the lesser of the balance and order total. |
| `onApplied` | `(amountApplied: number, remainingBalance: number) => void` | No | Callback fired after credits are successfully applied, receiving the amount applied and the remaining balance. |

#### Usage in MDX

```mdx
<StoreCreditApply customerId={customerId} orderTotal={totalInCents} />
```

Best used on the checkout page to let customers redeem store credits against their order.

### StoreCreditBalance

Displays the customer's current store credit balance, account status, and currency. Fetches balance data automatically from the module client.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `customerId` | `string` | Yes | The ID of the customer whose balance to display. |

#### Usage in MDX

```mdx
<StoreCreditBalance customerId={customerId} />
```

Best used on a customer account dashboard or wallet page to show available store credit.

### StoreCreditTransactions

Displays a paginated list of store credit transactions (credits and debits) for a customer, including amounts, reasons, and dates.

#### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `customerId` | `string` | Yes | The ID of the customer whose transactions to display. |
| `limit` | `number` | No | Maximum number of transactions to fetch. When omitted, returns all transactions. |

#### Usage in MDX

```mdx
<StoreCreditTransactions customerId={customerId} limit={10} />
```

Best used on a store credit detail page or account section to show the customer's credit history.

## Notes

- Listens for `return.refunded` and `referral.completed` events to auto-credit accounts.
- Frozen accounts can still receive credits but cannot be debited.
- Debit operations fail if the account has insufficient balance.
- Each transaction records a `reason`, optional `referenceType`/`referenceId`, and `balanceAfter` snapshot.
