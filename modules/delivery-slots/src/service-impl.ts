import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	AvailableSlotsParams,
	BookSlotParams,
	CreateBlackoutParams,
	CreateScheduleParams,
	DeliveryBlackout,
	DeliveryBooking,
	DeliverySchedule,
	DeliverySlotsController,
	DeliverySlotsSummary,
	ListBookingsParams,
	ListSchedulesParams,
	SlotAvailability,
	UpdateScheduleParams,
} from "./service";

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function validateTime(value: string, label: string): void {
	if (!TIME_RE.test(value)) {
		throw new Error(`${label} must be in HH:MM 24-hour format`);
	}
}

function validateDate(value: string, label: string): void {
	if (!DATE_RE.test(value)) {
		throw new Error(`${label} must be in YYYY-MM-DD format`);
	}
}

function validateDayOfWeek(day: number): void {
	if (!Number.isInteger(day) || day < 0 || day > 6) {
		throw new Error(
			"Day of week must be an integer from 0 (Sunday) to 6 (Saturday)",
		);
	}
}

function getDayOfWeek(dateStr: string): number {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day).getDay();
}

export function createDeliverySlotsController(
	data: ModuleDataService,
): DeliverySlotsController {
	async function getScheduleRecord(
		id: string,
	): Promise<DeliverySchedule | null> {
		const raw = await data.get("deliverySchedule", id);
		return raw ? (raw as unknown as DeliverySchedule) : null;
	}

	async function updateScheduleRecord(
		id: string,
		updates: Record<string, unknown>,
	): Promise<DeliverySchedule | null> {
		const existing = await data.get("deliverySchedule", id);
		if (!existing) return null;
		const updated = {
			...(existing as Record<string, unknown>),
			...updates,
			updatedAt: new Date(),
		};
		await data.upsert("deliverySchedule", id, updated);
		return updated as unknown as DeliverySchedule;
	}

	return {
		// ── Schedule CRUD ─────────────────────────────────────────────

		async createSchedule(
			params: CreateScheduleParams,
		): Promise<DeliverySchedule> {
			if (!params.name.trim()) {
				throw new Error("Schedule name is required");
			}
			validateDayOfWeek(params.dayOfWeek);
			validateTime(params.startTime, "Start time");
			validateTime(params.endTime, "End time");
			if (params.startTime >= params.endTime) {
				throw new Error("Start time must be before end time");
			}
			if (!Number.isInteger(params.capacity) || params.capacity < 1) {
				throw new Error("Capacity must be a positive integer");
			}
			if (
				params.surchargeInCents !== undefined &&
				params.surchargeInCents < 0
			) {
				throw new Error("Surcharge cannot be negative");
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const schedule: DeliverySchedule = {
				id,
				name: params.name.trim(),
				dayOfWeek: params.dayOfWeek,
				startTime: params.startTime,
				endTime: params.endTime,
				capacity: params.capacity,
				surchargeInCents: params.surchargeInCents ?? 0,
				active: params.active ?? true,
				sortOrder: params.sortOrder ?? 0,
				createdAt: now,
				updatedAt: now,
			};

			await data.upsert(
				"deliverySchedule",
				id,
				schedule as unknown as Record<string, unknown>,
			);
			return schedule;
		},

		async updateSchedule(
			id: string,
			params: UpdateScheduleParams,
		): Promise<DeliverySchedule | null> {
			const existing = await getScheduleRecord(id);
			if (!existing) return null;

			if (params.name !== undefined && !params.name.trim()) {
				throw new Error("Schedule name cannot be empty");
			}
			if (params.dayOfWeek !== undefined) {
				validateDayOfWeek(params.dayOfWeek);
			}
			if (params.startTime !== undefined) {
				validateTime(params.startTime, "Start time");
			}
			if (params.endTime !== undefined) {
				validateTime(params.endTime, "End time");
			}

			const newStart = params.startTime ?? existing.startTime;
			const newEnd = params.endTime ?? existing.endTime;
			if (newStart >= newEnd) {
				throw new Error("Start time must be before end time");
			}

			if (
				params.capacity !== undefined &&
				(!Number.isInteger(params.capacity) || params.capacity < 1)
			) {
				throw new Error("Capacity must be a positive integer");
			}
			if (
				params.surchargeInCents !== undefined &&
				params.surchargeInCents < 0
			) {
				throw new Error("Surcharge cannot be negative");
			}

			const updates: Record<string, unknown> = {};
			if (params.name !== undefined) updates.name = params.name.trim();
			if (params.dayOfWeek !== undefined) updates.dayOfWeek = params.dayOfWeek;
			if (params.startTime !== undefined) updates.startTime = params.startTime;
			if (params.endTime !== undefined) updates.endTime = params.endTime;
			if (params.capacity !== undefined) updates.capacity = params.capacity;
			if (params.surchargeInCents !== undefined)
				updates.surchargeInCents = params.surchargeInCents;
			if (params.active !== undefined) updates.active = params.active;
			if (params.sortOrder !== undefined) updates.sortOrder = params.sortOrder;

			return updateScheduleRecord(id, updates);
		},

		async getSchedule(id: string): Promise<DeliverySchedule | null> {
			return getScheduleRecord(id);
		},

		async listSchedules(
			params?: ListSchedulesParams,
		): Promise<DeliverySchedule[]> {
			const where: Record<string, unknown> = {};
			if (params?.dayOfWeek !== undefined) where.dayOfWeek = params.dayOfWeek;
			if (params?.active !== undefined) where.active = params.active;

			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where,
				orderBy: { sortOrder: "asc" },
			};
			if (params?.take != null) query.take = params.take;
			if (params?.skip != null) query.skip = params.skip;

			const raw = await data.findMany("deliverySchedule", query);
			return raw as unknown as DeliverySchedule[];
		},

		async deleteSchedule(id: string): Promise<boolean> {
			const existing = await data.get("deliverySchedule", id);
			if (!existing) return false;
			await data.delete("deliverySchedule", id);
			return true;
		},

		// ── Booking management ────────────────────────────────────────

		async bookSlot(params: BookSlotParams): Promise<DeliveryBooking> {
			if (!params.orderId) {
				throw new Error("Order ID is required");
			}
			validateDate(params.deliveryDate, "Delivery date");

			const schedule = await getScheduleRecord(params.scheduleId);
			if (!schedule) {
				throw new Error("Delivery schedule not found");
			}
			if (!schedule.active) {
				throw new Error("Delivery schedule is not available");
			}

			// Verify the date matches the schedule's day of week
			const dow = getDayOfWeek(params.deliveryDate);
			if (dow !== schedule.dayOfWeek) {
				throw new Error(
					"Delivery date does not match the schedule's day of week",
				);
			}

			// Check for blackout
			const blackouts = await data.findMany("deliveryBlackout", {
				where: { date: params.deliveryDate },
			});
			if (blackouts.length > 0) {
				throw new Error("Delivery is not available on this date");
			}

			// Check for duplicate booking on the same order
			const existingOrderBookings = await data.findMany("deliveryBooking", {
				where: { orderId: params.orderId },
			});
			const activeOrderBooking = (
				existingOrderBookings as unknown as DeliveryBooking[]
			).find((b) => b.status === "confirmed");
			if (activeOrderBooking) {
				throw new Error("Order already has a confirmed delivery booking");
			}

			// Check capacity
			const dateBookings = await data.findMany("deliveryBooking", {
				where: {
					scheduleId: params.scheduleId,
					deliveryDate: params.deliveryDate,
				},
			});
			const confirmedCount = (
				dateBookings as unknown as DeliveryBooking[]
			).filter((b) => b.status === "confirmed").length;
			if (confirmedCount >= schedule.capacity) {
				throw new Error("Delivery slot is fully booked");
			}

			const id = crypto.randomUUID();
			const now = new Date();

			const booking: DeliveryBooking = {
				id,
				scheduleId: params.scheduleId,
				deliveryDate: params.deliveryDate,
				orderId: params.orderId,
				scheduleName: schedule.name,
				startTime: schedule.startTime,
				endTime: schedule.endTime,
				surchargeInCents: schedule.surchargeInCents,
				status: "confirmed",
				createdAt: now,
				updatedAt: now,
				...(params.customerId != null && { customerId: params.customerId }),
				...(params.instructions != null && {
					instructions: params.instructions,
				}),
			};

			await data.upsert(
				"deliveryBooking",
				id,
				booking as unknown as Record<string, unknown>,
			);
			return booking;
		},

		async cancelBooking(id: string): Promise<DeliveryBooking | null> {
			const raw = await data.get("deliveryBooking", id);
			if (!raw) return null;

			const booking = raw as unknown as DeliveryBooking;
			if (booking.status === "cancelled") {
				throw new Error("Booking is already cancelled");
			}

			const updated = {
				...(raw as Record<string, unknown>),
				status: "cancelled",
				updatedAt: new Date(),
			};
			await data.upsert("deliveryBooking", id, updated);
			return updated as unknown as DeliveryBooking;
		},

		async getBooking(id: string): Promise<DeliveryBooking | null> {
			const raw = await data.get("deliveryBooking", id);
			return raw ? (raw as unknown as DeliveryBooking) : null;
		},

		async getOrderBooking(orderId: string): Promise<DeliveryBooking | null> {
			const raw = await data.findMany("deliveryBooking", {
				where: { orderId },
			});
			const bookings = raw as unknown as DeliveryBooking[];
			return bookings.find((b) => b.status === "confirmed") ?? null;
		},

		async listBookings(
			params?: ListBookingsParams,
		): Promise<DeliveryBooking[]> {
			const where: Record<string, unknown> = {};
			if (params?.deliveryDate !== undefined)
				where.deliveryDate = params.deliveryDate;
			if (params?.orderId !== undefined) where.orderId = params.orderId;
			if (params?.customerId !== undefined)
				where.customerId = params.customerId;
			if (params?.status !== undefined) where.status = params.status;

			const query: {
				where: Record<string, unknown>;
				orderBy: Record<string, "asc" | "desc">;
				take?: number;
				skip?: number;
			} = {
				where,
				orderBy: { createdAt: "desc" },
			};
			if (params?.take != null) query.take = params.take;
			if (params?.skip != null) query.skip = params.skip;

			const raw = await data.findMany("deliveryBooking", query);
			return raw as unknown as DeliveryBooking[];
		},

		// ── Availability ──────────────────────────────────────────────

		async getAvailableSlots(
			params: AvailableSlotsParams,
		): Promise<SlotAvailability[]> {
			validateDate(params.date, "Date");

			// Check blackout
			const blackouts = await data.findMany("deliveryBlackout", {
				where: { date: params.date },
			});
			if (blackouts.length > 0) return [];

			const dow = getDayOfWeek(params.date);

			const schedules = (await data.findMany("deliverySchedule", {
				where: { dayOfWeek: dow, active: true },
				orderBy: { sortOrder: "asc" },
			})) as unknown as DeliverySchedule[];

			const results: SlotAvailability[] = [];
			for (const schedule of schedules) {
				const bookings = await data.findMany("deliveryBooking", {
					where: { scheduleId: schedule.id, deliveryDate: params.date },
				});
				const confirmed = (bookings as unknown as DeliveryBooking[]).filter(
					(b) => b.status === "confirmed",
				).length;
				const remaining = schedule.capacity - confirmed;

				results.push({
					schedule,
					date: params.date,
					booked: confirmed,
					remaining,
					available: remaining > 0,
				});
			}

			return results;
		},

		async getSlotBookingCount(
			scheduleId: string,
			date: string,
		): Promise<number> {
			validateDate(date, "Date");
			const bookings = await data.findMany("deliveryBooking", {
				where: { scheduleId, deliveryDate: date },
			});
			return (bookings as unknown as DeliveryBooking[]).filter(
				(b) => b.status === "confirmed",
			).length;
		},

		// ── Blackout dates ────────────────────────────────────────────

		async createBlackout(
			params: CreateBlackoutParams,
		): Promise<DeliveryBlackout> {
			validateDate(params.date, "Blackout date");

			// Prevent duplicate blackout for the same date
			const existing = await data.findMany("deliveryBlackout", {
				where: { date: params.date },
			});
			if (existing.length > 0) {
				throw new Error("Blackout already exists for this date");
			}

			const id = crypto.randomUUID();

			const blackout: DeliveryBlackout = {
				id,
				date: params.date,
				createdAt: new Date(),
				...(params.reason != null && { reason: params.reason }),
			};

			await data.upsert(
				"deliveryBlackout",
				id,
				blackout as unknown as Record<string, unknown>,
			);
			return blackout;
		},

		async deleteBlackout(id: string): Promise<boolean> {
			const existing = await data.get("deliveryBlackout", id);
			if (!existing) return false;
			await data.delete("deliveryBlackout", id);
			return true;
		},

		async listBlackouts(): Promise<DeliveryBlackout[]> {
			const raw = await data.findMany("deliveryBlackout", {
				where: {},
				orderBy: { date: "asc" },
			});
			return raw as unknown as DeliveryBlackout[];
		},

		async isBlackoutDate(date: string): Promise<boolean> {
			validateDate(date, "Date");
			const raw = await data.findMany("deliveryBlackout", {
				where: { date },
			});
			return raw.length > 0;
		},

		// ── Analytics ─────────────────────────────────────────────────

		async getSummary(): Promise<DeliverySlotsSummary> {
			const allSchedules = (await data.findMany("deliverySchedule", {
				where: {},
			})) as unknown as DeliverySchedule[];
			const allBookings = (await data.findMany("deliveryBooking", {
				where: {},
			})) as unknown as DeliveryBooking[];
			const allBlackouts = await data.findMany("deliveryBlackout", {
				where: {},
			});

			const confirmed = allBookings.filter((b) => b.status === "confirmed");
			const cancelled = allBookings.filter((b) => b.status === "cancelled");

			return {
				totalSchedules: allSchedules.length,
				activeSchedules: allSchedules.filter((s) => s.active).length,
				totalBookings: allBookings.length,
				confirmedBookings: confirmed.length,
				cancelledBookings: cancelled.length,
				totalSurchargeRevenue: confirmed.reduce(
					(sum, b) => sum + b.surchargeInCents,
					0,
				),
				blackoutDates: allBlackouts.length,
			};
		},
	};
}
