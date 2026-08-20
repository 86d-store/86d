import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAppointmentController } from "../service-impl";

describe("appointment controllers — edge cases", () => {
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
			slug: `haircut-${crypto.randomUUID().slice(0, 8)}`,
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
			email: `jane-${crypto.randomUUID().slice(0, 8)}@example.com`,
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

	// ── 1. Staff-service assignment isolation ─────────────────

	describe("staff-service assignment isolation", () => {
		it("assigning staff to one service does not add them to another", async () => {
			const svcA = await createTestService({ name: "Massage" });
			const svcB = await createTestService({ name: "Facial" });
			const staff = await createTestStaff();

			await controller.assignService(staff.id, svcA.id);

			const staffForA = await controller.getServiceStaff(svcA.id);
			const staffForB = await controller.getServiceStaff(svcB.id);

			expect(staffForA).toHaveLength(1);
			expect(staffForA[0].id).toBe(staff.id);
			expect(staffForB).toHaveLength(0);
		});

		it("unassigning staff from one service preserves other assignments", async () => {
			const svcA = await createTestService({ name: "Massage" });
			const svcB = await createTestService({ name: "Facial" });
			const staff = await createTestStaff();

			await controller.assignService(staff.id, svcA.id);
			await controller.assignService(staff.id, svcB.id);

			await controller.unassignService(staff.id, svcA.id);

			const remainingServices = await controller.getStaffServices(staff.id);
			expect(remainingServices).toHaveLength(1);
			expect(remainingServices[0].id).toBe(svcB.id);
		});

		it("two staff assigned to different services are fully isolated", async () => {
			const svcA = await createTestService({ name: "Massage" });
			const svcB = await createTestService({ name: "Facial" });
			const staffA = await createTestStaff({ name: "Alice" });
			const staffB = await createTestStaff({ name: "Bob" });

			await controller.assignService(staffA.id, svcA.id);
			await controller.assignService(staffB.id, svcB.id);

			const staffForA = await controller.getServiceStaff(svcA.id);
			const staffForB = await controller.getServiceStaff(svcB.id);

			expect(staffForA).toHaveLength(1);
			expect(staffForA[0].id).toBe(staffA.id);
			expect(staffForB).toHaveLength(1);
			expect(staffForB[0].id).toBe(staffB.id);
		});

		it("deleting a service with multiple staff removes all its assignments", async () => {
			const svc = await createTestService({ name: "Massage" });
			const svcKeep = await createTestService({ name: "Facial" });
			const staff1 = await createTestStaff({ name: "Alice" });
			const staff2 = await createTestStaff({ name: "Bob" });

			await controller.assignService(staff1.id, svc.id);
			await controller.assignService(staff2.id, svc.id);
			await controller.assignService(staff1.id, svcKeep.id);

			await controller.deleteService(svc.id);

			// staff1 still has svcKeep
			const s1Services = await controller.getStaffServices(staff1.id);
			expect(s1Services).toHaveLength(1);
			expect(s1Services[0].id).toBe(svcKeep.id);

			// staff2 has nothing left
			const s2Services = await controller.getStaffServices(staff2.id);
			expect(s2Services).toHaveLength(0);
		});
	});

	// ── 2. Schedule overlap detection ─────────────────────────

	describe("schedule overlap / replacement", () => {
		it("setting schedule for same staff+day replaces the old times", async () => {
			const staff = await createTestStaff();

			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "13:00",
			});
			const replaced = await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "14:00",
				endTime: "18:00",
			});

			const schedules = await controller.getSchedule(staff.id);
			expect(schedules).toHaveLength(1);
			expect(schedules[0].startTime).toBe("14:00");
			expect(schedules[0].endTime).toBe("18:00");
			expect(schedules[0].id).toBe(replaced.id);
		});

		it("different days for same staff are independent", async () => {
			const staff = await createTestStaff();

			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "13:00",
			});
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "10:00",
				endTime: "14:00",
			});

			const schedules = await controller.getSchedule(staff.id);
			expect(schedules).toHaveLength(2);

			const monday = schedules.find((s) => s.dayOfWeek === 1);
			const tuesday = schedules.find((s) => s.dayOfWeek === 2);
			expect(monday?.startTime).toBe("09:00");
			expect(tuesday?.startTime).toBe("10:00");
		});

		it("same day for different staff members are independent", async () => {
			const staff1 = await createTestStaff({ name: "Alice" });
			const staff2 = await createTestStaff({ name: "Bob" });

			await controller.setSchedule({
				staffId: staff1.id,
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "12:00",
			});
			await controller.setSchedule({
				staffId: staff2.id,
				dayOfWeek: 1,
				startTime: "13:00",
				endTime: "17:00",
			});

			const s1Sched = await controller.getSchedule(staff1.id);
			const s2Sched = await controller.getSchedule(staff2.id);

			expect(s1Sched).toHaveLength(1);
			expect(s1Sched[0].startTime).toBe("09:00");
			expect(s2Sched).toHaveLength(1);
			expect(s2Sched[0].startTime).toBe("13:00");
		});

		it("replacing a schedule preserves the original createdAt", async () => {
			const staff = await createTestStaff();

			const first = await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 3,
				startTime: "08:00",
				endTime: "12:00",
			});
			const second = await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 3,
				startTime: "10:00",
				endTime: "16:00",
			});

			expect(second.createdAt.getTime()).toBe(first.createdAt.getTime());
		});
	});

	// ── 3. Appointment count isolation ────────────────────────

	describe("appointment count isolation", () => {
		it("countAppointments for one staff excludes another's", async () => {
			const svc = await createTestService();
			const staff1 = await createTestStaff({ name: "Alice" });
			const staff2 = await createTestStaff({ name: "Bob" });

			await createTestAppointment(svc.id, staff1.id, {
				startsAt: new Date("2026-04-01T09:00:00Z"),
			});
			await createTestAppointment(svc.id, staff1.id, {
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff2.id, {
				startsAt: new Date("2026-04-01T11:00:00Z"),
			});

			const count1 = await controller.countAppointments({
				staffId: staff1.id,
			});
			const count2 = await controller.countAppointments({
				staffId: staff2.id,
			});
			const total = await controller.countAppointments();

			expect(count1).toBe(2);
			expect(count2).toBe(1);
			expect(total).toBe(3);
		});

		it("countAppointments for one service excludes another's", async () => {
			const svcA = await createTestService({ name: "Massage", price: 80 });
			const svcB = await createTestService({ name: "Facial", price: 60 });
			const staff = await createTestStaff();

			await createTestAppointment(svcA.id, staff.id, {
				startsAt: new Date("2026-04-01T09:00:00Z"),
			});
			await createTestAppointment(svcB.id, staff.id, {
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			await createTestAppointment(svcB.id, staff.id, {
				startsAt: new Date("2026-04-01T11:00:00Z"),
			});

			const countA = await controller.countAppointments({
				serviceId: svcA.id,
			});
			const countB = await controller.countAppointments({
				serviceId: svcB.id,
			});

			expect(countA).toBe(1);
			expect(countB).toBe(2);
		});

		it("stats revenue only includes completed appointments", async () => {
			const svc = await createTestService({ price: 50 });
			const staff = await createTestStaff();

			const a1 = await createTestAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-04-01T09:00:00Z"),
			});
			const a2 = await createTestAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-04-01T10:00:00Z"),
			});
			const a3 = await createTestAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-04-01T11:00:00Z"),
			});

			await controller.updateAppointment(a1.id, { status: "completed" });
			await controller.updateAppointment(a2.id, { status: "confirmed" });
			await controller.cancelAppointment(a3.id);

			const stats = await controller.getStats();
			expect(stats.totalRevenue).toBe(50); // only a1
			expect(stats.completedAppointments).toBe(1);
			expect(stats.confirmedAppointments).toBe(1);
			expect(stats.cancelledAppointments).toBe(1);
		});
	});

	// ── 4. Service deletion cascade ──────────────────────────

	describe("service deletion cascade", () => {
		it("deleting a service removes its staff assignments but not the staff", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			await controller.assignService(staff.id, svc.id);

			await controller.deleteService(svc.id);

			const staffMember = await controller.getStaff(staff.id);
			expect(staffMember).not.toBeNull();

			const services = await controller.getStaffServices(staff.id);
			expect(services).toHaveLength(0);
		});

		it("appointments referencing a deleted service still exist", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id);

			await controller.deleteService(svc.id);

			// The appointment record persists (no cascade to appointments)
			const fetched = await controller.getAppointment(appt.id);
			expect(fetched).not.toBeNull();
			expect(fetched?.serviceId).toBe(svc.id);
		});

		it("creating an appointment for a deleted service throws", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			await controller.deleteService(svc.id);

			await expect(createTestAppointment(svc.id, staff.id)).rejects.toThrow(
				"Service not found",
			);
		});

		it("availability returns empty for a deleted service", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff = await createTestStaff();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			await controller.deleteService(svc.id);

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});
			expect(slots).toHaveLength(0);
		});
	});

	// ── 5. Staff status affects availability ─────────────────

	describe("staff status affects availability", () => {
		it("deactivating staff removes them from available slots", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff = await createTestStaff({ status: "active" });
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			// Slots exist while active
			const before = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});
			expect(before.length).toBeGreaterThan(0);

			// Deactivate
			await controller.updateStaff(staff.id, { status: "inactive" });

			const after = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});
			expect(after).toHaveLength(0);
		});

		it("reactivating staff restores their availability", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff = await createTestStaff({ status: "inactive" });
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "11:00",
			});

			const empty = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});
			expect(empty).toHaveLength(0);

			await controller.updateStaff(staff.id, { status: "active" });

			const restored = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});
			expect(restored).toHaveLength(2);
		});

		it("mixed active/inactive staff only shows active slots", async () => {
			const svc = await createTestService({ duration: 60 });
			const activeStaff = await createTestStaff({
				name: "Active",
				status: "active",
			});
			const inactiveStaff = await createTestStaff({
				name: "Inactive",
				status: "inactive",
			});

			await controller.assignService(activeStaff.id, svc.id);
			await controller.assignService(inactiveStaff.id, svc.id);

			// Both have Tuesday schedules
			for (const sid of [activeStaff.id, inactiveStaff.id]) {
				await controller.setSchedule({
					staffId: sid,
					dayOfWeek: 2,
					startTime: "09:00",
					endTime: "11:00",
				});
			}

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});

			// Only active staff's slots
			expect(slots.length).toBeGreaterThan(0);
			for (const slot of slots) {
				expect(slot.staffId).toBe(activeStaff.id);
			}
		});
	});

	// ── 6. Multiple appointments same slot ───────────────────

	describe("multiple appointments same slot", () => {
		it("booking the same time slot blocks availability for that staff", async () => {
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

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});

			const slotTimes = slots.map((s) => s.startsAt.toISOString());
			expect(slotTimes).not.toContain("2026-03-10T10:00:00.000Z");
			expect(slotTimes).toContain("2026-03-10T09:00:00.000Z");
			expect(slotTimes).toContain("2026-03-10T11:00:00.000Z");
		});

		it("two staff can serve the same time slot independently", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff1 = await createTestStaff({ name: "Alice" });
			const staff2 = await createTestStaff({ name: "Bob" });

			await controller.assignService(staff1.id, svc.id);
			await controller.assignService(staff2.id, svc.id);

			for (const sid of [staff1.id, staff2.id]) {
				await controller.setSchedule({
					staffId: sid,
					dayOfWeek: 2,
					startTime: "09:00",
					endTime: "11:00",
				});
			}

			// Book staff1 at 09:00
			await createTestAppointment(svc.id, staff1.id, {
				startsAt: new Date("2026-03-10T09:00:00Z"),
			});

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});

			// staff1: only 10:00. staff2: 09:00 and 10:00. Total = 3
			const staff1Slots = slots.filter((s) => s.staffId === staff1.id);
			const staff2Slots = slots.filter((s) => s.staffId === staff2.id);

			expect(staff1Slots).toHaveLength(1);
			expect(staff1Slots[0].startsAt.toISOString()).toBe(
				"2026-03-10T10:00:00.000Z",
			);
			expect(staff2Slots).toHaveLength(2);
		});

		it("back-to-back appointments leave no gap slots", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff = await createTestStaff();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			// Fill all 3 slots
			await createTestAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-03-10T09:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-03-10T10:00:00Z"),
			});
			await createTestAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-03-10T11:00:00Z"),
			});

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});
			expect(slots).toHaveLength(0);
		});
	});

	// ── 7. Upcoming appointments ordering ────────────────────

	describe("upcoming appointments ordering", () => {
		it("returns all future pending/confirmed appointments", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			const now = Date.now();
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "day3@test.com",
				startsAt: new Date(now + 3 * 86400000),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "day1@test.com",
				startsAt: new Date(now + 1 * 86400000),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "day5@test.com",
				startsAt: new Date(now + 5 * 86400000),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "day2@test.com",
				startsAt: new Date(now + 2 * 86400000),
			});

			const upcoming = await controller.getUpcomingAppointments();
			expect(upcoming).toHaveLength(4);

			const emails = upcoming.map((a) => a.customerEmail);
			expect(emails).toContain("day1@test.com");
			expect(emails).toContain("day2@test.com");
			expect(emails).toContain("day3@test.com");
			expect(emails).toContain("day5@test.com");
		});

		it("take limits the number of upcoming results", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			const now = Date.now();
			for (let i = 1; i <= 5; i++) {
				await createTestAppointment(svc.id, staff.id, {
					customerEmail: `c${i}@test.com`,
					startsAt: new Date(now + i * 86400000),
				});
			}

			const limited = await controller.getUpcomingAppointments({
				take: 2,
			});
			expect(limited).toHaveLength(2);
		});

		it("excludes completed and no-show from upcoming", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			const now = Date.now();
			const a1 = await createTestAppointment(svc.id, staff.id, {
				customerEmail: "completed@test.com",
				startsAt: new Date(now + 1 * 86400000),
			});
			const a2 = await createTestAppointment(svc.id, staff.id, {
				customerEmail: "noshow@test.com",
				startsAt: new Date(now + 2 * 86400000),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerEmail: "pending@test.com",
				startsAt: new Date(now + 3 * 86400000),
			});

			await controller.updateAppointment(a1.id, {
				status: "completed",
			});
			await controller.updateAppointment(a2.id, { status: "no-show" });

			const upcoming = await controller.getUpcomingAppointments();
			expect(upcoming).toHaveLength(1);
			expect(upcoming[0].customerEmail).toBe("pending@test.com");
		});

		it("upcoming filtered by customerId only returns that customer", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();

			const now = Date.now();
			await createTestAppointment(svc.id, staff.id, {
				customerId: "cust-A",
				customerEmail: "a@test.com",
				startsAt: new Date(now + 1 * 86400000),
			});
			await createTestAppointment(svc.id, staff.id, {
				customerId: "cust-B",
				customerEmail: "b@test.com",
				startsAt: new Date(now + 2 * 86400000),
			});

			const upcoming = await controller.getUpcomingAppointments({
				customerId: "cust-A",
			});
			expect(upcoming).toHaveLength(1);
			expect(upcoming[0].customerId).toBe("cust-A");
		});
	});

	// ── 8. Cancel idempotency ────────────────────────────────

	describe("cancel idempotency", () => {
		it("cancelling an already-cancelled appointment still returns cancelled", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id);

			const first = await controller.cancelAppointment(appt.id);
			expect(first?.status).toBe("cancelled");

			const second = await controller.cancelAppointment(appt.id);
			expect(second?.status).toBe("cancelled");
		});

		it("double-cancel does not create duplicate records", async () => {
			const svc = await createTestService();
			const staff = await createTestStaff();
			const appt = await createTestAppointment(svc.id, staff.id);

			await controller.cancelAppointment(appt.id);
			await controller.cancelAppointment(appt.id);

			const all = await controller.listAppointments();
			expect(all).toHaveLength(1);
			expect(all[0].status).toBe("cancelled");
		});

		it("cancelled appointment frees its availability slot", async () => {
			const svc = await createTestService({ duration: 60 });
			const staff = await createTestStaff();
			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "12:00",
			});

			const appt = await createTestAppointment(svc.id, staff.id, {
				startsAt: new Date("2026-03-10T10:00:00Z"),
			});

			const before = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});
			expect(before).toHaveLength(2);

			await controller.cancelAppointment(appt.id);

			const after = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: new Date("2026-03-10T00:00:00Z"),
			});
			expect(after).toHaveLength(3);
		});

		it("cancelling a non-existent appointment returns null", async () => {
			const result = await controller.cancelAppointment("ghost-id");
			expect(result).toBeNull();
		});
	});
});
