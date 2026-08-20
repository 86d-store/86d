"use client";

import Link from "next/link";
import {
	ContextMenu,
	ContextMenuContent,
	ContextMenuItem,
	ContextMenuTrigger,
} from "~/core/context-menu";
import { Icon } from "~/core/icon";
import { cn } from "~/lib/utils";

export interface LogoProps extends React.HTMLAttributes<HTMLAnchorElement> {
	url: string;
	className?: string;
	children: React.ReactNode;
}

export interface LogoImageProps
	extends React.ImgHTMLAttributes<HTMLImageElement> {
	src: string;
	alt: string;
	className?: string;
}

export interface LogoTextProps extends React.HTMLAttributes<HTMLSpanElement> {
	children: React.ReactNode;
	className?: string;
}

export interface LogoBrandDownloadProps {
	children: React.ReactNode;
	files: Array<{
		name: string;
		path: string;
		format: "svg" | "png" | "jpg" | "jpeg" | "webp";
	}>;
	className?: string;
}

const LogoBrandDownload = ({
	children,
	files,
	className,
}: LogoBrandDownloadProps) => {
	const handleDownload = async (file: LogoBrandDownloadProps["files"][0]) => {
		try {
			const response = await fetch(file.path);
			if (!response.ok) throw new Error(`Failed to fetch ${file.name}`);

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement("a");
			link.href = url;
			link.download = file.name;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			window.URL.revokeObjectURL(url);
		} catch (error) {
			console.error("Failed to download file:", error);
		}
	};

	return (
		<ContextMenu>
			<ContextMenuTrigger>
				<div className={cn("inline-block", className)}>{children}</div>
			</ContextMenuTrigger>
			<ContextMenuContent className="w-48">
				{files.map((file) => (
					<ContextMenuItem key={file.path} onClick={() => handleDownload(file)}>
						<Icon name="DownloadIcon" className="mr-2 h-4 w-4" />
						Download {file.format.toUpperCase()}
					</ContextMenuItem>
				))}
			</ContextMenuContent>
		</ContextMenu>
	);
};

function isInternalStorePath(url: string): boolean {
	return url.startsWith("/") && !url.startsWith("//");
}

const Logo = ({ url, className, children, ...props }: LogoProps) => {
	const mergedClass = cn("flex max-h-8 items-center gap-2", className);
	if (isInternalStorePath(url)) {
		return (
			<Link href={url} className={mergedClass}>
				{children}
			</Link>
		);
	}
	return (
		<a href={url} className={mergedClass} {...props}>
			{children}
		</a>
	);
};

const LogoImage = ({ src, alt, className, ...props }: LogoImageProps) => (
	<img src={src} alt={alt} className={cn("block h-8", className)} {...props} />
);

const LogoImageMobile = ({ src, alt, className, ...props }: LogoImageProps) => (
	<img
		src={src}
		alt={alt}
		className={cn("flex h-8 md:hidden", className)}
		{...props}
	/>
);

const LogoImageDesktop = ({
	src,
	alt,
	className,
	...props
}: LogoImageProps) => (
	<img
		src={src}
		alt={alt}
		className={cn("hidden h-8 md:flex", className)}
		{...props}
	/>
);

const LogoText = ({ children, className, ...props }: LogoTextProps) => (
	<span
		className={cn("font-semibold text-lg tracking-tighter", className)}
		{...props}
	>
		{children}
	</span>
);

const LogoTextMobile = ({ children, className, ...props }: LogoTextProps) => (
	<span
		className={cn(
			"font-semibold text-lg tracking-tighter md:hidden",
			className,
		)}
		{...props}
	>
		{children}
	</span>
);

const LogoTextDesktop = ({ children, className, ...props }: LogoTextProps) => (
	<span
		className={cn(
			"hidden font-semibold text-lg tracking-tighter md:flex",
			className,
		)}
		{...props}
	>
		{children}
	</span>
);

export {
	Logo,
	LogoBrandDownload,
	LogoImage,
	LogoImageDesktop,
	LogoImageMobile,
	LogoText,
	LogoTextDesktop,
	LogoTextMobile,
};
