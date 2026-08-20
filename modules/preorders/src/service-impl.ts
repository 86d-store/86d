import type { ModuleDataService } from "@86d-app/core/types/module";
import type {
	CampaignStatus,
	PreorderCampaign,
	PreorderItem,
	PreorderItemStatus,
	PreordersController,
} from "./service";

const CANCELLABLE_ITEM_STATUSES: PreorderItemStatus[] = [
	"pending",
	"confirmed",
];

export function createPreordersController(
	data: ModuleDataService,
): PreordersController {
	async function findCampaign(id: string): Promise<PreorderCampaign | null> {
		const raw = await data.get("preorderCampaign", id);
		if (!raw) return null;
		return raw as unknown as PreorderCampaign;
	}

	async function saveCampaign(campaign: PreorderCampaign): Promise<void> {
		await data.upsert(
			"preorderCampaign",
			campaign.id,
			campaign as Record<string, unknown>,
		);
	}

	async function findItem(id: string): Promise<PreorderItem | null> {
		const raw = await data.get("preorderItem", id);
		if (!raw) return null;
		return raw as unknown as PreorderItem;
	}

	async function saveItem(item: PreorderItem): Promise<void> {
		await data.upsert("preorderItem", item.id, item as Record<string, unknown>);
	}

	function isCampaignAcceptingOrders(campaign: PreorderCampaign): boolean {
		if (campaign.status !== "active") return false;
		const now = new Date();
		if (now < campaign.startDate) return false;
		if (campaign.endDate && now > campaign.endDate) return false;
		return true;
	}

	function calculateDeposit(
		campaign: PreorderCampaign,
		quantity: number,
	): number {
		const totalPrice = campaign.price * quantity;
		if (campaign.paymentType === "full") return totalPrice;
		if (campaign.depositAmount) {
			return campaign.depositAmount * quantity;
		}
		if (campaign.depositPercent) {
			return (
				Math.round(totalPrice * (campaign.depositPercent / 100) * 100) / 100
			);
		}
		return totalPrice;
	}

	return {
		async createCampaign(params) {
			const now = new Date();
			const id = crypto.randomUUID();
			const status: CampaignStatus =
				params.startDate <= now ? "active" : "draft";

			const campaign: PreorderCampaign = {
				id,
				productId: params.productId,
				productName: params.productName,
				variantId: params.variantId,
				variantLabel: params.variantLabel,
				status,
				paymentType: params.paymentType,
				depositAmount: params.depositAmount,
				depositPercent: params.depositPercent,
				price: params.price,
				maxQuantity: params.maxQuantity,
				currentQuantity: 0,
				startDate: params.startDate,
				endDate: params.endDate,
				estimatedShipDate: params.estimatedShipDate,
				message: params.message,
				createdAt: now,
				updatedAt: now,
			};

			await saveCampaign(campaign);
			return campaign;
		},

		async getCampaign(id) {
			return findCampaign(id);
		},

		async listCampaigns(params) {
			const where: Record<string, unknown> = {};
			if (params?.status) where.status = params.status;
			if (params?.productId) where.productId = params.productId;

			const all = await data.findMany("preorderCampaign", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as PreorderCampaign[];
		},

		async updateCampaign(id, updates) {
			const campaign = await findCampaign(id);
			if (!campaign) return null;

			const now = new Date();
			const updated: PreorderCampaign = {
				...campaign,
				...(updates.productName !== undefined
					? { productName: updates.productName }
					: {}),
				...(updates.paymentType !== undefined
					? { paymentType: updates.paymentType }
					: {}),
				...(updates.depositAmount !== undefined
					? { depositAmount: updates.depositAmount }
					: {}),
				...(updates.depositPercent !== undefined
					? { depositPercent: updates.depositPercent }
					: {}),
				...(updates.price !== undefined ? { price: updates.price } : {}),
				...(updates.maxQuantity !== undefined
					? { maxQuantity: updates.maxQuantity }
					: {}),
				...(updates.endDate !== undefined ? { endDate: updates.endDate } : {}),
				...(updates.estimatedShipDate !== undefined
					? { estimatedShipDate: updates.estimatedShipDate }
					: {}),
				...(updates.message !== undefined ? { message: updates.message } : {}),
				updatedAt: now,
			};

			await saveCampaign(updated);
			return updated;
		},

		async activateCampaign(id) {
			const campaign = await findCampaign(id);
			if (!campaign) return null;
			if (campaign.status !== "draft" && campaign.status !== "paused") {
				return null;
			}

			const now = new Date();
			const updated: PreorderCampaign = {
				...campaign,
				status: "active",
				updatedAt: now,
			};
			await saveCampaign(updated);
			return updated;
		},

		async pauseCampaign(id) {
			const campaign = await findCampaign(id);
			if (!campaign) return null;
			if (campaign.status !== "active") return null;

			const now = new Date();
			const updated: PreorderCampaign = {
				...campaign,
				status: "paused",
				updatedAt: now,
			};
			await saveCampaign(updated);
			return updated;
		},

		async completeCampaign(id) {
			const campaign = await findCampaign(id);
			if (!campaign) return null;
			if (campaign.status !== "active" && campaign.status !== "paused") {
				return null;
			}

			const now = new Date();
			const updated: PreorderCampaign = {
				...campaign,
				status: "completed",
				updatedAt: now,
			};
			await saveCampaign(updated);
			return updated;
		},

		async cancelCampaign(id, reason) {
			const campaign = await findCampaign(id);
			if (!campaign) return null;
			if (campaign.status === "completed" || campaign.status === "cancelled") {
				return campaign;
			}

			const now = new Date();
			const updated: PreorderCampaign = {
				...campaign,
				status: "cancelled",
				updatedAt: now,
			};
			await saveCampaign(updated);

			// Cancel all pending/confirmed preorder items
			const items = await data.findMany("preorderItem", {
				where: { campaignId: id },
			});
			for (const raw of items) {
				const item = raw as unknown as PreorderItem;
				if (CANCELLABLE_ITEM_STATUSES.includes(item.status)) {
					const cancelledItem: PreorderItem = {
						...item,
						status: "cancelled",
						cancelledAt: now,
						cancelReason: reason ?? "Campaign cancelled",
						updatedAt: now,
					};
					await saveItem(cancelledItem);
				}
			}

			return updated;
		},

		async placePreorder(params) {
			const campaign = await findCampaign(params.campaignId);
			if (!campaign) return null;
			if (!isCampaignAcceptingOrders(campaign)) return null;

			if (
				campaign.maxQuantity &&
				campaign.currentQuantity + params.quantity > campaign.maxQuantity
			) {
				return null;
			}

			const now = new Date();
			const id = crypto.randomUUID();
			const totalPrice = campaign.price * params.quantity;
			const depositPaid = calculateDeposit(campaign, params.quantity);

			const item: PreorderItem = {
				id,
				campaignId: params.campaignId,
				customerId: params.customerId,
				customerEmail: params.customerEmail,
				quantity: params.quantity,
				status: "pending",
				depositPaid,
				totalPrice,
				createdAt: now,
				updatedAt: now,
			};

			await saveItem(item);

			// Update campaign quantity
			const updatedCampaign: PreorderCampaign = {
				...campaign,
				currentQuantity: campaign.currentQuantity + params.quantity,
				updatedAt: now,
			};
			await saveCampaign(updatedCampaign);

			return item;
		},

		async getPreorderItem(id) {
			return findItem(id);
		},

		async listPreorderItems(params) {
			const where: Record<string, unknown> = {};
			if (params?.campaignId) where.campaignId = params.campaignId;
			if (params?.customerId) where.customerId = params.customerId;
			if (params?.status) where.status = params.status;

			const all = await data.findMany("preorderItem", {
				...(Object.keys(where).length > 0 ? { where } : {}),
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as PreorderItem[];
		},

		async getCustomerPreorders(customerId, params) {
			const all = await data.findMany("preorderItem", {
				where: { customerId },
				...(params?.take !== undefined ? { take: params.take } : {}),
				...(params?.skip !== undefined ? { skip: params.skip } : {}),
			});
			return all as unknown as PreorderItem[];
		},

		async cancelPreorderItem(id, reason) {
			const item = await findItem(id);
			if (!item) return null;
			if (!CANCELLABLE_ITEM_STATUSES.includes(item.status)) return item;

			const now = new Date();
			const cancelled: PreorderItem = {
				...item,
				status: "cancelled",
				cancelledAt: now,
				cancelReason: reason,
				updatedAt: now,
			};
			await saveItem(cancelled);

			// Reduce campaign currentQuantity
			const campaign = await findCampaign(item.campaignId);
			if (campaign) {
				const updatedCampaign: PreorderCampaign = {
					...campaign,
					currentQuantity: Math.max(
						0,
						campaign.currentQuantity - item.quantity,
					),
					updatedAt: now,
				};
				await saveCampaign(updatedCampaign);
			}

			return cancelled;
		},

		async fulfillPreorderItem(id, orderId) {
			const item = await findItem(id);
			if (!item) return null;
			if (item.status !== "confirmed" && item.status !== "ready") {
				return null;
			}

			const now = new Date();
			const fulfilled: PreorderItem = {
				...item,
				status: "fulfilled",
				fulfilledAt: now,
				...(orderId !== undefined ? { orderId } : {}),
				updatedAt: now,
			};
			await saveItem(fulfilled);
			return fulfilled;
		},

		async markReady(id) {
			const item = await findItem(id);
			if (!item) return null;
			if (item.status !== "confirmed") return null;

			const now = new Date();
			const ready: PreorderItem = {
				...item,
				status: "ready",
				updatedAt: now,
			};
			await saveItem(ready);
			return ready;
		},

		async notifyCustomers(campaignId) {
			const items = await data.findMany("preorderItem", {
				where: { campaignId },
			});
			const now = new Date();
			const notifiedIds: string[] = [];

			for (const raw of items) {
				const item = raw as unknown as PreorderItem;
				if (
					(item.status === "confirmed" || item.status === "ready") &&
					!item.notifiedAt
				) {
					const notified: PreorderItem = {
						...item,
						notifiedAt: now,
						updatedAt: now,
					};
					await saveItem(notified);
					notifiedIds.push(item.id);
				}
			}

			return { notified: notifiedIds.length, itemIds: notifiedIds };
		},

		async getSummary() {
			const campaigns = await data.findMany("preorderCampaign", {});
			const items = await data.findMany("preorderItem", {});
			const campaignList = campaigns as unknown as PreorderCampaign[];
			const itemList = items as unknown as PreorderItem[];

			let activeCampaigns = 0;
			for (const c of campaignList) {
				if (c.status === "active") activeCampaigns++;
			}

			let pendingItems = 0;
			let confirmedItems = 0;
			let fulfilledItems = 0;
			let cancelledItems = 0;
			let totalRevenue = 0;
			let totalDeposits = 0;

			for (const item of itemList) {
				switch (item.status) {
					case "pending":
						pendingItems++;
						break;
					case "confirmed":
					case "ready":
						confirmedItems++;
						break;
					case "fulfilled":
						fulfilledItems++;
						break;
					case "cancelled":
					case "refunded":
						cancelledItems++;
						break;
				}
				if (item.status !== "cancelled" && item.status !== "refunded") {
					totalRevenue += item.totalPrice;
					totalDeposits += item.depositPaid;
				}
			}

			return {
				totalCampaigns: campaignList.length,
				activeCampaigns,
				totalItems: itemList.length,
				pendingItems,
				confirmedItems,
				fulfilledItems,
				cancelledItems,
				totalRevenue,
				totalDeposits,
			};
		},

		async getActiveCampaignForProduct(productId, variantId) {
			const where: Record<string, unknown> = {
				productId,
				status: "active",
			};
			if (variantId) where.variantId = variantId;

			const results = await data.findMany("preorderCampaign", {
				where,
				take: 1,
			});
			const campaigns = results as unknown as PreorderCampaign[];
			if (campaigns.length === 0) return null;

			const campaign = campaigns[0];
			if (!isCampaignAcceptingOrders(campaign)) return null;
			return campaign;
		},
	};
}
