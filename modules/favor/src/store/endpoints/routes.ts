import { checkAvailability } from "./check-availability";
import { createDelivery } from "./create-delivery";
import { getDelivery } from "./get-delivery";

export const storeEndpoints = {
	"/favor/deliveries": createDelivery,
	"/favor/deliveries/:id": getDelivery,
	"/favor/availability": checkAvailability,
};
