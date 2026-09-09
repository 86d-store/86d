import FooterTemplate from "../footer.mdx";

export interface StoreFooterProps {
	logo: {
		url: string;
		lightSrc: string;
		darkSrc: string;
		alt: string;
		title: string;
	};
	storeName: string;
	sections: {
		title: string;
		links: { name: string; href: string }[];
	}[];
}

export function StoreFooter(props: StoreFooterProps) {
	return <FooterTemplate {...props} year={new Date().getFullYear()} />;
}
