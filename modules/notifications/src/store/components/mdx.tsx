"use client";

import type { MDXComponents } from "mdx/types";
import { NotificationBell } from "./notification-bell";
import { NotificationInbox } from "./notification-inbox";
import { NotificationPreferences } from "./notification-preferences";

export default {
	NotificationBell,
	NotificationInbox,
	NotificationPreferences,
} satisfies MDXComponents;
