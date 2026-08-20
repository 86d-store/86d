"use client";

import { useModuleClient } from "@86d-app/core/client/provider";
import { useEffect, useRef, useState } from "react";
import BlogAdminTemplate from "./blog-admin.mdx";

interface BlogPost {
	id: string;
	title: string;
	slug: string;
	content: string;
	excerpt?: string | null;
	coverImage?: string | null;
	author?: string | null;
	status: "draft" | "published" | "archived";
	tags: string[];
	category?: string | null;
	publishedAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

function timeAgo(dateStr: string): string {
	const diff = Date.now() - new Date(dateStr).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return "just now";
	if (mins < 60) return `${mins}m ago`;
	const hrs = Math.floor(mins / 60);
	if (hrs < 24) return `${hrs}h ago`;
	const days = Math.floor(hrs / 24);
	return `${days}d ago`;
}

const SKELETON_ROW_KEYS = [
	"skel-row-1",
	"skel-row-2",
	"skel-row-3",
	"skel-row-4",
	"skel-row-5",
];
const SKELETON_CELL_KEYS = [
	"skel-cell-1",
	"skel-cell-2",
	"skel-cell-3",
	"skel-cell-4",
	"skel-cell-5",
	"skel-cell-6",
];

const STATUS_COLORS: Record<string, string> = {
	draft: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
	published:
		"bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
	archived: "bg-muted text-muted-foreground",
};

function useBlogAdminApi() {
	const client = useModuleClient();
	return {
		listPosts: client.module("blog").admin["/admin/blog"],
		getPost: client.module("blog").admin["/admin/blog/:id"],
		createPost: client.module("blog").admin["/admin/blog/create"],
		updatePost: client.module("blog").admin["/admin/blog/:id/update"],
		deletePost: client.module("blog").admin["/admin/blog/:id/delete"],
	};
}

function DeleteModal({
	post,
	onClose,
	onSuccess,
}: {
	post: BlogPost;
	onClose: () => void;
	onSuccess: () => void;
}) {
	const cancelRef = useRef<HTMLButtonElement>(null);
	useEffect(() => {
		cancelRef.current?.focus();
	}, []);
	useEffect(() => {
		function handler(e: KeyboardEvent) {
			if (e.key === "Escape") onClose();
		}
		document.addEventListener("keydown", handler);
		return () => document.removeEventListener("keydown", handler);
	}, [onClose]);
	const api = useBlogAdminApi();

	const deleteMutation = api.deletePost.useMutation({
		onSuccess: () => {
			void api.listPosts.invalidate();
			onSuccess();
		},
	});

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div
				role="dialog"
				aria-modal="true"
				className="w-full max-w-sm rounded-xl border border-border bg-card shadow-xl"
			>
				<div className="px-6 py-5">
					<h2 className="font-semibold text-foreground text-lg">
						Delete post?
					</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						<span className="font-medium text-foreground">{post.title}</span>{" "}
						will be permanently deleted.
					</p>
					<div className="mt-5 flex justify-end gap-2">
						<button
							ref={cancelRef}
							type="button"
							onClick={onClose}
							className="rounded-md border border-border px-4 py-2 text-foreground text-sm hover:bg-muted"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={() => deleteMutation.mutate({ params: { id: post.id } })}
							disabled={deleteMutation.isPending}
							className="rounded-md bg-destructive px-4 py-2 font-medium text-destructive-foreground text-sm hover:bg-destructive/90 disabled:opacity-50"
						>
							{deleteMutation.isPending ? "Deleting…" : "Delete"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

function PostForm({
	post,
	onSaved,
	onCancel,
}: {
	post?: BlogPost | undefined;
	onSaved: () => void;
	onCancel: () => void;
}) {
	const api = useBlogAdminApi();
	const isEditing = !!post;

	const [title, setTitle] = useState(post?.title ?? "");
	const [slug, setSlug] = useState(post?.slug ?? "");
	const [content, setContent] = useState(post?.content ?? "");
	const [excerpt, setExcerpt] = useState(post?.excerpt ?? "");
	const [coverImage, setCoverImage] = useState(post?.coverImage ?? "");
	const [author, setAuthor] = useState(post?.author ?? "");
	const [category, setCategory] = useState(post?.category ?? "");
	const [tagsInput, setTagsInput] = useState(post?.tags.join(", ") ?? "");
	const [status, setStatus] = useState<"draft" | "published">(
		post?.status === "published" ? "published" : "draft",
	);
	const [error, setError] = useState("");

	const createMutation = api.createPost.useMutation({
		onSuccess: () => {
			void api.listPosts.invalidate();
			onSaved();
		},
		onError: () => setError("Failed to create post."),
	});

	const updateMutation = api.updatePost.useMutation({
		onSuccess: () => {
			void api.listPosts.invalidate();
			onSaved();
		},
		onError: () => setError("Failed to update post."),
	});

	const isPending = createMutation.isPending || updateMutation.isPending;

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		setError("");

		const tags = tagsInput
			.split(",")
			.map((t) => t.trim())
			.filter(Boolean);

		const payload = {
			title,
			...(slug.trim() ? { slug: slug.trim() } : {}),
			content,
			...(excerpt.trim() ? { excerpt: excerpt.trim() } : {}),
			...(coverImage.trim() ? { coverImage: coverImage.trim() } : {}),
			...(author.trim() ? { author: author.trim() } : {}),
			...(category.trim() ? { category: category.trim() } : {}),
			tags,
			status,
		};

		if (isEditing && post) {
			updateMutation.mutate({ params: { id: post.id }, ...payload });
		} else {
			createMutation.mutate(payload);
		}
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-5">
			<div className="flex items-center justify-between">
				<h2 className="font-bold text-foreground text-xl">
					{isEditing ? "Edit Post" : "New Post"}
				</h2>
				<button
					type="button"
					onClick={onCancel}
					className="text-muted-foreground text-sm hover:text-foreground"
				>
					Cancel
				</button>
			</div>

			<div>
				<label
					htmlFor="post-title"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Title <span className="text-destructive">*</span>
				</label>
				<input
					id="post-title"
					type="text"
					required
					value={title}
					onChange={(e) => setTitle(e.target.value)}
					placeholder="My blog post title"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="post-slug"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Slug
				</label>
				<input
					id="post-slug"
					type="text"
					value={slug}
					onChange={(e) => setSlug(e.target.value)}
					placeholder="my-blog-post-title (auto-generated if blank)"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="post-excerpt"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Excerpt
				</label>
				<textarea
					id="post-excerpt"
					value={excerpt}
					onChange={(e) => setExcerpt(e.target.value)}
					placeholder="A brief summary of the post..."
					rows={2}
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="post-content"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Content <span className="text-destructive">*</span>
				</label>
				<textarea
					id="post-content"
					required
					value={content}
					onChange={(e) => setContent(e.target.value)}
					placeholder="Write your blog post content here..."
					rows={12}
					className="w-full rounded-lg border border-input bg-background px-3 py-2 font-mono text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div className="grid gap-4 sm:grid-cols-2">
				<div>
					<label
						htmlFor="post-author"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Author
					</label>
					<input
						id="post-author"
						type="text"
						value={author}
						onChange={(e) => setAuthor(e.target.value)}
						placeholder="Author name"
						className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
					/>
				</div>
				<div>
					<label
						htmlFor="post-category"
						className="mb-1 block font-medium text-foreground text-sm"
					>
						Category
					</label>
					<input
						id="post-category"
						type="text"
						value={category}
						onChange={(e) => setCategory(e.target.value)}
						placeholder="News, Guides, Updates..."
						className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
					/>
				</div>
			</div>

			<div>
				<label
					htmlFor="post-cover"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Cover Image URL
				</label>
				<input
					id="post-cover"
					type="url"
					value={coverImage}
					onChange={(e) => setCoverImage(e.target.value)}
					placeholder="https://example.com/image.jpg"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
			</div>

			<div>
				<label
					htmlFor="post-tags"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Tags
				</label>
				<input
					id="post-tags"
					type="text"
					value={tagsInput}
					onChange={(e) => setTagsInput(e.target.value)}
					placeholder="tag1, tag2, tag3"
					className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none ring-offset-background focus:ring-2 focus:ring-ring focus:ring-offset-1"
				/>
				<p className="mt-1 text-muted-foreground text-xs">
					Separate tags with commas
				</p>
			</div>

			<div>
				<label
					htmlFor="post-status"
					className="mb-1 block font-medium text-foreground text-sm"
				>
					Status
				</label>
				<select
					id="post-status"
					value={status}
					onChange={(e) => setStatus(e.target.value as "draft" | "published")}
					className="h-9 w-full rounded-md border border-border bg-background px-3 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="draft">Draft</option>
					<option value="published">Published</option>
				</select>
			</div>

			{error && (
				<p className="text-destructive text-sm" role="alert">
					{error}
				</p>
			)}

			<div className="flex gap-2">
				<button
					type="submit"
					disabled={isPending}
					className="rounded-lg bg-primary px-5 py-2 font-medium text-primary-foreground text-sm transition-opacity disabled:opacity-60"
				>
					{isPending ? "Saving…" : isEditing ? "Update Post" : "Create Post"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					className="rounded-lg border border-border px-5 py-2 font-medium text-foreground text-sm hover:bg-muted"
				>
					Cancel
				</button>
			</div>
		</form>
	);
}

export function BlogAdmin() {
	const api = useBlogAdminApi();
	const [statusFilter, setStatusFilter] = useState("");
	const [page, setPage] = useState(1);
	const [deleteTarget, setDeleteTarget] = useState<BlogPost | null>(null);
	const [editTarget, setEditTarget] = useState<BlogPost | null>(null);
	const [showCreateForm, setShowCreateForm] = useState(false);
	const pageSize = 25;

	const queryInput: Record<string, string> = {
		page: String(page),
		limit: String(pageSize),
	};
	if (statusFilter) queryInput.status = statusFilter;

	const {
		data,
		isLoading: loading,
		isError: postsError,
		refetch: refetchPosts,
	} = api.listPosts.useQuery(queryInput) as {
		data: { posts: BlogPost[]; total: number } | undefined;
		isLoading: boolean;
		isError: boolean;
		refetch: () => void;
	};

	const posts = data?.posts ?? [];
	const total = data?.total ?? 0;
	const totalPages = Math.max(1, Math.ceil(total / pageSize));

	if (showCreateForm || editTarget) {
		return (
			<PostForm
				post={editTarget ?? undefined}
				onSaved={() => {
					setShowCreateForm(false);
					setEditTarget(null);
				}}
				onCancel={() => {
					setShowCreateForm(false);
					setEditTarget(null);
				}}
			/>
		);
	}

	if (postsError) {
		return (
			<div
				role="alert"
				className="rounded-md border border-destructive/50 bg-destructive/10 p-4"
			>
				<p className="font-semibold text-destructive">
					Failed to load blog posts
				</p>
				<p className="mt-1 text-muted-foreground text-sm">
					Check your connection and try again.
				</p>
				<button
					type="button"
					onClick={() => refetchPosts()}
					className="mt-3 rounded-md bg-destructive/20 px-3 py-1.5 font-medium text-destructive text-sm transition-colors hover:bg-destructive/30"
				>
					Try again
				</button>
			</div>
		);
	}

	const subtitle = `${total} ${total === 1 ? "post" : "posts"}`;

	const tableBody = loading ? (
		SKELETON_ROW_KEYS.map((rowKey) => (
			<tr key={rowKey}>
				{SKELETON_CELL_KEYS.map((cellKey) => (
					<td key={`${rowKey}-${cellKey}`} className="px-4 py-3">
						<div className="h-4 w-24 animate-pulse rounded bg-muted" />
					</td>
				))}
			</tr>
		))
	) : posts.length === 0 ? (
		<tr>
			<td colSpan={6} className="px-4 py-12 text-center">
				<p className="font-medium text-foreground text-sm">No posts found</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Create your first blog post to get started.
				</p>
			</td>
		</tr>
	) : (
		posts.map((post) => (
			<tr key={post.id} className="transition-colors hover:bg-muted/30">
				<td className="px-4 py-3">
					<div>
						<span className="font-medium text-foreground text-sm">
							{post.title}
						</span>
						<p className="text-muted-foreground text-xs">/{post.slug}</p>
					</div>
				</td>
				<td className="px-4 py-3">
					<span
						className={`inline-flex items-center rounded-full px-2 py-0.5 font-medium text-xs ${STATUS_COLORS[post.status] ?? "bg-muted text-muted-foreground"}`}
					>
						{post.status}
					</span>
				</td>
				<td className="hidden px-4 py-3 text-foreground text-sm md:table-cell">
					{post.author || (
						<span className="text-muted-foreground">&mdash;</span>
					)}
				</td>
				<td className="hidden px-4 py-3 text-foreground text-sm lg:table-cell">
					{post.category || (
						<span className="text-muted-foreground">&mdash;</span>
					)}
				</td>
				<td className="hidden px-4 py-3 text-right text-muted-foreground text-xs xl:table-cell">
					{timeAgo(post.updatedAt)}
				</td>
				<td className="px-4 py-3 text-right">
					<div className="flex justify-end gap-1">
						<button
							type="button"
							onClick={() => setEditTarget(post)}
							className="rounded-md px-2 py-1 text-foreground text-xs hover:bg-muted"
						>
							Edit
						</button>
						<button
							type="button"
							onClick={() => setDeleteTarget(post)}
							className="rounded-md px-2 py-1 text-destructive text-xs hover:bg-destructive/10"
						>
							Delete
						</button>
					</div>
				</td>
			</tr>
		))
	);

	return (
		<BlogAdminTemplate
			subtitle={subtitle}
			onNewPost={() => setShowCreateForm(true)}
			statusFilter={statusFilter}
			onStatusFilterChange={(v: string) => {
				setStatusFilter(v);
				setPage(1);
			}}
			tableBody={tableBody}
			showPagination={totalPages > 1}
			page={page}
			totalPages={totalPages}
			onPrevPage={() => setPage((p) => Math.max(1, p - 1))}
			onNextPage={() => setPage((p) => Math.min(totalPages, p + 1))}
			deleteModal={
				deleteTarget ? (
					<DeleteModal
						post={deleteTarget}
						onClose={() => setDeleteTarget(null)}
						onSuccess={() => setDeleteTarget(null)}
					/>
				) : null
			}
		/>
	);
}
