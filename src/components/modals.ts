// Consolidated modal exports for easier imports
// Using React.lazy for code splitting - wrap with Suspense when using
import { lazy } from 'react';

export const TicketModal = lazy(() => import('./TicketModal'));
export const ScoreEntryModal = lazy(() => import('./ScoreEntryModal'));
export const StatsModal = lazy(() => import('./StatsModal'));
export const RemoveModal = lazy(() => import('./RemoveModal'));
export const ChangelogModal = lazy(() => import('./ChangelogModal'));
export const PrivacyModal = lazy(() => import('./PrivacyModal'));
export const AddGameModal = lazy(() => import('./AddGameModal'));

// These are used immediately on page load, so keep static imports
export { AuthModal } from './AuthModal';
export { LeaderboardModal } from './LeaderboardModal';
export { SocialModal, SocialFAB } from './SocialModal';
