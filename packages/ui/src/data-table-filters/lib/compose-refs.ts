// @see https://github.com/radix-ui/primitives/blob/main/packages/react/compose-refs/src/composeRefs.tsx

import { type MutableRefObject, type Ref, useCallback } from "react";

type PossibleRef<T> = Ref<T> | undefined;

/**
 * Set a given ref to a given value
 * This utility takes care of different types of refs: callback refs and RefObject(s)
 */
function setRef<T>(ref: PossibleRef<T>, value: T) {
	if (typeof ref === "function") {
		ref(value);
	} else if (ref != null) {
		(ref as MutableRefObject<T>).current = value;
	}
}

/**
 * A utility to compose multiple refs together
 * Accepts callback refs and RefObject(s)
 */
function composeRefs<T>(...refs: PossibleRef<T>[]) {
	return (node: T) => {
		for (const ref of refs) {
			setRef(ref, node);
		}
	};
}

/**
 * A custom hook that composes multiple refs
 * Accepts callback refs and RefObject(s)
 */
function useComposedRefs<T>(...refs: PossibleRef<T>[]) {
	// Rest args are the dependency identity; an array literal cannot name them.
	// biome-ignore lint/correctness/useExhaustiveDependencies: compose whenever the refs tuple identity changes
	return useCallback(composeRefs(...refs), refs);
}

export { composeRefs, useComposedRefs };
