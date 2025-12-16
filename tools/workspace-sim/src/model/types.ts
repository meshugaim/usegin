// Workspace tiers (billing attached to workspaces, not users)
export type WorkspaceTier = 'free' | 'pro' | 'enterprise'

// Roles
export type WorkspaceRole = 'owner' | 'member'
export type ProjectRole = 'owner' | 'internal' | 'external'

// Core entities
export interface User {
  id: string
  email: string
  createdAt: Date
}

export interface WorkspaceLimits {
  maxProjects: number
  maxMembers: number
  maxCollaboratorsPerProject: number
  storageGb: number
  canHavePublicProjects: boolean
}

export interface Workspace {
  id: string
  name: string
  tier: WorkspaceTier
  limits: WorkspaceLimits
  createdAt: Date
}

export interface WorkspaceMember {
  id: string
  workspaceId: string
  userId: string
  role: WorkspaceRole
  invitedBy?: string
  joinedAt: Date
}

export interface Project {
  id: string
  workspaceId: string
  name: string
  description?: string
  isPublic: boolean // visible to all workspace members
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
