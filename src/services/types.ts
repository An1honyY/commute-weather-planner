// Shared result shape for every src/services/ module — docs/05-data-wiring.md
// §5.4 / docs/12-dev-workflow-ci.md §12.1. One typed seam per external API,
// rather than each screen interpreting raw fetch errors differently — this
// is what makes the dev-menu failure toggles (§12.2) and unit-test mocking
// (§11.1) simple.
export type ServiceError = "network" | "unreachable" | "rate-limited";

export type ServiceResult<T> = { data: T } | { error: ServiceError };
