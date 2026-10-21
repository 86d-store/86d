/**
 * Business hours utility functions.
 * Supports multiple windows per day and windows that cross midnight.
 */

import type { BusinessHours, DaySchedule, TimeWindow } from "./service";

const DAY_NAMES = [
	"sunday",
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
] as const;

/**
 * Parse a time string (HH:MM) to minutes since midnight.
 */
function parseTimeToMinutes(time: string): number {
	const [hours, minutes] = time.split(":").map(Number);
	return hours * 60 + minutes;
}

/**
 * Check if a time (in minutes since midnight) is within a single window.
 * Handles midnight-crossing windows (e.g., 18:00-02:00).
 */
function isTimeInWindow(
	timeMinutes: number,
	window: TimeWindow,
	checkPreviousDay: boolean,
): boolean {
	const openMinutes = parseTimeToMinutes(window.open);
	const closeMinutes = parseTimeToMinutes(window.close);

	if (closeMinutes > openMinutes) {
		return timeMinutes >= openMinutes && timeMinutes < closeMinutes;
	}

	if (checkPreviousDay) {
		return timeMinutes < closeMinutes;
	}
	return timeMinutes >= openMinutes;
}

/**
 * Get the day schedule for a given day index (0 = Sunday, 6 = Saturday).
 */
function getDaySchedule(
	hours: BusinessHours,
	dayIndex: number,
): DaySchedule | undefined {
	const dayName = DAY_NAMES[dayIndex];
	return hours.schedule[dayName];
}

/**
 * Check if a given date/time falls within the store's business hours.
 *
 * @param hours The business hours configuration
 * @param date The date/time to check (should be in the store's timezone)
 * @returns Object with isOpen status and next open/close time info
 */
export function isWithinBusinessHours(
	hours: BusinessHours,
	date: Date,
): { isOpen: boolean; reason: string } {
	const dayIndex = date.getDay();
	const timeMinutes = date.getHours() * 60 + date.getMinutes();

	const todaySchedule = getDaySchedule(hours, dayIndex);

	if (todaySchedule?.closed) {
		return { isOpen: false, reason: "closed_today" };
	}

	const todayWindows = todaySchedule?.windows ?? [];
	for (const window of todayWindows) {
		if (isTimeInWindow(timeMinutes, window, false)) {
			return { isOpen: true, reason: "within_window" };
		}
	}

	const previousDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;
	const previousSchedule = getDaySchedule(hours, previousDayIndex);

	if (previousSchedule && !previousSchedule.closed) {
		const previousWindows = previousSchedule.windows ?? [];
		for (const window of previousWindows) {
			const openMinutes = parseTimeToMinutes(window.open);
			const closeMinutes = parseTimeToMinutes(window.close);

			if (
				closeMinutes < openMinutes &&
				isTimeInWindow(timeMinutes, window, true)
			) {
				return { isOpen: true, reason: "within_overnight_window" };
			}
		}
	}

	return { isOpen: false, reason: "outside_hours" };
}

/**
 * Validate a business hours configuration.
 * Returns an array of validation errors, empty if valid.
 */
export function validateBusinessHours(hours: BusinessHours): string[] {
	const errors: string[] = [];

	if (!hours.timezone) {
		errors.push("timezone is required");
	}

	const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

	for (const dayName of DAY_NAMES) {
		const schedule = hours.schedule[dayName];
		if (!schedule) continue;

		if (schedule.closed && schedule.windows && schedule.windows.length > 0) {
			errors.push(`${dayName}: cannot have windows when marked closed`);
		}

		if (schedule.windows) {
			for (let i = 0; i < schedule.windows.length; i++) {
				const window = schedule.windows[i];

				if (!timeRegex.test(window.open)) {
					errors.push(`${dayName} window ${i + 1}: invalid open time format`);
				}
				if (!timeRegex.test(window.close)) {
					errors.push(`${dayName} window ${i + 1}: invalid close time format`);
				}
			}
		}
	}

	return errors;
}
