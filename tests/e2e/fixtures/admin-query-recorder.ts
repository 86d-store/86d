type QueryEntry = readonly [string, string];

function sortedEntries(searchParams: URLSearchParams): QueryEntry[] {
	return [...searchParams.entries()].sort(
		([leftKey, leftValue], [rightKey, rightValue]) => {
			const keyOrder = leftKey.localeCompare(rightKey);
			return keyOrder !== 0 ? keyOrder : leftValue.localeCompare(rightValue);
		},
	);
}

function hasExactSearchParams(
	actual: URLSearchParams,
	expected: URLSearchParams,
): boolean {
	const actualEntries = sortedEntries(actual);
	const expectedEntries = sortedEntries(expected);
	if (actualEntries.length !== expectedEntries.length) return false;

	return actualEntries.every(
		([key, value], index) =>
			key === expectedEntries[index]?.[0] &&
			value === expectedEntries[index]?.[1],
	);
}

export function createAdminQueryRecorder() {
	const requests: URL[] = [];

	return {
		record(url: string): void {
			requests.push(new URL(url));
		},
		countPath(path: string): number {
			return requests.filter((request) => request.pathname === path).length;
		},
		countExact(path: string, expected: URLSearchParams): number {
			return requests.filter(
				(request) =>
					request.pathname === path &&
					hasExactSearchParams(request.searchParams, expected),
			).length;
		},
	};
}
