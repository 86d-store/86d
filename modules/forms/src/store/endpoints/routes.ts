import { getForm } from "./get-form";
import { listForms } from "./list-forms";
import { submitForm } from "./submit-form";

export const storeEndpoints = {
	"/forms": listForms,
	"/forms/:slug": getForm,
	"/forms/:slug/submit": submitForm,
};
