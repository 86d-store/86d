import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAppointmentController } from "../service-impl";

describe("createAppointmentController", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAppointmentController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAppointmentController(mockData);
	});

	async function createTestService(
		overrides: Partial<Parameters<typeof controller.createService>[0]> = {},
	) {
		return controller.createService({
			name: "Haircut",
			slug: "haircut",
			duration: 30,
			price: 40,
			...overrides,
		});
	}

	async function createTestStaff(
		overrides: Partial<Parameters<typeof controller.createStaff>[0]> = {},
	) {
		return controller.createStaff({
			name: "Jane Smith",
			email: "jane@example.com",
			...overrides,
		});
	}

	async function createTestAppointment(
		serviceId: string,
		staffId: string,
		overrides: Partial<Parameters<typeof controller.createAppointment>[0]> = {},
	) {
		return controller.createAppointment({
			serviceId,
			staffId,
			customerName: "John Doe",
			customerEmail: "john@example.com",
			startsAt: new Date("2026-04-01T10:00:00Z"),
			...overrides,
		});
	}

	// ── createService ──

	describe("createService", () => {
		it("creates a service with required fields", async () => {
			const svc = await createTestService();
			expect(svc.id).toBeDefined();
			expect(svc.name).toBe("Haircut");
			expect(svc.slug).toBe("haircut");
			expect(svc.duration).toBe(30);
			expect(svc.price).toBe(40);
			expect(svc.currency).toBe("USD");
			expect(svc.status).toBe("active");
			expect(svc.maxCapacity).toBe(1);
			expect(svc.sortOrder).toBe(0);
			expect(svc.createdAt).toBeInstanceOf(Date);
			expect(svc.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a service with all optional fields", async () => {
			const svc = await createTestService({
				description: "A professional haircut",
				currency: "EUR",
				status: "inactive",
				maxCapacity: 3,
				sortOrder: 5,
			});
			expect(svc.description).toBe("A professional haircut");
			expect(svc.currency).toBe("EUR");
			expect(svc.status).toBe("inactive");
			expect(svc.maxCapacity).toBe(3);
			expect(svc.sortOrder).toBe(5);
		});

		it("assigns unique IDs", async () => {
			const s1 = await createTestService({ slug: "a" });
			const s2 = await createTestService({ slug: "b" });
			expect(s1.id).not.toBe(s2.id);
		});
	});

	// ── getService ──

	describe("getService", () => {
		it("returns an existing service by ID", async () => {
			const created = await createTestService();
			const fetched = await controller.getService(created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.name).toBe("Haircut");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.getService("missing");
			expect(result).toBeNull();
		});
	});

	// ── getServiceBySlug ──

	describe("getServiceBySlug", () => {
		it("returns a service by slug", async () => {
			await createTestService({ slug: "massage" });
			const result = await controller.getServiceBySlug("massage");
			expect(result).not.toBeNull();
			expect(result?.slug).toBe("massage");
		});

		it("returns null for non-existent slug", async () => {
			const result = await controller.getServiceBySlug("nope");
			expect(result).toBeNull();
		});
	});

	// ── updateService ──

	describe("updateService", () => {
		it("updates name and slug", async () => {
			const created = await createTestService();
			const updated = await controller.updateService(created.id, {
				name: "Premium Haircut",
				slug: "premium-haircut",
			});
			expect(updated?.name).toBe("Premium Haircut");
			expect(updated?.slug).toBe("premium-haircut");
		});

		it("updates price and duration", async () => {
			const created = await createTestService();
			const updated = await controller.updateService(created.id, {
				price: 60,
				duration: 45,
			});
			expect(updated?.price).toBe(60);
			expect(updated?.duration).toBe(45);
		});

		it("clears description with null", async () => {
			const created = await createTestService({
				description: "Old description",
			});
			const updated = await controller.updateService(created.id, {
				description: null,
			});
			expect(updated?.description).toBeUndefined();
		});

		it("preserves fields not included in update", async () => {
			const created = await createTestService({
				description: "Keep me",
				currency: "EUR",
			});
			const updated = await controller.updateService(created.id, {
				name: "New Name",
			});
			expect(updated?.description).toBe("Keep me");
			expect(updated?.currency).toBe("EUR");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.updateService("missing", {
				name: "X",
			});
			expect(result).toBeNull();
		});

		it("updates the updatedAt timestamp", async () => {
			const created = await createTestService();
			const updated = await controller.updateService(created.id, {
				name: "Updated",
			});
			expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(
				created.updatedAt.getTime(),
			);
		});
	});

	// ── deleteService ──

	describe("deleteService", () => {
		it("deletes a service and its staff assignments", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			await controller.assignService(staff.id, svc.id);

			const deleted = await controller.deleteService(svc.id);
			expect(deleted).toBe(true);

			const fetched = await controller.getService(svc.id);
			expect(fetched).toBeNull();

			const services = await controller.getStaffServices(staff.id);
			expect(services).toHaveLength(0);
		});

		it("returns false for non-existent ID", async () => {
			const result = await controller.deleteService("missing");
			expect(result).toBe(false);
		});
	});

	// ── listServices ──

	describe("listServices", () => {
		it("returns all services", async () => {
			await createTestService({ slug: "a" });
			await createTestService({ slug: "b" });
			await createTestService({ slug: "c" });

			const results = await controller.listServices();
			expect(results).toHaveLength(3);
		});

		it("filters by status", async () => {
			await createTestService({ slug: "a", status: "active" });
			await createTestService({ slug: "b", status: "inactive" });

			const active = await controller.listServices({ status: "active" });
			expect(active).toHaveLength(1);
		});

		it("supports pagination", async () => {
			await createTestService({ slug: "a" });
			await createTestService({ slug: "b" });
			await createTestService({ slug: "c" });

			const page = await controller.listServices({ take: 2, skip: 0 });
			expect(page).toHaveLength(2);
		});
	});

	// ── countServices ──

	describe("countServices", () => {
		it("counts all services", async () => {
			await createTestService({ slug: "a" });
			await createTestService({ slug: "b" });

			const count = await controller.countServices();
			expect(count).toBe(2);
		});

		it("counts filtered services", async () => {
			await createTestService({ slug: "a", status: "active" });
			await createTestService({ slug: "b", status: "inactive" });

			const count = await controller.countServices({ status: "active" });
			expect(count).toBe(1);
		});
	});

	// ── createStaff ──

	describe("createStaff", () => {
		it("creates a staff member with required fields", async () => {
			const staff = await createTestStaff();
			expect(staff.id).toBeDefined();
			expect(staff.name).toBe("Jane Smith");
			expect(staff.email).toBe("jane@example.com");
			expect(staff.status).toBe("active");
			expect(staff.createdAt).toBeInstanceOf(Date);
			expect(staff.updatedAt).toBeInstanceOf(Date);
		});

		it("creates a staff member with optional fields", async () => {
			const staff = await createTestStaff({
				bio: "Senior stylist",
				status: "inactive",
			});
			expect(staff.bio).toBe("Senior stylist");
			expect(staff.status).toBe("inactive");
		});

		it("assigns unique IDs", async () => {
			const s1 = await createTestStaff({ email: "a@test.com" });
			const s2 = await createTestStaff({ email: "b@test.com" });
			expect(s1.id).not.toBe(s2.id);
		});
	});

	// ── getStaff ──

	describe("getStaff", () => {
		it("returns an existing staff member", async () => {
			const created = await createTestStaff();
			const fetched = await controller.getStaff(created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.name).toBe("Jane Smith");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.getStaff("missing");
			expect(result).toBeNull();
		});
	});

	// ── updateStaff ──

	describe("updateStaff", () => {
		it("updates name and email", async () => {
			const created = await createTestStaff();
			const updated = await controller.updateStaff(created.id, {
				name: "Jane Doe",
				email: "janedoe@example.com",
			});
			expect(updated?.name).toBe("Jane Doe");
			expect(updated?.email).toBe("janedoe@example.com");
		});

		it("clears bio with null", async () => {
			const created = await createTestStaff({ bio: "Old bio" });
			const updated = await controller.updateStaff(created.id, {
				bio: null,
			});
			expect(updated?.bio).toBeUndefined();
		});

		it("preserves fields not included in update", async () => {
			const created = await createTestStaff({ bio: "Keep me" });
			const updated = await controller.updateStaff(created.id, {
				name: "New Name",
			});
			expect(updated?.bio).toBe("Keep me");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.updateStaff("missing", {
				name: "X",
			});
			expect(result).toBeNull();
		});
	});

	// ── deleteStaff ──

	describe("deleteStaff", () => {
		it("deletes a staff member and cascades", async () => {
			const staff = await createTestStaff();
			const svc = await createTestService();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "17:00",
			});

			const deleted = await controller.deleteStaff(staff.id);
			expect(deleted).toBe(true);

			const fetched = await controller.getStaff(staff.id);
			expect(fetched).toBeNull();

			const schedule = await controller.getSchedule(staff.id);
			expect(schedule).toHaveLength(0);
		});

		it("returns false for non-existent ID", async () => {
			const result = await controller.deleteStaff("missing");
			expect(result).toBe(false);
		});
	});

	// ── listStaff ──

	describe("listStaff", () => {
		it("returns all staff", async () => {
			await createTestStaff({ email: "a@test.com" });
			await createTestStaff({ email: "b@test.com" });

			const results = await controller.listStaff();
			expect(results).toHaveLength(2);
		});

		it("filters by status", async () => {
			await createTestStaff({
				email: "a@test.com",
				status: "active",
			});
			await createTestStaff({
				email: "b@test.com",
				status: "inactive",
			});

			const active = await controller.listStaff({ status: "active" });
			expect(active).toHaveLength(1);
		});
	});

	// ── countStaff ──

	describe("countStaff", () => {
		it("counts all staff", async () => {
			await createTestStaff({ email: "a@test.com" });
			await createTestStaff({ email: "b@test.com" });

			const count = await controller.countStaff();
			expect(count).toBe(2);
		});
	});

	// ── assignService / unassignService ──

	describe("staff-service assignments", () => {
		it("assigns a service to a staff member", async () => {
			const staff = await createTestStaff();
			const svc = await createTestService();
			const assignment = await controller.assignService(staff.id, svc.id);
			expect(assignment.staffId).toBe(staff.id);
			expect(assignment.serviceId).toBe(svc.id);
		});

		it("returns existing assignment on duplicate", async () => {
			const staff = await createTestStaff();
			const svc = await createTestService();
			const first = await controller.assignService(staff.id, svc.id);
			const second = await controller.assignService(staff.id, svc.id);
			expect(first.id).toBe(second.id);
		});

		it("unassigns a service from a staff member", async () => {
			const staff = await createTestStaff();
			const svc = await createTestService();
			await controller.assignService(staff.id, svc.id);

			const removed = await controller.unassignService(staff.id, svc.id);
			expect(removed).toBe(true);

			const services = await controller.getStaffServices(staff.id);
			expect(services).toHaveLength(0);
		});

		it("returns false when unassigning non-existent assignment", async () => {
			const result = await controller.unassignService("a", "b");
			expect(result).toBe(false);
		});

		it("getStaffServices returns assigned services", async () => {
			const staff = await createTestStaff();
			const s1 = await createTestService({ slug: "a" });
			const s2 = await createTestService({ slug: "b" });
			await controller.assignService(staff.id, s1.id);
			await controller.assignService(staff.id, s2.id);

			const services = await controller.getStaffServices(staff.id);
			expect(services).toHaveLength(2);
		});

		it("getServiceStaff returns assigned staff", async () => {
			const svc = await createTestService();
			const st1 = await createTestStaff({ email: "a@test.com" });
			const st2 = await createTestStaff({ email: "b@test.com" });
			await controller.assignService(st1.id, svc.id);
			await controller.assignService(st2.id, svc.id);

			const staff = await controller.getServiceStaff(svc.id);
			expect(staff).toHaveLength(2);
		});
	});

	// ── Schedules ──

	describe("schedules", () => {
		it("sets a schedule for a day", async () => {
			const staff = await createTestStaff();
			const schedule = await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "17:00",
			});
			expect(schedule.staffId).toBe(staff.id);
			expect(schedule.dayOfWeek).toBe(1);
			expect(schedule.startTime).toBe("09:00");
			expect(schedule.endTime).toBe("17:00");
		});

		it("upserts schedule for same day", async () => {
			const staff = await createTestStaff();
			const first = await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "17:00",
			});
			const second = await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "10:00",
				endTime: "18:00",
			});
			expect(second.id).toBe(first.id);
			expect(second.startTime).toBe("10:00");
		});

		it("gets all schedules for a staff member", async () => {
			const staff = await createTestStaff();
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "17:00",
			});
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 3,
				startTime: "10:00",
				endTime: "18:00",
			});

			const schedules = await controller.getSchedule(staff.id);
			expect(schedules).toHaveLength(2);
		});

		it("removes a schedule", async () => {
			const staff = await createTestStaff();
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "17:00",
			});

			const removed = await controller.removeSchedule(staff.id, 1);
			expect(removed).toBe(true);

			const schedules = await controller.getSchedule(staff.id);
			expect(schedules).toHaveLength(0);
		});

		it("returns false when removing non-existent schedule", async () => {
			const result = await controller.removeSchedule("missing", 1);
			expect(result).toBe(false);
		});
	});

	// ── getAvailableSlots ──

	describe("getAvailableSlots", () => {
		it("returns available time slots for a service", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff = await createTestStaff();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2, // Tuesday
				startTime: "09:00",
				endTime: "12:00",
			});

			// Tuesday
			const date = new Date("2026-03-10T00:00:00Z");
			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date,
			});

			expect(slots).toHaveLength(3); // 09:00-10:00, 10:00-11:00, 11:00-12:00
			expect(slots[0].staffId).toBe(staff.id);
		});

		it("excludes slots that conflict with existing appointments", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff = await createTestStaff();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			// Book 10:00-11:00
			await createTestAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-03-10T10:00:00Z"),
			});

			const date = new Date("2026-03-10T00:00:00Z");
			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date,
			});

			expect(slots).toHaveLength(2); // 09:00-10:00 and 11:00-12:00
		});

		it("returns empty for inactive service", async () => {
			const svc = await createTestService({ status: "inactive" });
			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});
			expect(slots).toHaveLength(0);
		});

		it("returns empty for non-existent service", async () => {
			const slots = await controller.getAvailableSlots({
				serviceId: "missing",
				date: new Date("2026-03-10T00:00:00Z"),
			});
			expect(slots).toHaveLength(0);
		});

		it("returns empty when no staff is scheduled for the day", async () => {
			const svc = await createTestService({ duration: 30 });
			const staff = await createTestStaff();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1, // Monday
				startTime: "09:00",
				endTime: "17:00",
			});

			// Tuesday — no schedule
			const date = new Date("2026-03-10T00:00:00Z");
			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date,
			});
			expect(slots).toHaveLength(0);
		});

		it("filters by specific staff member", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff1 = await createTestStaff({ email: "a@test.com" });
			const staff2 = await createTestStaff({ email: "b@test.com" });
			await controller.assignService(staff1.id, svc.id);
			await controller.assignService(staff2.id, svc.id);
			await controller.setSchedule({
				staffId: staff1.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "11:00",
			});
			await controller.setSchedule({
				staffId: staff2.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			const date = new Date("2026-03-10T00:00:00Z");
			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				staffId: staff1.id,
				date,
			});

			// Only staff1's slots: 09-10, 10-11
			expect(slots).toHaveLength(2);
			for (const slot of slots) {
				expect(slot.staffId).toBe(staff1.id);
			}
		});

		it("excludes inactive staff from availability", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff = await createTestStaff({ status: "inactive" });
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			const date = new Date("2026-03-10T00:00:00Z");
			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date,
			});
			expect(slots).toHaveLength(0);
		});

		it("ignores cancelled appointments when checking conflicts", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff = await createTestStaff();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			// Book and cancel 10:00-11:00
			const appt = await createTestAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-03-10T10:00:00Z"),
			});
			await controller.cancelAppointment(appt.id);

			const date = new Date("2026-03-10T00:00:00Z");
			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date,
			});

			expect(slots).toHaveLength(3); // All slots available
		});
	});

	// ── createAppointment ──

	describe("createAppointment", () => {
		it("creates an appointment with required fields", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			const appt = await createTestAppointment(svc.id, staff.id);
			expect(appt.id).toBeDefined();
			expect(appt.serviceId).toBe(svc.id);
			expect(appt.staffId).toBe(staff.id);
			expect(appt.customerName).toBe("John Doe");
			expect(appt.customerEmail).toBe("john@example.com");
			expect(appt.status).toBe("pending");
			expect(appt.price).toBe(40);
			expect(appt.currency).toBe("USD");
			expect(appt.createdAt).toBeInstanceOf(Date);
		});

		it("calculates endsAt from service duration", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff = await createTestStaff();
			const startsAt = new Date("2026-04-01T10:00:00Z");

			const appt = await createTestAppointment(svc.id, staff.id, {
				startsAt,
			});
			expect(appt.endsAt.getTime()).toBe(startsAt.getTime() + 60 * 60000);
		});

		it("creates an appointment with optional fields", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			const appt = await createTestAppointment(svc.id, staff.id, {
				customerId: "cust-1",
				customerPhone: "+1234567890",
				notes: "First visit",
			});
			expect(appt.customerId).toBe("cust-1");
			expect(appt.customerPhone).toBe("+1234567890");
			expect(appt.notes).toBe("First visit");
		});

		it("throws for non-existent service", async () => {
			const staff = await createTestStaff();
			await expect(createTestAppointment("missing", staff.id)).rejects.toThrow(
				"Service not found",
			);
		});
	});

	// ── getAppointment ──

	describe("getAppointment", () => {
		it("returns an existing appointment", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const created = await createTestAppointment(svc.id, staff.id);

			const fetched = await controller.getAppointment(created.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.customerName).toBe("John Doe");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.getAppointment("missing");
			expect(result).toBeNull();
		});
	});

	// ── updateAppointment ──

	describe("updateAppointment", () => {
		it("updates status", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id);

			const updated = await controller.updateAppointment(appt.id, {
				status: "confirmed",
			});
			expect(updated?.status).toBe("confirmed");
		});

		it("updates notes", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id);

			const updated = await controller.updateAppointment(appt.id, {
				notes: "Special request",
			});
			expect(updated?.notes).toBe("Special request");
		});

		it("clears notes with null", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id, {
				notes: "Old notes",
			});

			const updated = await controller.updateAppointment(appt.id, {
				notes: null,
			});
			expect(updated?.notes).toBeUndefined();
		});

		it("reschedules by updating startsAt", async () => {
			const svc = await createTestService({ duration: 30 });
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id);

			const newStart = new Date("2026-04-02T14:00:00Z");
			const updated = await controller.updateAppointment(appt.id, {
				startsAt: newStart,
			});
			expect(updated?.startsAt).toEqual(newStart);
			expect(updated?.endsAt.getTime()).toBe(newStart.getTime() + 30 * 60000);
		});

		it("reassigns staff", async () => {
			const svc = await createTestService();
			const staff1 = await createTestStaff({ email: "a@test.com" });
			const staff2 = await createTestStaff({ email: "b@test.com" });
			const appt = await createTestAppointment(svc.id, staff1.id);

			const updated = await controller.updateAppointment(appt.id, {
				staffId: staff2.id,
			});
			expect(updated?.staffId).toBe(staff2.id);
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.updateAppointment("missing", {
				status: "confirmed",
			});
			expect(result).toBeNull();
		});
	});

	// ── cancelAppointment ──

	describe("cancelAppointment", () => {
		it("cancels an appointment", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id);

			const cancelled = await controller.cancelAppointment(appt.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null for non-existent ID", async () => {
			const result = await controller.cancelAppointment("missing");
			expect(result).toBeNull();
		});
	});

	// ── listAppointments ──

	describe("listAppointments", () => {
		it("returns all appointments", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "a@test.com",
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "b@test.com",
				startsAt: new Date("2026-04-02T10:00:00Z"),
			});

			const results = await controller.listAppointments();
			expect(results).toHaveLength(2);
		});

		it("filters by staffId", async () => {
			const svc = await createTestService();
			const staff1 = await createTestStaff({ email: "a@test.com" });
			const staff2 = await createTestStaff({ email: "b@test.com" });
			await createTestAppointment(svc.id, staff1.id, {
				customerEmail: "c1@test.com",
			});
			await createTestAppointment(svc.id, staff2.id, {
				customerEmail: "c2@test.com",
			});

			const results = await controller.listAppointments({
				staffId: staff1.id,
			});
			expect(results).toHaveLength(1);
		});

		it("filters by status", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id, {
				customerEmail: "a@test.com",
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "b@test.com",
				startsAt: new Date("2026-04-02T10:00:00Z"),
			});
			await controller.updateAppointment(appt.id, {
				status: "confirmed",
			});

			const results = await controller.listAppointments({
				status: "confirmed",
			});
			expect(results).toHaveLength(1);
		});

		it("filters by date range", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "a@test.com",
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "b@test.com",
				startsAt: new Date("2026-04-05T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "c@test.com",
				startsAt: new Date("2026-04-10T10:00:00Z"),
			});

			const results = await controller.listAppointments({
				from: new Date("2026-04-03T00:00:00Z"),
				to: new Date("2026-04-07T00:00:00Z"),
			});
			expect(results).toHaveLength(1);
		});

		it("supports pagination", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "a@test.com",
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "b@test.com",
				startsAt: new Date("2026-04-02T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "c@test.com",
				startsAt: new Date("2026-04-03T10:00:00Z"),
			});

			const page = await controller.listAppointments({
				take: 2,
				skip: 0,
			});
			expect(page).toHaveLength(2);
		});
	});

	// ── countAppointments ──

	describe("countAppointments", () => {
		it("counts all appointments", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "a@test.com",
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "b@test.com",
				startsAt: new Date("2026-04-02T10:00:00Z"),
			});

			const count = await controller.countAppointments();
			expect(count).toBe(2);
		});

		it("counts filtered appointments", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id, {
				customerEmail: "a@test.com",
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "b@test.com",
				startsAt: new Date("2026-04-02T10:00:00Z"),
			});
			await controller.cancelAppointment(appt.id);

			const count = await controller.countAppointments({
				status: "cancelled",
			});
			expect(count).toBe(1);
		});

		it("counts within date range", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "a@test.com",
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "b@test.com",
				startsAt: new Date("2026-04-10T10:00:00Z"),
			});

			const count = await controller.countAppointments({
				from: new Date("2026-04-05T00:00:00Z"),
			});
			expect(count).toBe(1);
		});
	});

	// ── getUpcomingAppointments ──

	describe("getUpcomingAppointments", () => {
		it("returns future non-cancelled appointments", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			const futureDate = new Date(Date.now() + 86400000);
			const pastDate = new Date(Date.now() - 86400000);

			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "future@test.com",
				startsAt: futureDate,
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "past@test.com",
				startsAt: pastDate,
			});

			const upcoming = await controller.getUpcomingAppointments();
			expect(upcoming).toHaveLength(1);
			expect(upcoming[0].customerEmail).toBe("future@test.com");
		});

		it("excludes cancelled appointments", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			const futureDate = new Date(Date.now() + 86400000);
			const appt = await createTestAppointment(svc.id, staff.id, {
				startsAt: futureDate,
			});
			await controller.cancelAppointment(appt.id);

			const upcoming = await controller.getUpcomingAppointments();
			expect(upcoming).toHaveLength(0);
		});

		it("filters by staffId", async () => {
			const svc = await createTestService();
			const staff1 = await createTestStaff({ email: "a@test.com" });
			const staff2 = await createTestStaff({ email: "b@test.com" });

			const futureDate = new Date(Date.now() + 86400000);
			await createTestAppointment(svc.id, staff1.id, {
				customerEmail: "c1@test.com",
				startsAt: futureDate,
			});
			await createTestAppointment(svc.id, staff2.id, {
				customerEmail: "c2@test.com",
				startsAt: futureDate,
			});

			const upcoming = await controller.getUpcomingAppointments({
				staffId: staff1.id,
			});
			expect(upcoming).toHaveLength(1);
		});

		it("limits results with take", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			for (let i = 1; i <= 5; i++) {
				await createTestAppointment(svc.id, staff.id, {
					customerEmail: `c${i}@test.com`,
					startsAt: new Date(Date.now() + i * 86400000),
				});
			}

			const upcoming = await controller.getUpcomingAppointments({
				take: 3,
			});
			expect(upcoming).toHaveLength(3);
		});
	});

	// ── getStats ──

	describe("getStats", () => {
		it("returns stats for all entities", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			const a1 = await createTestAppointment(svc.id, staff.id, {
				customerEmail: "a@test.com",
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			const a2 = await createTestAppointment(svc.id, staff.id, {
				customerEmail: "b@test.com",
				startsAt: new Date("2026-04-02T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "c@test.com",
				startsAt: new Date("2026-04-03T10:00:00Z"),
			});

			await controller.updateAppointment(a1.id, {
				status: "completed",
			});
			await controller.cancelAppointment(a2.id);

			const stats = await controller.getStats();
			expect(stats.totalAppointments).toBe(3);
			expect(stats.completedAppointments).toBe(1);
			expect(stats.cancelledAppointments).toBe(1);
			expect(stats.pendingAppointments).toBe(1);
			expect(stats.totalServices).toBe(1);
			expect(stats.totalStaff).toBe(1);
			expect(stats.totalRevenue).toBe(40); // Only completed appointments
		});

		it("returns zeros when empty", async () => {
			const stats = await controller.getStats();
			expect(stats.totalAppointments).toBe(0);
			expect(stats.pendingAppointments).toBe(0);
			expect(stats.confirmedAppointments).toBe(0);
			expect(stats.cancelledAppointments).toBe(0);
			expect(stats.completedAppointments).toBe(0);
			expect(stats.noShowAppointments).toBe(0);
			expect(stats.totalServices).toBe(0);
			expect(stats.totalStaff).toBe(0);
			expect(stats.totalRevenue).toBe(0);
		});
	});

	// ── Appointment lifecycle ──

	describe("appointment lifecycle", () => {
		it("transitions through complete lifecycle", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id);
			expect(appt.status).toBe("pending");

			const confirmed = await controller.updateAppointment(appt.id, {
				status: "confirmed",
			});
			expect(confirmed?.status).toBe("confirmed");

			const completed = await controller.updateAppointment(appt.id, {
				status: "completed",
			});
			expect(completed?.status).toBe("completed");
		});

		it("can mark as no-show", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id);

			await controller.updateAppointment(appt.id, {
				status: "confirmed",
			});
			const noShow = await controller.updateAppointment(appt.id, {
				status: "no-show",
			});
			expect(noShow?.status).toBe("no-show");
		});
	});
});
