import { assignServiceToStaff } from "./assign-service";
import { createService } from "./create-service";
import { createStaff } from "./create-staff";
import { deleteService } from "./delete-service";
import { deleteStaff } from "./delete-staff";
import { getAppointmentAdmin } from "./get-appointment";
import { getServiceAdmin } from "./get-service";
import { getStats } from "./get-stats";
import { listAppointments } from "./list-appointments";
import { listServicesAdmin } from "./list-services";
import { listStaffAdmin } from "./list-staff";
import { setSchedule } from "./set-schedule";
import { updateAppointment } from "./update-appointment";
import { updateService } from "./update-service";
import { updateStaff } from "./update-staff";

export const adminEndpoints = {
	"/admin/appointments": listAppointments,
	"/admin/appointments/stats": getStats,
	"/admin/appointments/services": listServicesAdmin,
	"/admin/appointments/services/create": createService,
	"/admin/appointments/services/:id": getServiceAdmin,
	"/admin/appointments/services/:id/update": updateService,
	"/admin/appointments/services/:id/delete": deleteService,
	"/admin/appointments/staff": listStaffAdmin,
	"/admin/appointments/staff/create": createStaff,
	"/admin/appointments/staff/:id/update": updateStaff,
	"/admin/appointments/staff/:id/delete": deleteStaff,
	"/admin/appointments/staff/:id/services/assign": assignServiceToStaff,
	"/admin/appointments/staff/:id/schedule": setSchedule,
	"/admin/appointments/:id": getAppointmentAdmin,
	"/admin/appointments/:id/update": updateAppointment,
};
