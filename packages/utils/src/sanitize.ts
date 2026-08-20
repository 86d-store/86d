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

export function normalizeWhitespace(input: string): string {
	return input.replace(/\s+/g, " ").trim();
}

export function sanitizeText(input: string): string {
	return normalizeWhitespace(stripTags(input));
}
