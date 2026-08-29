import type {
	ColumnVisibilityState,
	SortingState,
} from "@tanstack/react-table";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import type {
	GiftCardAdminRecord,
	GiftCardAdminStats,
	GiftCardAdminTransaction,
} from "../admin/components/gift-card-admin-types";
import {
	GiftCardDataTable,
	getGiftCardEmptyStateCopy,
} from "../admin/components/gift-card-data-table";
import {
	formatGiftCardCurrency,
	formatGiftCardDate,
} from "../admin/components/gift-card-format";
import {
	GiftCardDetailContent,
	GiftCardListError,
	GiftCardStatsPanel,
	ReadOnlyNotice,
} from "../admin/components/gift-card-overview-presentation";
import { getGiftCardServerSort } from "../admin/components/gift-card-table-model";
import {
	createDefaultGiftCardTableState,
	GIFT_CARD_TABLE_STORAGE_KEY,
	type GiftCardTableState,
	type GiftCardTableStateController,
	normalizeGiftCardSorting,
	parseGiftCardTableState,
} from "../admin/components/use-persisted-gift-card-table-state";
import { formatCurrency as formatStorefrontCurrency } from "../store/components/_utils";

function makeCard(
	overrides: Partial<GiftCardAdminRecord> = {},
): GiftCardAdminRecord {
	return {
		id: "card-alpha",
		code: "GIFT-ALPH-2345-6789",
		initialBalance: 100,
		currentBalance: 75,
		currency: "USD",
		status: "active",
		recipientEmail: "alpha@example.com",
		createdAt: "2026-01-01T00:00:00.000Z",
		...overrides,
	};
}

function makeStats(
	overrides: Partial<GiftCardAdminStats> = {},
): GiftCardAdminStats {
	return {
		totalIssued: 12,
		totalActive: 6,
		totalDepleted: 2,
		totalDisabled: 1,
		totalExpired: 3,
		...overrides,
	};
}

function makeTransaction(
	overrides: Partial<GiftCardAdminTransaction> = {},
): GiftCardAdminTransaction {
	return {
		id: "transaction-one",
		type: "debit",
		amount: 25,
		balanceAfter: 75,
		createdAt: "2026-01-02T00:00:00.000Z",
		...overrides,
	};
}

function makeStateController(
	overrides: Partial<GiftCardTableState> = {},
): GiftCardTableStateController {
	return {
		state: { ...createDefaultGiftCardTableState(), ...overrides },
		onColumnVisibilityChange: vi.fn(),
		onSortingChange: vi.fn(),
		onGlobalFilterChange: vi.fn(),
		onStatusFilterChange: vi.fn(),
	};
}

function renderTable({
	cards = [],
	total = cards.length,
	isLoading = false,
	state = {},
}: {
	cards?: GiftCardAdminRecord[];
	total?: number;
	isLoading?: boolean;
	state?: Partial<GiftCardTableState>;
} = {}) {
	return renderToStaticMarkup(
		<GiftCardDataTable
			cards={cards}
			total={total}
			isLoading={isLoading}
			pageSize={20}
			skip={0}
			stateController={makeStateController(state)}
			onStatusFilterChange={vi.fn()}
			onView={vi.fn()}
			onPreviousPage={vi.fn()}
			onNextPage={vi.fn()}
		/>,
	);
}

