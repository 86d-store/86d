

# @86d-app/auctions

📚 **Documentation:** [86d.app/docs/modules/auctions](https://86d.app/docs/modules/auctions)

Time-limited product auctions for 86d commerce platform. Supports English (ascending), Dutch (descending), and sealed (blind) auction types with reserve prices, buy-it-now, anti-sniping protection, and auction watching.

## Installation

```ts
import auctions from "@86d-app/auctions";

export default defineStore({
  modules: [
    auctions({
      defaultAntiSniping: true,
      defaultAntiSnipingMinutes: 5,
    }),
  ],
});
```

## Configuration

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `defaultAntiSniping` | `boolean` | `true` | Whether anti-sniping protection is enabled by default for new auctions |
| `defaultAntiSnipingMinutes` | `number` | `5` | Default minutes to extend auction end time on last-minute bids |

## Auction Types

| Type | Description |
|------|-------------|
| `english` | Ascending bids. Standard auction format — bids go up from starting price |
| `dutch` | Descending price. Price drops on interval until someone buys. Requires `priceDropAmount` and `priceDropIntervalMinutes` |
| `sealed` | Blind bidding. Each customer places one bid. Highest wins when auction ends |

## Entities

### Auction

The auction listing with type, pricing, schedule, and status.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique auction ID |
| `title` | `string` | Auction title |
| `description` | `string?` | Auction description |
| `productId` | `string` | Product being auctioned |
| `productName` | `string` | Product display name |
| `imageUrl` | `string?` | Product image URL |
| `type` | `english \| dutch \| sealed` | Auction type |
| `status` | `draft \| scheduled \| active \| ended \| sold \| cancelled` | Current status |
| `startingPrice` | `number` | Starting bid amount (cents) |
| `reservePrice` | `number` | Minimum price to sell (0 = no reserve) |
| `buyNowPrice` | `number` | Buy-it-now price (0 = disabled) |
| `bidIncrement` | `number` | Minimum bid increment (cents) |
| `currentBid` | `number` | Current highest bid (cents) |
| `bidCount` | `number` | Total bids placed |
| `highestBidderId` | `string?` | Current highest bidder |
| `winnerId` | `string?` | Winner (set after auction ends) |
| `finalPrice` | `number?` | Final sale price (cents) |
| `startsAt` | `Date` | When auction starts |
| `endsAt` | `Date` | When auction ends |
| `antiSnipingEnabled` | `boolean` | Whether anti-sniping extends end time |
| `antiSnipingMinutes` | `number` | Minutes to extend on last-minute bids |

### Bid

An individual bid placed by a customer.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique bid ID |
| `auctionId` | `string` | Associated auction |
| `customerId` | `string` | Bidder's customer ID |
| `customerName` | `string?` | Bidder's display name |
| `amount` | `number` | Bid amount (cents) |
| `maxAutoBid` | `number?` | Maximum auto-bid amount |
| `isWinning` | `boolean` | Whether this is the current winning bid |
| `isAutoBid` | `boolean` | Whether placed automatically |

### Auction Watch

Tracks customers watching an auction for updates.

| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | Unique watch ID |
| `auctionId` | `string` | Auction being watched |
| `customerId` | `string` | Watching customer |

## Store Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/auctions` | List auctions (filter by status, type) |
| `GET` | `/auctions/:id` | Get auction details |
| `GET` | `/auctions/:id/bids` | List bids for an auction |
| `POST` | `/auctions/bids/place` | Place a bid (requires auth) |
| `POST` | `/auctions/buy-now` | Buy at buy-it-now price (requires auth) |
| `POST` | `/auctions/watch` | Watch an auction (requires auth) |
| `POST` | `/auctions/unwatch` | Stop watching an auction (requires auth) |
| `GET` | `/auctions/my-bids` | List customer's own bids (requires auth) |
| `GET` | `/auctions/my-watches` | List customer's watched auctions (requires auth) |

## Admin Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/admin/auctions` | List all auctions (all statuses) |
| `POST` | `/admin/auctions/create` | Create a new auction |
| `GET` | `/admin/auctions/summary` | Get auction analytics summary |
| `GET` | `/admin/auctions/:id` | Get auction detail with recent bids and watcher count |
| `PUT` | `/admin/auctions/:id/update` | Update auction (draft/scheduled only) |
| `DELETE` | `/admin/auctions/:id/delete` | Delete auction (not active/sold) |
| `POST` | `/admin/auctions/:id/publish` | Publish auction (draft/scheduled) |
| `POST` | `/admin/auctions/:id/cancel` | Cancel auction |
| `POST` | `/admin/auctions/:id/close` | Close auction (determine winner) |
| `GET` | `/admin/auctions/:id/bids` | List bids for an auction |

## Controller API

```ts
interface AuctionController {
  // Auction CRUD
  createAuction(params: CreateAuctionParams): Promise<Auction>;
  updateAuction(id: string, params: UpdateAuctionParams): Promise<Auction | null>;
  getAuction(id: string): Promise<Auction | null>;
  listAuctions(params?): Promise<Auction[]>;
  deleteAuction(id: string): Promise<boolean>;

  // Lifecycle
  publishAuction(id: string): Promise<Auction | null>;
  cancelAuction(id: string): Promise<Auction | null>;
  closeAuction(id: string): Promise<Auction | null>;

  // Bidding
  placeBid(params: PlaceBidParams): Promise<BidResult>;
  getBid(id: string): Promise<Bid | null>;
  listBids(auctionId: string, params?): Promise<Bid[]>;
  getHighestBid(auctionId: string): Promise<Bid | null>;
  getBidsByCustomer(customerId: string, params?): Promise<Bid[]>;

  // Buy-it-now
  buyNow(params: BuyNowParams): Promise<Auction>;

  // Watching
  watchAuction(auctionId: string, customerId: string): Promise<AuctionWatch>;
  unwatchAuction(auctionId: string, customerId: string): Promise<boolean>;
  getWatchers(auctionId: string): Promise<AuctionWatch[]>;
  isWatching(auctionId: string, customerId: string): Promise<boolean>;
  getWatchedAuctions(customerId: string): Promise<AuctionWatch[]>;

  // Analytics
  getAuctionSummary(): Promise<AuctionSummary>;
}
```

## Auction Lifecycle

```
draft → scheduled → active → ended/sold
                      ↘
                   cancelled
```

- Auctions are auto-set to `active` or `scheduled` based on `startsAt`
- Only draft/scheduled auctions can be edited
- `closeAuction` → `sold` if reserve met and bids exist, otherwise `ended`
- `buyNow` immediately transitions to `sold`

## Anti-Sniping Protection

When enabled, if a bid is placed within `antiSnipingMinutes` of the auction end, the end time is extended. This prevents last-second bidding from winning unfairly.

## Store Components

| Component | Description |
|-----------|-------------|
| `AuctionListing` | Browsable grid of active auctions |
| `AuctionPage` | Detailed auction view with bid history |

### Admin Components

| Component | Description |
|-----------|-------------|
| `AuctionsList` | Dashboard with summary stats and auction list |
| `AuctionDetail` | Detailed view with bids and watcher count |

## Notes

- All monetary values (prices, bids) are in cents
- Reserve price of 0 means no reserve (item sells to highest bidder)
- Buy-it-now price of 0 means buy-it-now is disabled
- Highest bidder cannot bid again (prevents self-outbidding)
- Sealed auctions allow only one bid per customer
- Watch is idempotent — re-watching returns existing watch record
