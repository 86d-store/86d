# Browser smoke tests

Playwright coverage for browser-only Store Runtime seams against a live, seeded Store.

**Parent:** repository root [`AGENTS.md`](../../AGENTS.md) owns change protocol, Module integrity, TypeScript, security, product language, testing, and commit gates. This guide owns local mechanics only.

## Change protocol

1. Read the parent guide, this file, [`README.md`](./README.md), and [`../playwright.config.ts`](../playwright.config.ts).
2. Keep the suite focused on browser boundaries. Unit, integration, and rendered-state tests remain the CI base.
3. Run the focused harness tests and Playwright `--list`, then the full ordered parent gates. Run the browser suite against an already running, migrated, seeded Store when browser execution is in scope.

## Structure

```text
tests/browser/
  fixtures/                 Page objects and exact-request recorders
  __tests__/                Fast harness and recorder contracts
  auth.spec.ts              Redirect and session seams
  commerce.spec.ts          Cart, checkout, and request contracts
  admin.spec.ts             Browser query and mobile admin seams
  storefront.spec.ts        Storefront focus, mobile-menu, and recovery seams
```

## Test rules

- Import `test` from `./fixtures/test-fixtures` and use role, label, or `data-testid` locators.
- Wait with web-first assertions. Do not use arbitrary delays or `networkidle`.
- Keep one Chromium project, zero retries, and no route catalogs, wall-clock thresholds, screenshot assertions, or pixel baselines.
- Add viewport overrides only within mobile-specific tests.
- Reuse the stored authenticated session; setup fails closed if it cannot create that session.
- Keep the fixture route enabled for deterministic visual inspection, even when a fixture state does not belong in the smoke suite.

## Visual inspection

Agents inspect affected UI in Chrome at 1280×720 and 375×667, in light and dark schemes. Exercise required loading, empty, error, and populated states; verify focus, overflow, and recovery behavior. Screenshots are review artifacts only, never committed baselines or launch evidence.
