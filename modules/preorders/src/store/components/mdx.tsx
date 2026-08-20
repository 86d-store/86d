"use client";

import type { MDXComponents } from "mdx/types";
import { CampaignDetail } from "./campaign-detail";
import { CampaignList } from "./campaign-list";
import { MyPreorders } from "./my-preorders";
import { PreorderButton } from "./preorder-button";
import { PreordersHomepageSection } from "./preorders-homepage-section";

export {
	CampaignDetail,
	CampaignList,
	MyPreorders,
	PreorderButton,
	PreordersHomepageSection,
};

export default {
	CampaignDetail,
	CampaignList,
	MyPreorders,
	PreorderButton,
	PreordersHomepageSection,
} satisfies MDXComponents;
