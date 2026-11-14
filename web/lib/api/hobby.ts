// Hobby Hub (Stage 11): groups, posts, comments, likes and chat.
// Stage 21: private chats, pictures in chats, unread counts.

import { ApiError, apiFetch } from "./client";

export type Person = { id: string; name: string };
export type Group = {
  id: number;
  slug: string;
  name: string;
  emoji: string;
  description: string;
  createdAt: string;
  members: number;
  posts: number;
  lastActivity: string | null;
  joined: boolean;
  mine: boolean;
  unread: number; // posts and messages since you last looked (members only)
  locked?: boolean; // Stage 27: the admin made it read only
};
// Stage 29: members (and the admin) can read; others get memberCount and an empty members list
export type GroupDetail = Omit<Group, "members" | "posts" | "lastActivity" | "unread"> & { members: Person[]; memberCount: number; canRead: boolean };
export type Post = { id: number; body: string; createdAt: string; author: Person; likes: number; comments: number; liked: boolean; mine: boolean };
export type Comment = { id: number; body: string; createdAt: string; author: Person; mine: boolean };
export type ChatImage = { id: string; url: string; width: number; height: number };
// Stage 28: a deleted message stays in the list (deletedBy set, no words or picture); editedAt = "edited"
export type DeletedBy = "author" | "admin" | null;
export type Message = { id: number; body: string; createdAt: string; author: Person; image: ChatImage | null; mine?: boolean; deletedBy?: DeletedBy; editedAt?: string | null };
export type DirectMessage = {
  id: number;
  body: string;
  createdAt: string;
  readAt: string | null;
  image: ChatImage | null;
  mine: boolean;
  deletedBy?: DeletedBy;
  editedAt?: string | null;
};
export type Conversation = {
  id: string;
  name: string;
  lastBody: string;
  lastImage: boolean;
  lastDeleted?: boolean;
  lastMine: boolean;
  lastAt: string;
  unread: number;
};
export type Edited = { id: number; body: string; editedAt: string };
export type Unread = { messages: number; groups: number };

const json = (method: string, body?: unknown): RequestInit => ({ method, ...(body !== undefined && { body: JSON.stringify(body) }) });

export const getGroups = () => apiFetch<Group[]>("/api/hobby/groups");
export const createGroup = (g: { name: string; emoji: string; description: string }) => apiFetch<Group>("/api/hobby/groups", json("POST", g));
export const getGroup = (slug: string) => apiFetch<GroupDetail>(`/api/hobby/groups/${slug}`);
export const deleteGroup = (slug: string) => apiFetch<void>(`/api/hobby/groups/${slug}`, json("DELETE"));
export const setMembership = (slug: string, join: boolean) =>
  apiFetch<{ joined: boolean }>(`/api/hobby/groups/${slug}/membership`, json(join ? "PUT" : "DELETE"));

export const getPosts = (slug: string, before?: number) =>
  apiFetch<{ posts: Post[]; more: boolean }>(`/api/hobby/groups/${slug}/posts${before ? `?before=${before}` : ""}`);
export const createPost = (slug: string, body: string) => apiFetch<Post>(`/api/hobby/groups/${slug}/posts`, json("POST", { body }));
export const deletePost = (id: number) => apiFetch<void>(`/api/hobby/posts/${id}`, json("DELETE"));
export const setPostLike = (id: number, like: boolean) =>
  apiFetch<{ liked: boolean; likes: number }>(`/api/hobby/posts/${id}/like`, json(like ? "PUT" : "DELETE"));
export const getComments = (postId: number) => apiFetch<Comment[]>(`/api/hobby/posts/${postId}/comments`);
export const createComment = (postId: number, body: string) => apiFetch<Comment>(`/api/hobby/posts/${postId}/comments`, json("POST", { body }));
export const deleteComment = (id: number) => apiFetch<void>(`/api/hobby/comments/${id}`, json("DELETE"));

export const getMessages = (slug: string, before?: number) =>
  apiFetch<{ messages: Message[]; more: boolean }>(`/api/hobby/groups/${slug}/messages${before ? `?before=${before}` : ""}`);
export const sendMessage = (slug: string, body: string, imageId?: string) =>
  apiFetch<Message>(`/api/hobby/groups/${slug}/messages`, json("POST", { body, imageId }));
export const deleteMessage = (id: number) => apiFetch<void>(`/api/hobby/messages/${id}`, json("DELETE"));
export const editMessage = (id: number, body: string) => apiFetch<Edited>(`/api/hobby/messages/${id}`, json("PATCH", { body }));
export const markGroupRead = (slug: string) => apiFetch<void>(`/api/hobby/groups/${slug}/read`, json("PUT"));

// --- Stage 21: private chats ---
export const getUnread = () => apiFetch<Unread>("/api/hobby/unread");
export const findPeople = (q = "") => apiFetch<(Person & { lastSeenAt: string })[]>(`/api/hobby/people?q=${encodeURIComponent(q)}`);
export const getConversations = () => apiFetch<Conversation[]>("/api/hobby/dms");
export const getDirectMessages = (userId: string, before?: number) =>
  apiFetch<{ person: Person; messages: DirectMessage[]; more: boolean }>(`/api/hobby/dms/${userId}${before ? `?before=${before}` : ""}`);
export const sendDirectMessage = (userId: string, body: string, imageId?: string) =>
  apiFetch<DirectMessage>(`/api/hobby/dms/${userId}`, json("POST", { body, imageId }));
export const markDirectRead = (userId: string) => apiFetch<void>(`/api/hobby/dms/${userId}/read`, json("PUT"));
export const deleteDirectMessage = (id: number) => apiFetch<void>(`/api/hobby/dms/messages/${id}`, json("DELETE"));
export const editDirectMessage = (id: number, body: string) => apiFetch<Edited>(`/api/hobby/dms/messages/${id}`, json("PATCH", { body }));

// A picture is a form upload (not JSON), so it skips apiFetch's JSON header
export async function uploadChatImage(file: Blob, name: string): Promise<ChatImage> {
  const form = new FormData();
  form.append("file", file, name);
  const res = await fetch("/api/hobby/images", { method: "POST", body: form, signal: AbortSignal.timeout(60_000) });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, body.error ?? `API answered ${res.status}`);
  return body as ChatImage;
}
