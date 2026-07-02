// Shared with App.jsx and ClubLayoutSkeleton — kept dependency-free (no
// component imports) so it can be statically imported from App.jsx without
// dragging ClubLayout's lazy-loaded chunk into the main bundle.
// Routes: /club/:id → dashboard, /club/:id/settings, /club/:id/vote, /club/:id/log, /club/:id/fund
export function activeTab(path, clubId) {
  if (path === `/club/${clubId}/settings`) return 'settings'
  if (path === `/club/${clubId}/vote`) return 'vote'
  if (path === `/club/${clubId}/log`) return 'log'
  if (path === `/club/${clubId}/fund`) return 'fund'
  return 'dashboard'
}
