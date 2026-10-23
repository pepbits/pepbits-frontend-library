export * from "./types.ts";
export * from "./document-key.ts";
export * from "./policy.ts";
export * from "./document-manager.ts";
/* The React binding. Anything importing this index pulls React in with it, so
   a script that wants the logic alone imports ./policy.ts or ./document-key.ts
   directly -- the same arrangement other pure packages use for verification scripts. */
export * from "./use-workspace.tsx";
