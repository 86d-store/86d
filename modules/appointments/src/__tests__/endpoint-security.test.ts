import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createAppointmentController } from "../service-impl";

/**
 * Security regression tests for appointments endpoints.
 *
 * Focuses on:
 * - Cascade deletion correctness (staff/service removal cleans up associations)
 * - Idempotent assignment (assigning the same service/staff pair twice is safe)
 * - Available slots filtering (only active services/staff appear)
 * - Upcoming appointments filtering (cancelled/completed/no-show are excluded)
 * - cancelAppointment alias behaviour
 */

describe("appointments endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createAppointmentController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createAppointmentController(mockData);
	});

	// ── helpers ──────────────────────────────────────────────────────────

	async function makeService(
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

	async function makeStaff(
		overrides: Partial<Parameters<typeof controller.createStaff>[0]> = {},
	) {
		return controller.createStaff({
			name: "Jane Smith",
			email: "jane@example.com",
			...overrides,
		});
	}

	async function makeAppointment(
		serviceId: string,
		staffId: string,
		overrides: Partial<Parameters<typeof controller.createAppointment>[0]> = {},
	) {
		return controller.createAppointment({
			serviceId,
			staffId,
			customerName: "John Doe",
			customerEmail: "john@example.com",
			startsAt: new Date("2026-06-01T10:00:00Z"),
			...overrides,
		});
	}

	// ── cascade deletion: staff ───────────────────────────────────────────

	describe("cascade deletion: deleting staff", () => {
		it("removes staff-service assignments when staff is deleted", async () => {
			const svc = await makeService();
			const staff = await makeStaff();
			await controller.assignService(staff.id, svc.id);

			// Verify assignment exists
			const before = await controller.getStaffServices(staff.id);
			expect(before).toHaveLength(1);

			await controller.deleteStaff(staff.id);

			// The staff is gone
			const found = await controller.getStaff(staff.id);
			expect(found).toBeNull();

			// A new controller lookup for assignments should be empty
			// (the cascade deleted the staffService record)
			const after = await controller.getServiceStaff(svc.id);
			expect(after).toHaveLength(0);
		});

		it("removes schedules when staff is deleted", async () => {
			const staff = await makeStaff();
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 1,
				startTime: "09:00",
				endTime: "17:00",
			});
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: 2,
				startTime: "09:00",
				endTime: "17:00",
			});

			// Verify schedules exist
			const before = await controller.getSchedule(staff.id);
			expect(before).toHaveLength(2);

			await controller.deleteStaff(staff.id);

			// Schedules should be purged
			const after = await controller.getSchedule(staff.id);
			expect(after).toHaveLength(0);
		});

		it("does not affect other staff schedules or assignments", async () => {
			const svc = await makeService();
			const staff1 = await makeStaff({ email: "s1@example.com" });
			const staff2 = await makeStaff({
				name: "Bob Jones",
				email: "s2@example.com",
			});

			await controller.assignService(staff1.id, svc.id);
			await controller.assignService(staff2.id, svc.id);
			await controller.setSchedule({
				staffId: staff2.id,
				dayOfWeek: 3,
				startTime: "08:00",
				endTime: "16:00",
			});

			await controller.deleteStaff(staff1.id);

			// staff2's assignment should still exist
			const staff2Services = await controller.getStaffServices(staff2.id);
			expect(staff2Services).toHaveLength(1);

			// staff2's schedule should still exist
			const staff2Schedules = await controller.getSchedule(staff2.id);
			expect(staff2Schedules).toHaveLength(1);
		});
	});

	// ── cascade deletion: service ─────────────────────────────────────────

	describe("cascade deletion: deleting service", () => {
		it("removes staff-service assignments when service is deleted", async () => {
			const svc = await makeService();
			const staff1 = await makeStaff({ email: "s1@example.com" });
			const staff2 = await makeStaff({
				name: "Bob Jones",
				email: "s2@example.com",
			});

			await controller.assignService(staff1.id, svc.id);
			await controller.assignService(staff2.id, svc.id);

			// Verify assignments exist
			const before = await controller.getServiceStaff(svc.id);
			expect(before).toHaveLength(2);

			await controller.deleteService(svc.id);

			// Assignments should be gone
			const after1 = await controller.getStaffServices(staff1.id);
			expect(after1).toHaveLength(0);

			const after2 = await controller.getStaffServices(staff2.id);
			expect(after2).toHaveLength(0);
		});

		it("does not affect other services' assignments", async () => {
			const svc1 = await makeService({ slug: "svc-1" });
			const svc2 = await makeService({ name: "Massage", slug: "svc-2" });
			const staff = await makeStaff();

			await controller.assignService(staff.id, svc1.id);
			await controller.assignService(staff.id, svc2.id);

			await controller.deleteService(svc1.id);

			// svc2 assignment must survive
			const remaining = await controller.getStaffServices(staff.id);
			expect(remaining).toHaveLength(1);
			expect(remaining[0].id).toBe(svc2.id);
		});
	});

	// ── idempotent assignment ─────────────────────────────────────────────

	describe("idempotent staff-service assignment", () => {
		it("assigning the same pair twice returns the existing record and does not duplicate", async () => {
			const svc = await makeService();
			const staff = await makeStaff();

			const first = await controller.assignService(staff.id, svc.id);
			const second = await controller.assignService(staff.id, svc.id);

			// Should return the same assignment
			expect(second.id).toBe(first.id);

			// Only one record should exist
			const services = await controller.getStaffServices(staff.id);
			expect(services).toHaveLength(1);
		});
	});

	// ── available slots filtering ─────────────────────────────────────────

	describe("available slots filtering", () => {
		// Monday 2026-06-01 (UTC weekday = 1)
		const monday = new Date("2026-06-01T00:00:00Z");

		it("returns no slots when service is inactive", async () => {
			const svc = await makeService({ status: "inactive" });
			const staff = await makeStaff();

			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: monday.getUTCDay(),
				startTime: "09:00",
				endTime: "17:00",
			});

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: monday,
			});

			expect(slots).toHaveLength(0);
		});

		it("returns no slots when staff is inactive", async () => {
			const svc = await makeService();
			const staff = await makeStaff({ status: "inactive" });

			await controller.assignService(staff.id, svc.id);
			await controller.setSchedule({
				staffId: staff.id,
				dayOfWeek: monday.getUTCDay(),
				startTime: "09:00",
				endTime: "17:00",
			});

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: monday,
			});

			expect(slots).toHaveLength(0);
		});

		it("returns slots only for active service + active staff", async () => {
			const svc = await makeService({ duration: 60 });
			const activeStaff = await makeStaff({ email: "active@example.com" });
			const inactiveStaff = await makeStaff({
				name: "Inactive",
				email: "inactive@example.com",
				status: "inactive",
			});

			await controller.assignService(activeStaff.id, svc.id);
			await controller.assignService(inactiveStaff.id, svc.id);

			const dayOfWeek = monday.getUTCDay();
			await controller.setSchedule({
				staffId: activeStaff.id,
				dayOfWeek,
				startTime: "09:00",
				endTime: "11:00",
			});
			await controller.setSchedule({
				staffId: inactiveStaff.id,
				dayOfWeek,
				startTime: "09:00",
				endTime: "11:00",
			});

			const slots = await controller.getAvailableSlots({
				serviceId: svc.id,
				date: monday,
			});

			// Only slots for activeStaff (2 × 60-min in a 2-hour window)
			expect(slots.length).toBeGreaterThan(0);
			for (const slot of slots) {
				expect(slot.staffId).toBe(activeStaff.id);
			}
		});
	});

	// ── upcoming appointments filtering ──────────────────────────────────

	describe("upcoming appointments filtering", () => {
		it("excludes cancelled appointments from upcoming list", async () => {
			const svc = await makeService();
			const staff = await makeStaff();

			const futureDate = new Date(Date.now() + 3_600_000);
			const appt = await makeAppointment(svc.id, staff.id, {
				startsAt: futureDate,
			});
			await controller.cancelAppointment(appt.id);

			const upcoming = await controller.getUpcomingAppointments({});
			expect(upcoming).toHaveLength(0);
		});

		it("excludes completed appointments from upcoming list", async () => {
			const svc = await makeService();
			const staff = await makeStaff();

			const futureDate = new Date(Date.now() + 3_600_000);
			const appt = await makeAppointment(svc.id, staff.id, {
				startsAt: futureDate,
			});
			await controller.updateAppointment(appt.id, { status: "completed" });

			const upcoming = await controller.getUpcomingAppointments({});
			expect(upcoming).toHaveLength(0);
		});

		it("excludes no-show appointments from upcoming list", async () => {
			const svc = await makeService();
			const staff = await makeStaff();

			const futureDate = new Date(Date.now() + 3_600_000);
			const appt = await makeAppointment(svc.id, staff.id, {
				startsAt: futureDate,
			});
			await controller.updateAppointment(appt.id, { status: "no-show" });

			const upcoming = await controller.getUpcomingAppointments({});
			expect(upcoming).toHaveLength(0);
		});

		it("excludes past appointments from upcoming list", async () => {
			const svc = await makeService();
			const staff = await makeStaff();

			const pastDate = new Date(Date.now() - 3_600_000);
			await makeAppointment(svc.id, staff.id, { startsAt: pastDate });

			const upcoming = await controller.getUpcomingAppointments({});
			expect(upcoming).toHaveLength(0);
		});

		it("includes only pending/confirmed future appointments", async () => {
			const svc = await makeService();
			const staff = await makeStaff();

			const future1 = new Date(Date.now() + 3_600_000);
			const future2 = new Date(Date.now() + 7_200_000);
			const future3 = new Date(Date.now() + 10_800_000);

			await makeAppointment(svc.id, staff.id, { startsAt: future1 }); // pending
			const confirmed = await makeAppointment(svc.id, staff.id, {
				startsAt: future2,
			});
			await controller.updateAppointment(confirmed.id, {
				status: "confirmed",
			});
			const cancelled = await makeAppointment(svc.id, staff.id, {
				startsAt: future3,
			});
			await controller.cancelAppointment(cancelled.id);

			const upcoming = await controller.getUpcomingAppointments({});
			expect(upcoming).toHaveLength(2);
			for (const a of upcoming) {
				expect(["pending", "confirmed"]).toContain(a.status);
			}
		});
	});

	// ── cancelAppointment alias ───────────────────────────────────────────

	describe("cancelAppointment alias", () => {
		it("sets appointment status to cancelled", async () => {
			const svc = await makeService();
			const staff = await makeStaff();
			const appt = await makeAppointment(svc.id, staff.id);

			expect(appt.status).toBe("pending");

			const cancelled = await controller.cancelAppointment(appt.id);
			expect(cancelled?.status).toBe("cancelled");
		});

		it("returns null when appointment does not exist", async () => {
			const result = await controller.cancelAppointment("nonexistent-id");
			expect(result).toBeNull();
		});

		it("preserves all other appointment fields after cancel", async () => {
			const svc = await makeService();
			const staff = await makeStaff();
			const appt = await makeAppointment(svc.id, staff.id, {
				notes: "VIP customer",
			});

			const cancelled = await controller.cancelAppointment(appt.id);
			expect(cancelled?.customerName).toBe(appt.customerName);
			expect(cancelled?.customerEmail).toBe(appt.customerEmail);
			expect(cancelled?.serviceId).toBe(appt.serviceId);
			expect(cancelled?.staffId).toBe(appt.staffId);
			expect(cancelled?.price).toBe(appt.price);
		});
	});
});
