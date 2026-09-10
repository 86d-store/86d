# Store UI rewrite: implementation and verification

Date: 2026-09-08. Review mode: **full**. Status: local implementation complete; all six required repository gates and the eight selected official UI browser tests passed.

The central storefront, account, and store admin surfaces now separate state and data preparation from MDX presentation. Shared compositions replace repeated page framing, navigation, actions, and recovery markup. Existing commerce modules, endpoints, authorization, and durable persistence retain their ownership. This work makes no capability maturity or production-readiness claim.

## Scope and review boundary

The implementation uses the existing Next.js App Router, React, TypeScript, MDX, Tailwind v4, semantic theme tokens, and shadcn/Base UI primitives. It follows the repository's two-file template convention and 86d.app's narrow ownership, shared compositions, and explicit loading/error state patterns. Storefront icons use the existing Lucide family; admin navigation retains its existing `Icon` adapter.

Inspected and changed surfaces:

- Brisa homepage, navbar, footer, about page, catalog/collection/search/journal headings, detail wrappers, and tracking wrapper.
- Account shell/navigation, account overview, recent-order loading/error/empty/populated presentation, and pagination.
- Store admin shell, navigation preparation, dashboard metrics, operations, recent orders, and low-stock sections.
- Shared Store actions/links, storefront/admin error and not-found recovery pages, and theme-preload release.
- Source tests, isolated browser fixtures, and the affected shared UI package import boundaries.

The review does **not** cover every installed module's internal UI, checkout/payment behavior, authenticated order continuity, every storefront data state, legal/contact content, or production commerce. Existing module components remain responsible for their requests, loading/error states, and mutations. Brisa `contact.mdx`, `terms.mdx`, and `privacy.mdx` are unchanged. Their existing implicit MDX paragraph nesting remains outside this slice.

Concurrent shared CSS/font migration belongs to another task. In particular, deletion of `merchant-tokens.css` and `_brand-fonts.ts`, the shared font/token changes, and `.changeset/polite-glasses-learn.md` are not attributed to this rewrite. Visual fixture results describe the combined local checkout, not isolated proof of those other changes.

## Architecture and ownership

| Owner | Logic and contracts | Presentation |
| --- | --- | --- |
| Store navbar | `apps/store/components/store-navbar.tsx`: open state, path matching, theme callbacks, desktop breakpoint cleanup | `templates/brisa/navbar.mdx`; shared Sheet owns focus, Escape, and scroll containment |
| Brisa pages | Existing module components retain commerce behavior; layout supplies configuration; `_components/footer.tsx` derives the year | `_components/container.mdx`, `page-heading.mdx`, `quick-link.mdx`, `theme-control.mdx`, and route templates |
| Account navigation | Account `_components/account-navigation.ts` owns destinations and matching; `account-shell.tsx` owns routing | Account `_components/account-shell.mdx`: desktop links and labeled mobile select |
| Account overview | Account `_hooks/use-account-overview.ts` owns the existing `/orders/me` query and five-item pagination; `account-overview-data.ts` validates unknown responses and prepares display values | Account `_components/account-overview.mdx` and `account-overview-skeleton.mdx`; route `loading.tsx` reuses the presentation |
| Admin navigation | `apps/store/lib/admin-navigation.ts` prepares recursive groups and active paths; `components/admin/_hooks/use-admin-navigation.ts` owns search and the existing collapsed-preference key | `components/admin/shell.mdx`, composed with Sidebar, Collapsible, Breadcrumb, and shared actions |
| Dashboard | Admin `_hooks/use-dashboard.ts` owns existing read requests and refresh; `dashboard-data.ts` validates each response and keeps loading/error/ready distinct | Admin `_components/dashboard.mdx` and `dashboard-parts.mdx`, with a typed `dashboard-view.tsx` boundary |
| Shared actions/recovery | `components/store-action.tsx` extends existing primitives; `page-state.tsx` defines the recovery props contract | `StoreAction`, semantic-anchor `StoreLink`, and `page-state.mdx` compose existing button/Empty primitives |
| Theme readiness | `components/theme-preload-release.tsx` waits for `resolvedTheme` before removing the preload attribute | Existing theme provider and semantic tokens |

