import { checkWaitlist } from "./check-waitlist";
import { joinWaitlist } from "./join-waitlist";
import { leaveWaitlist } from "./leave-waitlist";
import { myWaitlist } from "./my-waitlist";

export const storeEndpoints = {
	"/waitlist/join": joinWaitlist,
	"/waitlist/leave": leaveWaitlist,
	"/waitlist/check/:productId": checkWaitlist,
	"/waitlist/mine": myWaitlist,
};
