import type { MDXComponents } from "mdx/types";
import { AnnouncementBanner } from "./announcement-banner";
import { AnnouncementBar } from "./announcement-bar";
import { AnnouncementPopup } from "./announcement-popup";

export { AnnouncementBanner, AnnouncementBar, AnnouncementPopup };

export default {
	AnnouncementBar,
	AnnouncementBanner,
	AnnouncementPopup,
} satisfies MDXComponents;
