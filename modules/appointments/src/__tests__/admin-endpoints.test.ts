import { describe, expect, it, vi } from "vitest";
import { assignServiceToStaff } from "../admin/endpoints/assign-service";
import { createService } from "../admin/endpoints/create-service";
import { createStaff } from "../admin/endpoints/create-staff";
import { deleteService } from "../admin/endpoints/delete-service";
import { deleteStaff } from "../admin/endpoints/delete-staff";
import { getAppointmentAdmin } from "../admin/endpoints/get-appointment";
import { getServiceAdmin } from "../admin/endpoints/get-service";
import { getStats } from "../admin/endpoints/get-stats";
import { listAppointments } from "../admin/endpoints/list-appointments";
import { listServicesAdmin } from "../admin/endpoints/list-services";
import { listStaffAdmin } from "../admin/endpoints/list-staff";
import { setSchedule } from "../admin/endpoints/set-schedule";
import { updateAppointment } from "../admin/endpoints/update-appointment";
import { updateService } from "../admin/endpoints/update-service";
import { updateStaff } from "../admin/endpoints/update-staff";
import type {
	Appointment,
	AppointmentController,
	AppointmentStats,
	Schedule,
	Service,
	Staff,
	StaffService,
} from "../service";

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractHandler(
	ep: unknown,
): (ctx: Record<string, unknown>) => Promise<unknown> {
	const obj = ep as Record<string, unknown>;
	const fn = typeof obj.handler === "function" ? obj.handler : ep;
	return fn as (ctx: Record<string, unknown>) => Promise<unknown>;
}

