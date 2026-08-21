import type { CompiledExecutionGraph } from "./compile";
import type { AnyHookPointDefinition } from "./hooks";
import { hookImplementationIdentity, shallowMergePatches } from "./hooks";

/**
 * Run a compiled hook chain: frozen input for every implementer, validated
 * patches, shallow later-wins merge. No nested hook runner is provided.
 */
export async function runCompiledHook<D extends AnyHookPointDefinition>(
	graph: CompiledExecutionGraph,
	definition: D,
	input: unknown,
): Promise<
	| Readonly<{ ok: true; patch: Record<string, unknown> }>
	| Readonly<{
			ok: false;
			code:
				| "HOOK_NOT_COMPILED"
				| "INVALID_HOOK_INPUT"
				| "INVALID_HOOK_PATCH"
				| "HOOK_HANDLER_FAILED";
	  }>
> {
	const key = `${definition.owner}\0${definition.name}\0${definition.version}`;
	const chain = graph.hookChains.get(key);
	if (!chain) {
		return { ok: false, code: "HOOK_NOT_COMPILED" };
	}

	const parsedInput = definition.input.safeParse(input);
	if (!parsedInput.success) {
		return { ok: false, code: "INVALID_HOOK_INPUT" };
	}
	const frozenInput = Object.freeze(
		structuredClone(parsedInput.data) as Record<string, unknown>,
	);

	const patches: Record<string, unknown>[] = [];
	for (const identity of chain.order) {
		const [moduleId, implementationId] = splitIdentity(identity);
		if (!moduleId || !implementationId) {
			return { ok: false, code: "HOOK_HANDLER_FAILED" };
		}
		const impl = graph.hookImplementations.get(
			hookImplementationIdentity(moduleId, implementationId),
		);
		if (!impl) {
			return { ok: false, code: "HOOK_HANDLER_FAILED" };
		}
		let rawPatch: unknown;
		try {
			rawPatch = await impl.handle(frozenInput as never);
		} catch {
			return { ok: false, code: "HOOK_HANDLER_FAILED" };
		}
		const parsedPatch = definition.patch.safeParse(rawPatch);
		if (!parsedPatch.success) {
			return { ok: false, code: "INVALID_HOOK_PATCH" };
		}
		patches.push(parsedPatch.data as Record<string, unknown>);
	}

	return {
		ok: true,
		patch: Object.freeze(shallowMergePatches(patches)),
	};
}

function splitIdentity(
	identity: string,
): [string | undefined, string | undefined] {
	const slash = identity.indexOf("/");
	if (slash <= 0 || slash === identity.length - 1) {
		return [undefined, undefined];
	}
	return [identity.slice(0, slash), identity.slice(slash + 1)];
}
