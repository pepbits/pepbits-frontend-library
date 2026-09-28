"use client";

import { useCallback, useEffect, useState } from "react";
import { useSchoolApi } from "./api";
import type { GradeRequest, QuizAttempt } from "./contract";

/** A student's recorded attempt for one quiz (GET /quiz-attempts). The source kept it in localStorage. */
export function useQuizAttempt(studentId: string | null, quizId: string | null) {
  const api = useSchoolApi();
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    setAttempt(null); setLoaded(false); setLoadError(null);
    if (!studentId || !quizId) { setLoaded(true); return; }
    let alive = true;
    api.get<{ data: QuizAttempt | null }>(`/quiz-attempts?studentId=${encodeURIComponent(studentId)}&quizId=${encodeURIComponent(quizId)}`)
      .then(({ data }) => { if (alive) setAttempt(data); })
      .catch((e: Error) => { if (alive) setLoadError(e.message); })
      .finally(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [api, studentId, quizId, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { attempt, loaded, loadError, reload };
}

export type GradeState =
  | { status: "idle" }
  | { status: "grading"; request: GradeRequest }
  | { status: "failed"; request: GradeRequest; message: string }
  | { status: "graded"; attempt: QuizAttempt };

/** Submits answers for SERVER grading (POST /quizzes/:id/grade). The client never scores: it sends only the answers,
    time taken and, for students, their id (preview: true for staff, which the server does not store). A rejected
    request keeps the submitted answers so Retry sends exactly the same attempt. */
export function useQuizGrader(quizId: string) {
  const api = useSchoolApi();
  const [state, setState] = useState<GradeState>({ status: "idle" });
  const submit = useCallback(async (request: GradeRequest) => {
    setState({ status: "grading", request });
    try {
      const { data } = await api.post<{ data: QuizAttempt }>(`/quizzes/${encodeURIComponent(quizId)}/grade`, request);
      setState({ status: "graded", attempt: data });
    } catch (e) {
      setState({ status: "failed", request, message: (e as Error).message });
    }
  }, [api, quizId]);
  /* An ordinary event callback over the current failed state: the request is sent once per click, never from inside a
     state updater (which React may call twice), and it is exactly the request that failed. */
  const retry = useCallback(() => { if (state.status === "failed") void submit(state.request); }, [state, submit]);
  const reset = useCallback(() => setState({ status: "idle" }), []);
  return { state, submit, retry, reset };
}
