"use client";
import { SourceButton, SourceInput } from "../../shared/controls";
import { useEffect, useRef, useState } from "react";
import { Send } from "lucide-react";
import type { ChatMessage } from "../../shared/types";
import { useTeleconsultClient } from "../lib/api";
import { useApi } from "../lib/hooks";
import { useTeleconsultFormat } from "../lib/format";
import { cx } from "./ui";

export function ChatThread({ appointmentId, author, dark }: { appointmentId: string; author: string; dark?: boolean }) {
  const msgs = useApi<ChatMessage[]>(`/api/appointments/${encodeURIComponent(appointmentId)}/messages`, { poll: 2000 });
  const client = useTeleconsultClient();
  const { fmtTime } = useTeleconsultFormat();
  const [text, setText] = useState("");
  const [failure, setFailure] = useState<string>();
  const listRef = useRef<HTMLUListElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.data?.length]);

  const send = async () => {
    if (!text.trim()) return;
    const t = text;
    setFailure(undefined);
    try {
      // The server derives the sender from the authenticated account; `from`/`author` are display fields only.
      await client.post(`/api/appointments/${encodeURIComponent(appointmentId)}/messages`, { from: "patient", author, text: t });
      setText((current) => (current === t ? "" : current));
      msgs.reload();
    } catch (e) {
      // The typed message stays in the box so it can be sent again.
      setFailure((e as Error).message);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <ul ref={listRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1 py-2">
        {msgs.data?.map((m) => (
          <li key={m.id} className={cx("flex", m.author === "System" ? "justify-center" : m.from === "patient" ? "justify-end" : "justify-start")}>
            {m.author === "System" ? (
              <span className={cx("px-4 text-center text-xs", dark ? "text-white/60" : "text-ink-400")}>{m.text}</span>
            ) : (
              <span className={cx("max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px]", m.from === "patient" ? "rounded-br-md bg-forest text-white" : dark ? "rounded-bl-md bg-white/15 text-white" : "rounded-bl-md bg-white text-ink")}>
                {m.from === "staff" && <span className={cx("block text-xs font-semibold", dark ? "text-sun" : "text-forest-500")}>{m.author}</span>}
                {m.text}
                <span className={cx("ml-2 text-[11px]", m.from === "patient" ? "text-forest-200" : dark ? "text-white/50" : "text-ink-400")}>{fmtTime(m.at)}</span>
              </span>
            )}
          </li>
        ))}
      </ul>
      {failure && <p role="alert" className="px-1 pt-1 text-xs text-rose-600">{failure}</p>}
      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 pt-2">
        <SourceInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Message your care team" className={cx("h-12 min-w-0 flex-1 rounded-2xl px-4 text-[15px] focus:outline-none focus:ring-2 focus:ring-forest-500", dark ? "bg-white/10 text-white placeholder:text-white/50" : "border border-forest-100 bg-white")} />
        <SourceButton type="submit" className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sun text-forest-900" aria-label="Send"><Send className="h-5 w-5" /></SourceButton>
      </form>
    </div>
  );
}
