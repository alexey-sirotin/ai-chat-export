# AI Chat Export — project state

Last updated: 2026-10-08

This file is the canonical technical handoff for the project. Keep it focused on the **current state**, active decisions, known follow-ups, and the next useful steps. Do not turn it into a chronological development log.

## Repository / product

- Repository: `alexey-sirotin/ai-chat-export`
- Product name: **AI Chat Export**
- Default branch: `main`
- Current `main` head when this file was created: `f76d741fdf0908e6542a03f307d469ac00773e18`
- Current released version in the repository: **0.1.38**
- Public export formats: Markdown and HTML
- Diagnostic normalized JSON remains development-oriented and is disabled in packaged release builds.
- Browser targets: Chromium/Chrome and Firefox.

Store status from the project discussion:
- Chrome Web Store: published; extension id `bpllfeabeahfkpcdimjloolpgdebenoc`.
- Firefox Add-ons: published; initially auto-approved, with the usual possibility of later human review.

## Supported providers

Current provider support:

- ChatGPT
- Claude
- Grok
- DeepSeek

The architecture is provider-adapter based. Provider-specific code owns extraction, branch reconstruction, service markup, inline-card semantics, auth/download details, and provider-specific selection behavior. Shared code owns normalized export, ZIP/download flow, generic rendering, common ordered selection where appropriate, progress/cancellation, and packaging.

ChatGPT keeps specialized graph-aware selection because one logical assistant exchange can span multiple nodes. Claude, Grok, and DeepSeek share more of the ordered-message selection plumbing.

See also:
- `docs/provider-internals.md`
- the multi-platform architecture documentation merged via PR #31.

## Current renderer capabilities

### Markdown / HTML

Shared renderer handles:
- ordinary Markdown text;
- headings, lists, blockquotes, tables, fenced code and inline code;
- local and remote attachment references;
- inline images;
- local-path preference after successful asset download;
- image sizing constrained to the message card width;
- safe remote fallbacks when an image cannot be archived locally.

### KaTeX / math

