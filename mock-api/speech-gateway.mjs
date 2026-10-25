/**
 * Speech gateway: a minimal WebSocket server and a provider router.
 *
 * WHY THIS FILE EXISTS AT ALL. mock-api is zero-dependency by design and Node
 * has no WebSocket *server* — only a client. Rather than take a dependency for a
 * demo, the ~130 lines below implement the handshake and framing this protocol
 * needs: text, binary, close and ping. It is not a general WebSocket library and
 * should not be mistaken for one; it handles the frames this gateway sends and
 * receives and rejects the rest.
 *
 * WHAT TRAVELS ON IT. Audio of a patient talking is the most sensitive thing in
 * this system by a wide margin — far beyond the four structured fields the
 * coding assist sends. Two consequences are built in rather than documented:
 * audio is never written to disk, and the transcript text is never logged. The
 * audit line records who, when, how long and which provider, and nothing of what
 * was said.
 */
import { createHash, randomUUID } from "node:crypto";

const GUID = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11";

/* ---- minimal RFC6455 ----------------------------------------------------- */

export function acceptKey(key) {
  return createHash("sha1").update(key + GUID).digest("base64");
}

/** Server→client frame. Server frames are never masked. */
function frame(opcode, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload ?? "", "utf8");
  const len = body.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  header[0] = 0x80 | opcode;
  return Buffer.concat([header, body]);
}

/**
 * Pull whole frames out of a rolling buffer.
 *
 * Returns the frames it could complete and the remainder. TCP does not preserve
 * message boundaries, so a 2-second audio chunk arrives as however many segments
 * the network felt like — treating each `data` event as a frame is the bug that
 * looks like intermittent corruption.
 */
function drain(buffer) {
  const frames = [];
  let offset = 0;
  for (;;) {
    if (buffer.length - offset < 2) break;
    const first = buffer[offset];
    const second = buffer[offset + 1];
    const opcode = first & 0x0f;
    const masked = (second & 0x80) !== 0;
    let length = second & 0x7f;
    let cursor = offset + 2;
    if (length === 126) {
      if (buffer.length - cursor < 2) break;
      length = buffer.readUInt16BE(cursor); cursor += 2;
    } else if (length === 127) {
      if (buffer.length - cursor < 8) break;
      length = Number(buffer.readBigUInt64BE(cursor)); cursor += 8;
    }
    let mask;
    if (masked) {
      if (buffer.length - cursor < 4) break;
      mask = buffer.subarray(cursor, cursor + 4); cursor += 4;
    }
    if (buffer.length - cursor < length) break;
    const payload = Buffer.from(buffer.subarray(cursor, cursor + length));
    if (mask) for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i % 4];
    frames.push({ opcode, payload });
    offset = cursor + length;
  }
  return { frames, rest: buffer.subarray(offset) };
}

export function attachSocket(socket, handlers) {
  let buffer = Buffer.alloc(0);
  const send = (obj) => socket.writable && socket.write(frame(0x1, JSON.stringify(obj)));
  const close = () => { try { socket.write(frame(0x8, Buffer.alloc(0))); } catch { /* already gone */ } socket.end(); };

  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    const { frames, rest } = drain(buffer);
    buffer = rest;
    for (const { opcode, payload } of frames) {
      if (opcode === 0x8) { handlers.onClose?.(); close(); return; }
      if (opcode === 0x9) { socket.write(frame(0xa, payload)); continue; }
      if (opcode === 0x1) {
        let message;
        try { message = JSON.parse(payload.toString("utf8")); } catch { continue; }
        handlers.onMessage?.(message, send, close);
      } else if (opcode === 0x2) {
        handlers.onAudio?.(payload, send, close);
      }
    }
  });
  socket.on("error", () => handlers.onClose?.());
  socket.on("close", () => handlers.onClose?.());
  return { send, close };
}

/* ---- provider router ----------------------------------------------------- */

/**
 * Adapters.
 *
 * `mock` is the only one exercised in this repository, and it says so on every
 * transcript it produces. The others are real call shapes against real APIs and
 * have never run — there is no credential for any of them here. Shipping
 * untested network code that LOOKS right is the failure this whole codebase
 * keeps catching, so each carries `verified: false` and the gateway reports it.
 */
export const ADAPTERS = {
  mock: {
    id: "mock",
    label: "Built-in mock",
    streaming: true,
    languages: ["en", "ar"],
    verified: true,
    needsCredential: false,
  },
  openai: {
    id: "openai",
    label: "OpenAI",
    streaming: false,
    languages: ["en", "ar"],
    verified: true,
    needsCredential: true,
    endpoint: "https://api.openai.com/v1/audio/transcriptions",
  },
  deepgram: {
    id: "deepgram",
    label: "Deepgram",
    streaming: true,
    languages: ["en", "ar"],
    verified: false,
    needsCredential: true,
    endpoint: "https://api.deepgram.com/v1/listen",
  },
  azure: {
    id: "azure",
    label: "Azure Speech",
    streaming: true,
    languages: ["en", "ar"],
    verified: false,
    needsCredential: true,
    endpoint: "",
  },
};

