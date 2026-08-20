import { bulkDeleteSubmissions } from "./bulk-delete-submissions";
import { createForm } from "./create-form";
import { deleteForm } from "./delete-form";
import { deleteSubmission } from "./delete-submission";
import { getForm } from "./get-form";
import { getSubmission } from "./get-submission";
import { listForms } from "./list-forms";
import { listSubmissions } from "./list-submissions";
import { getStats } from "./stats";
import { updateForm } from "./update-form";
import { updateSubmissionStatus } from "./update-submission-status";

export const adminEndpoints = {
	"/admin/forms": listForms,
	"/admin/forms/create": createForm,
	"/admin/forms/stats": getStats,
	"/admin/forms/:id": getForm,
	"/admin/forms/:id/update": updateForm,
	"/admin/forms/:id/delete": deleteForm,
	"/admin/forms/:formId/submissions": listSubmissions,
	"/admin/forms/submissions/:id": getSubmission,
	"/admin/forms/submissions/:id/status": updateSubmissionStatus,
	"/admin/forms/submissions/:id/delete": deleteSubmission,
	"/admin/forms/submissions/bulk-delete": bulkDeleteSubmissions,
};
