# Shared fallback catalog chunks — 2 October 2026

Status: Webpack configuration corrected locally; **full Next rebuild, bundle gate and deployment pending**.

The normal-terminal public-build attempt passed both web and desktop compilation, then failed the unchanged 550,000-byte compressed client-chunk budget. Desktop's largest chunk was 431,332 bytes. Web's largest chunk was 783,676 bytes: Next combined the immediate English fallback catalog and standalone control English catalog into one shared chunk. Other languages already loaded on demand. This is a bundling defect, separate from the earlier font-resolution correction and SSH/session restrictions.

The production client Webpack configuration now keeps canonical language fallbacks and control English messages in individually named chunks, matching desktop's existing Vite policy. Framework cache groups remain in place. Development and server bundling are unchanged. The catalog content, backend ownership, localization behavior and page layout are unchanged; neither messages nor language support were removed and the existing bundle budget was not raised.

`npm run test:catalog-chunks` compiles the actual canonical English source catalogs using Next's bundled Webpack and verifies separate emitted assets within the existing budget. It also checks preserved framework groups, unchanged development/server configuration and Windows/POSIX module paths. This focused bundling test is not a full Next application build. The [validation receipt](evidence/shared-catalog-chunks-2026-10-02/validation.json) retains source identity and exact command scope. The existing guarded deployment command reruns this test, the full public builds and the bundle gate before packaging or remote staging.

The operator's stopped attempt created only local builds and read the selected remote baseline. No release upload, service pause or cutover occurred. The private pipeline's `--retry-build` option archives that known build-only attempt with its evidence, and refuses a retry if packaging/upload/cutover evidence is present. Public activation remains pending until authenticated staging and public verification complete.

## Next configuration-loader follow-up

The following normal-terminal attempt stopped immediately because Next’s TypeScript config loader could not resolve the newly imported local ESM helper. The direct catalog compiler checks had missed this integration boundary. The cache-group rule is now inline in `next.config.ts`, and the tests load the actual config through installed Next `transpileConfig` before using it to compile the actual source catalogs. Both tests pass. The [separate correction receipt](evidence/shared-catalog-chunks-2026-10-02/next-config-loader-correction.json) preserves this new source identity without rewriting the prior test record. No remote staging or cutover occurred. A full normal-terminal rebuild and deployment remain pending.
