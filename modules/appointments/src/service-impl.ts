import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	Appointment,
	AppointmentController,
	AppointmentStats,
	Schedule,
	Service,
	Staff,
	StaffService,
	TimeSlot,
} from "./service";

function buildFindOptions(opts: {
	where?: Record<string, unknown>;
	orderBy?: Record<string, "asc" | "desc">;
	take?: number | undefined;
	skip?: number | undefined;
}) {
	const result: Record<string, unknown> = {};
	if (opts.where) result.where = opts.where;
	if (opts.orderBy) result.orderBy = opts.orderBy;
	if (opts.take != null) result.take = opts.take;
	if (opts.skip != null) result.skip = opts.skip;
	return result;
}

function parseTime(time: string): { hours: number; minutes: number } {
	const [h, m] = time.split(":").map(Number);
	return { hours: h, minutes: m };
}

function addMinutes(date: Date, minutes: number): Date {
	return new Date(date.getTime() + minutes * 60000);
}

export function createAppointmentController(
	data: ModuleDataService,
): AppointmentController {
	return {
		// ── Services ─────────────────────────────────────────

		async createService(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const svc: Service = {
				id,
				name: params.name,
				slug: params.slug,
				duration: params.duration,
				price: params.price,
				currency: params.currency ?? "USD",
				status: params.status ?? "active",
				maxCapacity: params.maxCapacity ?? 1,
				sortOrder: params.sortOrder ?? 0,
				createdAt: now,
				updatedAt: now,
				...(params.description != null && {
					description: params.description,
				}),
			};
			await data.upsert("service", id, svc as Record<string, unknown>);
			return svc;
		},

		async getService(id) {
			const raw = await data.get("service", id);
			return raw as unknown as Service;
		},

		async getServiceBySlug(slug) {
			const results = (await data.findMany("service", {
				where: { slug },
			})) as unknown as Service[];
			return results[0] ?? null;
		},

		async updateService(id, params) {
			const existing = await data.get("service", id);
			if (!existing) return null;

			const current = existing as unknown as Service;

			const base: Service = {
				id: current.id,
				name: params.name ?? current.name,
				slug: params.slug ?? current.slug,
				duration: params.duration ?? current.duration,
				price: params.price ?? current.price,
				currency: params.currency ?? current.currency,
				status: params.status ?? current.status,
				maxCapacity: params.maxCapacity ?? current.maxCapacity,
				sortOrder: params.sortOrder ?? current.sortOrder,
				createdAt: current.createdAt,
				updatedAt: new Date(),
			};

			const descVal =
				params.description === null
					? null
					: (params.description ?? current.description);
			if (descVal != null) base.description = descVal;

			await data.upsert("service", id, base as Record<string, unknown>);
			return base;
		},

		async deleteService(id) {
			const existing = await data.get("service", id);
			if (!existing) return false;

			// Cascade: remove staff-service assignments
			const assignments = (await data.findMany("staffService", {
				where: { serviceId: id },
			})) as unknown as StaffService[];
			for (const a of assignments) {
				await data.delete("staffService", a.id);
			}

			await data.delete("service", id);
			return true;
		},

		async listServices(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;

			return (await data.findMany(
				"service",
				buildFindOptions({
					where,
					orderBy: { sortOrder: "asc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as Service[];
		},

		async countServices(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;

			const results = (await data.findMany("service", {
				where,
			})) as unknown as Service[];
			return results.length;
		},

		// ── Staff ────────────────────────────────────────────

		async createStaff(params) {
			const id = crypto.randomUUID();
			const now = new Date();
			const member: Staff = {
				id,
				name: params.name,
				email: params.email,
				status: params.status ?? "active",
				createdAt: now,
				updatedAt: now,
				...(params.bio != null && { bio: params.bio }),
			};
			await data.upsert("staff", id, member as Record<string, unknown>);
			return member;
		},

		async getStaff(id) {
			const raw = await data.get("staff", id);
			return raw as unknown as Staff;
		},

		async updateStaff(id, params) {
			const existing = await data.get("staff", id);
			if (!existing) return null;

			const current = existing as unknown as Staff;

			const base: Staff = {
				id: current.id,
				name: params.name ?? current.name,
				email: params.email ?? current.email,
				status: params.status ?? current.status,
				createdAt: current.createdAt,
				updatedAt: new Date(),
			};

			const bioVal = params.bio === null ? null : (params.bio ?? current.bio);
			if (bioVal != null) base.bio = bioVal;

			await data.upsert("staff", id, base as Record<string, unknown>);
			return base;
		},

		async deleteStaff(id) {
			const existing = await data.get("staff", id);
			if (!existing) return false;

			// Cascade: remove assignments
			const assignments = (await data.findMany("staffService", {
				where: { staffId: id },
			})) as unknown as StaffService[];
			for (const a of assignments) {
				await data.delete("staffService", a.id);
			}

			// Cascade: remove schedules
			const schedules = (await data.findMany("schedule", {
				where: { staffId: id },
			})) as unknown as Schedule[];
			for (const s of schedules) {
				await data.delete("schedule", s.id);
			}

			await data.delete("staff", id);
			return true;
		},

		async listStaff(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;

			return (await data.findMany(
				"staff",
				buildFindOptions({
					where,
					orderBy: { name: "asc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as Staff[];
		},

		async countStaff(params) {
			const where: Record<string, unknown> = {};
			if (params?.status !== undefined) where.status = params.status;

			const results = (await data.findMany("staff", {
				where,
			})) as unknown as Staff[];
			return results.length;
		},

		// ── Staff–Service assignments ────────────────────────

		async assignService(staffId, serviceId) {
			// Check for existing assignment
			const existing = (await data.findMany("staffService", {
				where: { staffId, serviceId },
			})) as unknown as StaffService[];

			if (existing.length > 0) return existing[0];

			const id = crypto.randomUUID();
			const assignment: StaffService = {
				id,
				staffId,
				serviceId,
				createdAt: new Date(),
			};
			await data.upsert(
				"staffService",
				id,
				assignment as Record<string, unknown>,
			);
			return assignment;
		},

		async unassignService(staffId, serviceId) {
			const existing = (await data.findMany("staffService", {
				where: { staffId, serviceId },
			})) as unknown as StaffService[];

			if (existing.length === 0) return false;

			for (const entry of existing) {
				await data.delete("staffService", entry.id);
			}
			return true;
		},

		async getStaffServices(staffId) {
			const assignments = (await data.findMany("staffService", {
				where: { staffId },
			})) as unknown as StaffService[];

			const services: Service[] = [];
			for (const a of assignments) {
				const svc = await data.get("service", a.serviceId);
				if (svc) services.push(svc as unknown as Service);
			}
			return services;
		},

		async getServiceStaff(serviceId) {
			const assignments = (await data.findMany("staffService", {
				where: { serviceId },
			})) as unknown as StaffService[];

			const staffMembers: Staff[] = [];
			for (const a of assignments) {
				const member = await data.get("staff", a.staffId);
				if (member) staffMembers.push(member as unknown as Staff);
			}
			return staffMembers;
		},

		// ── Schedules ────────────────────────────────────────

		async setSchedule(params) {
			// Upsert by staffId + dayOfWeek
			const existing = (await data.findMany("schedule", {
				where: { staffId: params.staffId, dayOfWeek: params.dayOfWeek },
			})) as unknown as Schedule[];

			const id = existing[0]?.id ?? crypto.randomUUID();
			const schedule: Schedule = {
				id,
				staffId: params.staffId,
				dayOfWeek: params.dayOfWeek,
				startTime: params.startTime,
				endTime: params.endTime,
				createdAt: existing[0]?.createdAt ?? new Date(),
			};

			await data.upsert("schedule", id, schedule as Record<string, unknown>);
			return schedule;
		},

		async getSchedule(staffId) {
			return (await data.findMany("schedule", {
				where: { staffId },
				orderBy: { dayOfWeek: "asc" },
			})) as unknown as Schedule[];
		},

		async removeSchedule(staffId, dayOfWeek) {
			const existing = (await data.findMany("schedule", {
				where: { staffId, dayOfWeek },
			})) as unknown as Schedule[];

			if (existing.length === 0) return false;

			for (const entry of existing) {
				await data.delete("schedule", entry.id);
			}
			return true;
		},

		// ── Availability ─────────────────────────────────────

		async getAvailableSlots(params) {
			const service = await data.get("service", params.serviceId);
			if (!service) return [];

			const svc = service as unknown as Service;
			if (svc.status !== "active") return [];

			const dayOfWeek = params.date.getUTCDay();

			// Determine which staff to check
			let staffIds: string[];
			if (params.staffId) {
				staffIds = [params.staffId];
			} else {
				const assignments = (await data.findMany("staffService", {
					where: { serviceId: params.serviceId },
				})) as unknown as StaffService[];
				staffIds = assignments.map((a) => a.staffId);
			}

			const slots: TimeSlot[] = [];

			for (const staffId of staffIds) {
				// Check staff is active
				const staffRaw = await data.get("staff", staffId);
				if (!staffRaw) continue;
				const staffMember = staffRaw as unknown as Staff;
				if (staffMember.status !== "active") continue;

				// Get schedule for this day
				const schedules = (await data.findMany("schedule", {
					where: { staffId, dayOfWeek },
				})) as unknown as Schedule[];

				if (schedules.length === 0) continue;

				const sched = schedules[0];
				const start = parseTime(sched.startTime);
				const end = parseTime(sched.endTime);

				// Get existing appointments for this staff on this date
				const dateStart = new Date(params.date);
				dateStart.setUTCHours(0, 0, 0, 0);
				const dateEnd = new Date(params.date);
				dateEnd.setUTCHours(23, 59, 59, 999);

				const existingAppts = (await data.findMany("appointment", {
					where: { staffId },
				})) as unknown as Appointment[];

				const dayAppts = existingAppts.filter(
					(a) =>
						a.status !== "cancelled" &&
						a.startsAt >= dateStart &&
						a.startsAt <= dateEnd,
				);

				// Generate slots
				const slotStart = new Date(params.date);
				slotStart.setUTCHours(start.hours, start.minutes, 0, 0);

				const schedEnd = new Date(params.date);
				schedEnd.setUTCHours(end.hours, end.minutes, 0, 0);

				let cursor = new Date(slotStart);
				while (addMinutes(cursor, svc.duration) <= schedEnd) {
					const slotEnd = addMinutes(cursor, svc.duration);

					// Check for conflicts
					const hasConflict = dayAppts.some(
						(a) => cursor < a.endsAt && slotEnd > a.startsAt,
					);

					if (!hasConflict) {
						slots.push({
							startsAt: new Date(cursor),
							endsAt: new Date(slotEnd),
							staffId,
						});
					}

					cursor = new Date(slotEnd);
				}
			}

			return slots;
		},

		// ── Appointments ─────────────────────────────────────

		async createAppointment(params) {
			const service = await data.get("service", params.serviceId);
			if (!service) throw new Error("Service not found");

			const svc = service as unknown as Service;

			const id = crypto.randomUUID();
			const now = new Date();
			const endsAt = addMinutes(params.startsAt, svc.duration);

			const appt: Appointment = {
				id,
				serviceId: params.serviceId,
				staffId: params.staffId,
				customerName: params.customerName,
				customerEmail: params.customerEmail,
				startsAt: params.startsAt,
				endsAt,
				status: "pending",
				price: svc.price,
				currency: svc.currency,
				createdAt: now,
				updatedAt: now,
				...(params.customerId != null && {
					customerId: params.customerId,
				}),
				...(params.customerPhone != null && {
					customerPhone: params.customerPhone,
				}),
				...(params.notes != null && { notes: params.notes }),
			};

			await data.upsert("appointment", id, appt as Record<string, unknown>);
			return appt;
		},

		async getAppointment(id) {
			const raw = await data.get("appointment", id);
			return raw as unknown as Appointment;
		},

		async updateAppointment(id, params) {
			const existing = await data.get("appointment", id);
			if (!existing) return null;

			const current = existing as unknown as Appointment;

			let endsAt = current.endsAt;
			if (params.startsAt) {
				const service = await data.get("service", current.serviceId);
				if (service) {
					const svc = service as unknown as Service;
					endsAt = addMinutes(params.startsAt, svc.duration);
				}
			}

			const base: Appointment = {
				id: current.id,
				serviceId: current.serviceId,
				staffId: params.staffId ?? current.staffId,
				customerName: current.customerName,
				customerEmail: current.customerEmail,
				startsAt: params.startsAt ?? current.startsAt,
				endsAt,
				status: params.status ?? current.status,
				price: current.price,
				currency: current.currency,
				createdAt: current.createdAt,
				updatedAt: new Date(),
			};

			if (current.customerId != null) base.customerId = current.customerId;
			if (current.customerPhone != null)
				base.customerPhone = current.customerPhone;

			const notesVal =
				params.notes === null ? null : (params.notes ?? current.notes);
			if (notesVal != null) base.notes = notesVal;

			await data.upsert("appointment", id, base as Record<string, unknown>);
			return base;
		},

		async cancelAppointment(id) {
			return this.updateAppointment(id, { status: "cancelled" });
		},

		async listAppointments(params) {
			const where: Record<string, unknown> = {};
			if (params?.staffId !== undefined) where.staffId = params.staffId;
			if (params?.serviceId !== undefined) where.serviceId = params.serviceId;
			if (params?.customerId !== undefined)
				where.customerId = params.customerId;
			if (params?.status !== undefined) where.status = params.status;

			const all = (await data.findMany(
				"appointment",
				buildFindOptions({
					where,
					orderBy: { startsAt: "desc" },
					take: params?.take,
					skip: params?.skip,
				}),
			)) as unknown as Appointment[];

			// Apply date range filters in memory (ModuleDataService doesn't support gte/lte)
			return all.filter((a) => {
				if (params?.from && a.startsAt < params.from) return false;
				if (params?.to && a.startsAt > params.to) return false;
				return true;
			});
		},

		async countAppointments(params) {
			const where: Record<string, unknown> = {};
			if (params?.staffId !== undefined) where.staffId = params.staffId;
			if (params?.serviceId !== undefined) where.serviceId = params.serviceId;
			if (params?.customerId !== undefined)
				where.customerId = params.customerId;
			if (params?.status !== undefined) where.status = params.status;

			const all = (await data.findMany("appointment", {
				where,
			})) as unknown as Appointment[];

			return all.filter((a) => {
				if (params?.from && a.startsAt < params.from) return false;
				if (params?.to && a.startsAt > params.to) return false;
				return true;
			}).length;
		},

		async getUpcomingAppointments(params) {
			const where: Record<string, unknown> = {};
			if (params?.staffId !== undefined) where.staffId = params.staffId;
			if (params?.customerId !== undefined)
				where.customerId = params.customerId;

			const all = (await data.findMany(
				"appointment",
				buildFindOptions({
					where,
					orderBy: { startsAt: "asc" },
				}),
			)) as unknown as Appointment[];

			const now = new Date();
			const upcoming = all.filter(
				(a) =>
					a.startsAt > now &&
					a.status !== "cancelled" &&
					a.status !== "completed" &&
					a.status !== "no-show",
			);

			if (params?.take) return upcoming.slice(0, params.take);
			return upcoming;
		},

		// ── Stats ────────────────────────────────────────────

		async getStats() {
			const allAppts = (await data.findMany(
				"appointment",
				{},
			)) as unknown as Appointment[];
			const allServices = (await data.findMany(
				"service",
				{},
			)) as unknown as Service[];
			const allStaff = (await data.findMany("staff", {})) as unknown as Staff[];

			const stats: AppointmentStats = {
				totalAppointments: allAppts.length,
				pendingAppointments: allAppts.filter((a) => a.status === "pending")
					.length,
				confirmedAppointments: allAppts.filter((a) => a.status === "confirmed")
					.length,
				cancelledAppointments: allAppts.filter((a) => a.status === "cancelled")
					.length,
				completedAppointments: allAppts.filter((a) => a.status === "completed")
					.length,
				noShowAppointments: allAppts.filter((a) => a.status === "no-show")
					.length,
				totalServices: allServices.length,
				totalStaff: allStaff.length,
				totalRevenue: allAppts
					.filter((a) => a.status === "completed")
					.reduce((sum, a) => sum + a.price, 0),
			};
			return stats;
		},
	};
}
