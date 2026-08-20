import { getAISimilar } from "./get-ai-similar";
import { getForProduct } from "./get-for-product";
import { getPersonalized } from "./get-personalized";
import { getTrending } from "./get-trending";
import { recordClick } from "./record-click";
import { trackInteraction } from "./track-interaction";

export const storeEndpoints = {
	"/recommendations/trending": getTrending,
	"/recommendations/personalized": getPersonalized,
	"/recommendations/track": trackInteraction,
	"/recommendations/click": recordClick,
	"/recommendations/:productId/similar": getAISimilar,
	"/recommendations/:productId": getForProduct,
};
