#!/usr/bin/env python3
"""Legacy procedural asset generator for the 86d Atelier luxury seed catalog.

Canonical demo images are curated stock photos: run `bun run seed:fetch-luxury-assets`
from the repo root (public/) to download, resize, and refresh manifest attribution.
Use this script only if you need to regenerate abstract placeholders locally.
"""

from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Iterable

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageOps


ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = ROOT / "scripts" / "seed-assets" / "luxury-house"
MANIFEST_PATH = OUTPUT_DIR / "manifest.json"
PRODUCT_SIZE = (1600, 2000)
BANNER_SIZE = (2400, 1400)
RAND = random.Random(86)


Color = tuple[int, int, int]


@dataclass(frozen=True)
class AssetSpec:
	relative_path: str
	label: str
	source_note: str
	alt: str
	renderer: str
	palette: tuple[Color, Color, Color]


PRODUCT_SPECS: list[tuple[str, str, str, tuple[Color, Color, Color], str]] = [
	("regent-penny-loafer", "Regent Penny Loafer", "shoe", ((46, 36, 31), (184, 150, 116), (235, 223, 208)), "A sculpted calfskin penny loafer on a limestone plinth."),
	("montclair-chelsea-boot", "Montclair Chelsea Boot", "boot", ((60, 44, 34), (166, 134, 104), (234, 226, 214)), "A polished Chelsea boot with an elongated silhouette and soft shadow."),
	("sable-slingback-pump", "Sable Slingback Pump", "heel", ((54, 41, 47), (173, 138, 153), (240, 231, 224)), "A refined slingback pump framed like a luxury editorial product card."),
	("riviera-driving-shoe", "Riviera Driving Shoe", "moccasin", ((89, 71, 54), (198, 171, 142), (237, 228, 217)), "A supple driving shoe with artisanal stitching on a warm stone backdrop."),
	("meridian-automatic-38", "Meridian Automatic 38", "watch-round", ((56, 52, 49), (189, 168, 138), (235, 226, 214)), "A round automatic timepiece with warm metallic highlights and leather strap."),
	("observatory-chronograph", "Observatory Chronograph", "watch-square", ((46, 53, 59), (165, 176, 186), (232, 236, 238)), "A chronograph watch rendered with crisp steel edges and luxury restraint."),
	("passage-gmt", "Passage GMT", "watch-travel", ((35, 43, 52), (164, 152, 132), (231, 225, 217)), "A travel-ready GMT watch on a soft slate and champagne surface."),
	("palais-top-handle", "Palais Top Handle", "bag-structured", ((70, 45, 37), (181, 135, 119), (237, 228, 222)), "A structured top-handle bag in editorial studio light."),
	("galerie-chain-shoulder-bag", "Galerie Chain Shoulder Bag", "bag-chain", ((35, 35, 37), (181, 154, 122), (235, 227, 219)), "A chain shoulder bag with brushed metal accents and quiet luxury styling."),
	("avenue-crescent-clutch", "Avenue Crescent Clutch", "bag-crescent", ((69, 50, 43), (193, 160, 142), (238, 229, 224)), "A crescent clutch on a soft terrazzo-toned backdrop."),
	("continental-zip-wallet", "Continental Zip Wallet", "wallet-long", ((52, 39, 33), (178, 144, 120), (236, 228, 219)), "A long zip wallet with stitched edges and shadow depth."),
	("atelier-card-case", "Atelier Card Case", "wallet-small", ((42, 37, 41), (171, 141, 162), (236, 229, 233)), "A slim card case captured like a premium catalog still life."),
	("grand-tour-passport-folio", "Grand Tour Passport Folio", "folio", ((80, 58, 40), (193, 161, 120), (238, 230, 219)), "A passport folio styled with travel-editorial polish."),
	("cashmere-cap", "Cashmere Cap", "cap", ((55, 44, 40), (170, 151, 142), (236, 231, 227)), "A soft cashmere cap set against a brushed stone background."),
	("silk-twill-wrap", "Silk Twill Wrap", "scarf-silk", ((77, 48, 60), (203, 172, 151), (242, 232, 227)), "A draped silk twill wrap with fluid folds and elegant light."),
	("cashmere-fringe-scarf", "Cashmere Fringe Scarf", "scarf-cashmere", ((78, 62, 51), (193, 169, 149), (239, 232, 224)), "A cashmere scarf with fringe detail in a tactile editorial composition."),
]

