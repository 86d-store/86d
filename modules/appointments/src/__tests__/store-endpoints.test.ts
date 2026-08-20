import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAppointmentController } from "../service-impl";

type DataService = ReturnType<typeof createMockDataService>;

describe("store endpoints — appointments", () => {
	let data: DataService;
	let controller: ReturnType<typeof createAppointmentController>;

	beforeEach(() => {
		data = createMockDataService();
		controller = createAppointmentController(data);
	});

	async function seedService(
		overrides: Partial<Parameters<typeof controller.createService>[0]> = {},
	) {
		return controller.createService({
			name: "Deep Tissue Massage",
			slug: `massage-${crypto.randomUUID().slice(0, 8)}`,
			duration: 60,
			price: 12000,
			...overrides,
		});
	}

	async function seedStaff(
		overrides: Partial<Parameters<typeof controller.createStaff>[0]> = {},
	) {
		return controller.createStaff({
			name: "Maria Lopez",
			email: `maria-${crypto.randomUUID().slice(0, 8)}@example.com`,
			...overrides,
		});
	}

	async function seedAppointment(
		serviceId: string,
		staffId: string,
		overrides: Partial<Parameters<typeof controller.createAppointment>[0]> = {},
	) {
		return controller.createAppointment({
			serviceId,
			staffId,
			customerName: "Alex Customer",
			customerEmail: "alex@example.com",
			startsAt: new Date("2026-04-07T10:00:00Z"),
			...overrides,
		});
	}

	// ── 1. GET /appointments/services — list active services ──

	describe("list services (store)", () => {
		it("returns only active services sorted by sortOrder", async () => {
			// Insert in sortOrder so mock insertion order matches expected sort
			await seedService({
				name: "Massage",
				slug: "massage",
				status: "active",
				sortOrder: 0,
			});
			await seedService({
				name: "Manicure",
				slug: "manicure",
				status: "active",
				sortOrder: 1,
			});
			await seedService({
				name: "Hidden Treatment",
				slug: "hidden",
				status: "inactive",
				sortOrder: 1,
			});
			await seedService({
				name: "Facial",
				slug: "facial",
				status: "active",
				sortOrder: 2,
			});

			const services = await controller.listServices({ status: "active" });

			expect(services).toHaveLength(3);
			expect(services[0].name).toBe("Massage");
			expect(services[1].name).toBe("Manicure");
			expect(services[2].name).toBe("Facial");

			for (const svc of services) {
				expect(svc.status).toBe("active");
			}
		});

		it("returns empty array when no active services exist", async () => {
			await seedService({ slug: "only-inactive", status: "inactive" });

			const services = await controller.listServices({ status: "active" });
			expect(services).toHaveLength(0);
		});
	});

	// ── 2. GET /appointments/services/:slug — get service by slug ──

	describe("get service by slug (store)", () => {
		it("returns the service when slug matches", async () => {
			const created = await seedService({
				name: "Hot Stone",
				slug: "hot-stone",
			});

			const found = await controller.getServiceBySlug("hot-stone");
			expect(found).not.toBeNull();
			expect(found?.id).toBe(created.id);
			expect(found?.name).toBe("Hot Stone");
			expect(found?.slug).toBe("hot-stone");
		});

		it("returns null when slug does not exist", async () => {
			const result = await controller.getServiceBySlug("nonexistent-slug");
			expect(result).toBeNull();
		});
	});

	// ── 3. GET /appointments/availability — get available time slots ──

	describe("available slots (store)", () => {
		it("returns slots for a day with a matching schedule", async () => {
			const svc = await seedService({ duration: 60 });
			const staff = await seedStaff();
			await controller.assignService(staff.id, svc.id);
			// Tuesday = dayOfWeek 2; 2026-04-07 is a Tuesday
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-04-07T00:00:00Z"),
			});

			expect(slots).toHaveLength(3);
			expect(slots[0].startsAt.toISOString()).toBe("2026-04-07T09:00:00.000Z");
			expect(slots[0].endsAt.toISOString()).toBe("2026-04-07T10:00:00.000Z");
			expect(slots[1].startsAt.toISOString()).toBe("2026-04-07T10:00:00.000Z");
			expect(slots[2].startsAt.toISOString()).toBe("2026-04-07T11:00:00.000Z");
			for (const slot of slots) {
				expect(slot.staffId).toBe(staff.id);
			}
		});

		it("returns empty for a day with no schedule", async () => {
			const svc = await seedService({ duration: 30 });
			const staff = await seedStaff();
			await controller.assignService(staff.id, svc.id);
			// Schedule only on Monday (1)
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "17:00",
			});

			// 2026-04-07 is Tuesday (dayOfWeek=2), no schedule
			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-04-07T00:00:00Z"),
			});

			expect(slots).toHaveLength(0);
		});

		it("excludes time slots that conflict with existing appointments", async () => {
			const svc = await seedService({ duration: 60 });
			const staff = await seedStaff();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			// Book the 10:00-11:00 slot
			await seedAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-04-07T10:00:00Z"),
			});

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-04-07T00:00:00Z"),
			});

			expect(slots).toHaveLength(2);
			const startTimes = slots.map((s) => s.startsAt.toISOString());
			expect(startTimes).toContain("2026-04-07T09:00:00.000Z");
			expect(startTimes).toContain("2026-04-07T11:00:00.000Z");
			expect(startTimes).not.toContain("2026-04-07T10:00:00.000Z");
		});

		it("returns empty for an inactive service", async () => {
			const svc = await seedService({
				duration: 60,
				status: "inactive",
			});
			const staff = await seedStaff();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-04-07T00:00:00Z"),
			});
			expect(slots).toHaveLength(0);
		});

		it("returns empty when staff is inactive", async () => {
			const svc = await seedService({ duration: 60 });
			const staff = await seedStaff({ status: "inactive" });
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-04-07T00:00:00Z"),
			});
			expect(slots).toHaveLength(0);
		});
	});

	// ── 4. POST /appointments/book — book appointment ──

	describe("book appointment (store)", () => {
		it("creates an appointment with pending status", async () => {
			const svc = await seedService({ duration: 45, price: 8500 });
			const staff = await seedStaff();

			const appt = await controller.createAppointment({
				serviceId: svc.id,
				staffId: staff.id,
				customerName: "Sam Buyer",
				customerEmail: "sam@example.com",
				startsAt: new Date("2026-04-07T14:00:00Z"),
			});

			expect(appt.status).toBe("pending");
			expect(appt.serviceId).toBe(svc.id);
			expect(appt.staffId).toBe(staff.id);
			expect(appt.customerName).toBe("Sam Buyer");
			expect(appt.customerEmail).toBe("sam@example.com");
			expect(appt.price).toBe(8500);
			expect(appt.currency).toBe("USD");
			expect(appt.id).toBeDefined();
			expect(appt.createdAt).toBeInstanceOf(Date);
		});

		it("calculates endsAt from service duration", async () => {
			const svc = await seedService({ duration: 90 });
			const staff = await seedStaff();

			const appt = await controller.createAppointment({
				serviceId: svc.id,
				staffId: staff.id,
				customerName: "Test",
				customerEmail: "test@example.com",
				startsAt: new Date("2026-04-07T10:00:00Z"),
			});

			expect(appt.endsAt.toISOString()).toBe("2026-04-07T11:30:00.000Z");
		});

		it("sets price and currency from the service", async () => {
			const svc = await seedService({
				duration: 30,
				price: 5000,
				currency: "EUR",
			});
			const staff = await seedStaff();

			const appt = await controller.createAppointment({
				serviceId: svc.id,
				staffId: staff.id,
				customerName: "Euro Customer",
				customerEmail: "euro@example.com",
				startsAt: new Date("2026-04-07T10:00:00Z"),
			});

			expect(appt.price).toBe(5000);
			expect(appt.currency).toBe("EUR");
		});

		it("throws when service does not exist", async () => {
			const staff = await seedStaff();

			await expect(
				controller.createAppointment({
					serviceId: "nonexistent-service-id",
					staffId: staff.id,
					customerName: "Ghost",
					customerEmail: "ghost@example.com",
					startsAt: new Date("2026-04-07T10:00:00Z"),
				}),
			).rejects.toThrow("Service not found");
		});

		it("includes optional fields when provided", async () => {
			const svc = await seedService({ duration: 60 });
			const staff = await seedStaff();

			const appt = await controller.createAppointment({
				serviceId: svc.id,
				staffId: staff.id,
				customerName: "Full Details",
				customerEmail: "full@example.com",
				customerPhone: "+1-555-0199",
				customerId: "cust_abc",
				startsAt: new Date("2026-04-07T10:00:00Z"),
				notes: "First visit, prefers low lighting",
			});

			expect(appt.customerPhone).toBe("+1-555-0199");
			expect(appt.customerId).toBe("cust_abc");
			expect(appt.notes).toBe("First visit, prefers low lighting");
		});
	});

	// ── 5. GET /appointments/:id — get appointment ──

	describe("get appointment (store)", () => {
		it("returns the appointment when it exists", async () => {
			const svc = await seedService({ duration: 30 });
			const staff = await seedStaff();
			const created = await seedAppointment(svc.id, staff.id);

			const fetched = await controller.getAppointment(created.id);

			expect(fetched).not.toBeNull();
			expect(fetched?.id).toBe(created.id);
			expect(fetched?.customerName).toBe("Alex Customer");
			expect(fetched?.serviceId).toBe(svc.id);
			expect(fetched?.staffId).toBe(staff.id);
		});

		it("returns null for a non-existent appointment", async () => {
			const result = await controller.getAppointment("no-such-id");
			expect(result).toBeNull();
		});
	});

	// ── 6. GET /appointments/me — list customer's appointments ──

	describe("list my appointments (store)", () => {
		it("returns appointments for a specific customer", async () => {
			const svc = await seedService({ duration: 30 });
			const staff = await seedStaff();
			const customerId = "cust_alice";

			await controller.createAppointment({
				serviceId: svc.id,
				staffId: staff.id,
				customerName: "Alice",
				customerEmail: "alice@example.com",
				customerId,
				startsAt: new Date("2026-04-07T10:00:00Z"),
			});
			await controller.createAppointment({
				serviceId: svc.id,
				staffId: staff.id,
				customerName: "Alice",
				customerEmail: "alice@example.com",
				customerId,
				startsAt: new Date("2026-04-08T10:00:00Z"),
			});
			// Another customer's appointment
			await seedAppointment(svc.id, staff.id, {
				customerId: "cust_bob",
				startsAt: new Date("2026-04-09T10:00:00Z"),
			});

			const aliceAppts = await controller.listAppointments({ customerId });
			expect(aliceAppts).toHaveLength(2);
			for (const a of aliceAppts) {
				expect(a.customerId).toBe(customerId);
			}
		});

		it("returns empty when customer has no appointments", async () => {
			const appts = await controller.listAppointments({
				customerId: "cust_nobody",
			});
			expect(appts).toHaveLength(0);
		});

		it("filters by status", async () => {
			const svc = await seedService({ duration: 30 });
			const staff = await seedStaff();
			const customerId = "cust_filter";

			const a1 = await controller.createAppointment({
				serviceId: svc.id,
				staffId: staff.id,
				customerName: "Filter",
				customerEmail: "filter@example.com",
				customerId,
				startsAt: new Date("2026-04-07T10:00:00Z"),
			});
			await controller.cancelAppointment(a1.id);

			await controller.createAppointment({
				serviceId: svc.id,
				staffId: staff.id,
				customerName: "Filter",
				customerEmail: "filter@example.com",
				customerId,
				startsAt: new Date("2026-04-08T10:00:00Z"),
			});

			const cancelled = await controller.listAppointments({
				customerId,
				status: "cancelled",
			});
			expect(cancelled).toHaveLength(1);
			expect(cancelled[0].status).toBe("cancelled");

			const pending = await controller.listAppointments({
				customerId,
				status: "pending",
			});
			expect(pending).toHaveLength(1);
			expect(pending[0].status).toBe("pending");
		});

		it("does not return other customers' appointments", async () => {
			const svc = await seedService({ duration: 30 });
			const staff = await seedStaff();
			await seedAppointment(svc.id, staff.id, { customerId: "cust_other" });

			const mine = await controller.listAppointments({ customerId: "cust_me" });
			expect(mine).toHaveLength(0);
		});
	});

	// ── 7. POST /appointments/:id/cancel — cancel appointment ──

	describe("cancel appointment (store)", () => {
		it("sets a pending appointment to cancelled", async () => {
			const svc = await seedService({ duration: 30 });
			const staff = await seedStaff();
			const appt = await seedAppointment(svc.id, staff.id);
			expect(appt.status).toBe("pending");

			const cancelled = await controller.cancelAppointment(appt.id);

			expect(cancelled).not.toBeNull();
			expect(cancelled?.status).toBe("cancelled");
			expect(cancelled?.id).toBe(appt.id);
		});

		it("returns null when cancelling a non-existent appointment", async () => {
			const result = await controller.cancelAppointment("missing-appt-id");
			expect(result).toBeNull();
		});

		it("cancelled appointment is persisted", async () => {
			const svc = await seedService({ duration: 30 });
			const staff = await seedStaff();
			const appt = await seedAppointment(svc.id, staff.id);

			await controller.cancelAppointment(appt.id);

			const refetched = await controller.getAppointment(appt.id);
			expect(refetched?.status).toBe("cancelled");
		});

		it("cancelling frees the time slot for availability", async () => {
			const svc = await seedService({ duration: 60 });
			const staff = await seedStaff();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "11:00",
			});

			const appt = await seedAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-04-07T09:00:00Z"),
			});

			const before = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-04-07T00:00:00Z"),
			});
			expect(before).toHaveLength(1);

			await controller.cancelAppointment(appt.id);

			const after = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-04-07T00:00:00Z"),
			});
			expect(after).toHaveLength(2);
		});
	});
});
