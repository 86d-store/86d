/**
 * Single process-env access point for packages that must read or mutate
 * `process.env` without tripping `lint/style/noProcessEnv` at call sites.
 *
 * Biome flags the `process.env` member expression; destructuring `env` from
 * `process` is the allowed boundary used everywhere else in this repo.
 */

export type ProcessEnv = NodeJS.ProcessEnv;

/** Live process environment map (mutable; same object as `process.env`). */
export function readProcessEnv(): ProcessEnv {
	if (typeof process === "undefined") {
		return {};
	}
	const { env } = process;
	return env;
}

/** Read one process-scoped variable. */
export function getProcessEnv(name: string): string | undefined {
	return readProcessEnv()[name];
}

/** Set or delete one process-scoped variable. */
export function setProcessEnv(name: string, value: string | undefined): void {
	const env = readProcessEnv();
	if (value === undefined) {
		Reflect.deleteProperty(env, name);
	} else {
		env[name] = value;
	}
}

/** Shallow copy of the current process environment. */
export function snapshotProcessEnv(): ProcessEnv {
	return { ...readProcessEnv() };
}

/**
 * Restore the live process environment to match a snapshot (test helper).
 * Deletes keys absent from the snapshot, then assigns snapshot values.
 */
export function restoreProcessEnv(snapshot: ProcessEnv): void {
	const env = readProcessEnv();
	for (const key of Object.keys(env)) {
		if (!Object.hasOwn(snapshot, key)) {
			Reflect.deleteProperty(env, key);
		}
	}
	Object.assign(env, snapshot);
}

/** True when `CI` is set (any non-empty value). */
export function isCi(): boolean {
	return Boolean(getProcessEnv("CI"));
}

/** True when the Playwright harness is active. */
export function isPlaywright(): boolean {
	return Boolean(getProcessEnv("PLAYWRIGHT"));
}
