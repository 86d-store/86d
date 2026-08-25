export type VisualApiIssue = Readonly<{
	method: string;
	path: string;
	failure: string;
}>;

type TrackedRequest = Readonly<{
	method: string;
	path: string;
}>;

export function createVisualApiTracker(storeUrl: string) {
	const storeOrigin = new URL(storeUrl).origin;
	const pending = new Map<object, TrackedRequest>();
	const failures = new Map<object, VisualApiIssue>();
	const pendingIssues = (): VisualApiIssue[] => {
		const issues: VisualApiIssue[] = [];
		for (const [request, tracked] of pending) {
			if (failures.has(request)) continue;
			issues.push({
				...tracked,
				failure: "request remained pending at teardown",
			});
		}
		return issues;
	};

	return {
		beginPhase(): void {
			pending.clear();
			failures.clear();
		},
		started(
			request: object,
			input: Readonly<{ method: string; url: string }>,
		): void {
			const url = new URL(input.url);
			const isRuntimeRequest =
				url.pathname.startsWith("/api/") ||
				url.pathname.startsWith("/uploads/");
			if (url.origin !== storeOrigin || !isRuntimeRequest) {
				return;
			}
			pending.set(request, {
				method: input.method,
				path: `${url.pathname}${url.search}`,
			});
		},
		responded(request: object, status: number): void {
			const tracked = pending.get(request);
			if (!tracked || status < 400) return;
			failures.set(request, { ...tracked, failure: `HTTP ${status}` });
		},
		finished(request: object): void {
			pending.delete(request);
		},
		failed(request: object, failure: string): void {
			const tracked = pending.get(request);
			if (!tracked) return;
			failures.set(request, { ...tracked, failure });
			pending.delete(request);
		},
		pendingIssues,
		issues(): VisualApiIssue[] {
			return [...failures.values(), ...pendingIssues()];
		},
	};
}