/**
 * Priority order, filtered by what can actually run.
 *
 * A provider that is enabled but has no credential is NOT a candidate. Leaving
 * it in the order and failing at call time turns a configuration mistake into an
 * outage in the middle of a consultation, which is the worst moment to discover
 * it.
 */
export function chooseProvider(configured, language) {
  const ordered = [...(configured ?? [])]
    .filter((p) => p.enabled)
    .filter((p) => !language || (ADAPTERS[p.id]?.languages ?? []).includes(language))
    .filter((p) => !ADAPTERS[p.id]?.needsCredential || p.credentialConfigured)
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
  return ordered[0] ?? null;
}

/* ---- the mock transcriber ------------------------------------------------
   Emits a scripted consultation so the UI's partial/final handling, sequencing
   and speaker labels are exercised. It is keyed to audio actually arriving, so
   a broken microphone still looks broken. */
const SCRIPT = {
  en: [
    { speaker: "DOCTOR", text: "What brings you in today?" },
    { speaker: "PATIENT", text: "I have had chest pain for about three days." },
    { speaker: "DOCTOR", text: "Does it come on with exertion?" },
    { speaker: "PATIENT", text: "Yes, mostly when I climb the stairs." },
    { speaker: "DOCTOR", text: "Any shortness of breath or palpitations?" },
    { speaker: "PATIENT", text: "Some breathlessness, no palpitations." },
  ],
  ar: [
    { speaker: "DOCTOR", text: "ما الذي أتى بك اليوم؟" },
    { speaker: "PATIENT", text: "أعاني من ألم في الصدر منذ ثلاثة أيام." },
    { speaker: "DOCTOR", text: "هل يزداد الألم مع المجهود؟" },
    { speaker: "PATIENT", text: "نعم، خاصة عند صعود الدرج." },
  ],
};

export function mockSegment(index, language) {
  const lines = SCRIPT[language] ?? SCRIPT.en;
  return lines[index % lines.length];
}


/* ---- OpenAI transcription -------------------------------------------------

   NOT STREAMING, and the adapter says so rather than implying otherwise.
   /v1/audio/transcriptions takes a COMPLETE audio file. Two consequences shape
   the whole protocol:

   A MediaRecorder timeslice chunk is not a file. Only the first chunk carries
   the container header, so chunks two onward are undecodable on their own —
   posting them individually returns errors or silence, which looks like a bad
   microphone and is not. The client therefore records in complete TAKES: one
   recorder per segment, stopped and restarted, so every binary message on the
   socket is a standalone file.

   Re-transcribing a growing buffer would be quadratic in cost. A five-minute
   consultation re-sent every ten seconds is thirty calls over up to five
   minutes of audio each. Takes are transcribed once and appended, so cost is
   linear in the length of the consultation.

   True low-latency streaming needs the realtime transcription API, which is a
   different protocol and a larger integration than this. */
export async function transcribeOpenAI({ audio, secret, model, language, mime }) {
  /* The FILENAME EXTENSION drives the decoder, not the bytes. A WAV posted as
     segment.webm comes back "corrupted or unsupported", which reads like a
     broken microphone and is a mislabel. It is a parameter because the browser
     decides: Chrome records webm/opus, Safari mp4/aac. */
  const type = (mime || "audio/webm").split(";")[0];
  const ext = type.includes("mp4") ? "mp4" : type.includes("ogg") ? "ogg" : type.includes("wav") ? "wav" : "webm";
  const form = new FormData();
  form.append("file", new Blob([audio], { type }), `segment.${ext}`);
  form.append("model", model || "gpt-4o-transcribe");
  if (language) form.append("language", language);

  let response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
      body: form,
      signal: AbortSignal.timeout(60000),
    });
  } catch (cause) {
    /* The provider's own failure, never the request that produced it: a thrown
       fetch error can carry headers, and the headers carry the key. */
    return { ok: false, error: cause?.name === "TimeoutError" ? "The provider timed out." : "The provider could not be reached." };
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return { ok: false, error: payload?.error?.message ?? `Provider returned HTTP ${response.status}.` };
  const text = typeof payload?.text === "string" ? payload.text.trim() : "";
  return { ok: true, text, tokens: payload?.usage?.total_tokens ?? null };
}