CATEGORY_SPECS: list[tuple[str, str, tuple[Color, Color, Color]]] = [
	("footwear", "Footwear", ((73, 58, 48), (190, 160, 132), (238, 230, 222))),
	("timepieces", "Timepieces", ((45, 50, 58), (170, 160, 146), (233, 230, 225))),
	("handbags", "Handbags", ((72, 47, 42), (192, 149, 135), (239, 229, 224))),
	("small-leather-goods", "Small Leather Goods", ((70, 55, 43), (188, 163, 132), (238, 231, 223))),
	("headwear", "Headwear", ((60, 51, 46), (181, 164, 150), (238, 233, 228))),
	("scarves", "Scarves", ((83, 57, 64), (199, 171, 159), (241, 232, 228))),
]

COLLECTION_SPECS: list[tuple[str, str, tuple[Color, Color, Color]]] = [
	("house-icons", "House Icons", ((49, 43, 39), (180, 154, 126), (236, 228, 220))),
	("leather-atelier", "Leather Atelier", ((76, 54, 39), (191, 150, 118), (238, 230, 221))),
	("timepiece-gallery", "Timepiece Gallery", ((42, 49, 56), (173, 164, 152), (233, 230, 226))),
	("travel-salon", "Travel Salon", ((71, 62, 56), (189, 166, 145), (238, 233, 227))),
	("evening-edit", "Evening Edit", ((53, 41, 49), (175, 143, 152), (239, 231, 233))),
	("gift-selection", "Gift Selection", ((73, 58, 54), (196, 171, 146), (240, 234, 228))),
]

BLOG_SPECS: list[tuple[str, str, tuple[Color, Color, Color]]] = [
	("inside-the-atelier", "Inside the Atelier", ((61, 46, 39), (187, 150, 122), (239, 231, 223))),
	("packing-the-travel-salon", "Packing the Travel Salon", ((65, 58, 53), (184, 165, 144), (239, 234, 228))),
	("the-art-of-gifting", "The Art of Gifting", ((70, 55, 58), (196, 167, 152), (241, 232, 227))),
]

PAGE_SPECS: list[tuple[str, str, tuple[Color, Color, Color]]] = [
	("about", "About", ((64, 50, 43), (188, 158, 131), (239, 231, 223))),
	("contact", "Contact", ((54, 49, 45), (180, 165, 149), (239, 233, 226))),
	("concierge", "Concierge", ((50, 43, 48), (181, 155, 162), (240, 232, 234))),
	("shipping-returns", "Shipping & Returns", ((60, 54, 50), (189, 169, 151), (240, 234, 227))),
	("care-guide", "Care Guide", ((67, 57, 47), (191, 170, 144), (240, 234, 226))),
]


def lerp(a: int, b: int, t: float) -> int:
	return round(a + (b - a) * t)


def blend(a: Color, b: Color, t: float) -> Color:
	return (lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t))


def with_alpha(color: Color, alpha: int) -> tuple[int, int, int, int]:
	return (color[0], color[1], color[2], alpha)


def vertical_gradient(size: tuple[int, int], top: Color, bottom: Color) -> Image.Image:
	width, height = size
	base = Image.new("RGB", size, top)
	draw = ImageDraw.Draw(base)
	for y in range(height):
		t = y / max(height - 1, 1)
		draw.line((0, y, width, y), fill=blend(top, bottom, t))
	return base


def add_noise(image: Image.Image, amount: int = 14) -> Image.Image:
	noise = Image.effect_noise(image.size, amount).convert("L")
	noise = ImageOps.autocontrast(noise)
	colored = Image.merge(
		"RGB",
		(
			noise.point(lambda v: int(v * 0.06)),
			noise.point(lambda v: int(v * 0.05)),
			noise.point(lambda v: int(v * 0.04)),
		),
	)
	return ImageChops.add(image, colored)


