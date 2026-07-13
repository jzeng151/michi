"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatDate } from "@/lib/format";
import { commentSchema } from "@/lib/validation";
import type { CommentItem } from "@/lib/types";

export function Comments({
  walkId,
  initial,
  viewerId,
  viewerName,
  viewerUsername,
  canComment,
  lockedNote = "Comments open up when the walk is shared publicly.",
}: {
  walkId: string;
  initial: CommentItem[];
  viewerId: string;
  viewerName: string;
  viewerUsername: string;
  canComment: boolean;
  lockedNote?: string;
}) {
  const [comments, setComments] = useState(initial);
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);

  async function post(e: React.FormEvent) {
    e.preventDefault();
    const parsed = commentSchema.safeParse(body);
    if (!parsed.success) {
      setError(parsed.error.issues[0].message);
      return;
    }
    setError(null);
    setPosting(true);
    const { data, error: insertError } = await createClient()
      .from("comments")
      .insert({ walk_id: walkId, user_id: viewerId, body: parsed.data })
      .select("id, created_at")
      .single();
    if (insertError || !data) {
      setError(insertError?.message ?? "Couldn't post the comment.");
    } else {
      setComments((c) => [
        ...c,
        {
          id: data.id,
          body: parsed.data,
          created_at: data.created_at ?? new Date().toISOString(),
          authorId: viewerId,
          authorName: viewerName,
          authorUsername: viewerUsername,
        },
      ]);
      setBody("");
    }
    setPosting(false);
  }

  async function remove(id: string) {
    const previous = comments;
    setComments((c) => c.filter((item) => item.id !== id));
    const { error: deleteError } = await createClient()
      .from("comments")
      .delete()
      .eq("id", id);
    if (deleteError) setComments(previous);
  }

  return (
    <section aria-label="Comments" className="flex flex-col gap-3">
      <h2 className="font-medium">
        Comments <span className="text-ink-muted">({comments.length})</span>
      </h2>
      {comments.length === 0 && (
        <p className="text-sm text-ink-muted">No comments yet.</p>
      )}
      <ul className="flex flex-col gap-3">
        {comments.map((c) => (
          <li key={c.id} className="rounded-xl bg-canvas p-3">
            <p className="mb-1 text-sm text-ink-muted">
              <span className="font-medium text-ink">{c.authorName}</span>{" "}
              <span>@{c.authorUsername}</span> · {formatDate(c.created_at)}
            </p>
            {/* Plain text node: React escapes it, so markup in comments renders literally. */}
            <p className="text-sm whitespace-pre-wrap">{c.body}</p>
            {c.authorId === viewerId && (
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="mt-1 text-xs text-ink-muted underline underline-offset-4 hover:text-ink"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>
      {canComment ? (
        <form onSubmit={post} className="flex flex-col gap-2">
          <label htmlFor="comment-body" className="text-sm">
            Add a comment
          </label>
          <textarea
            id="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink"
            aria-invalid={Boolean(error)}
          />
          <div aria-live="polite">
            {error && <p className="text-sm text-accent-text">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={posting}
            className="self-start rounded-full bg-accent px-4 py-1.5 text-sm font-medium text-accent-ink transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {posting ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-ink-muted">{lockedNote}</p>
      )}
    </section>
  );
}
