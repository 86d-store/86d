import { describe, expect, it, vi } from "vitest";
import { cancelBooking } from "../admin/endpoints/cancel-booking";
import { createBlackout } from "../admin/endpoints/create-blackout";
import { createSchedule } from "../admin/endpoints/create-schedule";
import { deleteBlackout } from "../admin/endpoints/delete-blackout";
import { deleteSchedule } from "../admin/endpoints/delete-schedule";
import { getSchedule } from "../admin/endpoints/get-schedule";
import { listBlackoutsAdmin } from "../admin/endpoints/list-blackouts";
import { listBookings } from "../admin/endpoints/list-bookings";
import { listSchedules } from "../admin/endpoints/list-schedules";
import { summary } from "../admin/endpoints/summary";
import { updateSchedule } from "../admin/endpoints/update-schedule";
import type {
	BookingStatus,
	DeliveryBlackout,
	DeliveryBooking,
	DeliverySchedule,
	DeliverySlotsController,
	DeliverySlotsSummary,
} from "../service";

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeSchedule(
	overrides: Partial<DeliverySchedule> = {},
): DeliverySchedule {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Morning Delivery",
		dayOfWeek: 1,
		startTime: "09:00",
		endTime: "12:00",
		capacity: 10,
		surchargeInCents: 0,
		active: true,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeBooking(
	overrides: Partial<DeliveryBooking> = {},
): DeliveryBooking {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		scheduleId: "sched_1",
		deliveryDate: "2026-06-01",
		orderId: "order_1",
		scheduleName: "Morning Delivery",
		startTime: "09:00",
		endTime: "12:00",
		surchargeInCents: 0,
		status: "confirmed" as BookingStatus,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeBlackout(
	overrides: Partial<DeliveryBlackout> = {},
): DeliveryBlackout {
	return {
		id: crypto.randomUUID(),
		date: "2026-12-25",
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<DeliverySlotsController> = {},
): DeliverySlotsController {
	return {
		createSchedule: vi.fn().mockResolvedValue(makeSchedule()),
		updateSchedule: vi.fn().mockResolvedValue(null),
		getSchedule: vi.fn().mockResolvedValue(null),
		listSchedules: vi.fn().mockResolvedValue([]),
		deleteSchedule: vi.fn().mockResolvedValue(false),
		bookSlot: vi.fn().mockResolvedValue(makeBooking()),
		cancelBooking: vi.fn().mockResolvedValue(null),
		getBooking: vi.fn().mockResolvedValue(null),
		getOrderBooking: vi.fn().mockResolvedValue(null),
		listBookings: vi.fn().mockResolvedValue([]),
		getAvailableSlots: vi.fn().mockResolvedValue([]),
		getSlotBookingCount: vi.fn().mockResolvedValue(0),
		createBlackout: vi.fn().mockResolvedValue(makeBlackout()),
		deleteBlackout: vi.fn().mockResolvedValue(false),
		listBlackouts: vi.fn().mockResolvedValue([]),
		isBlackoutDate: vi.fn().mockResolvedValue(false),
		getSummary: vi.fn().mockResolvedValue({
			totalSchedules: 0,
			activeSchedules: 0,
			totalBookings: 0,
			confirmedBookings: 0,
			cancelledBookings: 0,
			totalSurchargeRevenue: 0,
			blackoutDates: 0,
		} satisfies DeliverySlotsSummary),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: DeliverySlotsController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { deliverySlots: opts.controller ?? makeController() },
		},
	});
}

const listSchedulesHandler = extractHandler(listSchedules);
const createScheduleHandler = extractHandler(createSchedule);
const getScheduleHandler = extractHandler(getSchedule);
const updateScheduleHandler = extractHandler(updateSchedule);
const deleteScheduleHandler = extractHandler(deleteSchedule);
const listBlackoutsHandler = extractHandler(listBlackoutsAdmin);
const createBlackoutHandler = extractHandler(createBlackout);
const deleteBlackoutHandler = extractHandler(deleteBlackout);
const listBookingsHandler = extractHandler(listBookings);
const cancelBookingHandler = extractHandler(cancelBooking);
const summaryHandler = extractHandler(summary);

// ── Schedules ─────────────────────────────────────────────────────────────────

describe("admin GET /delivery-slots", () => {
	it("returns empty list when no schedules", async () => {
		const result = (await call(listSchedulesHandler)) as {
			schedules: DeliverySchedule[];
		};
		expect(result.schedules).toHaveLength(0);
	});

	it("returns schedules from controller", async () => {
		const schedules = [
			makeSchedule({ name: "Morning" }),
			makeSchedule({ name: "Afternoon" }),
		];
		const ctrl = makeController({
			listSchedules: vi.fn().mockResolvedValue(schedules),
		});
		const result = (await call(listSchedulesHandler, {
			controller: ctrl,
		})) as { schedules: DeliverySchedule[] };
		expect(result.schedules).toHaveLength(2);
	});

	it("forwards dayOfWeek filter to controller", async () => {
		const ctrl = makeController();
		await call(listSchedulesHandler, {
			query: { dayOfWeek: "1" },
			controller: ctrl,
		});
		expect(ctrl.listSchedules).toHaveBeenCalledWith(
			expect.objectContaining({ dayOfWeek: 1 }),
		);
	});

	it("forwards active filter to controller", async () => {
		const ctrl = makeController();
		await call(listSchedulesHandler, {
			query: { active: "true" },
			controller: ctrl,
		});
		expect(ctrl.listSchedules).toHaveBeenCalledWith(
			expect.objectContaining({ active: true }),
		);
	});
});

describe("admin POST /delivery-slots/create", () => {
	it("creates a schedule and returns it", async () => {
		const schedule = makeSchedule({ name: "Evening Delivery" });
		const ctrl = makeController({
			createSchedule: vi.fn().mockResolvedValue(schedule),
		});
		const result = (await call(createScheduleHandler, {
			body: {
				name: "Evening Delivery",
				dayOfWeek: 3,
				startTime: "18:00",
				endTime: "21:00",
				capacity: 5,
			},
			controller: ctrl,
		})) as { schedule: DeliverySchedule };
		expect(result.schedule.name).toBe("Evening Delivery");
	});

	it("passes optional surcharge to controller", async () => {
		const ctrl = makeController();
		await call(createScheduleHandler, {
			body: {
				name: "Premium Slot",
				dayOfWeek: 0,
				startTime: "08:00",
				endTime: "10:00",
				capacity: 3,
				surchargeInCents: 500,
			},
			controller: ctrl,
		});
		expect(ctrl.createSchedule).toHaveBeenCalledWith(
			expect.objectContaining({ surchargeInCents: 500 }),
		);
	});
});

describe("admin GET /delivery-slots/:id", () => {
	it("returns error when schedule not found", async () => {
		const result = (await call(getScheduleHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Schedule not found");
	});

	it("returns schedule when found", async () => {
		const schedule = makeSchedule({ id: "sched_1" });
		const ctrl = makeController({
			getSchedule: vi.fn().mockResolvedValue(schedule),
		});
		const result = (await call(getScheduleHandler, {
			params: { id: "sched_1" },
			controller: ctrl,
		})) as { schedule: DeliverySchedule };
		expect(result.schedule.id).toBe("sched_1");
	});
});

describe("admin POST /delivery-slots/:id/update", () => {
	it("returns error when schedule not found", async () => {
		const result = (await call(updateScheduleHandler, {
			params: { id: "missing" },
			body: { capacity: 20 },
		})) as { error: string };
		expect(result.error).toBe("Schedule not found");
	});

	it("updates schedule and returns it", async () => {
		const schedule = makeSchedule({ capacity: 20 });
		const ctrl = makeController({
			updateSchedule: vi.fn().mockResolvedValue(schedule),
		});
		const result = (await call(updateScheduleHandler, {
			params: { id: schedule.id },
			body: { capacity: 20 },
			controller: ctrl,
		})) as { schedule: DeliverySchedule };
		expect(result.schedule.capacity).toBe(20);
	});

	it("passes active flag to controller", async () => {
		const schedule = makeSchedule({ active: false });
		const ctrl = makeController({
			updateSchedule: vi.fn().mockResolvedValue(schedule),
		});
		await call(updateScheduleHandler, {
			params: { id: schedule.id },
			body: { active: false },
			controller: ctrl,
		});
		expect(ctrl.updateSchedule).toHaveBeenCalledWith(
			schedule.id,
			expect.objectContaining({ active: false }),
		);
	});
});

describe("admin POST /delivery-slots/:id/delete", () => {
	it("returns deleted=false when not found", async () => {
		const result = (await call(deleteScheduleHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes schedule and returns deleted=true", async () => {
		const ctrl = makeController({
			deleteSchedule: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteScheduleHandler, {
			params: { id: "sched_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── Blackouts ─────────────────────────────────────────────────────────────────

describe("admin GET /delivery-slots/blackouts", () => {
	it("returns empty list when no blackouts", async () => {
		const result = (await call(listBlackoutsHandler)) as {
			blackouts: DeliveryBlackout[];
		};
		expect(result.blackouts).toHaveLength(0);
	});

	it("returns blackout dates from controller", async () => {
		const blackouts = [
			makeBlackout({ date: "2026-12-25" }),
			makeBlackout({ date: "2026-01-01" }),
		];
		const ctrl = makeController({
			listBlackouts: vi.fn().mockResolvedValue(blackouts),
		});
		const result = (await call(listBlackoutsHandler, {
			controller: ctrl,
		})) as { blackouts: DeliveryBlackout[] };
		expect(result.blackouts).toHaveLength(2);
	});
});

describe("admin POST /delivery-slots/blackouts/create", () => {
	it("creates a blackout and returns it", async () => {
		const blackout = makeBlackout({ date: "2026-12-25", reason: "Christmas" });
		const ctrl = makeController({
			createBlackout: vi.fn().mockResolvedValue(blackout),
		});
		const result = (await call(createBlackoutHandler, {
			body: { date: "2026-12-25", reason: "Christmas" },
			controller: ctrl,
		})) as { blackout: DeliveryBlackout };
		expect(result.blackout.date).toBe("2026-12-25");
		expect(result.blackout.reason).toBe("Christmas");
	});

	it("creates blackout without reason", async () => {
		const ctrl = makeController();
		await call(createBlackoutHandler, {
			body: { date: "2026-07-04" },
			controller: ctrl,
		});
		expect(ctrl.createBlackout).toHaveBeenCalledWith(
			expect.objectContaining({ date: "2026-07-04" }),
		);
	});
});

describe("admin POST /delivery-slots/blackouts/:id/delete", () => {
	it("returns deleted=false when not found", async () => {
		const result = (await call(deleteBlackoutHandler, {
			params: { id: "missing" },
		})) as { deleted: boolean };
		expect(result.deleted).toBe(false);
	});

	it("deletes blackout and returns deleted=true", async () => {
		const ctrl = makeController({
			deleteBlackout: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteBlackoutHandler, {
			params: { id: "blackout_1" },
			controller: ctrl,
		})) as { deleted: boolean };
		expect(result.deleted).toBe(true);
	});
});

// ── Bookings ──────────────────────────────────────────────────────────────────

describe("admin GET /delivery-slots/bookings", () => {
	it("returns empty list when no bookings", async () => {
		const result = (await call(listBookingsHandler)) as {
			bookings: DeliveryBooking[];
		};
		expect(result.bookings).toHaveLength(0);
	});

	it("returns bookings from controller", async () => {
		const bookings = [makeBooking(), makeBooking()];
		const ctrl = makeController({
			listBookings: vi.fn().mockResolvedValue(bookings),
		});
		const result = (await call(listBookingsHandler, {
			controller: ctrl,
		})) as { bookings: DeliveryBooking[] };
		expect(result.bookings).toHaveLength(2);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listBookingsHandler, {
			query: { status: "cancelled" },
			controller: ctrl,
		});
		expect(ctrl.listBookings).toHaveBeenCalledWith(
			expect.objectContaining({ status: "cancelled" as BookingStatus }),
		);
	});

	it("forwards orderId filter to controller", async () => {
		const ctrl = makeController();
		await call(listBookingsHandler, {
			query: { orderId: "order_1" },
			controller: ctrl,
		});
		expect(ctrl.listBookings).toHaveBeenCalledWith(
			expect.objectContaining({ orderId: "order_1" }),
		);
	});
});

describe("admin POST /delivery-slots/bookings/:id/cancel", () => {
	it("returns error when booking not found", async () => {
		const result = (await call(cancelBookingHandler, {
			params: { id: "missing" },
		})) as { error: string };
		expect(result.error).toBe("Booking not found");
	});

	it("cancels booking and returns it", async () => {
		const booking = makeBooking({ status: "cancelled" });
		const ctrl = makeController({
			cancelBooking: vi.fn().mockResolvedValue(booking),
		});
		const result = (await call(cancelBookingHandler, {
			params: { id: booking.id },
			controller: ctrl,
		})) as { booking: DeliveryBooking };
		expect(result.booking.status).toBe("cancelled");
	});

	it("calls cancelBooking with booking id", async () => {
		const booking = makeBooking({ id: "bk_1", status: "cancelled" });
		const ctrl = makeController({
			cancelBooking: vi.fn().mockResolvedValue(booking),
		});
		await call(cancelBookingHandler, {
			params: { id: "bk_1" },
			controller: ctrl,
		});
		expect(ctrl.cancelBooking).toHaveBeenCalledWith("bk_1");
	});
});

// ── Summary ───────────────────────────────────────────────────────────────────

describe("admin GET /delivery-slots/summary", () => {
	it("returns zero-state summary", async () => {
		const result = (await call(summaryHandler)) as {
			summary: DeliverySlotsSummary;
		};
		expect(result.summary.totalSchedules).toBe(0);
		expect(result.summary.totalBookings).toBe(0);
		expect(result.summary.blackoutDates).toBe(0);
	});

	it("returns real summary from controller", async () => {
		const ctrl = makeController({
			getSummary: vi.fn().mockResolvedValue({
				totalSchedules: 5,
				activeSchedules: 4,
				totalBookings: 120,
				confirmedBookings: 110,
				cancelledBookings: 10,
				totalSurchargeRevenue: 25000,
				blackoutDates: 3,
			}),
		});
		const result = (await call(summaryHandler, { controller: ctrl })) as {
			summary: DeliverySlotsSummary;
		};
		expect(result.summary.totalSchedules).toBe(5);
		expect(result.summary.confirmedBookings).toBe(110);
		expect(result.summary.totalSurchargeRevenue).toBe(25000);
	});
});
