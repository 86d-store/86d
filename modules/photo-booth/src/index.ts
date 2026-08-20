import type {
	Module,
	ModuleConfig,
	ModuleContext,
} from "@86d-app/core/types/module";
import { adminEndpoints } from "./admin/endpoints/routes";
import { photoBoothSchema } from "./schema";
import { createPhotoBoothController } from "./service-impl";
import { storeEndpoints } from "./store/endpoints/routes";

export type {
	Photo,
	PhotoBoothController,
	PhotoSession,
	PhotoStream,
	SendStatus,
} from "./service";

export interface PhotoBoothOptions extends ModuleConfig {
	/** Max photo size in bytes (default: "5242880" = 5MB) */
	maxPhotoSize?: string;
	/** Comma-separated allowed formats (default: "jpeg,png,webp") */
	allowedFormats?: string;
	/** Enable photo streaming (default: "true") */
	streamEnabled?: string;
	/** Require email for photo capture (default: "false") */
	requireEmail?: string;
}

export default function photoBooth(options?: PhotoBoothOptions): Module {
	return {
		id: "photo-booth",
		version: "0.0.1",
		schema: photoBoothSchema,
		exports: {
			read: ["photoImageUrl", "photoSessionName"],
		},
		events: {
			emits: [
				"photo.captured",
				"photo.sent",
				"photo.deleted",
				"stream.created",
				"stream.ended",
				"photo.shared",
			],
		},
		init: async (ctx: ModuleContext) => {
			const controller = createPhotoBoothController(ctx.data, ctx.events);
			return { controllers: { photoBooth: controller } };
		},
		endpoints: {
			store: storeEndpoints,
			admin: adminEndpoints,
		},
		admin: {
			pages: [
				{
					path: "/admin/photo-booth",
					component: "PhotoBoothAdmin",
					label: "Photo Booth",
					icon: "Camera",
					group: "Marketing",
				},
				{
					path: "/admin/photo-booth/streams",
					component: "PhotoStreamList",
					label: "Photo Streams",
					icon: "Images",
					group: "Marketing",
				},
			],
		},
		store: {
			pages: [
				{
					path: "/photo-booth",
					component: "PhotoGallery",
				},
			],
		},
		options,
	};
}
