import { describe, expect, it } from "vitest";
import {
	isWithinBusinessHours,
	validateBusinessHours,
} from "../business-hours";
import type { BusinessHours } from "../service";

describe("business hours", () => {
	describe("multiple windows per day", () => {
		const hoursWithMultipleWindows: BusinessHours = {
			timezone: "America/Chicago",
			schedule: {
				monday: {
					windows: [
						{ open: "07:00", close: "15:00" },
						{ open: "18:00", close: "23:00" },
					],
				},
			},
		};

		it("returns open during first window", () => {
			const date = new Date("2026-10-19T10:30:00"); // Monday 10:30 AM
			const result = isWithinBusinessHours(hoursWithMultipleWindows, date);
			expect(result.isOpen).toBe(true);
			expect(result.reason).toBe("within_window");
		});

		it("returns open during second window", () => {
			const date = new Date("2026-10-19T20:00:00"); // Monday 8 PM
			const result = isWithinBusinessHours(hoursWithMultipleWindows, date);
			expect(result.isOpen).toBe(true);
			expect(result.reason).toBe("within_window");
		});

		it("returns closed between windows", () => {
			const date = new Date("2026-10-19T16:00:00"); // Monday 4 PM
			const result = isWithinBusinessHours(hoursWithMultipleWindows, date);
			expect(result.isOpen).toBe(false);
			expect(result.reason).toBe("outside_hours");
		});

		it("returns closed before first window", () => {
			const date = new Date("2026-10-19T06:00:00"); // Monday 6 AM
			const result = isWithinBusinessHours(hoursWithMultipleWindows, date);
			expect(result.isOpen).toBe(false);
			expect(result.reason).toBe("outside_hours");
		});

		it("returns closed after last window", () => {
			const date = new Date("2026-10-19T23:30:00"); // Monday 11:30 PM
			const result = isWithinBusinessHours(hoursWithMultipleWindows, date);
			expect(result.isOpen).toBe(false);
			expect(result.reason).toBe("outside_hours");
		});
	});

	describe("midnight crossing windows", () => {
		const hoursWithMidnightCrossing: BusinessHours = {
			timezone: "America/Chicago",
			schedule: {
				friday: {
					windows: [
						{ open: "07:00", close: "15:00" },
						{ open: "18:00", close: "02:00" }, // crosses midnight into Saturday
					],
				},
				saturday: {
					windows: [
						{ open: "07:00", close: "15:00" },
						{ open: "18:00", close: "02:00" }, // crosses midnight into Sunday
					],
				},
				sunday: {
					windows: [{ open: "07:00", close: "15:00" }],
				},
			},
		};

		it("returns open during Friday evening before midnight", () => {
			const date = new Date("2026-10-23T22:00:00"); // Friday 10 PM
			const result = isWithinBusinessHours(hoursWithMidnightCrossing, date);
			expect(result.isOpen).toBe(true);
			expect(result.reason).toBe("within_window");
		});

		it("returns open on Saturday early morning (Friday overnight window)", () => {
			const date = new Date("2026-10-24T01:00:00"); // Saturday 1 AM
			const result = isWithinBusinessHours(hoursWithMidnightCrossing, date);
			expect(result.isOpen).toBe(true);
			expect(result.reason).toBe("within_overnight_window");
		});

		it("returns closed on Saturday at 3 AM (after Friday overnight closes)", () => {
			const date = new Date("2026-10-24T03:00:00"); // Saturday 3 AM
			const result = isWithinBusinessHours(hoursWithMidnightCrossing, date);
			expect(result.isOpen).toBe(false);
			expect(result.reason).toBe("outside_hours");
		});

		it("returns open during Saturday evening before midnight", () => {
			const date = new Date("2026-10-24T23:00:00"); // Saturday 11 PM
			const result = isWithinBusinessHours(hoursWithMidnightCrossing, date);
			expect(result.isOpen).toBe(true);
			expect(result.reason).toBe("within_window");
		});

		it("returns open on Sunday early morning (Saturday overnight window)", () => {
			const date = new Date("2026-10-25T01:30:00"); // Sunday 1:30 AM
			const result = isWithinBusinessHours(hoursWithMidnightCrossing, date);
			expect(result.isOpen).toBe(true);
			expect(result.reason).toBe("within_overnight_window");
		});

		it("returns closed on Sunday at 2 AM exactly (boundary)", () => {
			const date = new Date("2026-10-25T02:00:00"); // Sunday 2 AM
			const result = isWithinBusinessHours(hoursWithMidnightCrossing, date);
			expect(result.isOpen).toBe(false);
			expect(result.reason).toBe("outside_hours");
		});
	});

	describe("closed days", () => {
		const hoursWithClosedDay: BusinessHours = {
			timezone: "America/Chicago",
			schedule: {
				monday: { closed: true },
				tuesday: {
					windows: [{ open: "09:00", close: "17:00" }],
				},
			},
		};

		it("returns closed on a day marked as closed", () => {
			const date = new Date("2026-10-19T12:00:00"); // Monday noon
			const result = isWithinBusinessHours(hoursWithClosedDay, date);
			expect(result.isOpen).toBe(false);
			expect(result.reason).toBe("closed_today");
		});

		it("returns open during hours on an open day", () => {
			const date = new Date("2026-10-20T12:00:00"); // Tuesday noon
			const result = isWithinBusinessHours(hoursWithClosedDay, date);
			expect(result.isOpen).toBe(true);
			expect(result.reason).toBe("within_window");
		});
	});

	describe("Demo Cafe schedule (full week with midnight crossing)", () => {
		const demoCafeHours: BusinessHours = {
			timezone: "America/Chicago",
			schedule: {
				sunday: {
					windows: [
						{ open: "07:00", close: "15:00" },
						{ open: "18:00", close: "24:00" },
					],
				},
				monday: {
					windows: [
						{ open: "07:00", close: "15:00" },
						{ open: "18:00", close: "24:00" },
					],
				},
				tuesday: {
					windows: [
						{ open: "07:00", close: "15:00" },
						{ open: "18:00", close: "24:00" },
					],
				},
				wednesday: {
					windows: [
						{ open: "07:00", close: "15:00" },
						{ open: "18:00", close: "24:00" },
					],
				},
				thursday: {
					windows: [
						{ open: "07:00", close: "15:00" },
						{ open: "18:00", close: "24:00" },
					],
				},
				friday: {
					windows: [
						{ open: "07:00", close: "15:00" },
						{ open: "18:00", close: "02:00" }, // crosses midnight
					],
				},
				saturday: {
					windows: [
						{ open: "07:00", close: "15:00" },
						{ open: "18:00", close: "02:00" }, // crosses midnight
					],
				},
			},
		};

		it("returns open during weekday morning window", () => {
			const date = new Date("2026-10-20T08:00:00"); // Tuesday 8 AM
			const result = isWithinBusinessHours(demoCafeHours, date);
			expect(result.isOpen).toBe(true);
		});

		it("returns closed during weekday afternoon break", () => {
			const date = new Date("2026-10-20T16:00:00"); // Tuesday 4 PM
			const result = isWithinBusinessHours(demoCafeHours, date);
			expect(result.isOpen).toBe(false);
		});

		it("returns open during weekday evening window", () => {
			const date = new Date("2026-10-20T19:00:00"); // Tuesday 7 PM
			const result = isWithinBusinessHours(demoCafeHours, date);
			expect(result.isOpen).toBe(true);
		});

		it("returns closed on weekday after midnight (no overnight)", () => {
			const date = new Date("2026-10-21T01:00:00"); // Wednesday 1 AM
			const result = isWithinBusinessHours(demoCafeHours, date);
			expect(result.isOpen).toBe(false);
		});

		it("returns open on Saturday during overnight from Friday", () => {
			const date = new Date("2026-10-24T01:00:00"); // Saturday 1 AM
			const result = isWithinBusinessHours(demoCafeHours, date);
			expect(result.isOpen).toBe(true);
			expect(result.reason).toBe("within_overnight_window");
		});

		it("returns open on Sunday during overnight from Saturday", () => {
			const date = new Date("2026-10-25T01:00:00"); // Sunday 1 AM
			const result = isWithinBusinessHours(demoCafeHours, date);
			expect(result.isOpen).toBe(true);
			expect(result.reason).toBe("within_overnight_window");
		});
	});

	describe("validateBusinessHours", () => {
		it("returns empty array for valid hours", () => {
			const hours: BusinessHours = {
				timezone: "America/Chicago",
				schedule: {
					monday: {
						windows: [{ open: "09:00", close: "17:00" }],
					},
				},
			};
			expect(validateBusinessHours(hours)).toEqual([]);
		});

		it("requires timezone", () => {
			const hours: BusinessHours = {
				timezone: "",
				schedule: {},
			};
			const errors = validateBusinessHours(hours);
			expect(errors).toContain("timezone is required");
		});

		it("rejects windows on closed day", () => {
			const hours: BusinessHours = {
				timezone: "America/Chicago",
				schedule: {
					monday: {
						closed: true,
						windows: [{ open: "09:00", close: "17:00" }],
					},
				},
			};
			const errors = validateBusinessHours(hours);
			expect(errors).toContain(
				"monday: cannot have windows when marked closed",
			);
		});

		it("rejects invalid time format", () => {
			const hours: BusinessHours = {
				timezone: "America/Chicago",
				schedule: {
					monday: {
						windows: [{ open: "9:00", close: "17:00" }],
					},
				},
			};
			const errors = validateBusinessHours(hours);
			expect(errors).toContain("monday window 1: invalid open time format");
		});

		it("accepts valid midnight-crossing windows", () => {
			const hours: BusinessHours = {
				timezone: "America/Chicago",
				schedule: {
					friday: {
						windows: [{ open: "18:00", close: "02:00" }],
					},
				},
			};
			expect(validateBusinessHours(hours)).toEqual([]);
		});
	});
});
