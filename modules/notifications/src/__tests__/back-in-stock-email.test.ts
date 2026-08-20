import { describe, expect, it } from "vitest";
import { buildBackInStockEmail } from "../emails/back-in-stock";

describe("buildBackInStockEmail", () => {
	it("returns correct subject with product name", () => {
		const { subject } = buildBackInStockEmail({
			productName: "Blue Running Shoes",
		});
		expect(subject).toBe("Blue Running Shoes is back in stock!");
	});

	it("includes product name in html and text", () => {
		const { html, text } = buildBackInStockEmail({
			productName: "Blue Running Shoes",
		});
		expect(html).toContain("Blue Running Shoes");
		expect(text).toContain("Blue Running Shoes");
	});

	it("includes shop now button when productUrl provided", () => {
		const { html, text } = buildBackInStockEmail({
			productName: "Sneakers",
			productUrl: "https://store.com/products/sneakers",
		});
		expect(html).toContain("Shop Now");
		expect(html).toContain("https://store.com/products/sneakers");
		expect(text).toContain("https://store.com/products/sneakers");
	});

	it("omits shop now button when productUrl not provided", () => {
		const { html } = buildBackInStockEmail({ productName: "Sneakers" });
		expect(html).not.toContain("Shop Now");
	});

	it("escapes html special characters in product name", () => {
		const { html } = buildBackInStockEmail({
			productName: "Shoes & Bags <Sale>",
		});
		expect(html).not.toContain("<Sale>");
		expect(html).toContain("&lt;Sale&gt;");
		expect(html).toContain("&amp;");
	});

	it("returns valid html with doctype", () => {
		const { html } = buildBackInStockEmail({ productName: "Widget" });
		expect(html).toContain("<!DOCTYPE html>");
		expect(html).toContain("</html>");
	});
});