describe("gift card admin list presentation", () => {
	it("renders a layout-matching desktop and mobile loading state", () => {
		const html = renderTable({ isLoading: true });

		expect(html).toContain('data-testid="gift-card-data-table"');
		expect(html).toContain(
			'class="hidden overflow-x-auto rounded-lg bg-card shadow-xs ring-1 ring-foreground/10 md:block" data-testid="gift-card-list-scroll-region"',
		);
		expect(html).toContain('data-testid="gift-card-list-loading-mobile"');
		expect(html).toContain('data-slot="table-row"');
		expect(html).toContain('data-slot="skeleton"');
		expect(html).not.toContain("Loading gift cards");
	});

	it("renders the list error independently from summary content", () => {
		const html = renderToStaticMarkup(<GiftCardListError />);

		expect(html).toContain('data-testid="gift-card-list-error"');
		expect(html).toContain("Gift cards are unavailable");
		expect(html).toContain("Your records have not changed");
	});

	it("renders accurate unfiltered, status-filtered, and search empty copy", () => {
		expect(getGiftCardEmptyStateCopy({ search: "", statusFilter: "" })).toEqual(
			{
				title: "No gift cards found",
				description: "No issued gift card records are available to review.",
			},
		);
		expect(
			getGiftCardEmptyStateCopy({ search: "", statusFilter: "expired" }),
		).toEqual({
			title: "No gift cards match this status",
			description: "Choose another status to review available records.",
		});

		const html = renderTable({
			state: { globalFilter: "missing code", statusFilter: "active" },
		});
		expect(html).toContain('data-testid="gift-card-list-empty-desktop"');
		expect(html).toContain('data-testid="gift-card-list-empty-mobile"');
		expect(html).toContain("No gift cards match your search");
	});

	it("keeps server-projected rows intact while restoring table controls", () => {
		const cards = [
			makeCard(),
			makeCard({
				id: "card-beta",
				code: "GIFT-BETA-2345-6789",
				recipientEmail: "beta@example.com",
				createdAt: "2026-02-01T00:00:00.000Z",
			}),
		];
		const searchedHtml = renderTable({
			cards,
			state: { globalFilter: "beta" },
		});
		expect(searchedHtml).toContain("GIFT-BETA-2345-6789");
		expect(searchedHtml).toContain("GIFT-ALPH-2345-6789");

		const sortedHtml = renderTable({
			cards,
			state: {
				sorting: [{ id: "code", desc: true }] satisfies SortingState,
			},
		});
		expect(sortedHtml.indexOf("GIFT-ALPH-2345-6789")).toBeLessThan(
			sortedHtml.indexOf("GIFT-BETA-2345-6789"),
		);

		const hiddenHtml = renderTable({
			cards,
			state: {
				columnVisibility: {
					recipient: false,
				} satisfies ColumnVisibilityState,
			},
		});
		const desktopTable = hiddenHtml.match(/<table[\s\S]+?<\/table>/)?.[0];
		expect(desktopTable).toBeDefined();
		expect(desktopTable).not.toContain(">Recipient<");
		expect(hiddenHtml).toContain('data-testid="gift-card-column-visibility"');
		expect(hiddenHtml).toContain('data-testid="gift-card-mobile-sort"');
		expect(hiddenHtml).toContain('aria-label="Sort gift cards"');
		expect(hiddenHtml).not.toContain("alpha@example.com");
		expect(hiddenHtml).not.toContain("beta@example.com");
		expect(hiddenHtml).toContain(
			'data-testid="gift-card-details-table-card-alpha"',
		);
	});

	it("renders arbitrary legacy currency and invalid optional dates safely", () => {
		expect(formatGiftCardCurrency(75, "legacy-token")).toBe(
			"75.00 LEGACY-TOKEN",
		);
		expect(formatStorefrontCurrency(75, "legacy-token")).toBe(
			"75.00 LEGACY-TOKEN",
		);
		expect(formatGiftCardDate("not-a-date")).toBe("Unknown date");

		const html = renderToStaticMarkup(
			<GiftCardDetailContent
				card={makeCard({
					currency: "legacy-token",
					expiresAt: "not-a-date",
				})}
				transactions={[]}
				isLoading={false}
				isError={false}
				onClose={vi.fn()}
			/>,
		);
		expect(html).toContain("75.00 LEGACY-TOKEN");
		expect(html).toContain("Unknown date");
	});
});

describe("gift card table persistence", () => {
	it("uses a stable table-specific storage key and safe defaults", () => {
		expect(GIFT_CARD_TABLE_STORAGE_KEY).toBe(
			"merchant-table-state-store-admin.gift-cards",
		);
		expect(parseGiftCardTableState(null)).toEqual(
			createDefaultGiftCardTableState(),
		);
		expect(parseGiftCardTableState("not-json")).toEqual(
			createDefaultGiftCardTableState(),
		);
	});

	it("restores supported state and rejects stale or unsafe values", () => {
		const restored = parseGiftCardTableState(
			JSON.stringify({
				v: 1,
				columnVisibility: { recipient: false, details: false, code: "no" },
				sorting: [
					{ id: "balance", desc: true },
					{ id: "unsafe", desc: false },
				],
				globalFilter: "recipient@example.com",
				statusFilter: "expired",
			}),
		);

		expect(restored).toEqual({
			v: 1,
			columnVisibility: { recipient: false },
			sorting: [{ id: "balance", desc: true }],
			globalFilter: "recipient@example.com",
			statusFilter: "expired",
		});
		expect(
			parseGiftCardTableState(
				JSON.stringify({
					v: 0,
					statusFilter: "active",
				}),
			),
		).toEqual(createDefaultGiftCardTableState());
	});

	it("keeps one supported sort and aligns empty state with the server default", () => {
		expect(
			normalizeGiftCardSorting([
				{ id: "balance", desc: false },
				{ id: "code", desc: true },
			]),
		).toEqual([{ id: "balance", desc: false }]);
		expect(normalizeGiftCardSorting([])).toEqual([
			{ id: "createdAt", desc: true },
		]);
		expect(getGiftCardServerSort([])).toEqual({
			sort: "createdAt",
			direction: "desc",
		});
		expect(getGiftCardServerSort([{ id: "balance", desc: false }])).toEqual({
			sort: "balance",
			direction: "asc",
		});
	});
});

