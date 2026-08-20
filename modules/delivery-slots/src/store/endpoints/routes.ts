import { availableSlots } from "./available-slots";
import { bookSlot } from "./book-slot";
import { cancelBookingStore } from "./cancel-booking";
import { orderBooking } from "./order-booking";

export const storeEndpoints = {
	"/delivery-slots/available": availableSlots,
	"/delivery-slots/book": bookSlot,
	"/delivery-slots/order/:orderId": orderBooking,
	"/delivery-slots/bookings/:id/cancel": cancelBookingStore,
};
