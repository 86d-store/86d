import { describe, expect, it } from "vitest";
import { createVisualApiTracker } from "../visual-api-tracker";

describe("visual API tracker", () => {
	it("reports a same-store API transport failure once and settles it", () => {
		const tracker = createVisualApiTracker("https://store.example");
		const request = {};

		tracker.started(request, {
			method: "GET",
			url: "https://store.example/api/customers/me?include=addresses",
		});
		tracker.failed(request, "net::ERR_CONNECTION_RESET");

		expect(tracker.issues()).toEqual([
			{
				method: "GET",
				path: "/api/customers/me?include=addresses",
				failure: "net::ERR_CONNECTION_RESET",
			},
		]);
	});

	it("ignores external and non-API requests", () => {
		const tracker = createVisualApiTracker("https://store.example");
		const externalRequest = {};
		const documentRequest = {};
		const apiLikeRequest = {};

		tracker.started(externalRequest, {
			method: "GET",
			url: "https://telemetry.example/api/events",
		});
		tracker.started(documentRequest, {
			method: "GET",
			url: "https://store.example/products",
		});
		tracker.started(apiLikeRequest, {
			method: "GET",
			url: "https://store.example/apiary",
		});
		tracker.failed(externalRequest, "external failure");
		tracker.failed(documentRequest, "document failure");
		tracker.failed(apiLikeRequest, "non-API failure");

		expect(tracker.issues()).toEqual([]);
	});

	it("settles fulfilled and HTTP-error responses without pending duplicates", () => {
		const tracker = createVisualApiTracker("https://store.example");
		const fulfilledRequest = {};
		const notFoundRequest = {};

		tracker.started(fulfilledRequest, {
			method: "POST",
			url: "https://store.example/api/analytics/events",
		});
		tracker.responded(fulfilledRequest, 204);
		tracker.finished(fulfilledRequest);
		tracker.started(notFoundRequest, {
			method: "GET",
			url: "https://store.example/api/products/missing",
		});
		tracker.responded(notFoundRequest, 404);
		const expectedIssues = [
			{
				method: "GET",
				path: "/api/products/missing",
				failure: "HTTP 404",
			},
		];
		expect(tracker.issues()).toEqual(expectedIssues);

		tracker.finished(notFoundRequest);
		expect(tracker.issues()).toEqual(expectedIssues);
	});

	it("reports missing same-store uploaded assets", () => {
		const tracker = createVisualApiTracker("https://store.example");
		const request = {};

		tracker.started(request, {
			method: "GET",
			url: "https://store.example/uploads/stores/store-1/products/hero.webp",
		});
		tracker.responded(request, 404);
		tracker.finished(request);

		expect(tracker.issues()).toEqual([
			{
				method: "GET",
				path: "/uploads/stores/store-1/products/hero.webp",
				failure: "HTTP 404",
			},
		]);
	});

	it("reports same-store API requests that remain pending at teardown", () => {
		const tracker = createVisualApiTracker("https://store.example");
		const request = {};

		tracker.started(request, {
			method: "GET",
			url: "https://store.example/api/orders?limit=20",
		});

		const pendingIssue = {
			method: "GET",
			path: "/api/orders?limit=20",
			failure: "request remained pending at teardown",
		};
		expect(tracker.pendingIssues()).toEqual([pendingIssue]);
		expect(tracker.issues()).toEqual([pendingIssue]);

		tracker.finished(request);
		expect(tracker.pendingIssues()).toEqual([]);
	});

	it("starts a clean phase while ignoring late events from setup requests", () => {
		const tracker = createVisualApiTracker("https://store.example");
		const setupRequest = {};
		const targetRequest = {};

		tracker.started(setupRequest, {
			method: "GET",
			url: "https://store.example/api/admin/orders",
		});
		tracker.responded(setupRequest, 503);
		tracker.beginPhase();
		tracker.responded(setupRequest, 504);
		tracker.failed(setupRequest, "net::ERR_ABORTED");
		tracker.finished(setupRequest);

		tracker.started(targetRequest, {
			method: "GET",
			url: "https://store.example/api/admin/customers",
		});
		tracker.failed(targetRequest, "net::ERR_CONNECTION_RESET");

		expect(tracker.issues()).toEqual([
			{
				method: "GET",
				path: "/api/admin/customers",
				failure: "net::ERR_CONNECTION_RESET",
			},
		]);
	});
});
