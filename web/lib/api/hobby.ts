// Hobby Hub (Stage 11): groups, posts, comments, likes and chat.

import { apiFetch } from "./client";

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
};
export type GroupDetail = Omit<Group, "members" | "posts" | "lastActivity"> & { members: Person[] };
export type Post = { id: number; body: string; createdAt: string; author: Person; likes: number; comments: number; liked: boolean; mine: boolean };
export type Comment = { id: number; body: string; createdAt: string; author: Person; mine: boolean };
export type Message = { id: number; body: string; createdAt: string; author: Person; mine?: boolean };

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
export const sendMessage = (slug: string, body: string) => apiFetch<Message>(`/api/hobby/groups/${slug}/messages`, json("POST", { body }));
export const deleteMessage = (id: number) => apiFetch<void>(`/api/hobby/messages/${id}`, json("DELETE"));
