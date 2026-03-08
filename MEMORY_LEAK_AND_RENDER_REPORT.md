# Memory Leak and Render Report
Date: 2026-03-08

## Scope
- Reviewed client-heavy components, route trackers, push prompt lifecycle code, and admin shell/client boundaries.

## Findings
## 1) Timer lifecycle risk in OneSignal prompt flow
- `components/OneSignalAutoPrompt.tsx` used chained timeout promises without explicit timer cleanup.
- Potential behavior: delayed handlers firing after unmount/navigation and noisy unhandled promise rejections.
- Fix applied:
  - explicit timer ids,
  - cleanup with `clearTimeout`,
  - guarded async try/catch in delayed callbacks.

## 2) Admin shell hydration scope
- `AdminShell` was client-side mainly for pathname propagation.
- Converted shell to server wrapper and kept pathname concern inside client `Sidebar`.
- Result: smaller client boundary and less hydration work in admin route tree.

## 3) Re-render observations
- `Sidebar` link filtering is memoized and now only recalculates on `access` change.
- No evidence of runaway subscriptions/websocket leaks in audited files.

## 4) High-frequency analytics handler
- Removed unnecessary user auth lookup from pageview API hot path.
- Indirectly reduces server resource churn and contention under high traffic.

## Residual Risks
- Some admin pages still fetch data client-side and can trigger extra renders on mount.
- Wider pass could further split large client pages into server shell + client islands.
