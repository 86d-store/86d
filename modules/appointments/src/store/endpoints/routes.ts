import { bookAppointment } from "./book-appointment";
import { cancelAppointment } from "./cancel-appointment";
import { getAppointment } from "./get-appointment";
import { getAvailableSlots } from "./get-available-slots";
import { getService } from "./get-service";
import { listMyAppointments } from "./list-my-appointments";
import { listServices } from "./list-services";

export const storeEndpoints = {
	"/appointments/services": listServices,
	"/appointments/services/:slug": getService,
	"/appointments/availability": getAvailableSlots,
	"/appointments/book": bookAppointment,
	"/appointments/me": listMyAppointments,
	"/appointments/:id": getAppointment,
	"/appointments/:id/cancel": cancelAppointment,
};
