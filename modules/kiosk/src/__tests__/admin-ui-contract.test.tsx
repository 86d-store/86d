import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { formatKioskDate } from "../admin/components/kiosk-table-presentation";
import { KioskUnavailableState } from "../admin/components/kiosk-unavailable-state";
import { SessionDataTable } from "../admin/components/session-data-table";
import {
	createStationFormDefaults,
	stationFormSchema,
} from "../admin/components/station-form-schema";
import {
	CREATE_STATION_AMBIGUOUS_ERROR,
	UPDATE_STATION_ERROR,
} from "../admin/components/station-sheet";
import {
	createDefaultKioskSessionTableState,
	createDefaultKioskStationTableState,
	KIOSK_SESSION_TABLE_STORAGE_KEY,
	KIOSK_STATION_TABLE_STORAGE_KEY,
	parseKioskSessionTableState,
	parseKioskStationTableState,
} from "../admin/components/use-persisted-kiosk-table-state";

describe("kiosk table persistence", () => {
	it("uses table-specific keys and safe versioned defaults", () => {
		expect(KIOSK_STATION_TABLE_STORAGE_KEY).toBe(
			"merchant-table-state-store-admin.kiosk-stations",
		);
		expect(KIOSK_SESSION_TABLE_STORAGE_KEY).toBe(
			"merchant-table-state-store-admin.kiosk-sessions",
		);
		expect(parseKioskStationTableState(null)).toEqual(
			createDefaultKioskStationTableState(),
		);
		expect(parseKioskSessionTableState("not-json")).toEqual(
			createDefaultKioskSessionTableState(),
		);
	});

	it("restores only supported visibility, one sort, filters, and pagination", () => {
		expect(
			parseKioskStationTableState(
				JSON.stringify({
					v: 1,
					columnVisibility: {
						location: false,
						actions: false,
						name: "no",
					},
					sorting: [
						{ id: "isActive", desc: true },
						{ id: "name", desc: false },
					],
					globalFilter: "front",
					pageIndex: 3,
					activityFilter: "false",
				}),
			),
		).toEqual({
			v: 1,
			columnVisibility: { location: false },
			sorting: [{ id: "isActive", desc: true }],
			globalFilter: "front",
			pageIndex: 3,
			activityFilter: "false",
		});

		expect(
			parseKioskSessionTableState(
				JSON.stringify({
					v: 1,
					columnVisibility: { stationId: false, unsafe: false },
					sorting: [{ id: "startedAt", desc: false }],
					globalFilter: "legacy active",
					pageIndex: 2,
					stationFilter: "station-two",
					statusFilter: "completed",
				}),
			),
		).toEqual({
			v: 1,
			columnVisibility: { stationId: false },
			sorting: [{ id: "startedAt", desc: false }],
			globalFilter: "legacy active",
			pageIndex: 2,
			stationFilter: "station-two",
			statusFilter: "completed",
		});
	});

	it("drops persisted station-ID sorting because the table shows station names", () => {
		expect(
			parseKioskSessionTableState(
				JSON.stringify({
					v: 1,
					sorting: [{ id: "stationId", desc: false }],
				}),
			).sorting,
		).toEqual([{ id: "startedAt", desc: true }]);
	});
});

describe("kiosk unavailable states", () => {
	it.each(["stations", "sessions"] as const)(
		"renders truthful %s copy and a named retry action",
		(kind) => {
			const html = renderToStaticMarkup(
				<KioskUnavailableState kind={kind} onRetry={vi.fn()} />,
			);
			expect(html).toContain(`data-testid="kiosk-${kind}-unavailable"`);
			expect(html).toContain(`aria-label="Retry loading kiosk ${kind}"`);
			expect(html).toContain("Your records have not changed");
			expect(html).not.toContain("No stations yet");
			expect(html).not.toContain("No legacy session records found");
		},
	);
});

describe("kiosk table presentation", () => {
	it("formats searchable dates in deterministic US English UTC", () => {
		expect(formatKioskDate("2026-01-01T01:00:00.000Z")).toContain(
			"Jan 1, 2026",
		);
	});
});

describe("station form contract", () => {
	it("shares trimming and bounded validation defaults", () => {
		expect(
			stationFormSchema.safeParse({
				name: "  Front counter  ",
				location: "  Lobby  ",
				isActive: true,
			}),
		).toMatchObject({
			success: true,
			data: { name: "Front counter", location: "Lobby", isActive: true },
		});
		expect(
			stationFormSchema.safeParse({
				name: "   ",
				location: "",
				isActive: true,
			}).success,
		).toBe(false);
		expect(createStationFormDefaults()).toEqual({
			name: "",
			location: "",
			isActive: true,
		});
	});

	it("uses stable safe update and ambiguous-create recovery copy", () => {
		expect(UPDATE_STATION_ERROR).toBe(
			"Station changes could not be saved. Try again.",
		);
		expect(CREATE_STATION_AMBIGUOUS_ERROR).toContain(
			"Station may have been registered",
		);
		expect(CREATE_STATION_AMBIGUOUS_ERROR).toContain(
			"check station registrations",
		);
	});
});

describe("legacy session table station filter", () => {
	it("uses complete named options while keeping opaque IDs internal", () => {
		const state = createDefaultKioskSessionTableState();
		const html = renderToStaticMarkup(
			<SessionDataTable
				sessions={[]}
				stationOptions={[
					{
						id: "station-private-id",
						name: "Front counter",
						location: "Lobby",
					},
				]}
				total={0}
				isLoading={false}
				stateController={{
					state,
					onColumnVisibilityChange: vi.fn(),
					onSortingChange: vi.fn(),
					onGlobalFilterChange: vi.fn(),
					setPageIndex: vi.fn(),
					onStationFilterChange: vi.fn(),
					onStatusFilterChange: vi.fn(),
				}}
			/>,
		);
		expect(html).toContain(
			'aria-label="Filter legacy session records by station"',
		);
		expect(html).toContain("Front counter — Lobby");
		expect(html).toContain('value="station-private-id"');
		expect(html).not.toContain("Station A-Z");
		expect(html).not.toContain("Station Z-A");
	});
});
