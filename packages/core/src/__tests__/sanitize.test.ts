import { describe, expect, it } from "vitest";
import {
	escapeScriptContent,
	isSafeUrl,
	normalizeWhitespace,
	sanitizeHtml,
	sanitizeText,
	stripTags,
} from "../sanitize";

describe("stripTags", () => {
	it("removes simple HTML tags", () => {
		expect(stripTags("<b>bold</b> text")).toBe("bold text");
	});

	it("removes self-closing tags", () => {
		expect(stripTags("hello<br/>world")).toBe("helloworld");
	});

	it("removes script content entirely", () => {
		expect(stripTags('before<script>alert("xss")</script>after')).toBe(
			"beforeafter",
		);
	});

	it("removes style content entirely", () => {
		expect(stripTags("text<style>body{color:red}</style>more")).toBe(
			"textmore",
		);
	});

	it("handles nested tags", () => {
		expect(stripTags("<div><span>inner</span></div>")).toBe("inner");
	});

	it("returns plain text unchanged", () => {
		expect(stripTags("no tags here")).toBe("no tags here");
	});

	it("handles empty string", () => {
		expect(stripTags("")).toBe("");
	});

	it("handles multiple script tags", () => {
		expect(
			stripTags('<script>a</script>ok<script type="module">b</script>'),
		).toBe("ok");
	});

	it("defeats nested/reassembled script tags", () => {
		expect(stripTags("<scr<script>ipt>alert(1)</script>")).toBe("");
		// After the inner empty script is removed, residual text remains — no tags.
		expect(stripTags("<scr<script></script>ipt>alert(1)</script>")).toBe(
			"ipt>alert(1)",
		);
	});

	it("matches spaced script end tags", () => {
		expect(stripTags("before<script>x</script >after")).toBe("beforeafter");
	});

	it("drops unclosed script content", () => {
		expect(stripTags("before<script>still running")).toBe("before");
	});
});

describe("normalizeWhitespace", () => {
	it("collapses multiple spaces", () => {
		expect(normalizeWhitespace("hello    world")).toBe("hello world");
	});

	it("collapses tabs and newlines", () => {
		expect(normalizeWhitespace("hello\t\n\tworld")).toBe("hello world");
	});

	it("trims leading and trailing whitespace", () => {
		expect(normalizeWhitespace("  hello  ")).toBe("hello");
	});

	it("handles empty string", () => {
		expect(normalizeWhitespace("")).toBe("");
	});

	it("handles whitespace-only string", () => {
		expect(normalizeWhitespace("   \t\n  ")).toBe("");
	});
});

describe("sanitizeText", () => {
	it("strips tags and normalizes whitespace", () => {
		expect(sanitizeText("<b>Hello</b>   <i>World</i>")).toBe("Hello World");
	});

	it("handles script injection attempt", () => {
		expect(sanitizeText('<script>alert("xss")</script>Clean text')).toBe(
			"Clean text",
		);
	});

	it("handles normal text without modification", () => {
		expect(sanitizeText("Normal product name")).toBe("Normal product name");
	});

	it("handles multiline input with tags", () => {
		expect(sanitizeText("<p>Line one</p>\n<p>Line two</p>")).toBe(
			"Line one Line two",
		);
	});

	it("preserves special characters that are not tags", () => {
		expect(sanitizeText("Price: $10 & 20% off")).toBe("Price: $10 & 20% off");
	});

	it("handles empty string", () => {
		expect(sanitizeText("")).toBe("");
	});
});

