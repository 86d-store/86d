import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import AbandonedCartEmail from "../templates/abandoned-cart";
import BackInStockEmail from "../templates/back-in-stock";
import { BaseEmail } from "../templates/base";
import ContactEmail from "../templates/contact";
import DeliveryConfirmationEmail from "../templates/delivery-confirmation";
import LowStockAlertEmail from "../templates/low-stock-alert";
import OrderCancelledEmail from "../templates/order-cancelled";
import OrderCompletedEmail from "../templates/order-completed";
import OrderConfirmationEmail from "../templates/order-confirmation";
import PaymentFailedEmail from "../templates/payment-failed";
import RefundProcessedEmail from "../templates/refund-processed";
import ReturnApprovedEmail from "../templates/return-approved";
import ReviewRequestEmail from "../templates/review-request";
import ShippingNotificationEmail from "../templates/shipping-notification";
import SubscriptionCancelEmail from "../templates/subscription-cancel";
import SubscriptionCompleteEmail from "../templates/subscription-complete";
import SubscriptionUpdateEmail from "../templates/subscription-update";
import WelcomeEmail from "../templates/welcome";

function render(element: React.ReactElement): string {
	return renderToStaticMarkup(element);
}

describe("BaseEmail", () => {
	it("renders children", () => {
		const html = render(
			<BaseEmail>
				<p>Hello</p>
			</BaseEmail>,
		);
		expect(html).toContain("<p>Hello</p>");
	});

	it("renders preview text when provided", () => {
		const html = render(
			<BaseEmail preview="Check this out">
				<p>Content</p>
			</BaseEmail>,
		);
		expect(html).toContain("Check this out");
	});

	it("renders store name in header and footer", () => {
		const html = render(
			<BaseEmail storeName="Cool Store">
				<p>Content</p>
			</BaseEmail>,
		);
		expect(html).toContain("Cool Store");
		expect(html).toContain("Powered by 86d");
	});

	it("shows generic footer when no store name", () => {
		const html = render(
			<BaseEmail>
				<p>Content</p>
			</BaseEmail>,
		);
		expect(html).toContain("Powered by 86d");
	});
});

describe("WelcomeEmail", () => {
	it("renders with store name", () => {
		const html = render(<WelcomeEmail storeName="My Shop" />);
		expect(html).toContain("Welcome");
		expect(html).toContain("My Shop");
	});

	it("falls back to 'our store' without store name", () => {
		const html = render(<WelcomeEmail />);
		expect(html).toContain("our store");
	});
});

describe("OrderConfirmationEmail", () => {
	const baseProps = {
		orderNumber: "ORD-001",
		customerName: "Alice",
		items: [
			{ name: "Widget", quantity: 2, price: 1500 },
			{ name: "Gadget", quantity: 1, price: 3000 },
		],
		subtotal: 6000,
		taxAmount: 480,
		shippingAmount: 500,
		discountAmount: 0,
		total: 6980,
		currency: "USD",
	};

	it("renders order number and customer name", () => {
		const html = render(<OrderConfirmationEmail {...baseProps} />);
		expect(html).toContain("ORD-001");
		expect(html).toContain("Alice");
	});

	it("renders item names and quantities", () => {
		const html = render(<OrderConfirmationEmail {...baseProps} />);
		expect(html).toContain("Widget");
		expect(html).toContain("x2");
		expect(html).toContain("Gadget");
	});

	it("renders formatted total", () => {
		const html = render(<OrderConfirmationEmail {...baseProps} />);
		expect(html).toContain("$69.80");
	});

	it("shows shipping address when provided", () => {
		const html = render(
			<OrderConfirmationEmail
				{...baseProps}
				shippingAddress={{
					firstName: "Alice",
					lastName: "Smith",
					line1: "123 Main St",
					city: "Springfield",
					state: "IL",
					postalCode: "62701",
					country: "US",
				}}
			/>,
		);
		expect(html).toContain("123 Main St");
		expect(html).toContain("Springfield");
		expect(html).toContain("Shipping To");
	});

	it("hides shipping address when not provided", () => {
		const html = render(<OrderConfirmationEmail {...baseProps} />);
		expect(html).not.toContain("Shipping To");
	});

	it("shows discount row when discount is positive", () => {
		const html = render(
			<OrderConfirmationEmail {...baseProps} discountAmount={1000} />,
		);
		expect(html).toContain("Discount");
	});

	it("hides discount row when discount is zero", () => {
		const html = render(<OrderConfirmationEmail {...baseProps} />);
		expect(html).not.toContain("Discount");
	});

	it("renders address line2 when present", () => {
		const html = render(
			<OrderConfirmationEmail
				{...baseProps}
				shippingAddress={{
					firstName: "Bob",
					lastName: "Jones",
					line1: "456 Oak Ave",
					line2: "Apt 2B",
					city: "Portland",
					state: "OR",
					postalCode: "97201",
					country: "US",
				}}
			/>,
		);
		expect(html).toContain("Apt 2B");
	});
});