function makeService(overrides: Partial<Service> = {}): Service {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Haircut",
		slug: "haircut",
		duration: 30,
		price: 3500,
		currency: "USD",
		status: "active",
		maxCapacity: 1,
		sortOrder: 0,
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeStaff(overrides: Partial<Staff> = {}): Staff {
	const now = new Date();
	return {
		id: crypto.randomUUID(),
		name: "Alice",
		email: "alice@example.com",
		status: "active",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeAppointment(overrides: Partial<Appointment> = {}): Appointment {
	const now = new Date();
	const end = new Date(now.getTime() + 30 * 60_000);
	return {
		id: crypto.randomUUID(),
		serviceId: "svc_1",
		staffId: "staff_1",
		customerName: "Bob",
		customerEmail: "bob@example.com",
		startsAt: now,
		endsAt: end,
		status: "pending",
		price: 3500,
		currency: "USD",
		createdAt: now,
		updatedAt: now,
		...overrides,
	};
}

function makeSchedule(overrides: Partial<Schedule> = {}): Schedule {
	return {
		id: crypto.randomUUID(),
		staffId: "staff_1",
		dayOfWeek: 1,
		startTime: "09:00",
		endTime: "17:00",
		createdAt: new Date(),
		...overrides,
	};
}

function makeController(
	overrides: Partial<AppointmentController> = {},
): AppointmentController {
	return {
		createService: vi.fn().mockResolvedValue(makeService()),
		getService: vi.fn().mockResolvedValue(null),
		getServiceBySlug: vi.fn().mockResolvedValue(null),
		updateService: vi.fn().mockResolvedValue(null),
		deleteService: vi.fn().mockResolvedValue(false),
		listServices: vi.fn().mockResolvedValue([]),
		countServices: vi.fn().mockResolvedValue(0),
		createStaff: vi.fn().mockResolvedValue(makeStaff()),
		getStaff: vi.fn().mockResolvedValue(null),
		updateStaff: vi.fn().mockResolvedValue(null),
		deleteStaff: vi.fn().mockResolvedValue(false),
		listStaff: vi.fn().mockResolvedValue([]),
		countStaff: vi.fn().mockResolvedValue(0),
		assignService: vi.fn().mockResolvedValue({
			id: "ss_1",
			staffId: "staff_1",
			serviceId: "svc_1",
			createdAt: new Date(),
		} satisfies StaffService),
		unassignService: vi.fn().mockResolvedValue(undefined),
		getStaffServices: vi.fn().mockResolvedValue([]),
		getServiceStaff: vi.fn().mockResolvedValue([]),
		setSchedule: vi.fn().mockResolvedValue(makeSchedule()),
		getSchedule: vi.fn().mockResolvedValue([]),
		removeSchedule: vi.fn().mockResolvedValue(undefined),
		getAvailableSlots: vi.fn().mockResolvedValue([]),
		createAppointment: vi.fn().mockResolvedValue(makeAppointment()),
		getAppointment: vi.fn().mockResolvedValue(null),
		updateAppointment: vi.fn().mockResolvedValue(null),
		cancelAppointment: vi.fn().mockResolvedValue(null),
		listAppointments: vi.fn().mockResolvedValue([]),
		countAppointments: vi.fn().mockResolvedValue(0),
		getUpcomingAppointments: vi.fn().mockResolvedValue([]),
		getStats: vi.fn().mockResolvedValue({
			totalAppointments: 0,
			pendingAppointments: 0,
			confirmedAppointments: 0,
			cancelledAppointments: 0,
			completedAppointments: 0,
			noShowAppointments: 0,
			totalServices: 0,
			totalStaff: 0,
			totalRevenue: 0,
		} satisfies AppointmentStats),
		...overrides,
	};
}

function call(
	handler: (ctx: Record<string, unknown>) => Promise<unknown>,
	opts: {
		query?: Record<string, string | undefined>;
		params?: Record<string, string>;
		body?: Record<string, unknown>;
		controller?: AppointmentController;
	} = {},
) {
	return handler({
		query: opts.query ?? {},
		params: opts.params ?? {},
		body: opts.body ?? {},
		context: {
			controllers: { appointments: opts.controller ?? makeController() },
		},
	});
}

// ── Extract handlers ──────────────────────────────────────────────────────────

const listServicesHandler = extractHandler(listServicesAdmin);
const createServiceHandler = extractHandler(createService);
const getServiceHandler = extractHandler(getServiceAdmin);
const updateServiceHandler = extractHandler(updateService);
const deleteServiceHandler = extractHandler(deleteService);
const listStaffHandler = extractHandler(listStaffAdmin);
const createStaffHandler = extractHandler(createStaff);
const updateStaffHandler = extractHandler(updateStaff);
const deleteStaffHandler = extractHandler(deleteStaff);
const assignServiceHandler = extractHandler(assignServiceToStaff);
const setScheduleHandler = extractHandler(setSchedule);
const listAppointmentsHandler = extractHandler(listAppointments);
const getAppointmentHandler = extractHandler(getAppointmentAdmin);
const updateAppointmentHandler = extractHandler(updateAppointment);
const statsHandler = extractHandler(getStats);

// ── Services ──────────────────────────────────────────────────────────────────

describe("admin GET /appointments/services", () => {
	it("returns empty list when no services", async () => {
		const result = (await call(listServicesHandler)) as {
			services: Service[];
		};
		expect(result.services).toHaveLength(0);
	});

	it("returns services from controller", async () => {
		const services = [
			makeService({ name: "Haircut" }),
			makeService({ name: "Coloring" }),
		];
		const ctrl = makeController({
			listServices: vi.fn().mockResolvedValue(services),
		});
		const result = (await call(listServicesHandler, {
			controller: ctrl,
		})) as { services: Service[] };
		expect(result.services).toHaveLength(2);
	});
});

describe("admin POST /appointments/services/create", () => {
	it("creates a service and returns it", async () => {
		const svc = makeService({ name: "Manicure", duration: 45 });
		const ctrl = makeController({
			createService: vi.fn().mockResolvedValue(svc),
		});
		const result = (await call(createServiceHandler, {
			body: { name: "Manicure", slug: "manicure", duration: 45, price: 2500 },
			controller: ctrl,
		})) as { service: Service };
		expect(result.service.name).toBe("Manicure");
	});
});

describe("admin GET /appointments/services/:id", () => {
	it("returns 404 when service not found", async () => {
		const result = (await call(getServiceHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns service when found", async () => {
		const svc = makeService({ id: "svc_1" });
		const ctrl = makeController({ getService: vi.fn().mockResolvedValue(svc) });
		const result = (await call(getServiceHandler, {
			params: { id: "svc_1" },
			controller: ctrl,
		})) as { service: Service };
		expect(result.service.id).toBe("svc_1");
	});
});

describe("admin POST /appointments/services/:id/update", () => {
	it("returns 404 when service not found", async () => {
		const result = (await call(updateServiceHandler, {
			params: { id: "missing" },
			body: { price: 4000 },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates service and returns it", async () => {
		const svc = makeService({ price: 4000 });
		const ctrl = makeController({
			updateService: vi.fn().mockResolvedValue(svc),
		});
		const result = (await call(updateServiceHandler, {
			params: { id: svc.id },
			body: { price: 4000 },
			controller: ctrl,
		})) as { service: Service };
		expect(result.service.price).toBe(4000);
	});
});

describe("admin DELETE /appointments/services/:id", () => {
	it("returns 404 when service not found", async () => {
		const result = (await call(deleteServiceHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes service and returns success", async () => {
		const ctrl = makeController({
			deleteService: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteServiceHandler, {
			params: { id: "svc_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

// ── Staff ─────────────────────────────────────────────────────────────────────

describe("admin GET /appointments/staff", () => {
	it("returns empty list when no staff", async () => {
		const result = (await call(listStaffHandler)) as { staff: Staff[] };
		expect(result.staff).toHaveLength(0);
	});

	it("returns staff from controller", async () => {
		const staff = [makeStaff(), makeStaff()];
		const ctrl = makeController({
			listStaff: vi.fn().mockResolvedValue(staff),
		});
		const result = (await call(listStaffHandler, { controller: ctrl })) as {
			staff: Staff[];
		};
		expect(result.staff).toHaveLength(2);
	});
});

describe("admin POST /appointments/staff/create", () => {
	it("creates a staff member and returns them", async () => {
		const staff = makeStaff({ name: "Carol" });
		const ctrl = makeController({
			createStaff: vi.fn().mockResolvedValue(staff),
		});
		const result = (await call(createStaffHandler, {
			body: { name: "Carol", email: "carol@example.com" },
			controller: ctrl,
		})) as { staff: Staff };
		expect(result.staff.name).toBe("Carol");
	});
});

describe("admin POST /appointments/staff/:id/update", () => {
	it("returns 404 when staff not found", async () => {
		const result = (await call(updateStaffHandler, {
			params: { id: "missing" },
			body: { status: "inactive" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("updates staff and returns them", async () => {
		const staff = makeStaff({ status: "inactive" });
		const ctrl = makeController({
			updateStaff: vi.fn().mockResolvedValue(staff),
		});
		const result = (await call(updateStaffHandler, {
			params: { id: staff.id },
			body: { status: "inactive" },
			controller: ctrl,
		})) as { staff: Staff };
		expect(result.staff.status).toBe("inactive");
	});
});

describe("admin DELETE /appointments/staff/:id", () => {
	it("returns 404 when staff not found", async () => {
		const result = (await call(deleteStaffHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("deletes staff and returns success", async () => {
		const ctrl = makeController({
			deleteStaff: vi.fn().mockResolvedValue(true),
		});
		const result = (await call(deleteStaffHandler, {
			params: { id: "staff_1" },
			controller: ctrl,
		})) as { success: boolean };
		expect(result.success).toBe(true);
	});
});

describe("admin POST /appointments/staff/:id/services/assign", () => {
	it("assigns service to staff and returns assignment", async () => {
		const ctrl = makeController();
		const result = (await call(assignServiceHandler, {
			params: { id: "staff_1" },
			body: { serviceId: "svc_1" },
			controller: ctrl,
		})) as { assignment: StaffService };
		expect(result.assignment).toBeDefined();
		expect(ctrl.assignService).toHaveBeenCalledWith("staff_1", "svc_1");
	});
});

// ── Schedule ──────────────────────────────────────────────────────────────────

describe("admin POST /appointments/staff/:id/schedule", () => {
	it("sets schedule and returns it", async () => {
		const schedule = makeSchedule({ dayOfWeek: 3 });
		const ctrl = makeController({
			setSchedule: vi.fn().mockResolvedValue(schedule),
		});
		const result = (await call(setScheduleHandler, {
			params: { id: "staff_1" },
			body: { dayOfWeek: 3, startTime: "08:00", endTime: "16:00" },
			controller: ctrl,
		})) as { schedule: Schedule };
		expect(result.schedule.dayOfWeek).toBe(3);
		expect(ctrl.setSchedule).toHaveBeenCalledWith(
			expect.objectContaining({ staffId: "staff_1", dayOfWeek: 3 }),
		);
	});
});

// ── Appointments ──────────────────────────────────────────────────────────────

describe("admin GET /appointments", () => {
	it("returns empty list when no appointments", async () => {
		const result = (await call(listAppointmentsHandler)) as {
			appointments: Appointment[];
		};
		expect(result.appointments).toHaveLength(0);
	});

	it("forwards status filter to controller", async () => {
		const ctrl = makeController();
		await call(listAppointmentsHandler, {
			query: { status: "confirmed" },
			controller: ctrl,
		});
		expect(ctrl.listAppointments).toHaveBeenCalledWith(
			expect.objectContaining({ status: "confirmed" }),
		);
	});

	it("forwards staffId and serviceId filters", async () => {
		const ctrl = makeController();
		await call(listAppointmentsHandler, {
			query: { staffId: "staff_1", serviceId: "svc_1" },
			controller: ctrl,
		});
		expect(ctrl.listAppointments).toHaveBeenCalledWith(
			expect.objectContaining({ staffId: "staff_1", serviceId: "svc_1" }),
		);
	});
});

describe("admin GET /appointments/:id", () => {
	it("returns 404 when appointment not found", async () => {
		const result = (await call(getAppointmentHandler, {
			params: { id: "missing" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("returns appointment when found", async () => {
		const appt = makeAppointment({ id: "appt_1" });
		const ctrl = makeController({
			getAppointment: vi.fn().mockResolvedValue(appt),
		});
		const result = (await call(getAppointmentHandler, {
			params: { id: "appt_1" },
			controller: ctrl,
		})) as { appointment: Appointment };
		expect(result.appointment.id).toBe("appt_1");
	});
});

describe("admin POST /appointments/:id/update", () => {
	it("returns 404 when appointment not found", async () => {
		const result = (await call(updateAppointmentHandler, {
			params: { id: "missing" },
			body: { status: "confirmed" },
		})) as { error: string; status: number };
		expect(result.status).toBe(404);
	});

	it("confirms appointment and returns it", async () => {
		const appt = makeAppointment({ status: "confirmed" });
		const ctrl = makeController({
			updateAppointment: vi.fn().mockResolvedValue(appt),
		});
		const result = (await call(updateAppointmentHandler, {
			params: { id: appt.id },
			body: { status: "confirmed" },
			controller: ctrl,
		})) as { appointment: Appointment };
		expect(result.appointment.status).toBe("confirmed");
		expect(ctrl.updateAppointment).toHaveBeenCalledWith(
			appt.id,
			expect.objectContaining({ status: "confirmed" }),
		);
	});
});

// ── Stats ─────────────────────────────────────────────────────────────────────

describe("admin GET /appointments/stats", () => {
	it("returns zero-state stats", async () => {
		const result = (await call(statsHandler)) as {
			stats: AppointmentStats;
		};
		expect(result.stats.totalAppointments).toBe(0);
		expect(result.stats.totalRevenue).toBe(0);
	});

	it("returns real stats from controller", async () => {
		const ctrl = makeController({
			getStats: vi.fn().mockResolvedValue({
				totalAppointments: 120,
				pendingAppointments: 10,
				confirmedAppointments: 35,
				cancelledAppointments: 8,
				completedAppointments: 62,
				noShowAppointments: 5,
				totalServices: 8,
				totalStaff: 4,
				totalRevenue: 420000,
			}),
		});
		const result = (await call(statsHandler, { controller: ctrl })) as {
			stats: AppointmentStats;
		};
		expect(result.stats.totalAppointments).toBe(120);
		expect(result.stats.totalRevenue).toBe(420000);
	});
});