describe("sanitizeHtml", () => {
	it("removes script tags and content", () => {
		expect(sanitizeHtml('<p>Safe</p><script>alert("xss")</script>')).toBe(
			"<p>Safe</p>",
		);
	});

	it("removes style tags and content", () => {
		expect(sanitizeHtml("<div>Ok</div><style>*{display:none}</style>")).toBe(
			"<div>Ok</div>",
		);
	});

	it("removes iframe tags", () => {
		expect(sanitizeHtml('<p>Content</p><iframe src="evil.com"></iframe>')).toBe(
			"<p>Content</p>",
		);
	});

	it("removes self-closing iframes", () => {
		expect(sanitizeHtml('<p>Ok</p><iframe src="x" />')).toBe("<p>Ok</p>");
	});

	it("removes object tags", () => {
		expect(sanitizeHtml('<object data="x.swf">fallback</object>')).toBe("");
	});

	it("removes embed tags", () => {
		expect(sanitizeHtml('<embed src="x.swf" />')).toBe("");
	});

	it("removes form tags and content", () => {
		expect(
			sanitizeHtml('<form action="/steal"><input name="pw"/></form>'),
		).toBe("");
	});

	it("removes event handler attributes", () => {
		expect(sanitizeHtml('<img src="x.jpg" onerror="alert(1)">')).toBe(
			'<img src="x.jpg" />',
		);
	});

	it("removes onclick attributes", () => {
		expect(sanitizeHtml('<a href="/ok" onclick="steal()">Link</a>')).toBe(
			'<a href="/ok">Link</a>',
		);
	});

	it("drops an unsafe href rather than blanking it", () => {
		expect(sanitizeHtml('<a href="javascript:alert(1)">Click</a>')).toBe(
			"<a>Click</a>",
		);
	});

	it("preserves safe HTML tags", () => {
		const safe =
			'<h1>Title</h1><p>Para with <strong>bold</strong> and <a href="/link">link</a></p>';
		expect(sanitizeHtml(safe)).toBe(safe);
	});

	it("preserves safe attributes", () => {
		expect(
			sanitizeHtml('<img src="photo.jpg" alt="A photo" class="rounded">'),
		).toBe('<img src="photo.jpg" alt="A photo" class="rounded" />');
	});

	// Each of these defeated the previous pattern-replacement sanitizer. The
	// allow-list emits only attributes it recognizes, so the separator, casing,
	// or encoding an author reaches for no longer decides the outcome.
	it.each([
		["attribute separated by a slash", "<img src=x/onerror=alert(1)>"],
		["tag and attribute both slashed", "<img/src=x/onerror=alert(1)>"],
		["newline separator", "<img src=x\nonerror=alert(1)>"],
		["tab separator", "<img src=x\tonerror=alert(1)>"],
		["uppercase handler", "<IMG SRC=x ONERROR=alert(1)>"],
		["newline before equals", "<img src=x onerror\n=alert(1)>"],
		["svg with slashed handler", "<svg/onload=alert(1)>"],
		["nested script tags", "<scr<script>ipt>alert(1)</script>"],
		["hex-encoded scheme", '<a href="jav&#x61;script:alert(1)">x</a>'],
		["decimal-encoded scheme", '<a href="&#106;avascript:alert(1)">x</a>'],
		["entity-encoded colon", '<a href="javascript&colon;alert(1)">x</a>'],
		["backtick handler value", '<img src="x" onerror=`alert(1)`>'],
		[
			"iframe srcdoc",
			'<iframe srcdoc="&lt;script&gt;alert(1)&lt;/script&gt;">',
		],
		["form action", "<form action=javascript:alert(1)></form>"],
		[
			"mXSS through foreign content",
			"<math><mtext><table><mglyph><style><img src=x onerror=alert(1)>",
		],
		["comment breakout", "<!--><img src=x onerror=alert(1)>"],
	])("neutralizes %s", (_label, payload) => {
		expect(sanitizeHtml(payload)).not.toMatch(
			/on[a-z]+\s*=|javascript:|<script|<iframe|<svg|<math|srcdoc/i,
		);
	});

	it("adds rel to a new browsing context", () => {
		expect(
			sanitizeHtml('<a href="https://x.com" target="_blank">out</a>'),
		).toBe(
			'<a href="https://x.com" target="_blank" rel="noopener noreferrer">out</a>',
		);
	});

	it("escapes text that is not markup", () => {
		expect(sanitizeHtml("2 < 3 and 5 > 4")).toBe("2 &lt; 3 and 5 &gt; 4");
	});

	it("handles empty string", () => {
		expect(sanitizeHtml("")).toBe("");
	});

	it("handles plain text", () => {
		expect(sanitizeHtml("Just text")).toBe("Just text");
	});
});

describe("isSafeUrl", () => {
	it("accepts normal URLs", () => {
		expect(isSafeUrl("https://example.com")).toBe(true);
		expect(isSafeUrl("/products/123")).toBe(true);
		expect(isSafeUrl("mailto:user@example.com")).toBe(true);
	});

	it("rejects javascript: URIs", () => {
		expect(isSafeUrl("javascript:alert(1)")).toBe(false);
		expect(isSafeUrl("JAVASCRIPT:alert(1)")).toBe(false);
		expect(isSafeUrl("  javascript:alert(1)")).toBe(false);
	});

	it("rejects data: URIs", () => {
		expect(isSafeUrl("data:text/html,<script>alert(1)</script>")).toBe(false);
	});

	it("rejects vbscript: URIs", () => {
		expect(isSafeUrl("vbscript:msgbox")).toBe(false);
	});

	it("rejects obfuscated javascript: URIs with control chars", () => {
		expect(isSafeUrl("java\tscript:alert(1)")).toBe(false);
		expect(isSafeUrl("java\nscript:alert(1)")).toBe(false);
	});

	// Each of these returned true from the previous scheme check, which compared
	// the raw string while the browser compares the decoded one.
	it.each([
		["hex character reference", "jav&#x61;script:alert(1)"],
		["decimal character reference", "&#106;avascript:alert(1)"],
		["entity-encoded colon", "javascript&colon;alert(1)"],
		["double-encoded reference", "jav&amp;#x61;script:alert(1)"],
	])("rejects a scheme hidden behind a %s", (_label, url) => {
		expect(isSafeUrl(url)).toBe(false);
	});

	it("rejects a scheme it has never heard of", () => {
		expect(isSafeUrl("chrome://settings")).toBe(false);
		expect(isSafeUrl("file:///etc/passwd")).toBe(false);
	});

	it("accepts relative and protocol-relative URLs", () => {
		expect(isSafeUrl("products/1")).toBe(true);
		expect(isSafeUrl("//cdn.example.com/x.png")).toBe(true);
		expect(isSafeUrl("?q=1")).toBe(true);
		expect(isSafeUrl("tel:+15551234")).toBe(true);
	});

	it("accepts empty string", () => {
		expect(isSafeUrl("")).toBe(true);
	});
});

describe("escapeScriptContent", () => {
	it("escapes closing script tags", () => {
		expect(escapeScriptContent("</script>")).toBe("<\\/script>");
	});

	it("escapes HTML comments", () => {
		expect(escapeScriptContent("<!--")).toBe("<\\!--");
	});

	it("escapes both patterns in JSON", () => {
		const json = '{"html":"</script>","comment":"<!--test-->"}';
		const escaped = escapeScriptContent(json);
		expect(escaped).not.toContain("</");
		expect(escaped).not.toContain("<!--");
		expect(escaped).toBe('{"html":"<\\/script>","comment":"<\\!--test-->"}');
	});

	it("leaves safe content unchanged", () => {
		const safe = '{"name":"Product","price":9.99}';
		expect(escapeScriptContent(safe)).toBe(safe);
	});

	it("handles empty string", () => {
		expect(escapeScriptContent("")).toBe("");
	});
});
