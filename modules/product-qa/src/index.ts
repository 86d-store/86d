import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { productQaStorage } from "./schema";
import { createProductQaController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Answer,
	AnswerStatus,
	ProductQaController,
	ProductQaSummary,
	QaAnalytics,
	Question,
	QuestionStatus,
} from "./service";

export interface ProductQaOptions extends ModuleConfig {
	/** Auto-publish questions without moderation */
	autoPublish?: string;
}

export default function productQa(options?: ProductQaOptions): Module {
	return {
		id: "product-qa",
		version: "0.0.1",
		storage: productQaStorage,
		exports: {
			read: ["questionCount", "answeredCount"],
		},
		events: {
			emits: [
				"question.submitted",
				"question.published",
				"question.rejected",
				"answer.submitted",
				"answer.published",
				"answer.official",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createProductQaController(
				ctx.data,
				{ autoPublish: options?.autoPublish === "true" },
				ctx.events,
			);
			return { controllers: { productQa: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/product-qa",
					component: "QuestionList",
					label: "Product Q&A",
					icon: "HelpCircle",
					group: "Marketing",
				},
				{
					path: "/admin/product-qa/analytics",
					component: "QaAnalytics",
					label: "Q&A Analytics",
					icon: "ChartBar",
					group: "Marketing",
				},
				{
					path: "/admin/product-qa/:id",
					component: "QuestionDetail",
				},
			],
		},
		options,
	};
}