describe("gift card summary presentation", () => {
	it("renders matching loading, error, and loaded summary states", () => {
		const loading = renderToStaticMarkup(
			<GiftCardStatsPanel stats={undefined} isLoading={true} isError={false} />,
		);
		expect(loading).toContain('data-testid="gift-card-stats-loading"');
		expect(loading.match(/data-slot="card"/g)).toHaveLength(4);

		const error = renderToStaticMarkup(
			<GiftCardStatsPanel stats={undefined} isLoading={false} isError={true} />,
		);
		expect(error).toContain('data-testid="gift-card-stats-error"');
		expect(error).toContain("The card list may still be available below");

		const loaded = renderToStaticMarkup(
			<GiftCardStatsPanel
				stats={makeStats()}
				isLoading={false}
				isError={false}
			/>,
		);
		expect(loaded).toContain('data-testid="gift-card-stats"');
		expect(loaded).toContain("Total cards");
		expect(loaded).toContain(">12<");
		expect(loaded).toContain("Disabled or expired");
		expect(loaded).toContain(">4<");
	});
});

describe("gift card detail presentation", () => {
	it("renders loading, error, and not-found states with stable selectors", () => {
		const loading = renderToStaticMarkup(
			<GiftCardDetailContent
				card={undefined}
				transactions={[]}
				isLoading={true}
				isError={false}
				onClose={vi.fn()}
			/>,
		);
		expect(loading).toContain('data-testid="gift-card-detail-loading"');
		expect(loading).toContain('data-slot="skeleton"');

		const error = renderToStaticMarkup(
			<GiftCardDetailContent
				card={undefined}
				transactions={[]}
				isLoading={true}
				isError={true}
				onClose={vi.fn()}
			/>,
		);
		expect(error).toContain('data-testid="gift-card-detail-error"');
		expect(error).not.toContain('data-testid="gift-card-detail-loading"');

		const empty = renderToStaticMarkup(
			<GiftCardDetailContent
				card={undefined}
				transactions={[]}
				isLoading={false}
				isError={false}
				onClose={vi.fn()}
			/>,
		);
		expect(empty).toContain('data-testid="gift-card-detail-empty"');
		expect(empty).toContain("Gift card not found");
	});

	it("renders read-only card details and both transaction-history states", () => {
		const emptyHistory = renderToStaticMarkup(
			<GiftCardDetailContent
				card={makeCard()}
				transactions={[]}
				isLoading={false}
				isError={false}
				onClose={vi.fn()}
			/>,
		);
		expect(emptyHistory).toContain('data-testid="gift-card-detail"');
		expect(emptyHistory).toContain('data-testid="gift-card-read-only-notice"');
		expect(emptyHistory).toContain(
			'data-testid="gift-card-transactions-empty"',
		);

		const history = renderToStaticMarkup(
			<GiftCardDetailContent
				card={makeCard()}
				transactions={[makeTransaction()]}
				isLoading={false}
				isError={false}
				onClose={vi.fn()}
			/>,
		);
		expect(history).toContain('data-testid="gift-card-transactions-list"');
		expect(history).toContain("Debit");
		expect(history).toContain("−$25.00");
	});

	it("exposes the same stable read-only notice outside detail rendering", () => {
		const html = renderToStaticMarkup(<ReadOnlyNotice />);
		expect(html).toContain('data-testid="gift-card-read-only-notice"');
		expect(html).toContain("Read-only view");
	});
});