KaTeX support is **implemented** in HTML export (PR #39).

Current behavior:
- render inline `$...$` and `\(...\)`;
- render display `$$...$$` and `\[...\]`;
- emit self-contained KaTeX MathML (`output: "mathml"`), avoiding external KaTeX CSS/fonts in exported HTML;
- fenced code and inline code are left untouched;
- ordinary currency-like text is not treated as math;
- invalid TeX is preserved literally rather than breaking the export;
- KaTeX 0.18.9 is vendored and reproducibility is checked in CI.

ChatGPT math normalization also converts ChatGPT-style delimiters to portable Markdown syntax where appropriate, without touching code spans/fences.

### Mermaid

Mermaid HTML rendering is **implemented** (PR #41).

Current behavior:
- fenced `mermaid` blocks stay unchanged in Markdown/JSON;
- HTML path renders them to static SVG;
- no CDN/runtime dependency is needed by the exported HTML;
- per-diagram fallback keeps the original Mermaid code block if rendering fails;
- SVG is sanitized;
- Mermaid 11.17.2 is vendored and checked in CI.

Manual validation included ChatGPT and DeepSeek HTML export.

An experimental Mermaid ESM packaging PR (#48) was closed without merge. Do not assume that experiment is active.

## Provider-specific current state

### ChatGPT

Source of truth remains the authenticated conversation graph rather than DOM transcript reconstruction.

Key behavior:
- conversation graph / active branch reconstruction;
- attachment discovery across current and historical representations;
- sandbox/interpreter file support;
- remote image fallback;
- `Model caption:` remains intentionally filtered;
- meaningful intermediate assistant text is retained while internal/tool/status noise is suppressed structurally.

Selection performance was profiled on a large chat. The main first-open delay came from server TTFB for the full conversation request, not local parsing/index construction. Pagination was slower in the tested case.

Current optimization (PR #45):
- prewarm the ChatGPT selection index when the conversation mounts;
- share an in-flight build so prewarm and popup do not duplicate the expensive request;
- preserve existing TTL/dirty/session-cache behavior.

Current ChatGPT selection DOM supports the newer `data-turn-key` structure, with legacy fallback (PR #40).

### Claude

Current Claude adapter:
- authenticated conversation API;
- deterministic active branch using `current_leaf_message_uuid` + parent links;
- structured `content[]` parsing;
- local Claude resource downloads;
- best-effort remote-image download with remote fallback;
- virtualized transcript selection support.

Claude custom visual/MCP widgets are supported (PR #42):
- capture the largest visible SVG from `*.claudemcpcontent.com` widget frames;
- inline computed presentation styles;
- sanitize dangerous content;
- associate the visual with the owning transcript row;
- export it as an `image/svg+xml` attachment;
- do not place raw SVG payloads in exported JSON.

Known Claude caveats remain broader provider coverage: unusual artifacts, shared-link behavior, citations, and future content variants can still change.

### Grok

Grok support is considered working and was manually validated extensively.

Core extraction:
- metadata from `/rest/app-chat/conversations_v2/{conversationId}`;
- complete response graph from `/rest/app-chat/conversations/{conversationId}/responses?includeThreads=false`;
- active branch from `responseId` / `parentResponseId`, using currently mounted response IDs only as a branch hint and never as the complete data source.

Important semantic detail:
- REST `message` is not always sufficient for exact inline-card placement;
- a `document_start` MAIN-world history hook captures gateway `conversation.history.item` events;
- `item.x_grok.output_chunks` is used for exact composition when available;
- generated images use `render_start` as the inline anchor and later `render_generated_image` as final metadata for that existing anchor.

Downloads:
- Grok-generated and user assets can require authenticated `assets.grok.com` requests with Grok referrer/image Accept headers;
- `/rest/assets/{assetId}` provides metadata/key information where needed;
- generated files use `/rest/conversations/files/content` and a fresh signed download URL;
- successful local copies are preferred over remote references;
- third-party images may fall back to a remote clickable image if download is blocked.

Manual validation covered:
- full and selected export;
- branched conversation (`34` response nodes / `18` active-branch turns in the main fixture);
- no transcript scrolling;
- external searched image position;
- generated image position;
- user-uploaded image;
- generated file (`hello.c`);
- filenames such as `image (2).jpg`;
- inline Markdown images in HTML;
- image width constrained inside message cards.

### DeepSeek

DeepSeek support was added and merged via PR #37.

Current behavior:
- detect chats at `/a/chat/s/{id}`;
- read bearer auth from `localStorage.userToken.value` in page context;
- fetch full history from `/api/v0/chat/history_messages?chat_session_id={id}`;
- deterministic active branch from `chat_session.current_message_id` + `parent_id`;
- normalize `REQUEST`, `RESPONSE`, `THINK`, and `FILE` fragments;
- export visible THINK/reasoning as a separate assistant block before the final response;
- localize external images inside both THINK and RESPONSE content;
- ordinary user files download from `files.deepseeksvc.com` signed paths (`ty=r`, `credentials: omit`);
- user image previews can use `ty=p` and export as WebP when no original image is exposed;
- external SVG images keep `.svg` instead of degrading to `.bin`;
- selection uses `data-virtual-list-item-key`.

Manual browser validation covered full export, selection, branch behavior, uploaded files, external raster images, and SVG rendering.

## Packaging / CI

Release packaging currently:
- builds Chromium and Firefox ZIPs;
- uses package smoke tests to enforce manifest/runtime file expectations and keep development files out of release packages;
- excludes docs/tests/scripts/source-development material from browser ZIPs;
- guards release-only behavior such as disabling diagnostic JSON.

PR #50 made release packaging reproducible from GitHub-generated source archives that do not contain `.git` metadata:
- prefer `git ls-files` in a normal checkout;
- fall back to source-archive file enumeration when `.git` is absent;
- ignore `.git`, `dist`, and `node_modules` in fallback mode;
- use NUL-delimited file enumeration;
- CI tests packaging from a source archive;
- procedure documented in `docs/release-packaging.md`.

This is relevant for AMO/store source submissions: GitHub's normal `Source code (zip)` archive should be usable directly.

## Recent merged work / milestones

Relevant merged PRs:
- #35 — Claude support
- #36 — Grok support
- #37 — DeepSeek support
- #38 — shared provider plumbing refactor
- #31 — current multi-platform architecture documentation
- #39 — KaTeX HTML rendering
- #40 — ChatGPT selection DOM update
- #41 — Mermaid HTML rendering
- #42 — Claude custom visual SVG capture
- #43 — rename to AI Chat Export
- #44 — packaged release mode + ChatGPT Markdown math hardening
- #45 — ChatGPT selection prewarm
- #46 — post-rename release hardening
- #47 — release v0.1.38
- #50 — source-archive packaging support

Repository was renamed from `chatgpt-export-md-html` to `ai-chat-export` after multi-provider support became stable.

## Current open work

At the time this file was created:
- no open pull requests;
- no open GitHub issues;
- `main` is the canonical working base.

Do not invent a new task from stale handoff material. Check current GitHub state first when starting new work.

## Backlog / future work

Known ideas that are not current blockers:

- broaden provider fixture coverage as server formats evolve;
- improve semantic citation/source preservation where providers expose richer citation cards;
- continue watching provider-internal APIs for compatibility drift;
- possible future common refactors only where behavior is already proven across multiple providers;
- HTML image preview resizing while keeping originals clickable remains low priority / “maybe someday”;
- support for externally referenced ChatGPT web images can be improved later; current policy permits remote fallback;
- scheduled compatibility testing remains desirable, but authenticated provider sessions make fully unattended checks non-trivial because login often uses Apple/Google/email-code flows.

## Working rules for future chats

When starting a new project chat:

1. Read this file first.
2. Check the current repository/PR/issue state on GitHub before assuming this snapshot is still current.
3. Use `docs/provider-internals.md` for provider-specific reverse-engineering detail.
4. Update this file after substantial milestones, merges, architecture decisions, or changes to active backlog/next steps.
5. Keep this file concise and current; remove stale “next step” items instead of accumulating history.
6. Do not create a separate handoff unless the user explicitly asks for one or a one-off experimental branch needs temporary notes.