describe("ShippingNotificationEmail", () => {
	it("renders order number and customer name", () => {
		const html = render(
			<ShippingNotificationEmail orderNumber="ORD-002" customerName="Bob" />,
		);
		expect(html).toContain("ORD-002");
		expect(html).toContain("Bob");
		expect(html).toContain("Your Order Has Shipped");
	});

	it("shows tracking info when provided", () => {
		const html = render(
			<ShippingNotificationEmail
				orderNumber="ORD-002"
				customerName="Bob"
				trackingNumber="1Z999AA10123456784"
				carrier="UPS"
				trackingUrl="https://track.example.com/123"
			/>,
		);
		expect(html).toContain("1Z999AA10123456784");
		expect(html).toContain("UPS");
		expect(html).toContain("Track Your Package");
	});

	it("hides tracking section when no tracking info", () => {
		const html = render(
			<ShippingNotificationEmail orderNumber="ORD-002" customerName="Bob" />,
		);
		expect(html).not.toContain("Tracking Number");
		expect(html).not.toContain("Track Your Package");
	});
});

describe("RefundProcessedEmail", () => {
	it("renders refund amount and order number", () => {
		const html = render(
			<RefundProcessedEmail
				orderNumber="ORD-003"
				customerName="Charlie"
				refundAmount={2500}
				currency="USD"
			/>,
		);
		expect(html).toContain("$25.00");
		expect(html).toContain("ORD-003");
		expect(html).toContain("Refund Processed");
	});

	it("shows reason when provided", () => {
		const html = render(
			<RefundProcessedEmail
				orderNumber="ORD-003"
				customerName="Charlie"
				refundAmount={2500}
				currency="USD"
				reason="Product defective"
			/>,
		);
		expect(html).toContain("Reason");
		expect(html).toContain("Product defective");
	});

	it("shows refunded items when provided", () => {
		const html = render(
			<RefundProcessedEmail
				orderNumber="ORD-003"
				customerName="Charlie"
				refundAmount={3000}
				currency="USD"
				items={[{ name: "Widget", quantity: 1, price: 3000 }]}
			/>,
		);
		expect(html).toContain("Widget");
		expect(html).toContain("Refunded Items");
	});

	it("hides items section when no items", () => {
		const html = render(
			<RefundProcessedEmail
				orderNumber="ORD-003"
				customerName="Charlie"
				refundAmount={1000}
				currency="USD"
			/>,
		);
		expect(html).not.toContain("Refunded Items");
	});
});

describe("LowStockAlertEmail", () => {
	it("renders product list with stock levels", () => {
		const html = render(
			<LowStockAlertEmail
				items={[
					{
						productId: "p1",
						productName: "Red Widget",
						quantity: 10,
						reserved: 3,
						available: 2,
						lowStockThreshold: 5,
					},
				]}
			/>,
		);
		expect(html).toContain("Red Widget");
		expect(html).toContain("Low Stock Alert");
	});

	it("shows 'Stock Alert' heading when any item is out of stock", () => {
		const html = render(
			<LowStockAlertEmail
				items={[
					{
						productId: "p1",
						productName: "Gone Widget",
						quantity: 0,
						reserved: 0,
						available: 0,
						lowStockThreshold: 5,
					},
				]}
			/>,
		);
		expect(html).toContain("Stock Alert");
	});

	it("uses singular wording for one product", () => {
		const html = render(
			<LowStockAlertEmail
				items={[
					{
						productId: "p1",
						productName: "Widget",
						quantity: 3,
						reserved: 1,
						available: 2,
						lowStockThreshold: 5,
					},
				]}
			/>,
		);
		expect(html).toContain("product is");
	});

	it("uses plural wording for multiple products", () => {
		const html = render(
			<LowStockAlertEmail
				items={[
					{
						productId: "p1",
						productName: "A",
						quantity: 3,
						reserved: 1,
						available: 2,
						lowStockThreshold: 5,
					},
					{
						productId: "p2",
						productName: "B",
						quantity: 2,
						reserved: 0,
						available: 2,
						lowStockThreshold: 5,
					},
				]}
			/>,
		);
		expect(html).toContain("products are");
	});

	it("shows admin link when adminUrl is provided", () => {
		const html = render(
			<LowStockAlertEmail
				items={[
					{
						productId: "p1",
						productName: "Widget",
						quantity: 3,
						reserved: 1,
						available: 2,
						lowStockThreshold: 5,
					},
				]}
				adminUrl="https://admin.example.com/inventory"
			/>,
		);
		expect(html).toContain("Manage Inventory");
		expect(html).toContain("https://admin.example.com/inventory");
	});
});

