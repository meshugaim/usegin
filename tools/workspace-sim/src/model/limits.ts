import type { WorkspaceTier, WorkspaceLimits } from './types'

// Limits for workspaces based on tier
export const WORKSPACE_LIMITS: Record<WorkspaceTier, WorkspaceLimits> = {
  free: {
    maxProjects: 3,
    maxMembers: 5,
    maxCollaboratorsPerProject: 5,
    storageGb: 1,
    canHavePublicProjects: false,
  },
  pro: {
    maxProjects: 20,
    maxMembers: 50,
    maxCollaboratorsPerProject: 50,
    storageGb: 50,
    canHavePublicProjects: true,
  },
  enterprise: {
    maxProjects: 1000, // effectively unlimited
    maxMembers: 1000,
    maxCollaboratorsPerProject: 500,
    storageGb: 500,
    canHavePublicProjects: true,
  },
}

// Get limits for a workspace tier
export function getWorkspaceLimits(tier: WorkspaceTier): WorkspaceLimits {
  return WORKSPACE_LIMITS[tier]
}
