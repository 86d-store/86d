/**
 * Input sanitization utilities for module authors.
 *
 * These functions are dependency-free so they can live inside @86d-app/core
 * without pulling in external packages, and so they are safe to import from a
 * client bundle.
 *
 * Everything here is an allow-list. A sanitizer that removes known-bad markup
 * is only as good as its list of attack shapes, and HTML has more separators,
 * encodings, and parsing quirks than any pattern set covers. These functions
 * instead emit only what they positively recognize, so an input the sanitizer
 * does not understand is dropped rather than passed through.
 */

/**
 * Strip HTML/XML tags from a string.
 * Removes `<script>` and `<style>` content entirely before stripping tags.
 *
 * Uses an index walk instead of regex so nested/reassembled markup and
 * forgiving end-tag forms cannot survive one pass, and so the scan stays linear.
 */
export function stripTags(input: string): string {
	let out = "";
	let i = 0;
	while (i < input.length) {
		const lt = input.indexOf("<", i);
		if (lt === -1) {
			out += input.slice(i);
			break;
		}
		out += input.slice(i, lt);

		const closing = input[lt + 1] === "/";
		let p = lt + 1 + (closing ? 1 : 0);
		if (p >= input.length || !isAsciiLetter(input.charCodeAt(p))) {
			// Bare "<" or non-tag — drop the angle and keep scanning.
			i = lt + 1;
			continue;
		}
		const nameStart = p;
		while (p < input.length && isAsciiTagNameChar(input.charCodeAt(p))) {
			p += 1;
		}
		const name = input.slice(nameStart, p).toLowerCase();

		// If another "<" appears before ">", restart at the inner angle so
		// reassembled tags like <scr<script>ipt>… cannot survive.
		const nextLt = input.indexOf("<", p);
		const gt = input.indexOf(">", p);
		if (gt === -1) {
			break;
		}
		if (nextLt !== -1 && nextLt < gt) {
			i = nextLt;
			continue;
		}
		i = gt + 1;

		if (!closing && (name === "script" || name === "style")) {
			const close = `</${name}`;
			let k = indexOfIgnoreCase(input, close, i);
			while (k !== -1) {
				const after = k + close.length;
				const boundary = input[after];
				if (
					boundary === undefined ||
					boundary === ">" ||
					boundary === "/" ||
					isAsciiWhitespace(boundary.charCodeAt(0))
				) {
					const end = input.indexOf(">", after);
					if (end === -1) {
						return out;
					}
					i = end + 1;
					break;
				}
				k = indexOfIgnoreCase(input, close, after);
			}
			if (k === -1) {
				return out;
			}
		}
	}
	return out;
}

function isAsciiLetter(code: number): boolean {
	return (code >= 65 && code <= 90) || (code >= 97 && code <= 122);
}

function isAsciiTagNameChar(code: number): boolean {
	return (
		isAsciiLetter(code) ||
		(code >= 48 && code <= 57) ||
		code === 45 /* - */ ||
		code === 58 /* : */
	);
}

function isAsciiWhitespace(code: number): boolean {
	return code === 9 || code === 10 || code === 12 || code === 13 || code === 32;
}

function indexOfIgnoreCase(
	haystack: string,
	needle: string,
	from: number,
): number {
	const lowerNeedle = needle.toLowerCase();
	const end = haystack.length - lowerNeedle.length;
	for (let i = from; i <= end; i += 1) {
		if (
			haystack.slice(i, i + lowerNeedle.length).toLowerCase() === lowerNeedle
		) {
			return i;
		}
	}
	return -1;
}

/**
 * Collapse multiple whitespace characters into a single space and trim.
 */
export function normalizeWhitespace(input: string): string {
	return input.replace(/\s+/g, " ").trim();
}

/**
 * Sanitize user-provided text for safe storage: strip HTML tags and
 * normalize whitespace. Use this on every user-facing text field
 * (names, descriptions, titles, bodies, etc.) before persisting.
 */
export function sanitizeText(input: string): string {
	return normalizeWhitespace(stripTags(input));
}

/**
 * Escape an attribute value. Attribute values are decoded before they are
 * checked, so every `&` reaching here is a literal one.
 */
