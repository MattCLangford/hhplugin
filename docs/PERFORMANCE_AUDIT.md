# HireHop Bundle Reliability Audit

Audit date: 21 July 2026

## Outcome

The transaction warnings were caused by request amplification rather than one confirmed HireHop limit. The largest source was the supplying commercial module starting one inventory-master lookup for every unique item without a global concurrency limit. Completed lookups could then cause repeated hidden Job Track document renders. The loader also allowed one failed script download to reject a sequence and block every later module in that attempt.

The implementation now isolates module loading, serialises automatic HireHop reads, caches inventory results for 15 minutes in the browser session, observes server rate-limit responses, and removes eager or duplicated data loads.

### Live reliability follow-up

Live testing exposed three additional lifecycle defects behind intermittent combinations such as Stage Designer appearing without Preview, Job Performance or commercial columns:

- shared-dependent scripts were allowed to initialize after the shared module failed to download, leaving their single-run guards around incomplete instances;
- an early depot/header value could be cached before the logged-in user's stable depot fields were ready; Stage Designer is not depot-gated, so it could appear by itself;
- the docked preview changes the supplying toolbar's DOM path, and HireHop can replace the complete `#items_tab` element after initialisation.

The loader now waits for the shared dependency before starting those modules. Depot resolution evaluates every known authoritative `window.user` depot field plus active header state and accepts a positive Proposal Creation match without allowing the first unrelated numeric field to veto it. Toolbar discovery supports docked and undocked layouts, and root replacement triggers event-driven module health refreshes. These checks do not make HireHop API requests.

## Root Causes

| Severity | Finding | Effect |
| --- | --- | --- |
| Critical | Inventory defaults were fetched once per unique supplying item with no bundle-wide queue or minimum gap. | Large lists created simultaneous HireHop transactions. A missing record could try four endpoints. |
| Critical | Loader sequences rejected on the first script error. Route checks retried failed downloads without persistent backoff. | One transient CDN/network failure produced a partial bundle and unhandled rejection. |
| High | Every inventory-default completion could schedule a hidden Job Track document render. | Progressive inventory lookup completion amplified document transactions. |
| High | Journey duplicated the native jobs-grid request during its hidden initial render, then requested up to five job details concurrently. | Up to six unnecessary automatic HireHop requests on a project page before Journey was opened. |
| High | Loader requested `12-projectgroups.js?v=0.5` while the manifest declared `0.11`. | Browser caches could retain materially stale code across users. |
| Medium | Stage Designer made eight catalogue calls before fallback search, including alternate parameter forms and an all-stock request overlapping category calls. | Opening the designer generated an avoidable request sequence. |
| Medium | Shared depot selection preferred any allowed-looking DOM candidate over the first authoritative candidate. | Unrelated page fields could activate or block modules inconsistently. |
| Medium | Several visual modules ran permanent 3–5 second maintenance intervals in addition to focus, AJAX and navigation events. | Continuous DOM scans and redraw amplification in long sessions. |

## Request Inventory: Before and After

`N` means the number of unique supplying inventory masters whose required fields are absent from the supplying-line data. Counts exclude the normal HireHop requests made by HireHop itself.

| Feature and endpoint | Before | After |
| --- | --- | --- |
| Inventory defaults: availability, hire-stock or consumables endpoints | `N` lookups started without a global limit; each lookup could use 1–4 requests. | Still required for missing master data, but one automatic request chain at a time, at least 1.25 seconds between chains, 0.5 seconds between fallbacks, identical in-flight deduplication, 15-minute session cache, paused while hidden, and server-directed/global cooldown after rate limiting. |
| Proposal preview: `/modules/docmaker/merge-html.php`, document 167 | One render when opened; debounced renders after relevant item mutations. | Unchanged because it is required functionality. In-flight refresh coalescing remains. Default opening is deferred while the browser tab is hidden. |
| Job Performance source: document 162 | One render on mount plus potentially repeated renders as inventory defaults resolved. | One render on mount to read commercial adjustment inputs. Later inventory/item changes recalculate from the existing supplying tree and cached inputs. Manual refresh still forces a render. Failed automatic retries are limited to at most one per minute. |
| Project Journey native jobs-grid URL | One duplicate request during hidden panel construction. | Zero duplicate requests. Native AJAX responses and rendered grid rows are reused. |
| Project Journey `api/job_data.php` | Up to five concurrent calls during initial hidden render; preload path could be revisited by renders. | Zero calls until Journey is opened; then at most five missing details, attempted once and serialised through the shared queue. |
| Stage hire-stock catalogue | Three calls: two categories plus overlapping `cat=0`. | Two category calls; the overlapping all-stock call was removed. |
| Stage availability catalogue | Four calls: two parameter variants for each of two categories. | Two preferred category calls normally; one alternate request per category only if its preferred response supplies no candidates. |
| Stage consumables catalogue | One call. | One call, queued with the other catalogue reads. |
| Stage fallback search | Up to two category calls for every missing search term. | Stops for each term as soon as a category returns candidates; otherwise retains the second-category fallback. |
| Stage writes: item save/import/delete | One save plus one bulk import for a normal stage; bounded retry existed only for HireHop error code 327. | Same functional write count. HTTP 429, server text warnings and code 327 now honour `Retry-After` when supplied and retain the two-attempt bound. |
| Capacity Tracker project search | User-opened only; one request per date chunk/page, with one alternate filter retry only after a server error. | Unchanged. It is already user-triggered, paginated, non-overlapping and guarded by an in-flight flag. |
| Capacity absence feed/proxy/Graph | User-opened only; one feed/proxy request or Graph pagination, cached 15 minutes. | Unchanged. This traffic is external to HireHop and already deduplicated/cached. |
| Autopull | No added API requests. | Unchanged. |
| Checklist, project/job groups, icons and project-jobs layout | No added API requests. | The prototype Checklist tab is disabled; the module retains the commercial-tab visibility policy. Other maintenance polling is now bounded. |

