# @pepbits/tokens

Hand-written CSS tokens and opt-in reference fonts for shared UI. Version `0.1.0` is published; consumers need CSS-aware tooling. The original CSS, all eight font assets, two OFL licenses and provenance are copied unchanged.

Published at **0.1.0** on GitHub Packages. Install with `npm install @pepbits/tokens` after adding the `@pepbits` registry `.npmrc` and a read token — see the [developer quick start](../../docs/development/PUBLISHING.md#developer-quick-start-for-product-apps). Working examples: the [component showcase](../../demo-apps/showcase/README.md) and the [demo apps](../../demo-apps/README.md).

## Public API and use

```ts
import '@pepbits/tokens/tokens.css';
import '@pepbits/tokens/reference-fonts.css'; // optional font faces
import {TOKEN_NAMES, tokenVar, type TokenName} from '@pepbits/tokens';

const background: TokenName = '--surface';
const style = {background: tokenVar(background)}; // var(--surface)
```

`TOKEN_NAMES` is the readonly list of 46 declared CSS custom properties, including their `--` prefix. `TokenName` is its literal union; `tokenVar(name)` returns the typed `var(--name)` expression. Asset exports retain `./tokens.css`, `./reference-fonts.css` and `./fonts/*.woff2`.

Hosts import CSS once, set `data-theme` to their effective theme, and apply effective font, scale, radius and density preferences at the appropriate surfaces. Loading this package does not apply preferences or tenant policy. Unknown names fail TypeScript checking; runtime callers must pass valid names. Font licenses and provenance live in [src/fonts](src/fonts/provenance.json).

## Scope and verification

CSS remains the source of truth; there is no JSON pipeline, theme provider, product configuration, persistence or automatic DOM mutation. Existing theme selector IDs, including `nexora`, are compatibility identifiers. Reference fonts do not replace the host's own font choices or supply a complete multilingual font stack.

`npm test -w @pepbits/tokens` checks the token list against actual declarations (excluding comments), the helper, and every stylesheet font URL and WOFF2 header. `npm run typecheck -w @pepbits/tokens` checks the public types. These checks do not establish browser rendering or contrast acceptance; no styles have been changed in this phase.
