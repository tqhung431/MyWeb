"use client";

// A group's board: posts (newest first) with likes and comments.
// When anyone posts, likes or comments, the API tells everyone with the group open ("hobby:board")
// and the board reloads itself.
// Stage 21: only members post and comment; others see a "Join" button in place of the box.

import { useConfirm } from "@/components/ui/Dialog";
import { Heart, Loader2, MessageCircle, Send, Trash2, UserPlus } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type FormEvent } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { useMe } from "@/features/me/MeProvider";
import { useRealtimeEvent } from "@/features/realtime/RealtimeProvider";
import { ApiError } from "@/lib/api/client";
import { createComment, createPost, deleteComment, deletePost, getComments, getPosts, setPostLike, type Comment, type Post } from "@/lib/api/hobby";
import { cn } from "@/lib/cn";
import { timeAgo } from "@/lib/time";

// Whether you're a member, for the comment boxes deep inside each post
const Membership = createContext<{ joined: boolean; onJoin: () => void }>({ joined: false, onJoin: () => {} });

export function Board({ slug, groupName, joined, onJoin }: { slug: string; groupName: string; joined: boolean; onJoin: () => void }) {
  const { user, askName } = useMe();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [more, setMore] = useState(false);
  const [changed, setChanged] = useState<Record<number, number>>({}); // postId → version, to reload its comments
  const olderLoaded = useRef(false);

  const load = useCallback(async () => {
    try {
      const page = await getPosts(slug);
      // Keep older pages you already loaded below the fresh first page
      setPosts((old) => {
        const oldest = page.posts.at(-1)?.id ?? Infinity;
        return [...page.posts, ...(old ?? []).filter((p) => p.id < oldest)];
      });
      if (!olderLoaded.current) setMore(page.more);
    } catch {
      setPosts((p) => p ?? []);
    }
  }, [slug]);

  useEffect(() => {
    setPosts(null);
    olderLoaded.current = false;
    void load();
  }, [load, user?.id]);

  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  useRealtimeEvent<{ slug: string; postId?: number }>("hobby:board", ({ slug: s, postId }) => {
    if (s !== slug) return;
    if (postId) setChanged((c) => ({ ...c, [postId]: (c[postId] ?? 0) + 1 }));
    if (pending.current) return;
    pending.current = setTimeout(() => {
      pending.current = null;
      void load();
    }, 300);
  });
  useRealtimeEvent("people:changed", () => void load());

  async function loadMore() {
    if (!posts?.length) return;
    const page = await getPosts(slug, posts.at(-1)!.id).catch(() => null);
    if (!page) return;
    olderLoaded.current = true;
    setPosts((p) => [...(p ?? []), ...page.posts]);
    setMore(page.more);
  }

  return (
    <Membership.Provider value={{ joined, onJoin }}>
      <div className="flex flex-col gap-4">
        {user && joined ? (
          <Composer slug={slug} groupName={groupName} onPosted={(p) => setPosts((list) => [p, ...(list ?? []).filter((x) => x.id !== p.id)])} />
        ) : (
          <div className="flex flex-col items-start gap-3 rounded-3xl border border-dashed border-border p-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted">{user ? `Join ${groupName} to post, comment and chat.` : "Pick a name, then join to post."}</p>
            <Button variant="primary" size="sm" onClick={user ? onJoin : askName}>
              <UserPlus className="h-4 w-4" aria-hidden="true" /> {user ? "Join" : "Pick a name"}
            </Button>
          </div>
        )}

        {posts === null && <p className="text-sm text-muted">Loading posts…</p>}
        {posts?.length === 0 && (
          <div className="rounded-3xl border border-dashed border-border p-8 text-center">
            <p className="text-4xl" aria-hidden="true">
              📝
            </p>
            <p className="mt-2 font-semibold">No posts yet</p>
            <p className="text-sm text-muted">Share something: a photo idea, a question, a recommendation.</p>
          </div>
        )}
        {posts?.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            version={changed[p.id] ?? 0}
            onChange={(np) => setPosts((list) => list?.map((x) => (x.id === np.id ? np : x)) ?? null)}
            onDeleted={() => setPosts((list) => list?.filter((x) => x.id !== p.id) ?? null)}
          />
        ))}
        {more && (
          <Button variant="secondary" className="self-center" onClick={loadMore}>
            Show older posts
          </Button>
        )}
      </div>
    </Membership.Provider>
  );
}

function Composer({ slug, groupName, onPosted }: { slug: string; groupName: string; onPosted: (p: Post) => void }) {
  const { user } = useMe();
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      onPosted(await createPost(slug, body));
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : "Not posted: can't reach Nook.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-border bg-surface p-4 shadow-card backdrop-blur-xl">
      <div className="flex gap-3">
        <Avatar name={user!.name} size="sm" />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          maxLength={4000}
          placeholder={`Share something with ${groupName}…`}
          aria-label="New post"
          className="min-h-16 flex-1 resize-none bg-transparent text-sm [field-sizing:content] placeholder:text-muted focus:outline-none"
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        <span className="text-xs text-rose-600 dark:text-rose-300">{error}</span>
        <Button type="submit" variant="primary" size="sm" disabled={!body.trim() || pending}>
          {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Post
        </Button>
      </div>
    </form>
  );
}

