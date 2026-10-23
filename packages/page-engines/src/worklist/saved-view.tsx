"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {AccessDenied, ErrorState, LoadingState, NotFoundState, SessionExpiredState, classifyFailure, type Failure} from "@pepbits/components";

export interface SavedView {
  id: string;
  pageId: string;
  label: string;
  filters: Record<string, string>;
  expiresAt: string;
}

/* VW_ and hex. Checked before asking, so a truncated paste does not become a
   request — but the length is a range rather than exactly sixteen: the server
   mints randomBytes(8), and pinning the client to today's size means a server
   that widens the id later starts rejecting its own links. */
const VIEW_ID = /^VW_[0-9A-F]{8,32}$/;

/**
 * Opening a shared link to a filtered view.
 *
 * The URL carries the id and NOTHING else — not the page, not the module, not
 * the tenant. A page name in the link would tell nginx, APM and browser history
 * which organization someone was looking at, which is the same class of leak the
 * opaque id exists to close: it would remove the personal name and leave the
 * ward. Everything else is resolved server-side, after authentication and the
 * tenant check.
 */
export function SavedViewScreen({ viewId, fetchView, onOpen, onSignIn }: {
  viewId: string;
  fetchView: (viewId: string) => Promise<Response>;
  onOpen: (view: SavedView) => void;
  /** Where sign-in lives. Defaults to reloading, which lands on the gate. */
  onSignIn?: () => void;
}) {
  const [failure, setFailure] = useState<Failure | null>(null);
  const [loading, setLoading] = useState(true);
  /* Held in refs so `load` depends on the id alone. Callers pass inline
     functions — `onOpen={(v) => …}` is a new function every render — and a
     dependency on either would re-run the effect for ever, asking the server
     again on each pass. */
  const fetchRef = useRef(fetchView);
  const openRef = useRef(onOpen);
  fetchRef.current = fetchView;
  openRef.current = onOpen;

  const load = useCallback(async () => {
    if (!VIEW_ID.test(viewId)) {
      /* Not "invalid id" — the same answer as a real id that does not resolve.
         Telling someone their id is well-formed but unknown is a free oracle. */
      setFailure(classifyFailure({ status: 404 }));
      setLoading(false);
      return;
    }
    setLoading(true);
    setFailure(null);
    try {
      const response = await fetchRef.current(viewId);
      if (!response.ok) {
        setFailure(classifyFailure({ status: response.status }));
        return;
      }
      openRef.current((await response.json()) as SavedView);
    } catch {
      setFailure(classifyFailure({ networkError: true }));
    } finally {
      setLoading(false);
    }
  }, [viewId]);

  useEffect(() => { void load(); }, [load]);

  if (loading && !failure) return <LoadingState title="Opening the saved view…" description="Checking that you can see it." />;
  if (!failure) return null;

  /* One classifier, five screens. The user's next action differs — sign in,
     ask someone, or give up — and a single "something went wrong" would send
     all three of them to support.

     Nothing here prints the view id. It is the only thing in the link, which
     makes it the nearest thing to a token for that view, and a screen that
     echoes it puts it in every screenshot and support ticket. */
  switch (failure.kind) {
    case "session-expired":
      /* onSignIn, or the screen is a dead end: SessionExpiredState renders its
         button only when there is somewhere to send the user, and a screen that
         says "sign in again" without offering it is a wall. */
      return (
        <SessionExpiredState
          description="Sign in again, then open the link a second time."
          onSignIn={onSignIn ?? (() => window.location.reload())}
        />
      );
    case "denied":
      return <AccessDenied description="This view was shared with people who have a different permission." />;
    case "not-found":
      return (
        <NotFoundState
          title="This view is not available"
          /* Expired, another tenant's, or never existed — the API answers 404
             to all three so that an id cannot be confirmed, and repeating that
             distinction here would hand back what it withheld. */
          /* Deliberately says nothing about WHY. Expired, another tenant's, or
             never existed all answer 404 so an id cannot be confirmed, and
             "may have expired" hands that distinction straight back — it tells
             the holder of a guessed id that the id was real. */
          description="Ask whoever sent it to share it again."
        />
      );
    default:
      return (
        <ErrorState
          title={failure.title}
          description={failure.description}
          referenceId={failure.reference}
          severity={failure.severity}
          onRetry={failure.retryable ? () => void load() : undefined}
        />
      );
  }
}
