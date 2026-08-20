import { activateAutomation } from "./activate-automation";
import { createAutomation } from "./create-automation";
import { deleteAutomation } from "./delete-automation";
import { duplicateAutomation } from "./duplicate-automation";
import { executeAutomation } from "./execute-automation";
import { getAutomation } from "./get-automation";
import { getExecution } from "./get-execution";
import { listAutomations } from "./list-automations";
import { listExecutions } from "./list-executions";
import { pauseAutomation } from "./pause-automation";
import { purgeExecutions } from "./purge-executions";
import { automationStats } from "./stats";
import { updateAutomation } from "./update-automation";

export const adminEndpoints = {
	"/admin/automations": listAutomations,
	"/admin/automations/stats": automationStats,
	"/admin/automations/executions": listExecutions,
	"/admin/automations/executions/:id": getExecution,
	"/admin/automations/executions/purge": purgeExecutions,
	"/admin/automations/:id": getAutomation,
	"/admin/automations/:id/update": updateAutomation,
	"/admin/automations/:id/delete": deleteAutomation,
	"/admin/automations/:id/activate": activateAutomation,
	"/admin/automations/:id/pause": pauseAutomation,
	"/admin/automations/:id/duplicate": duplicateAutomation,
	"/admin/automations/:id/execute": executeAutomation,
	"/admin/automations/create": createAutomation,
};