## Data Reused Instead of Requested

- Journey now consumes the native jobs-grid AJAX response captured by its existing `ajaxComplete` handler and falls back to rendered grid rows. It no longer requests the jqGrid URL itself.
- Job Performance reads supplying Revenue and CoS from the existing jsTree/native table data. The initial document-162 response is retained only for discount and commission inputs; subsequent line changes are calculated locally.
- Stage Designer still reads any reliable stock collections already present on `window` before calling an endpoint. Live catalogue requests remain necessary because those page collections are not consistently complete.
- Supplying RSP/Revenue/Markup use custom fields already present on the line first. Inventory lookup is only queued when required master data is absent.

## Shared Request Controls

`5-hirehop.js` now exposes `WiseProposalSectionBuilderHireHop.requests`:

- concurrency limit of one automatic HireHop read;
- priority queue so user-opened Journey or Stage work can pass background inventory hydration;
- configurable minimum request gap;
- identical in-flight request deduplication;
- memory caching and optional session caching;
- pause for background work when `document.hidden` is true;
- cooldown on HTTP 429 or recognised “too many” transaction messages;
- support for server `Retry-After` timing;
- bounded, non-sensitive diagnostics counters.

No automatic retry was added to the shared reader. Endpoint fallback remains explicit and bounded in the feature that understands the response.

## Polling and Observers

- Loader recovery remains bounded to 12 visible-page checks at 2.5 seconds.
- Icons and supplying commercial recovery remain bounded and now pause while hidden.
- Checklist, Project Journey, Project Jobs, Project Groups and Job Groups previously maintained forever. They now stop after 12 visible-page recovery checks (about one minute); load, focus, hash, resize where applicable, and AJAX events remain available afterward.
- Stage Designer toolbar recovery now stops after 12 visible-page checks.
- The disabled visual editor's 2.5-second recovery loop now stops after 24 visible-page checks if the module is re-enabled.
- The supplying commercial CoS watcher remains a 1.2-second interval only while an item-edit dialog is open. It reads local controls, makes no request, and is cleared when the dialog closes.
- The commercial MutationObserver now watches `#items_tab`, not the whole document body. Dialog opening is covered by the existing dialog event.
- Preview and icon observers remain scoped to supplying-tree containers and debounce their work.

## Failure Isolation and Diagnostics

- Supplying-list modules load independently after the shared integration module. One failed module no longer blocks the others.
- Script failures use exponential backoff with jitter and a five-minute cap instead of retrying on every route signal.
- Script load attempts time out after 15 seconds and remove their failed script element.
- Runtime modules touched by this audit have single-instance guards.
- Use `WiseHireHopEnhancementLoader.describe()` for module load state and retry timing.
- Use `WiseHireHopDiagnostics.describe()` for loader state, depot context, loaded-module flags and request queue/cache/rate-limit counters.
- Preview diagnostics now report whether its button, Job Performance strip and open panel are actually mounted, rather than treating script download alone as successful UI health.
- Diagnostics record request type only, not job IDs, inventory IDs, payloads or response data.

## Remaining Live-Environment Checks

HireHop's undocumented transaction thresholds and catalogue response shapes cannot be verified locally. The following need a live session:

1. Confirm the preferred availability `cats` form returns the same component fields as the alternate `cat` form.
2. Confirm inventory records expose `RSP`, `Revenue` and `Markup` in at least one retained fallback endpoint.
3. Measure the first uncached load time for a very large supplying list. The conservative queue intentionally trades progressive field hydration for transaction safety.
4. Confirm HTTP 429 and HireHop error 327 responses expose any `Retry-After` header as expected.
5. Confirm internal HireHop navigation emits one of the retained AJAX/focus/hash events after bounded recovery polling has stopped.
