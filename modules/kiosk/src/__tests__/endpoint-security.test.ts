import { createMockDataService } from "@86d-app/core/test-utils";
import { beforeEach, describe, expect, it } from "vitest";
import { createKioskController } from "../service-impl";

describe("kiosk endpoint security", () => {
	let mockData: ReturnType<typeof createMockDataService>;
	let controller: ReturnType<typeof createKioskController>;

	beforeEach(() => {
		mockData = createMockDataService();
		controller = createKioskController(mockData);
	});

	describe("station safety", () => {
		it("cannot update non-existent station", async () => {
			expect(
				await controller.updateStation("nonexistent", { name: "X" }),
			).toBeNull();
		});

		it("cannot delete non-existent station", async () => {
			expect(await controller.deleteStation("nonexistent")).toBe(false);
		});

		it("cannot start session on inactive station", async () => {
			const station = await controller.registerStation({ name: "S1" });
			await controller.updateStation(station.id, { isActive: false });
			expect(await controller.startSession(station.id)).toBeNull();
		});
	});

	describe("session safety", () => {
		it("cannot add item to completed session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			await controller.completeSession(session?.id as string, "card");

			expect(
				await controller.addItem(session?.id as string, {
					name: "X",
					price: 1,
					quantity: 1,
				}),
			).toBeNull();
		});

		it("cannot complete an abandoned session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			await controller.abandonSession(session?.id as string);

			expect(
				await controller.completeSession(session?.id as string, "card"),
			).toBeNull();
		});

		it("cannot abandon a completed session", async () => {
			const station = await controller.registerStation({ name: "S1" });
			const session = await controller.startSession(station.id);
			await controller.completeSession(session?.id as string, "card");

			expect(await controller.abandonSession(session?.id as string)).toBeNull();
		});

		it("get session returns null for non-existent id", async () => {
			expect(await controller.getSession("nonexistent")).toBeNull();
		});
	});

	describe("heartbeat safety", () => {
		it("heartbeat returns null for non-existent station", async () => {
			expect(await controller.heartbeat("nonexistent")).toBeNull();
		});
	});
});
