/**
 * Compatibility surface. Canonical schemas and digests live in `@86d-app/contracts`.
 * Do not add wire schemas here — extend the contracts package instead.
 */

export type {
	ChangeSet,
	ChangeSetReviewContent,
} from "@86d-app/contracts/change-set";
export type {
	ActionLevel,
	ActorReference,
	Approval,
	AuditEvent,
	AuthoritativePlane,
	AuthoritySnapshot,
	CommandBindingContent,
	CommandExecutionResponse,
	CommandFailure,
	CommandFailureCode,
	CommandReceipt,
	CommandReference,
	CommandRequest,
	CommandStatus,
	Confirmation,
	ConfirmationChallenge,
	GrantUse,
	JsonValue,
	PermissionUse,
	StandingPermission,
	StandingPermissionUseReservation,
	TargetReference,
	Workflow,
	WorkflowAttempt,
	WorkflowState,
	WorkflowStep,
} from "@86d-app/contracts/command";
