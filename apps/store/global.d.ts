declare module "*.png" {
	const value: {
		src: string;
		height: number;
		width: number;
		blurDataURL?: string;
	};
	export default value;
}

declare module "*.jpg" {
	const value: {
		src: string;
		height: number;
		width: number;
		blurDataURL?: string;
	};
	export default value;
}

declare module "*.jpeg" {
	const value: {
		src: string;
		height: number;
		width: number;
		blurDataURL?: string;
	};
	export default value;
}

declare module "*.gif" {
	const value: {
		src: string;
		height: number;
		width: number;
		blurDataURL?: string;
	};
	export default value;
}

declare module "*.webp" {
	const value: {
		src: string;
		height: number;
		width: number;
		blurDataURL?: string;
	};
	export default value;
}

declare module "*.svg" {
	const value: {
		src: string;
		height: number;
		width: number;
		blurDataURL?: string;
	};
	export default value;
}

declare module "*.txt" {
	const content: string;
	export default content;
}

declare module "starter/*.txt" {
	const content: string;
	export default content;
}