def add_vignette(image: Image.Image, strength: int = 110) -> Image.Image:
	width, height = image.size
	mask = Image.new("L", image.size, 0)
	draw = ImageDraw.Draw(mask)
	draw.ellipse(
		(-width * 0.15, -height * 0.1, width * 1.15, height * 1.1),
		fill=255,
	)
	mask = mask.filter(ImageFilter.GaussianBlur(radius=min(width, height) // 7))
	overlay = Image.new("RGB", image.size, (18, 14, 12))
	overlay.putalpha(ImageChops.invert(mask).point(lambda v: min(v, strength)))
	return Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")


def add_soft_shadow(image: Image.Image, mask: Image.Image, offset: tuple[int, int], blur: int, alpha: int) -> Image.Image:
	shadow = Image.new("RGBA", image.size, (0, 0, 0, 0))
	shadow_mask = mask.filter(ImageFilter.GaussianBlur(blur))
	shadow_layer = Image.new("RGBA", image.size, (30, 24, 20, alpha))
	shadow_layer.putalpha(shadow_mask)
	shadow.alpha_composite(shadow_layer, dest=offset)
	return Image.alpha_composite(image.convert("RGBA"), shadow)


def draw_floor(draw: ImageDraw.ImageDraw, size: tuple[int, int], color: Color) -> None:
	width, height = size
	draw.ellipse(
		(width * 0.16, height * 0.74, width * 0.84, height * 0.94),
		fill=with_alpha(color, 65),
	)
	draw.ellipse(
		(width * 0.22, height * 0.77, width * 0.78, height * 0.92),
		fill=with_alpha(color, 45),
	)


def draw_shoe(image: Image.Image, palette: tuple[Color, Color, Color], lifted: bool = False, heel: bool = False, boot: bool = False, moccasin: bool = False) -> Image.Image:
	width, height = image.size
	product = Image.new("RGBA", image.size, (0, 0, 0, 0))
	draw = ImageDraw.Draw(product)
	main, accent, _ = palette
	base_y = height * (0.68 if lifted else 0.72)
	x0 = width * 0.22
	x1 = width * 0.78
	upper = [
		(x0, base_y),
		(width * 0.32, height * 0.56),
		(width * 0.62, height * 0.53),
		(x1, height * (0.63 if not heel else 0.61)),
		(width * 0.73, base_y + 28),
		(width * 0.33, base_y + 34),
	]
	if boot:
		upper = [
			(width * 0.28, height * 0.78),
			(width * 0.28, height * 0.48),
			(width * 0.49, height * 0.42),
			(width * 0.7, height * 0.46),
			(width * 0.78, height * 0.64),
			(width * 0.71, height * 0.78),
		]
	draw.polygon(upper, fill=main)
	draw.rounded_rectangle(
		(width * 0.21, base_y + 16, width * 0.79, base_y + 66),
		radius=24,
		fill=blend(main, (14, 14, 14), 0.35),
	)
	if heel:
		draw.polygon(
			[
				(width * 0.67, base_y + 18),
				(width * 0.73, base_y + 18),
				(width * 0.69, height * 0.9),
				(width * 0.63, height * 0.9),
			],
			fill=blend(main, (20, 16, 14), 0.45),
		)
	if moccasin:
		draw.arc(
			(width * 0.32, height * 0.59, width * 0.62, height * 0.76),
			start=190,
			end=360,
			fill=accent,
			width=12,
		)
	else:
		draw.line(
			[(width * 0.34, height * 0.61), (width * 0.6, height * 0.58)],
			fill=accent,
			width=10,
		)
	mask = product.getchannel("A")
	shadow = Image.new("L", image.size, 0)
	ImageDraw.Draw(shadow).ellipse(
		(width * 0.24, height * 0.77, width * 0.78, height * 0.9),
		fill=200,
	)
	base = add_soft_shadow(image, shadow, (0, 8), 34, 120)
	return Image.alpha_composite(base, product)


def draw_watch(image: Image.Image, palette: tuple[Color, Color, Color], square: bool = False, travel: bool = False) -> Image.Image:
	width, height = image.size
	product = Image.new("RGBA", image.size, (0, 0, 0, 0))
	draw = ImageDraw.Draw(product)
	main, accent, surface = palette
	center_x = width * 0.5
	strap_w = width * 0.14
	draw.rounded_rectangle(
		(center_x - strap_w / 2, height * 0.16, center_x + strap_w / 2, height * 0.84),
		radius=52,
		fill=blend(main, (20, 18, 16), 0.25),
	)
	case_box = (
		width * 0.31,
		height * 0.34,
		width * 0.69,
		height * 0.66,
	)
	if square:
		draw.rounded_rectangle(case_box, radius=64, fill=accent)
	else:
		draw.ellipse(case_box, fill=accent)
	inner = (
		width * 0.36,
		height * 0.39,
		width * 0.64,
		height * 0.61,
	)
	if square:
		draw.rounded_rectangle(inner, radius=52, fill=surface)
	else:
		draw.ellipse(inner, fill=surface)
	for i in range(12):
		angle = (math.pi * 2 * i) / 12
		r1 = width * 0.125
		r2 = width * 0.14
		x1 = center_x + math.cos(angle) * r1
		y1 = height * 0.5 + math.sin(angle) * r1
		x2 = center_x + math.cos(angle) * r2
		y2 = height * 0.5 + math.sin(angle) * r2
		draw.line((x1, y1, x2, y2), fill=main, width=5)
	draw.line((center_x, height * 0.5, center_x, height * 0.41), fill=main, width=12)
	draw.line((center_x, height * 0.5, width * 0.58, height * 0.54), fill=main, width=9)
	if travel:
		draw.arc(
			(width * 0.34, height * 0.37, width * 0.66, height * 0.63),
			start=35,
			end=145,
			fill=blend(accent, (255, 255, 255), 0.22),
			width=12,
		)
	mask = product.getchannel("A")
	shadow = Image.new("L", image.size, 0)
	ImageDraw.Draw(shadow).ellipse(
		(width * 0.28, height * 0.72, width * 0.72, height * 0.86),
		fill=190,
	)
	base = add_soft_shadow(image, shadow, (0, 6), 38, 125)
	return Image.alpha_composite(base, product)


def draw_bag(image: Image.Image, palette: tuple[Color, Color, Color], chain: bool = False, crescent: bool = False) -> Image.Image:
	width, height = image.size
	product = Image.new("RGBA", image.size, (0, 0, 0, 0))
	draw = ImageDraw.Draw(product)
	main, accent, _ = palette
	if crescent:
		draw.pieslice(
			(width * 0.22, height * 0.42, width * 0.78, height * 0.86),
			start=180,
			end=360,
			fill=main,
		)
		draw.ellipse(
			(width * 0.36, height * 0.39, width * 0.64, height * 0.57),
			outline=accent,
			width=16,
		)
	else:
		draw.rounded_rectangle(
			(width * 0.24, height * 0.42, width * 0.76, height * 0.78),
			radius=76,
			fill=main,
		)
		draw.arc(
			(width * 0.36, height * 0.26, width * 0.64, height * 0.56),
			start=180,
			end=360,
			fill=accent,
			width=18,
		)
	if chain:
		for idx in range(8):
			x = width * 0.3 + idx * width * 0.05
			draw.ellipse(
				(x, height * 0.33, x + width * 0.055, height * 0.39),
				outline=accent,
				width=10,
			)
		draw.rectangle(
			(width * 0.44, height * 0.58, width * 0.56, height * 0.64),
			fill=accent,
		)
	else:
		draw.rectangle(
			(width * 0.44, height * 0.56, width * 0.56, height * 0.64),
			fill=blend(accent, (255, 255, 255), 0.15),
		)
	mask = product.getchannel("A")
	shadow = Image.new("L", image.size, 0)
	ImageDraw.Draw(shadow).ellipse(
		(width * 0.23, height * 0.74, width * 0.78, height * 0.88),
		fill=195,
	)
	base = add_soft_shadow(image, shadow, (0, 8), 40, 130)
	return Image.alpha_composite(base, product)


def draw_wallet(image: Image.Image, palette: tuple[Color, Color, Color], folio: bool = False, compact: bool = False) -> Image.Image:
	width, height = image.size
	product = Image.new("RGBA", image.size, (0, 0, 0, 0))
	draw = ImageDraw.Draw(product)
	main, accent, _ = palette
	if compact:
		box = (width * 0.29, height * 0.44, width * 0.71, height * 0.68)
	elif folio:
		box = (width * 0.22, height * 0.38, width * 0.78, height * 0.74)
	else:
		box = (width * 0.18, height * 0.45, width * 0.82, height * 0.68)
	draw.rounded_rectangle(box, radius=42, fill=main)
	draw.rounded_rectangle(
		(box[0] + 26, box[1] + 26, box[2] - 26, box[3] - 26),
		radius=32,
		outline=accent,
		width=7,
	)
	draw.line(
		(box[0] + 60, (box[1] + box[3]) / 2, box[2] - 60, (box[1] + box[3]) / 2),
		fill=blend(accent, (255, 255, 255), 0.16),
		width=6,
	)
	mask = product.getchannel("A")
	shadow = Image.new("L", image.size, 0)
	ImageDraw.Draw(shadow).ellipse(
		(width * 0.22, height * 0.68, width * 0.78, height * 0.82),
		fill=180,
	)
	base = add_soft_shadow(image, shadow, (0, 6), 34, 118)
	return Image.alpha_composite(base, product)


def draw_cap(image: Image.Image, palette: tuple[Color, Color, Color]) -> Image.Image:
	width, height = image.size
	product = Image.new("RGBA", image.size, (0, 0, 0, 0))
	draw = ImageDraw.Draw(product)
	main, accent, _ = palette
	draw.ellipse((width * 0.28, height * 0.44, width * 0.72, height * 0.76), fill=main)
	draw.pieslice(
		(width * 0.16, height * 0.58, width * 0.76, height * 0.9),
		start=190,
		end=330,
		fill=blend(main, (20, 18, 16), 0.18),
	)
	draw.arc((width * 0.34, height * 0.48, width * 0.66, height * 0.72), start=200, end=340, fill=accent, width=10)
	mask = product.getchannel("A")
	shadow = Image.new("L", image.size, 0)
	ImageDraw.Draw(shadow).ellipse(
		(width * 0.2, height * 0.76, width * 0.76, height * 0.9),
		fill=180,
	)
	base = add_soft_shadow(image, shadow, (0, 5), 30, 110)
	return Image.alpha_composite(base, product)


def draw_scarf(image: Image.Image, palette: tuple[Color, Color, Color], silk: bool = False) -> Image.Image:
	width, height = image.size
	product = Image.new("RGBA", image.size, (0, 0, 0, 0))
	draw = ImageDraw.Draw(product)
	main, accent, surface = palette
	points = [
		(width * 0.28, height * 0.3),
		(width * 0.61, height * 0.24),
		(width * 0.72, height * 0.48),
		(width * 0.51, height * 0.78),
		(width * 0.33, height * 0.72),
		(width * 0.22, height * 0.5),
	]
	draw.polygon(points, fill=main)
	draw.polygon(
		[(x * 0.97 + width * 0.02, y * 0.97 + height * 0.02) for x, y in points],
		outline=accent,
		width=10,
	)
	if silk:
		for idx in range(4):
			y = height * (0.39 + idx * 0.07)
			draw.line((width * 0.31, y, width * 0.65, y), fill=surface, width=7)
	else:
		for idx in range(7):
			x = width * 0.34 + idx * width * 0.04
			draw.line(
				(x, height * 0.75, x + width * 0.015, height * 0.86),
				fill=accent,
				width=5,
			)
	mask = product.getchannel("A")
	shadow = Image.new("L", image.size, 0)
	ImageDraw.Draw(shadow).ellipse(
		(width * 0.22, height * 0.76, width * 0.76, height * 0.9),
		fill=185,
	)
	base = add_soft_shadow(image, shadow, (0, 6), 34, 115)
	return Image.alpha_composite(base, product)


RENDERERS: dict[str, Callable[[Image.Image, tuple[Color, Color, Color]], Image.Image]] = {
	"shoe": lambda img, palette: draw_shoe(img, palette, lifted=True),
	"boot": lambda img, palette: draw_shoe(img, palette, boot=True),
	"heel": lambda img, palette: draw_shoe(img, palette, lifted=True, heel=True),
	"moccasin": lambda img, palette: draw_shoe(img, palette, moccasin=True),
	"watch-round": lambda img, palette: draw_watch(img, palette),
	"watch-square": lambda img, palette: draw_watch(img, palette, square=True),
	"watch-travel": lambda img, palette: draw_watch(img, palette, travel=True),
	"bag-structured": lambda img, palette: draw_bag(img, palette),
	"bag-chain": lambda img, palette: draw_bag(img, palette, chain=True),
	"bag-crescent": lambda img, palette: draw_bag(img, palette, crescent=True),
	"wallet-long": lambda img, palette: draw_wallet(img, palette),
	"wallet-small": lambda img, palette: draw_wallet(img, palette, compact=True),
	"folio": lambda img, palette: draw_wallet(img, palette, folio=True),
	"cap": draw_cap,
	"scarf-silk": lambda img, palette: draw_scarf(img, palette, silk=True),
	"scarf-cashmere": draw_scarf,
}


def make_product_canvas(palette: tuple[Color, Color, Color], detail: bool = False) -> Image.Image:
	primary, accent, surface = palette
	top = blend(surface, (255, 255, 255), 0.18)
	bottom = blend(primary, surface, 0.58)
	base = vertical_gradient(PRODUCT_SIZE, top, bottom)
	overlay = Image.new("RGBA", PRODUCT_SIZE, with_alpha(accent, 30 if detail else 20))
	mask = Image.new("L", PRODUCT_SIZE, 0)
	mask_draw = ImageDraw.Draw(mask)
	mask_draw.ellipse((-320, -220, 1320, 1140), fill=255)
	mask = mask.filter(ImageFilter.GaussianBlur(160))
	overlay.putalpha(mask.point(lambda v: min(v, 45 if detail else 28)))
	base = Image.alpha_composite(base.convert("RGBA"), overlay).convert("RGB")
	base = add_noise(base, amount=10 if detail else 8)
	base = add_vignette(base, strength=85 if detail else 72)
	rgba = base.convert("RGBA")
	draw = ImageDraw.Draw(rgba, "RGBA")
	draw_floor(draw, PRODUCT_SIZE, blend(primary, (25, 20, 18), 0.25))
	return rgba


def make_banner_canvas(size: tuple[int, int], palette: tuple[Color, Color, Color]) -> Image.Image:
	primary, accent, surface = palette
	base = vertical_gradient(size, blend(surface, (255, 255, 255), 0.12), blend(primary, surface, 0.55))
	base = add_noise(base, amount=7)
	base = add_vignette(base, strength=68)
	rgba = base.convert("RGBA")
	draw = ImageDraw.Draw(rgba, "RGBA")
	width, height = size
	draw.ellipse((width * 0.02, height * 0.12, width * 0.58, height * 1.02), fill=with_alpha(accent, 36))
	draw.ellipse((width * 0.44, -height * 0.1, width * 1.08, height * 0.74), fill=with_alpha(blend(surface, accent, 0.3), 30))
	return rgba


def save_image(image: Image.Image, path: Path) -> None:
	path.parent.mkdir(parents=True, exist_ok=True)
	image = image.convert("RGB")
	image.save(path, format="WEBP", quality=92, method=6)


def generate_product_assets() -> Iterable[dict[str, str]]:
	for slug, label, renderer, palette, alt in PRODUCT_SPECS:
		for view in ("hero", "detail"):
			canvas = make_product_canvas(palette, detail=view == "detail")
			composite = RENDERERS[renderer](canvas, palette)
			if view == "detail":
				composite = composite.crop((180, 220, 1420, 1780)).resize(PRODUCT_SIZE, Image.LANCZOS)
			relative_path = f"products/{slug}/{view}.webp"
			save_image(composite, OUTPUT_DIR / relative_path)
			yield {
				"relativePath": relative_path,
				"label": f"{label} {view}",
				"sourceNote": "Programmatically generated luxury editorial still-life illustration",
				"alt": alt,
			}


def generate_collection_asset(relative_prefix: str, slug: str, label: str, palette: tuple[Color, Color, Color], still_life: list[str]) -> dict[str, str]:
	canvas = make_banner_canvas(BANNER_SIZE, palette)
	positions = [(0.12, 0.16), (0.38, 0.04), (0.6, 0.18)]
	for idx, kind in enumerate(still_life):
		product_canvas = Image.new("RGBA", BANNER_SIZE, (0, 0, 0, 0))
		rendered = RENDERERS[kind](product_canvas, palette)
		rendered = rendered.crop((500, 200, 1900, 1250)).resize((820, 820), Image.LANCZOS)
		layer = Image.new("RGBA", BANNER_SIZE, (0, 0, 0, 0))
		x = int(BANNER_SIZE[0] * positions[idx][0])
		y = int(BANNER_SIZE[1] * positions[idx][1])
		layer.alpha_composite(rendered, dest=(x, y))
		canvas = Image.alpha_composite(canvas, layer)
	relative_path = f"{relative_prefix}/{slug}.webp"
	save_image(canvas, OUTPUT_DIR / relative_path)
	return {
		"relativePath": relative_path,
		"label": label,
		"sourceNote": "Programmatically generated luxury editorial banner",
		"alt": f"{label} editorial banner for the 86d Atelier seed catalog.",
	}


def generate_brand_assets() -> Iterable[dict[str, str]]:
	logo = make_banner_canvas((1200, 1200), ((44, 35, 30), (187, 159, 129), (239, 230, 222)))
	draw = ImageDraw.Draw(logo, "RGBA")
	draw.ellipse((260, 260, 940, 940), outline=with_alpha((216, 191, 156), 255), width=24)
	draw.rounded_rectangle((410, 410, 790, 790), radius=64, outline=with_alpha((67, 54, 48), 255), width=34)
	draw.arc((430, 430, 770, 770), start=210, end=330, fill=with_alpha((216, 191, 156), 255), width=22)
	save_image(logo, OUTPUT_DIR / "brand/logo.webp")
	yield {
		"relativePath": "brand/logo.webp",
		"label": "86d Atelier logo",
		"sourceNote": "Programmatically generated brand mark for seed data",
		"alt": "A minimal circular monogram mark for 86d Atelier.",
	}
	yield generate_collection_asset(
		"brand",
		"banner",
		"86d Atelier brand banner",
		((58, 45, 38), (188, 154, 123), (240, 232, 224)),
		["bag-structured", "watch-round", "scarf-silk"],
	)


def write_manifest(records: list[dict[str, str]]) -> None:
	MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
	MANIFEST_PATH.write_text(json.dumps(records, indent=2), encoding="utf-8")


def main() -> None:
	records: list[dict[str, str]] = []
	records.extend(generate_product_assets())
	for slug, label, palette in CATEGORY_SPECS:
		records.append(
			generate_collection_asset(
				"categories",
				slug,
				f"{label} category image",
				palette,
				["shoe", "watch-round", "bag-structured"],
			),
		)
	for slug, label, palette in COLLECTION_SPECS:
		recipes = {
			"house-icons": ["shoe", "watch-round", "bag-structured"],
			"leather-atelier": ["boot", "bag-chain", "wallet-long"],
			"timepiece-gallery": ["watch-round", "watch-square", "watch-travel"],
			"travel-salon": ["moccasin", "watch-travel", "folio"],
			"evening-edit": ["heel", "bag-crescent", "scarf-silk"],
			"gift-selection": ["wallet-small", "cap", "scarf-cashmere"],
		}
		records.append(
			generate_collection_asset("collections", slug, label, palette, recipes[slug]),
		)
	for slug, label, palette in BLOG_SPECS:
		records.append(
			generate_collection_asset(
				"blog",
				slug,
				label,
				palette,
				["bag-structured", "watch-round", "scarf-silk"],
			),
		)
	for slug, label, palette in PAGE_SPECS:
		records.append(
			generate_collection_asset(
				"pages",
				slug,
				f"{label} page image",
				palette,
				["wallet-long", "cap", "scarf-cashmere"],
			),
		)
	records.extend(generate_brand_assets())
	write_manifest(records)
	print(f"Wrote {len(records)} assets to {OUTPUT_DIR}")


if __name__ == "__main__":
	main()