No new commerce database, authorization policy, API endpoint, or persistence contract was introduced. The existing localStorage key for collapsed admin navigation remains in use. The account shell still receives the server-authenticated user, and admin authorization remains in its route layout.

The shared UI package required package-relative import repairs in `empty.tsx` and the `shadcn/{breadcrumb,collapsible,empty,item,separator,sidebar,tooltip}.tsx` files. These remove consumer-app alias dependencies; they do not replace primitive rendering, styles, or behavior. Package dependency wiring and its changeset document the shared navigation dependency.

## Coverage

Counts below refer to consolidated findings and overlap where a change affects more than one category.

| Category | Evidence inspected | Result |
| --- | --- | --- |
| Typography | Brisa heading/container/quick-link templates; account order rows; dashboard metrics; compiled MDX and semantic render output | 3 groups addressed: hierarchy, numeric/long-value layout, and paragraph nesting |
| Surfaces | Navbar Sheet, recursive admin sidebar, account select, shared actions, recovery composition, discovery-panel nesting | 7 groups addressed: navigation containment, duplicate chrome, control size, recovery, data states, repeated framing, and concentric corners |
| Animations | Removed trust marquee and scroll-driven navbar styling; action transition properties and `static`; Sheet transitions at 10% speed; preload-release behavior | 3 groups addressed; enter/exit frames inspected, Escape focus restored, reduced-motion Sheet has no running transitions |
| Icons | Navbar/theme/account controls, dashboard actions, retained admin icon adapter | 1 group addressed: repeated handwritten icons replaced by existing icon components and accessible controls |
| Performance | Removed navbar scroll subscription and repeated wrappers; MDX compositions; query/view separation; explicit transition properties | 2 groups addressed. **Not reviewed:** bundle-size or performance benchmark; no speed claim |

## Findings and changes

The findings describe the previous implementation and the completed correction. No confirmed actionable finding remains within the inspected source scope.

### Navigation, surfaces, and feedback

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `templates/brisa/navbar.mdx:36`; `apps/store/components/store-navbar.tsx:23` | An opacity-hidden custom mobile overlay left its links in the document and recreated overlay lifecycle behavior. | Controlled shared Sheet, explicit close action, active links, navigation close, and desktop-resize cleanup. | Hidden navigation must not remain keyboard-reachable; reuse the primitive's focus and dismissal behavior. |
| MEDIUM | `apps/store/lib/admin-navigation.ts:51`; `apps/store/components/admin/shell.mdx:12`; `apps/store/components/admin/_hooks/use-admin-navigation.ts:20` | A large TSX shell repeated group/subgroup rendering, interaction state, and route matching. | Pure navigation preparation, recursive MDX sections, shared Sidebar/Collapsible, searchable navigation, and preserved collapsed preferences. | Consistent structure and active-path feedback make deep navigation easier to follow without duplicating logic. |
| MEDIUM | `apps/store/app/(insecure)/account/_components/account-shell.mdx:29`; account `_components/account-navigation.ts`; account `page.tsx:1` | A separate mobile quick-link grid repeated part of the account navigation, while shell and rendering logic were interleaved. | One destination model feeds desktop navigation and a labeled mobile select; the redundant overview grid is removed. | Repeated navigation should offer the same destinations and state across screen sizes. |
| MEDIUM | `apps/store/components/store-action.tsx:7`; `templates/brisa/_components/theme-control.mdx:5`; `templates/brisa/navbar.mdx:27` | Ad hoc action markup used inconsistent sizing, press scales, transition scope, and duplicated theme icons. | Shared button/anchor compositions provide 44px mobile and 40px denser controls, exact transition properties, optional 0.96 press scale, and `static` for frequent controls. | Minimum hit area, motion restraint, and consistent icon/interaction treatment improve repeated use while preserving link semantics. |
| MEDIUM | `apps/store/components/page-state.mdx:4`; `apps/store/app/{error,not-found}.tsx`; `apps/store/app/admin/{error,not-found}.tsx` | Four recovery routes maintained separate button and error layouts. | One Empty-based MDX recovery composition receives page-specific copy, destinations, and reset callbacks. | Recovery actions should be consistent, accessible, and explicit about the next step. |
| LOW | `templates/brisa/index.mdx:26`; `templates/brisa/about.mdx:15`; `templates/brisa/_components/quick-link.mdx:6` | Discovery rows used `rounded-lg` inside `rounded-xl` with `p-2`, producing nonconcentric corners. | Outer shells use `rounded-2xl`: current 18px outer radius equals 10px inner radius plus 8px padding. | Concentric border radius prevents the inset surface from looking pinched. |

