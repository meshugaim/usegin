import type { UserTier, WorkspacePlan, WorkspaceLimits } from './types'

// Limits for private workspaces based on user tier
export const PRIVATE_WORKSPACE_LIMITS: Record<UserTier, WorkspaceLimits> = {
  free: {
    maxProjects: 1,
    maxCollaboratorsPerProject: 3,
    storageGb: 1,
  },
  pro: {
    maxProjects: 10,
    maxCollaboratorsPerProject: 100, // effectively unlimited
    storageGb: 50,
  },
  enterprise: {
    maxProjects: 1000, // effectively unlimited
    maxCollaboratorsPerProject: 1000,
    storageGb: 500,
  },
}

// Limits for group workspaces based on plan
export const GROUP_WORKSPACE_LIMITS: Record<WorkspacePlan, WorkspaceLimits> = {
  team: {
    maxProjects: 20,
    maxCollaboratorsPerProject: 50,
    storageGb: 100,
  },
  business: {
    maxProjects: 100,
    maxCollaboratorsPerProject: 200,
    storageGb: 500,
  },
  enterprise: {
    maxProjects: 1000,
    maxCollaboratorsPerProject: 1000,
    storageGb: 2000,
  },
}

// Check if user tier allows creating group workspaces
export function canCreateGroupWorkspace(tier: UserTier): boolean {
  return tier === 'pro' || tier === 'enterprise'
}

// Get limits for a private workspace
export function getPrivateLimits(tier: UserTier): WorkspaceLimits {
  return PRIVATE_WORKSPACE_LIMITS[tier]
}

// Get limits for a group workspace
export function getGroupLimits(plan: WorkspacePlan): WorkspaceLimits {
  return GROUP_WORKSPACE_LIMITS[plan]
}