type CardProps = { post: Post; version: number; onChange: (p: Post) => void; onDeleted: () => void };

function PostCard({ post, version, onChange, onDeleted }: CardProps) {
  const confirm = useConfirm();
  const { user, askName } = useMe();
  const [open, setOpen] = useState(false);

  async function like() {
    if (!user) return askName();
    onChange({ ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) }); // show it at once
    const r = await setPostLike(post.id, !post.liked).catch(() => null);
    if (r) onChange({ ...post, ...r });
  }

  async function remove() {
    if (!(await confirm({ title: "Delete this post and its comments?", confirmLabel: "Delete", danger: true }))) return;
    await deletePost(post.id).catch(() => {});
    onDeleted();
  }

  return (
    <article className="rounded-3xl border border-border bg-surface p-4 shadow-card backdrop-blur-xl sm:p-5">
      <header className="flex items-center gap-3">
        <Avatar name={post.author.name} size="sm" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{post.author.name}</p>
          <p className="text-xs text-muted">{timeAgo(post.createdAt)}</p>
        </div>
        {post.mine && (
          <Button variant="ghost" size="icon" className="h-9 w-9" onClick={remove} aria-label="Delete this post">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </header>
      <p className="mt-3 text-[15px] leading-relaxed break-words whitespace-pre-wrap">{post.body}</p>
      <footer className="mt-3 flex gap-1">
        <button
          type="button"
          onClick={like}
          aria-pressed={post.liked}
          aria-label={post.liked ? "Unlike" : "Like"}
          className={cn(
            "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums transition",
            post.liked ? "bg-rose-500/12 text-rose-600 dark:text-rose-300" : "text-muted hover:bg-surface-muted hover:text-text",
          )}
        >
          <Heart className={cn("h-4 w-4", post.liked && "fill-current")} aria-hidden="true" /> {post.likes}
        </button>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-muted tabular-nums transition hover:bg-surface-muted hover:text-text"
        >
          <MessageCircle className="h-4 w-4" aria-hidden="true" /> {post.comments} {post.comments === 1 ? "comment" : "comments"}
        </button>
      </footer>
      {open && <Comments postId={post.id} version={version} onCount={(n) => n !== post.comments && onChange({ ...post, comments: n })} />}
    </article>
  );
}

function Comments({ postId, version, onCount }: { postId: number; version: number; onCount: (n: number) => void }) {
  const { user, askName } = useMe();
  const { joined, onJoin } = useContext(Membership);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [body, setBody] = useState("");
  const [error, setError] = useState("");
  const count = useRef(onCount);
  useEffect(() => {
    count.current = onCount;
  });

  useEffect(() => {
    getComments(postId).then(setComments, () => setComments([]));
  }, [postId, version]);

  // Keep the post's "N comments" in step with the list
  useEffect(() => {
    if (comments) count.current(comments.length);
  }, [comments]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError("");
    try {
      const c = await createComment(postId, body);
      setComments((list) => [...(list ?? []).filter((x) => x.id !== c.id), c]);
      setBody("");
    } catch (err) {
      setError(err instanceof ApiError ? (err.details[0]?.message ?? err.message) : "Not sent: can't reach Nook.");
    }
  }

  async function remove(c: Comment) {
    await deleteComment(c.id).catch(() => {});
    setComments((list) => list?.filter((x) => x.id !== c.id) ?? []);
  }

  return (
    <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
      {comments === null && <p className="text-xs text-muted">Loading comments…</p>}
      {comments?.map((c) => (
        <div key={c.id} className="group flex gap-2.5">
          <Avatar name={c.author.name} size="sm" />
          <div className="min-w-0 flex-1 rounded-2xl bg-surface-muted px-3 py-2">
            <p className="text-xs">
              <span className="font-semibold">{c.author.name}</span> <span className="text-muted">· {timeAgo(c.createdAt)}</span>
            </p>
            <p className="text-sm break-words whitespace-pre-wrap">{c.body}</p>
          </div>
          {c.mine && (
            <button
              type="button"
              onClick={() => remove(c)}
              aria-label="Delete this comment"
              className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center self-center rounded-full text-muted opacity-60 hover:text-rose-600 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      {user && !joined ? (
        <button type="button" onClick={onJoin} className="cursor-pointer self-start text-sm font-semibold text-primary hover:underline">
          Join the group to comment
        </button>
      ) : user ? (
        <form onSubmit={onSubmit} className="flex items-center gap-2">
          <input
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={1000}
            placeholder="Write a comment…"
            aria-label="Write a comment"
            className="h-10 min-w-0 flex-1 rounded-full border border-border bg-surface-strong/70 px-4 text-sm focus:border-primary focus:ring-4 focus:ring-primary/15 focus:outline-none"
          />
          <Button type="submit" variant="ghost" size="icon" className="h-10 w-10" disabled={!body.trim()} aria-label="Send comment">
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </form>
      ) : (
        <button type="button" onClick={askName} className="cursor-pointer self-start text-sm font-semibold text-primary hover:underline">
          Pick a name to comment
        </button>
      )}
      {error && <p className="text-xs text-rose-600 dark:text-rose-300">{error}</p>}
    </div>
  );
}