### Data truth, typography, and composition

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| HIGH | `apps/store/app/admin/_hooks/dashboard-data.ts:90`; admin `_hooks/use-dashboard.ts`; admin `_components/dashboard-parts.mdx` | Unsafe query casts and fallback values could present a failed response as zero revenue, an empty list, or no low-stock alerts. | Validated loading/error/ready states, separate partial failures, prepared currency/count/date values, explicit retry or access recovery. | A financial or operational display must not turn missing data into a reassuring zero. |
| HIGH | `apps/store/app/(insecure)/account/_hooks/account-overview-data.ts:110`; account `_hooks/use-account-overview.ts`; account `_components/account-overview.mdx:25` | Unknown order data was asserted into a success shape, and formatting could throw on invalid currency/date values. | Defensive response parsing before formatting; sign-in, verified-email, restricted-access, and unavailable states receive explicit recovery; empty later pages retain previous-page recovery. | An unavailable history is not evidence of no purchases; failure states must remain distinct and recoverable. |
| MEDIUM | `templates/brisa/index.mdx:8`; `templates/brisa/footer.mdx:6`; `templates/brisa/about.mdx:8` | The homepage combined an animated trust-claim strip, duplicate signup, many independently padded optional wrappers, and generic unverified product/policy claims. | Editorial discovery hierarchy, one footer signup, one container for eight preserved commerce sections, and copy without invented shipping/return/quality promises. | Motion restraint and truthful hierarchy reduce distraction; hidden modules no longer leave large padded gaps. |
| MEDIUM | `templates/brisa/_components/{container,page-heading}.mdx`; Brisa `products/`, `collections/`, `blog/`, `search/`, `track/`; account `_components/account-overview.mdx:56`; admin `_components/dashboard-parts.mdx` | Page widths/headings and repeated text layouts drifted; long order values competed with badges and dates. | Shared page framing, balanced headings, wrapped supporting text, truncation where needed, responsive rows, and tabular money/counts. | Stable typography and deliberate long-value behavior improve scanning across widths. |
| HIGH | `templates/brisa/index.mdx:12`; `templates/brisa/navbar.mdx:62`; `templates/brisa/layout.mdx:3` | An intermediate version of this rewrite generated implicit MDX paragraphs, including a paragraph inside `Text variant="p"`; the browser reported hydration failure. | Explicit JSX strings where necessary, with compiler inspection and semantic render checks across edited MDX. | Valid HTML nesting is required for reliable hydration and predictable typography. |

### Motion and lifecycle

| Severity | Location | Before | After | Why |
| --- | --- | --- | --- | --- |
| MEDIUM | `apps/store/components/theme-preload-release.tsx:6`; `templates/brisa/navbar.mdx:11`; `apps/store/components/store-navbar.tsx:23` | Preload cleanup ran once without waiting for theme resolution; navbar scroll listeners changed decorative blur/background treatment. | Preload cleanup follows resolved theme; navbar uses a stable sticky surface and no scroll subscription. | Theme state must not be held under stale critical styling; avoid unnecessary high-frequency visual changes. |

## Considered but rejected

