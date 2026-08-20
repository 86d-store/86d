import type { z } from "zod";
import type { ModuleTransactionRunner } from "./durable-events";
import type { ScopedEventEmitter } from "./events";
import type { Primitive } from "./types/helper";
import type { ModuleDataService } from "./types/module";

export type CapabilityDefinition<
	Name extends string = string,
	Version extends string = string,
	Owner extends string = string,
	RequestSchema extends z.ZodType = z.ZodType,
	DecisionSchema extends z.ZodType = z.ZodType,
	FailureSchema extends z.ZodType = z.ZodType,
> = Readonly<{
	name: Name;
	version: Version;
	owner: Owner;
	request: RequestSchema;
	decision: DecisionSchema;
	failure: FailureSchema;
}>;

export type AnyCapabilityDefinition = CapabilityDefinition<
	string,
	string,
	string,
	z.ZodType,
	z.ZodType,
	z.ZodType
>;

export type CapabilityRequest<D extends AnyCapabilityDefinition> = z.infer<
	D["request"]
>;

export type CapabilityDecision<D extends AnyCapabilityDefinition> = z.infer<
	D["decision"]
>;

export type CapabilityFailure<D extends AnyCapabilityDefinition> = z.infer<
	D["failure"]
>;

export type CapabilitySuccess<Decision> = Readonly<{
	ok: true;
	decision: Decision;
}>;

export type CapabilityRejected<Failure> = Readonly<{
	ok: false;
	failure: Failure;
}>;

export type CapabilityResult<Decision, Failure> =
	| CapabilitySuccess<Decision>
	| CapabilityRejected<Failure>;

export type CapabilityKernelFailureCode =
	| "CAPABILITY_UNAVAILABLE"
	| "CAPABILITY_NOT_ACCEPTED"
	| "CAPABILITY_OPERATION_NOT_ACCEPTED"
	| "INVALID_CAPABILITY_REQUEST"
	| "INVALID_CAPABILITY_DECISION"
	| "INVALID_CAPABILITY_FAILURE"
	| "CAPABILITY_PROVIDER_FAILED";

/** A bounded failure returned by the kernel without exposing provider internals. */
export type CapabilityKernelFailure = Readonly<{
	code: CapabilityKernelFailureCode;
	capability: string;
	version: string;
}>;

/** The only runtime resources exposed to a capability provider. */
export type CapabilityProviderContext = Readonly<{
	data: ModuleDataService;
	events?: ScopedEventEmitter | undefined;
	/** Owner-local atomic state and durable-event transaction seam. */
	transactions?: ModuleTransactionRunner | undefined;
	storeId: string;
	options: Record<string, Primitive>;
}>;

export type CapabilityHandler<D extends AnyCapabilityDefinition> = (
	context: CapabilityProviderContext,
	request: CapabilityRequest<D>,
) => Promise<CapabilityResult<CapabilityDecision<D>, CapabilityFailure<D>>>;

export type CapabilityProvider<D extends AnyCapabilityDefinition> = Readonly<{
	definition: D;
	handle: CapabilityHandler<D>;
}>;

export type CapabilityAcceptance = Readonly<{
	definition: AnyCapabilityDefinition;
	name: string;
	owner: string;
	versions: readonly string[];
	operations?: readonly string[] | undefined;
	optional: boolean;
}>;

type RequestOperation<Request> = Request extends {
	operation: infer Operation extends string;
}
	? Operation
	: never;

export type CapabilityOperation<D extends AnyCapabilityDefinition> =
	RequestOperation<CapabilityRequest<D>>;

export type ModuleCapabilities = Readonly<{
	provides?: readonly CapabilityProvider<AnyCapabilityDefinition>[] | undefined;
	accepts?: readonly CapabilityAcceptance[] | undefined;
}>;

export interface CapabilityInvoker {
	invoke<D extends AnyCapabilityDefinition>(
		definition: D,
		request: CapabilityRequest<D>,
	): Promise<
		CapabilityResult<
			CapabilityDecision<D>,
			CapabilityFailure<D> | CapabilityKernelFailure
		>
	>;
}

export function defineCapability<
	const Name extends string,
	const Version extends string,
	const Owner extends string,
	RequestSchema extends z.ZodType,
	DecisionSchema extends z.ZodType,
	FailureSchema extends z.ZodType,
>(definition: {
	name: Name;
	version: Version;
	owner: Owner;
	request: RequestSchema;
	decision: DecisionSchema;
	failure: FailureSchema;
}): CapabilityDefinition<
	Name,
	Version,
	Owner,
	RequestSchema,
	DecisionSchema,
	FailureSchema
> {
	return Object.freeze({ ...definition });
}

export function provideCapability<D extends AnyCapabilityDefinition>(
	definition: D,
	handle: CapabilityHandler<D>,
): CapabilityProvider<D> {
	return Object.freeze({ definition, handle });
}

export function acceptCapability<D extends AnyCapabilityDefinition>(
	definition: D,
	options?: {
		versions?: readonly string[] | undefined;
		operations?: readonly CapabilityOperation<D>[] | undefined;
		optional?: boolean | undefined;
	},
): CapabilityAcceptance {
	return Object.freeze({
		definition,
		name: definition.name,
		owner: definition.owner,
		versions: Object.freeze([...(options?.versions ?? [definition.version])]),
		...(options?.operations
			? { operations: Object.freeze([...options.operations]) }
			: {}),
		optional: options?.optional ?? false,
	});
}
