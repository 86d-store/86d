import type { z } from "zod";

export type HookPointDefinition<
	Name extends string = string,
	Version extends string = string,
	Owner extends string = string,
	InputSchema extends z.ZodType = z.ZodType,
	PatchSchema extends z.ZodType = z.ZodType,
> = Readonly<{
	name: Name;
	version: Version;
	owner: Owner;
	input: InputSchema;
	patch: PatchSchema;
	minimumImplementers?: 0 | 1 | undefined;
}>;

export type AnyHookPointDefinition = HookPointDefinition<
	string,
	string,
	string,
	z.ZodType,
	z.ZodType
>;

export type HookImplementation<
	D extends AnyHookPointDefinition = AnyHookPointDefinition,
> = Readonly<{
	definition: D;
	/** Lower-kebab local id; full identity is `<moduleId>/<implementationId>`. */
	implementationId: string;
	priority?: number | undefined;
	before?: readonly string[] | undefined;
	after?: readonly string[] | undefined;
	handle: {
		bivarianceHack(
			input: z.infer<D["input"]>,
		): Promise<z.infer<D["patch"]>> | z.infer<D["patch"]>;
	}["bivarianceHack"];
}>;

export type AnyHookImplementation = HookImplementation<AnyHookPointDefinition>;

export function defineHook<
	const Name extends string,
	const Version extends string,
	const Owner extends string,
	InputSchema extends z.ZodType,
	PatchSchema extends z.ZodType,
>(definition: {
	name: Name;
	version: Version;
	owner: Owner;
	input: InputSchema;
	patch: PatchSchema;
	minimumImplementers?: 0 | 1 | undefined;
}): HookPointDefinition<Name, Version, Owner, InputSchema, PatchSchema> {
	return Object.freeze({ ...definition });
}

export function implementHook<D extends AnyHookPointDefinition>(
	definition: D,
	implementation: Omit<HookImplementation<D>, "definition">,
): HookImplementation<D> {
	return Object.freeze({ definition, ...implementation });
}

export function hookImplementationIdentity(
	moduleId: string,
	implementationId: string,
): string {
	return `${moduleId}/${implementationId}`;
}

const INT32_MIN = -2_147_483_648;
const INT32_MAX = 2_147_483_647;
const LOWER_KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function assertHookImplementationId(implementationId: string): void {
	if (!LOWER_KEBAB.test(implementationId)) {
		throw new Error(
			`Hook implementation identity must be lower-kebab: "${implementationId}".`,
		);
	}
}

export function normalizeHookPriority(priority: number | undefined): number {
	const value = priority ?? 0;
	if (!Number.isInteger(value) || value < INT32_MIN || value > INT32_MAX) {
		throw new Error(
			`Hook priority must be a signed 32-bit integer; received ${String(priority)}.`,
		);
	}
	return value;
}

/**
 * Topological order with before/after edges, then priority / moduleId /
 * implementationId tie-breaks. Explicit edges outrank priority.
 */
export function orderHookImplementations(
	implementations: readonly Readonly<{
		moduleId: string;
		implementationId: string;
		priority: number;
		before: readonly string[];
		after: readonly string[];
	}>[],
):
	| Readonly<{ ok: true; order: readonly string[] }>
	| Readonly<{
			ok: false;
			reason: "cycle" | "absent_reference";
			detail: string;
	  }> {
	const identityOf = (moduleId: string, implementationId: string) =>
		hookImplementationIdentity(moduleId, implementationId);

	const nodes = new Map<
		string,
		{
			moduleId: string;
			implementationId: string;
			priority: number;
			deps: Set<string>;
		}
	>();

	for (const impl of implementations) {
		const id = identityOf(impl.moduleId, impl.implementationId);
		nodes.set(id, {
			moduleId: impl.moduleId,
			implementationId: impl.implementationId,
			priority: impl.priority,
			deps: new Set(),
		});
	}

	for (const impl of implementations) {
		const id = identityOf(impl.moduleId, impl.implementationId);
		const node = nodes.get(id);
		if (!node) continue;
		for (const before of impl.before) {
			if (!nodes.has(before)) {
				return {
					ok: false,
					reason: "absent_reference",
					detail: `${id} before ${before}`,
				};
			}
			// `before: X` means this runs before X → X depends on this.
			nodes.get(before)?.deps.add(id);
		}
		for (const after of impl.after) {
			if (!nodes.has(after)) {
				return {
					ok: false,
					reason: "absent_reference",
					detail: `${id} after ${after}`,
				};
			}
			// `after: X` means this runs after X → this depends on X.
			node.deps.add(after);
		}
	}

	const remaining = new Set(nodes.keys());
	const order: string[] = [];

	while (remaining.size > 0) {
		const eligible = [...remaining].filter((id) => {
			const node = nodes.get(id);
			if (!node) return false;
			for (const dep of node.deps) {
				if (remaining.has(dep)) return false;
			}
			return true;
		});

		if (eligible.length === 0) {
			return {
				ok: false,
				reason: "cycle",
				detail: [...remaining].sort().join(","),
			};
		}

		eligible.sort((a, b) => {
			const left = nodes.get(a);
			const right = nodes.get(b);
			if (!left || !right) return a < b ? -1 : 1;
			if (left.priority !== right.priority) {
				return left.priority - right.priority;
			}
			if (left.moduleId !== right.moduleId) {
				return left.moduleId < right.moduleId ? -1 : 1;
			}
			if (left.implementationId !== right.implementationId) {
				return left.implementationId < right.implementationId ? -1 : 1;
			}
			return 0;
		});

		const next = eligible[0];
		if (!next) break;
		order.push(next);
		remaining.delete(next);
	}

	return { ok: true, order: Object.freeze(order) };
}

/** Shallow-merge validated patches; later keys replace earlier top-level keys. */
export function shallowMergePatches<T extends Record<string, unknown>>(
	patches: readonly T[],
): T {
	const merged: Record<string, unknown> = {};
	for (const patch of patches) {
		for (const [key, value] of Object.entries(patch)) {
			merged[key] = value;
		}
	}
	return merged as T;
}