| Location | Candidate | Rejected because |
| --- | --- | --- |
| Brisa homepage | Introduce stock photography or generated product imagery | No merchant-owned product assets were supplied. A typography-led discovery layout improves hierarchy without inventing merchandise. |
| Brisa navbar and account controls | Add staged entrances, spring icon swaps, or repeated hover movement | Navigation and theme controls are frequent interactions. Static state cues and short color changes preserve attention. |
| Module product, collection, and checkout internals | Replace existing commerce components to enforce the new style everywhere | Their contracts and states belong to the owning modules; this central UI slice preserves them rather than claiming every module was rewritten. |
| Shared shadcn package | Regenerate or restyle primitive implementations | Existing primitives provide the required behavior. Consumer-relative import repairs and app compositions solve this slice without a second primitive implementation. |

## Verification

Commands are run from the repository root unless a different directory is named. All six required gates passed in the repository's prescribed order.

| Check | Observed result and limit |
| --- | --- |
| `bun run generate:modules -- --frozen` | **Passed**, exit 0 in the final ordered run. No module source change is part of this UI slice. |
| `bun run typecheck` | **Passed: 115 successful tasks**, exit 0 in the final ordered run. Regenerated Next route types after stopping the temporary development server. |
| `bun run check` | **Passed: 4,657 files checked**, exit 0, no fixes or diagnostics in the final ordered run. |
| `bun run test` | **Passed**, exit 0: 117 workspace tasks plus 68 repository-level tests across 8 files. Updated the fixture-directory expectation for `store-ui`. An earlier run collided with a concurrent Git config lock; rerun after the lock cleared passed. |
| `bun run docker:build` | **Passed**, exit 0 without warnings or errors. All 115 build tasks succeeded, including optimized Next compilation and TypeScript. Repeated with `STORE_IMAGE=86d-store:ui-rewrite-20260908-2156` after another concurrent build replaced the shared local tag; the dedicated image uses the same compiled layers. |
| `bun run docker:verify` | **Passed**, exit 0 without warnings or errors; repeated successfully with the dedicated `STORE_IMAGE` above. Disposable stack boot, public app/database/storage health, runtime layout and non-root identity checks, restart, and second health check passed. The scripts removed their containers and volumes. |
| `bunx vitest run 'app/(insecure)/account/__tests__/account-overview-data.test.ts'`, from `apps/store` | **Passed: 7 tests.** Validated success formatting and escaped IDs, loading/error/empty separation, invalid date/currency/total rejection, later-page recovery, and known 401/403 authorization recovery. |
| Focused Biome on the edited account TS files, navbar controller, and footer controller; `git diff --check` | **Passed** during implementation. |
| MDX compilation and generated-code inspection | **Passed:** 19 edited Brisa/account MDX files produce no implicit `_components.p` elements. All 20 Brisa templates compile, including unchanged templates. Compilation alone does not prove valid rendered HTML. |
| `bun /tmp/86d-store-mdx-render-check.mjs` | **Passed: 26 render cases** across edited templates and account loading/error/empty/populated states, including current 401/403/503 recovery. Semantic component stubs preserve Text/View/link tag structure; commerce components are omitted. No paragraph nested directly inside a paragraph, heading, or span was found. This is not full primitive or commerce rendering proof. |
| Historical isolated Playwright UI run, superseded by the focused browser smoke | **Passed: 8/8 tests in 17.7s** against the dedicated production image and a disposable seeded database, with the real global sign-in setup intact. Covered 36 dashboard viewport/theme/state combinations, mobile menu focus/theme behavior, and account/recovery controls. Earlier development-server setup failed; the isolated stack required `BETTER_AUTH_URL` to match its assigned local URL. Only temporary Compose configuration changed. One CLI color-environment warning occurred; no test failures. This selected suite does not prove all commerce workflows. |
| `node /tmp/86d-ui-dashboard-matrix.cjs`; durable state assertions live beside the dashboard model and presentation | **Passed: 36/36 combinations** at 375×667, 768×1024, 1280×720; light/dark; loaded, empty, loading, partial error, permission error, unavailable. Eight cards in every state; six available values remain during partial error; failed/loading metrics do not show fake zeros. Partial-error refresh recovers eight values. No horizontal overflow or browser errors; low-stock header action stays aligned. [Results](./evidence/store-ui/dashboard-matrix.json). |
| `node /tmp/86d-ui-storefront-matrix.cjs` | **Passed: 6/6 actual homepage viewport/theme pairs** at the same sizes. Verified the main heading, three discovery links, resolved theme/preload release, no horizontal overflow, and no page/hydration errors. Commerce sections remained loading because local module initialization failed. [Results](./evidence/store-ui/86d-ui-storefront-matrix.json). |
| Isolated shell interactions; durable cases in `tests/browser/storefront.spec.ts` | Observed passing checks include closed mobile navigation absence, initial close-button focus, Escape focus restoration, theme switching/preload release, desktop resize dismissal, labeled account select, and recovery callback. These fixtures do not exercise authenticated commerce. |
| Mobile Sheet motion inspection | Chromium animation playback set to **0.1** at 375×667. Enter/exit intermediate and settled frames inspected; Escape restores trigger focus. Reduced-motion content/overlay report zero transition duration and no running animations; no page errors. [Results](./evidence/store-ui/86d-ui-navbar-motion.json). **Not verified:** every hover/focus/active state on every real data route. |