function escapeAttribute(value: string): string {
	return value
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;")
		.replace(/'/g, "&#39;");
}

/**
 * Escape a text node, leaving character references the author already wrote
 * intact. Escaping every `&` would turn a legitimate `&amp;` into a visible
 * `&amp;` on first pass and compound on every pass after it.
 */
function escapeText(value: string): string {
	return value
		.replace(/&(?!#\d+;|#[xX][0-9a-fA-F]+;|[a-zA-Z][a-zA-Z0-9]*;)/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

/**
 * Decode the HTML character references a browser resolves inside an attribute
 * value before it interprets that value as a URL. `jav&#x61;script:` reaches
 * the URL parser as `javascript:`, so a scheme check that skips this step reads
 * a different string than the browser does.
 */
function decodeCharacterReferences(value: string): string {
	const named: Record<string, string> = {
		amp: "&",
		lt: "<",
		gt: ">",
		quot: '"',
		apos: "'",
		nbsp: " ",
		Tab: "\t",
		NewLine: "\n",
		colon: ":",
		sol: "/",
	};
	// Repeat until stable so a double-encoded reference cannot survive one pass.
	let current = value;
	for (let pass = 0; pass < 3; pass += 1) {
		const next = current.replace(
			/&(#[xX][0-9a-fA-F]+|#\d+|[a-zA-Z][a-zA-Z0-9]*);?/g,
			(match, entity: string) => {
				if (entity.startsWith("#x") || entity.startsWith("#X")) {
					const code = Number.parseInt(entity.slice(2), 16);
					return Number.isFinite(code) ? safeFromCodePoint(code, match) : match;
				}
				if (entity.startsWith("#")) {
					const code = Number.parseInt(entity.slice(1), 10);
					return Number.isFinite(code) ? safeFromCodePoint(code, match) : match;
				}
				return named[entity] ?? match;
			},
		);
		if (next === current) break;
		current = next;
	}
	return current;
}

function safeFromCodePoint(code: number, fallback: string): string {
	if (code < 0 || code > 0x10ffff) return fallback;
	try {
		return String.fromCodePoint(code);
	} catch {
		return fallback;
	}
}

/** Schemes a URL may use when it will be rendered into an `href` or `src`. */
const ALLOWED_URL_SCHEMES = new Set(["http:", "https:", "mailto:", "tel:"]);

/**
 * Check whether a URL string is safe for use in `href` / `src` attributes.
 *
 * Allows absolute URLs on http, https, mailto, and tel; page-relative and
 * protocol-relative URLs; and fragments. Everything else is rejected, so a
 * scheme this function has never heard of does not reach the browser.
 *
 * Use as a Zod `.refine()` guard on any URL field that will be rendered
 * as an HTML attribute.
 */
/**
 * Match the browser URL preprocessor with linear scans: drop TAB/LF/CR
 * anywhere, then trim leading/trailing C0 controls and space.
 */
function stripBrowserUrlNoise(url: string): string {
	const decoded = decodeCharacterReferences(url);
	let buf = "";
	for (let i = 0; i < decoded.length; i += 1) {
		const c = decoded.charCodeAt(i);
		if (c !== 0x09 && c !== 0x0a && c !== 0x0d) {
			buf += decoded[i];
		}
	}
	let start = 0;
	let end = buf.length;
	while (start < end && buf.charCodeAt(start) <= 0x20) {
		start += 1;
	}
	while (end > start && buf.charCodeAt(end - 1) <= 0x20) {
		end -= 1;
	}
	return buf.slice(start, end);
}

export function isSafeUrl(url: string): boolean {
	// A browser resolves character references, drops tab, newline, and carriage
	// return from anywhere in the value, and trims leading and trailing C0
	// controls and space, all before it reads the scheme. Reading the same
	// string the browser reads is the whole job.
	const candidate = stripBrowserUrlNoise(url);

	if (candidate === "") return true;
	// Relative, root-relative, protocol-relative, and fragment-only URLs carry
	// no scheme, so they inherit the page's and cannot introduce one.
	if (/^[/#?]/.test(candidate)) return true;

	// A colon before the first slash, question mark, or hash is a scheme.
	// Without one the value is a relative path.
	const schemeEnd = candidate.indexOf(":");
	if (schemeEnd === -1) return true;
	const beforeColon = candidate.slice(0, schemeEnd);
	if (/[/?#]/.test(beforeColon)) return true;
	if (!/^[a-zA-Z][a-zA-Z0-9+.-]*$/.test(beforeColon)) return false;

	return ALLOWED_URL_SCHEMES.has(`${beforeColon.toLowerCase()}:`);
}

/** Tags that may appear in sanitized rich text, mapped to the attributes each may carry. */
const ALLOWED_HTML: Record<string, readonly string[]> = {
	p: [],
	br: [],
	hr: [],
	strong: [],
	b: [],
	em: [],
	i: [],
	u: [],
	s: [],
	sub: [],
	sup: [],
	code: [],
	pre: [],
	blockquote: [],
	h1: [],
	h2: [],
	h3: [],
	h4: [],
	h5: [],
	h6: [],
	ul: [],
	ol: ["start"],
	li: [],
	dl: [],
	dt: [],
	dd: [],
	span: [],
	div: [],
	figure: [],
	figcaption: [],
	table: [],
	thead: [],
	tbody: [],
	tfoot: [],
	tr: [],
	th: ["colspan", "rowspan", "scope"],
	td: ["colspan", "rowspan"],
	caption: [],
	a: ["href", "title", "target"],
	img: ["src", "alt", "title", "width", "height", "loading"],
};

/** Allowed on every permitted tag. `id` is omitted: a matching id clobbers a same-named global. */
const GLOBAL_ATTRIBUTES: readonly string[] = ["class"];

const VOID_HTML = new Set(["br", "hr", "img"]);
/** Disallowed tags whose content is markup a browser would still act on. */
const DROP_CONTENT_HTML = new Set([
	"iframe",
	"object",
	"embed",
	"applet",
	"form",
	"frame",
	"frameset",
	"noscript",
	"noembed",
	"template",
	"svg",
	"math",
]);
/** Tags whose content is script or style data rather than markup. */
const RAW_TEXT_HTML = new Set(["script", "style", "title", "textarea", "xmp"]);
const URL_ATTRIBUTES = new Set(["href", "src"]);
const NUMERIC_ATTRIBUTES = new Set([
	"colspan",
	"rowspan",
	"start",
	"width",
	"height",
]);

const TAG_START = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/;
/** name, then optionally `= value` as double-quoted, single-quoted, or bare. */
const ATTRIBUTE =
	/([^\s/>"'=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s/>]*)))?/gy;

function attributeValueIsAllowed(name: string, value: string): boolean {
	if (URL_ATTRIBUTES.has(name)) return isSafeUrl(value);
	if (NUMERIC_ATTRIBUTES.has(name)) return /^\d{1,6}$/.test(value);
	if (name === "target") return value === "_blank";
	if (name === "loading") return value === "lazy" || value === "eager";
	if (name === "scope") return value === "row" || value === "col";
	return true;
}

/**
 * Sanitize rich HTML for rendering with `dangerouslySetInnerHTML`.
 *
 * The output is rebuilt rather than filtered: text is escaped, and a tag is
 * emitted only when its name is in the allow-list, carrying only the attributes
 * that tag is allowed and only when their values validate. An attribute this
 * function does not recognize never reaches the output, so it does not matter
 * what separator, casing, or encoding an author used to write it.
 *
 * Prefer sanitizing at the point content is accepted rather than at render, so
 * what is stored is what is safe.
 */
export function sanitizeHtml(input: string): string {
	let out = "";
	let index = 0;
	const open: string[] = [];

	while (index < input.length) {
		const next = input.indexOf("<", index);
		if (next === -1) {
			out += escapeText(input.slice(index));
			break;
		}
		out += escapeText(input.slice(index, next));

		const rest = input.slice(next);
		// Comments, doctypes, and CDATA carry no rendered content worth keeping.
		if (rest.startsWith("<!--")) {
			const end = input.indexOf("-->", next + 4);
			index = end === -1 ? input.length : end + 3;
			continue;
		}
		if (rest.startsWith("<!") || rest.startsWith("<?")) {
			const end = input.indexOf(">", next + 2);
			index = end === -1 ? input.length : end + 1;
			continue;
		}

		const match = TAG_START.exec(rest);
		if (!match) {
			// Not a tag a parser would recognize; treat the character as text.
			out += "&lt;";
			index = next + 1;
			continue;
		}

		const closing = match[1] === "/";
		const name = match[2].toLowerCase();
		const { attributes, end } = readTag(input, next + match[0].length);
		index = end;

		if (RAW_TEXT_HTML.has(name)) {
			if (!closing) index = skipRawText(input, index, name);
			continue;
		}
		if (DROP_CONTENT_HTML.has(name)) {
			if (!closing) index = skipElement(input, index, name);
			continue;
		}
		if (!(name in ALLOWED_HTML)) continue;

		if (closing) {
			const at = open.lastIndexOf(name);
			if (at === -1) continue;
			// Close anything left open inside it so the output stays balanced.
			for (let i = open.length - 1; i >= at; i -= 1) out += `</${open[i]}>`;
			open.length = at;
			continue;
		}

		out += `<${name}`;
		const allowed = ALLOWED_HTML[name];
		let blank = false;
		for (const [attrName, attrValue] of attributes) {
			if (!allowed.includes(attrName) && !GLOBAL_ATTRIBUTES.includes(attrName))
				continue;
			if (!attributeValueIsAllowed(attrName, attrValue)) continue;
			out += ` ${attrName}="${escapeAttribute(attrValue)}"`;
			if (attrName === "target" && attrValue === "_blank") blank = true;
		}
		// A new browsing context keeps a reference to this one unless told otherwise.
		if (blank) out += ` rel="noopener noreferrer"`;

		if (VOID_HTML.has(name)) {
			out += " />";
		} else {
			out += ">";
			open.push(name);
		}
	}

	for (let i = open.length - 1; i >= 0; i -= 1) out += `</${open[i]}>`;
	return out;
}

/** Read attributes until the tag closes, returning them and the index after `>`. */
function readTag(
	input: string,
	from: number,
): { attributes: [string, string][]; end: number } {
	const attributes: [string, string][] = [];
	let i = from;
	while (i < input.length) {
		const char = input[i];
		if (char === ">") return { attributes, end: i + 1 };
		// `/` and whitespace both separate attributes, which is why a pattern
		// anchored on whitespace alone misses `<img src=x/onerror=...>`.
		if (char === "/" || /\s/.test(char)) {
			i += 1;
			continue;
		}
		ATTRIBUTE.lastIndex = i;
		const found = ATTRIBUTE.exec(input);
		if (!found || found.index !== i) {
			i += 1;
			continue;
		}
		const value = found[2] ?? found[3] ?? found[4] ?? "";
		attributes.push([found[1].toLowerCase(), decodeCharacterReferences(value)]);
		i = ATTRIBUTE.lastIndex;
	}
	return { attributes, end: input.length };
}

/** Skip a disallowed element and everything nested inside it. */
function skipElement(input: string, from: number, name: string): number {
	const token = new RegExp(`<(/?)${name}(?![a-zA-Z0-9])[^>]*>`, "gi");
	token.lastIndex = from;
	let depth = 1;
	let found = token.exec(input);
	while (found) {
		depth += found[1] === "/" ? -1 : 1;
		if (depth === 0) return token.lastIndex;
		found = token.exec(input);
	}
	return input.length;
}

/** Skip to the end of a raw-text element, whose content is never markup. */
function skipRawText(input: string, from: number, name: string): number {
	const close = new RegExp(`</${name}\\s*>`, "i");
	const rest = input.slice(from);
	const found = close.exec(rest);
	return found ? from + found.index + found[0].length : input.length;
}

/**
 * Escape a string for safe embedding inside a `<script>` tag.
 * Prevents script-tag breakout by encoding `</` and `<!--` sequences.
 * Use this when injecting JSON or data into inline `<script>` blocks.
 */
export function escapeScriptContent(input: string): string {
	return input.replace(/<\//g, "<\\/").replace(/<!--/g, "<\\!--");
}
