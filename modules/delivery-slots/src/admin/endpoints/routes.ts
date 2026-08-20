import { cancelBooking } from "./cancel-booking";
import { createBlackout } from "./create-blackout";
import { createSchedule } from "./create-schedule";
import { deleteBlackout } from "./delete-blackout";
import { deleteSchedule } from "./delete-schedule";
import { getSchedule } from "./get-schedule";
import { listBlackoutsAdmin } from "./list-blackouts";
import { listBookings } from "./list-bookings";
import { listSchedules } from "./list-schedules";
import { summary } from "./summary";
import { updateSchedule } from "./update-schedule";

export const adminEndpoints = {
	"/admin/delivery-slots": listSchedules,
	"/admin/delivery-slots/create": createSchedule,
	"/admin/delivery-slots/summary": summary,
	"/admin/delivery-slots/bookings": listBookings,
	"/admin/delivery-slots/blackouts": listBlackoutsAdmin,
	"/admin/delivery-slots/blackouts/create": createBlackout,
	"/admin/delivery-slots/blackouts/:id/delete": deleteBlackout,
	"/admin/delivery-slots/:id": getSchedule,
	"/admin/delivery-slots/:id/update": updateSchedule,
	"/admin/delivery-slots/:id/delete": deleteSchedule,
	"/admin/delivery-slots/bookings/:id/cancel": cancelBooking,
};
