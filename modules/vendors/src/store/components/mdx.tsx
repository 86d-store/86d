"use client";

import type { MDXComponents } from "mdx/types";
import { VendorApply } from "./vendor-apply";
import { VendorDirectory } from "./vendor-directory";
import { VendorProfile } from "./vendor-profile";

export default {
	VendorDirectory,
	VendorProfile,
	VendorApply,
} satisfies MDXComponents;
