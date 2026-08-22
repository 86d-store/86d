# Auctions Module

Time-limited product auctions with bidding, reserve prices, and buy-it-now.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity (_frozen_ lock), TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. **Route.** Read the parent guide, `../../../prd/contexts/store-runtime/module-system.md` when storage or cross-Module contracts change, and this file.
2. **Implement** within the Module source shape and patterns below.
3. **Verify.** From the repository root after any Module source change: `bun run generate:modules`, then prove `bun run generate:modules -- --frozen`. Run this Module's focused tests.
   - Done when the frozen check is _green_ and touched Module tests pass.

## Structure

```
src/
  index.ts              Factory (AuctionsOptions), admin nav, events, store pages
  schema.ts             3 models: auction, bid, auctionWatch
  service.ts            Types + AuctionController interface
  service-impl.ts       createAuctionController(data) implementation
  mdx.d.ts              MDX module declaration
  __tests__/
    service-impl.test.ts  87 tests covering CRUD, lifecycle, bidding, buy-now, watching, analytics
  admin/
    endpoints/            10 endpoints (auction CRUD, publish, cancel, close, bids, summary)
    components/           AuctionsList, AuctionDetail (TSX + MDX)
  store/
    endpoints/            9 endpoints (browse, detail, bid, buy-now, watch/unwatch, my-bids, my-watches)
    components/           AuctionListing, AuctionPage (TSX + MDX)
```

## Data models

- **auction**: id, title, description, productId, productName, imageUrl, type (english|dutch|sealed), status (draft|scheduled|active|ended|sold|cancelled), startingPrice, reservePrice, buyNowPrice, bidIncrement, currentBid, bidCount, highestBidderId, winnerId, finalPrice, priceDropAmount, priceDropIntervalMinutes, startsAt, endsAt, antiSnipingEnabled, antiSnipingMinutes
- **bid**: id, auctionId, customerId, customerName, amount, maxAutoBid, isWinning, isAutoBid, createdAt
- **auctionWatch**: id, auctionId, customerId, createdAt

## Auction types

- **English** (ascending): bids go up from starting price. Most common.
- **Dutch** (descending): price drops on interval until someone buys. Requires `priceDropAmount` and `priceDropIntervalMinutes`.
- **Sealed**: blind bidding. Each customer can bid once. Highest wins when auction ends.

## Auction lifecycle

```
draft → scheduled → active → ended/sold
                      ↘
                   cancelled
```

- `createAuction`: auto-sets status to `active` or `scheduled` based on `startsAt`
- `publishAuction`: transitions draft/scheduled to active (if startsAt passed) or scheduled
- `closeAuction`: transitions to `sold` (reserve met + bids) or `ended` (no bids / reserve not met)
- `cancelAuction`: transitions non-terminal auctions to cancelled
- `buyNow`: immediately transitions active auction to `sold`

## Options

| Option | Type | Default | Description |
| --- | --- | --- | --- |
| `defaultAntiSniping` | boolean | true | Whether anti-sniping is enabled by default |
| `defaultAntiSnipingMinutes` | number | 5 | Default anti-sniping extension in minutes |

## Patterns

- All monetary values in cents
- Anti-sniping: extends auction end time when bids arrive near close
- Sealed auctions: one bid per customer
- Highest bidder cannot bid again (prevents self-outbidding)
- Only draft/scheduled auctions can be edited or deleted
- Active/sold auctions cannot be deleted
- Reserve price: auction ends (not sold) if highest bid is below reserve
- Watch is idempotent (re-watching returns existing watch)

## Events

`auction.created`, `auction.published`, `auction.started`, `auction.ended`, `auction.sold`, `auction.cancelled`, `bid.placed`, `bid.outbid`, `auction.buy_now`, `auction.extended`