describe("AbandonedCartEmail", () => {
	it("renders cart total and item count", () => {
		const html = render(
			<AbandonedCartEmail
				cartTotal={79.99}
				currency="USD"
				itemCount={2}
				cartUrl="https://store.example.com/cart"
				storeName="Test Store"
			/>,
		);
		expect(html).toContain("2 items");
		expect(html).toContain("https://store.example.com/cart");
	});

	it("uses greeting with customer name when provided", () => {
		const html = render(
			<AbandonedCartEmail
				customerName="Jane"
				cartTotal={50}
				currency="USD"
				itemCount={1}
				cartUrl="https://store.example.com/cart"
			/>,
		);
		expect(html).toContain("Hi Jane");
		expect(html).toContain("1 item");
	});

	it("uses generic greeting without customer name", () => {
		const html = render(
			<AbandonedCartEmail
				cartTotal={50}
				currency="USD"
				itemCount={3}
				cartUrl="https://store.example.com/cart"
			/>,
		);
		expect(html).toContain("Hi,");
	});
});

describe("BackInStockEmail", () => {
	it("renders product name", () => {
		const html = render(
			<BackInStockEmail productName="Leather Wallet" storeName="My Shop" />,
		);
		expect(html).toContain("Leather Wallet");
	});

	it("renders with default store name", () => {
		const html = render(<BackInStockEmail productName="Widget" />);
		expect(html).toContain("Widget");
	});
});

describe("ContactEmail", () => {
	it("renders contact fields", () => {
		const html = render(
			<ContactEmail
				name="John Doe"
				email="john@example.com"
				subject="Product inquiry"
				message="I have a question."
				storeName="Test Store"
			/>,
		);
		expect(html).toContain("John Doe");
		expect(html).toContain("Product inquiry");
		expect(html).toContain("I have a question.");
	});
});

describe("DeliveryConfirmationEmail", () => {
	it("renders order number and customer name", () => {
		const html = render(
			<DeliveryConfirmationEmail
				orderNumber="ORD-123"
				customerName="Jane Smith"
				storeName="Test Store"
			/>,
		);
		expect(html).toContain("ORD-123");
		expect(html).toContain("Jane Smith");
	});

	it("shows delivery date when provided", () => {
		const html = render(
			<DeliveryConfirmationEmail
				orderNumber="ORD-456"
				customerName="John"
				deliveredAt="March 5, 2026"
			/>,
		);
		expect(html).toContain("March 5, 2026");
	});

	it("shows review link when reviewUrl provided", () => {
		const html = render(
			<DeliveryConfirmationEmail
				orderNumber="ORD-789"
				customerName="Jane"
				reviewUrl="https://store.example.com/review"
			/>,
		);
		expect(html).toContain("https://store.example.com/review");
	});
});

describe("OrderCancelledEmail", () => {
	it("renders order number and customer name", () => {
		const html = render(
			<OrderCancelledEmail
				orderNumber="ORD-M2KQ4X"
				customerName="Jane Smith"
				storeName="Test Store"
			/>,
		);
		expect(html).toContain("ORD-M2KQ4X");
		expect(html).toContain("Jane Smith");
	});

	it("shows cancellation reason when provided", () => {
		const html = render(
			<OrderCancelledEmail
				orderNumber="ORD-001"
				customerName="John"
				reason="Out of stock"
			/>,
		);
		expect(html).toContain("Out of stock");
	});
});

