// Tier levels for users
export type UserTier = 'free' | 'pro' | 'enterprise'

// Plan levels for group workspaces
export type WorkspacePlan = 'team' | 'business' | 'enterprise'

// Workspace types
export type WorkspaceType = 'private' | 'group'

// Roles
export type WorkspaceRole = 'owner' | 'member'
export type ProjectRole = 'owner' | 'internal' | 'external'

// Core entities
export interface User {
  id: string
  email: string
  tier: UserTier
  privateWorkspaceId: string
  createdAt: Date
}

export interface WorkspaceLimits {
  maxProjects: number
  maxCollaboratorsPerProject: number
  storageGb: number
}

export interface Workspace {
  id: string
  name: string
  type: WorkspaceType
  ownerUserId?: string // for private workspaces
  plan?: WorkspacePlan // for group workspaces
  billingContactId?: string // for group workspaces
  limits: WorkspaceLimits
  createdAt: Date
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  canCreateProjects: boolean
  invitedBy?: string
  joinedAt: Date
}

export interface Project {
  id: string
  workspaceId: string
  name: string
  description?: string
  createdAt: Date
}

export interface ProjectMember {
  id: string
  projectId: string
  userId: string
  role: ProjectRole
  joinedAt: Date
}

// Event log entry
export interface EventLogEntry {
  id: string
  timestamp: Date
  action: string
  details: string
  entityType?: 'user' | 'workspace' | 'project' | 'membership'
  entityId?: string
}

// Action result
export interface ActionResult<T = void> {
  success: boolean
  data?: T
  error?: string
}
