import { createAnnouncement } from "./create-announcement";
import { deleteAnnouncement } from "./delete-announcement";
import { getAnnouncement } from "./get-announcement";
import { listAnnouncements } from "./list-announcements";
import { reorder } from "./reorder";
import { stats } from "./stats";
import { updateAnnouncement } from "./update-announcement";

export const adminEndpoints = {
	"/admin/announcements": listAnnouncements,
	"/admin/announcements/create": createAnnouncement,
	"/admin/announcements/reorder": reorder,
	"/admin/announcements/stats": stats,
	"/admin/announcements/:id": getAnnouncement,
	"/admin/announcements/:id/update": updateAnnouncement,
	"/admin/announcements/:id/delete": deleteAnnouncement,
};