The durable test sources are the account overview and navigation tests, admin navigation/dashboard state tests, and the semantic fixture cases in `tests/browser/storefront.spec.ts`. Matrix results and representative screenshots are saved in [evidence/store-ui](./evidence/store-ui/). Temporary runners and detailed logs remain under `/tmp`. These are local verification artifacts, not production evidence. The synthetic fixture is gated by `BROWSER_MERCHANT_UI_FIXTURES=true` and must not be mistaken for live merchant data.

Representative captures: [desktop storefront](./evidence/store-ui/86d-ui-storefront-1280-light-viewport.png), [mobile storefront](./evidence/store-ui/86d-ui-storefront-375-dark-viewport.png), [desktop dashboard](./evidence/store-ui/86d-ui-dashboard-1280-dark-loaded.png), [mobile dashboard](./evidence/store-ui/86d-ui-dashboard-375-light-loaded.png), and [partial-failure recovery](./evidence/store-ui/86d-ui-dashboard-375-light-error-details.png).

Verified local image: `86d-store:ui-rewrite-20260908-2156`, image ID `sha256:6f4652dcfa0231950aba48dc370439f07d2feb5edbebba8fa763251da4769c7b`. This image was built from the working tree and was not published.

The final official UI run used a temporary isolated runner and log under `/tmp`. The temporary override enabled fixtures and set the exact local authentication URL. The owned stack and volumes were removed afterward (`cleanup_status=0`), and the temporary development server was stopped. The usual Playwright global setup wrote its ignored local session artifact.

## Verdict

**Approve for the inspected source changes and completed checks.** No confirmed actionable interface-polish finding remains in that boundary.

**Unverified beside this verdict:** the full commerce Playwright suite, every interaction state on every real data route, and live commerce workflows. The six required repository gates and eight selected official UI tests passed. Neither local source review nor fixture success advances capability maturity, proves checkout/order continuity, or authorizes remote publication. The rewrite is consolidated into the canonical `main` checkout with the newer shared font and semantic-style changes. No remote publication was performed.

## Main consolidation (2026-09-09)

The canonical checkout combines the existing UI/MDX rewrite with the shared font and semantic-style commit `a15b5b63`. The old application token stylesheet and contrast test remain removed; shared UI font dependencies and their asset test remain present. Original account, dashboard, navigation, recovery, Brisa, and fixture files were preserved byte-for-byte during integration. Package versions move to the existing branch's shared `0.1.0` line, with its historical contract-conformance fixtures and separate local/canonical registry generation. The independent fork lock-sync correction from `09b5335c` is also retained.

Expected failure diagnostics in the existing Runtime, Store edge, and four Module test suites are captured and asserted inside their individual tests, with restoration afterward. Production logging remains unchanged, and Module integrity is regenerated for those test-source changes.

The integration does not establish a new visual or commerce pass. Existing screenshots and browser observations above retain their stated scope. Required ordered repository verification is recorded with the final local integration result; no provider or package publication occurs here.