describe("OrderCompletedEmail", () => {
	it("renders order number and customer name", () => {
		const html = render(
			<OrderCompletedEmail
				orderNumber="ORD-M2KQ4X"
				customerName="Jane Smith"
				storeName="Test Store"
			/>,
		);
		expect(html).toContain("ORD-M2KQ4X");
		expect(html).toContain("Jane Smith");
	});
});

describe("PaymentFailedEmail", () => {
	it("renders customer name", () => {
		const html = render(
			<PaymentFailedEmail customerName="Jane Smith" storeName="Test Store" />,
		);
		expect(html).toContain("Jane Smith");
	});

	it("shows order number and amount when provided", () => {
		const html = render(
			<PaymentFailedEmail
				customerName="Jane"
				orderNumber="ORD-001"
				amount={137.17}
				currency="USD"
				reason="Card declined"
			/>,
		);
		expect(html).toContain("ORD-001");
		expect(html).toContain("Card declined");
	});

	it("shows retry link when retryUrl provided", () => {
		const html = render(
			<PaymentFailedEmail
				customerName="Jane"
				retryUrl="https://store.example.com/checkout"
			/>,
		);
		expect(html).toContain("https://store.example.com/checkout");
	});
});

describe("ReturnApprovedEmail", () => {
	it("renders return ID and order number", () => {
		const html = render(
			<ReturnApprovedEmail
				orderNumber="ORD-M2KQ4X"
				customerName="Jane Smith"
				returnId="RET-7K3QP2"
				storeName="Test Store"
			/>,
		);
		expect(html).toContain("ORD-M2KQ4X");
		expect(html).toContain("RET-7K3QP2");
		expect(html).toContain("Jane Smith");
	});

	it("shows returned items when provided", () => {
		const html = render(
			<ReturnApprovedEmail
				orderNumber="ORD-001"
				customerName="John"
				returnId="RET-001"
				items={["Cotton T-Shirt", "Leather Belt"]}
			/>,
		);
		expect(html).toContain("Cotton T-Shirt");
		expect(html).toContain("Leather Belt");
	});

	it("shows instructions when provided", () => {
		const html = render(
			<ReturnApprovedEmail
				orderNumber="ORD-001"
				customerName="John"
				returnId="RET-001"
				instructions="Ship to 123 Warehouse Ave."
			/>,
		);
		expect(html).toContain("Ship to 123 Warehouse Ave.");
	});
});

describe("ReviewRequestEmail", () => {
	it("renders order number and customer name", () => {
		const html = render(
			<ReviewRequestEmail
				orderNumber="ORD-M2KQ4X"
				customerName="Jane Smith"
				items={[{ name: "Leather Wallet" }]}
				storeName="Test Store"
			/>,
		);
		expect(html).toContain("ORD-M2KQ4X");
		expect(html).toContain("Jane Smith");
		expect(html).toContain("Leather Wallet");
	});

	it("renders review link when reviewUrl provided for item", () => {
		const html = render(
			<ReviewRequestEmail
				orderNumber="ORD-001"
				customerName="Jane"
				items={[
					{
						name: "Widget",
						reviewUrl: "https://store.example.com/products/widget#review",
					},
				]}
			/>,
		);
		expect(html).toContain("https://store.example.com/products/widget#review");
	});
});

describe("SubscriptionCancelEmail", () => {
	it("renders with store name", () => {
		const html = render(<SubscriptionCancelEmail storeName="My Store" />);
		expect(html).toContain("My Store");
	});

	it("renders with default content", () => {
		const html = render(<SubscriptionCancelEmail />);
		expect(html).toBeTruthy();
	});
});

describe("SubscriptionCompleteEmail", () => {
	it("renders with store name", () => {
		const html = render(<SubscriptionCompleteEmail storeName="My Store" />);
		expect(html).toContain("My Store");
	});

	it("renders with default content", () => {
		const html = render(<SubscriptionCompleteEmail />);
		expect(html).toBeTruthy();
	});
});

describe("SubscriptionUpdateEmail", () => {
	it("renders with store name", () => {
		const html = render(<SubscriptionUpdateEmail storeName="My Store" />);
		expect(html).toContain("My Store");
	});

	it("renders with default content", () => {
		const html = render(<SubscriptionUpdateEmail />);
		expect(html).toBeTruthy();
	});
});
