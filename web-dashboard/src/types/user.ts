export type { UserRole, UserProfile, UserAccount } from './rbac';
export { SYSTEM_ROLES_CONFIG, buildUserProfileFromAccount } from './rbac';
export type { CuratedMemoji } from '../services/avatarService';
export { CURATED_MEMOJIS, getRoleDefaultAvatar, resolveUserAvatar } from '../services/avatarService';

