import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  User,
  Workspace,
  WorkspaceMember,
  Project,
  ProjectMember,
  EventLogEntry,
  ActionResult,
  WorkspaceTier,
  WorkspaceRole,
  ProjectRole,
} from './types'
import { getWorkspaceLimits } from './limits'

// Generate unique IDs
let idCounter = 0
function generateId(prefix: string): string {
  return `${prefix}_${++idCounter}`
}

interface SimulatorState {
  // Entities
  users: User[]
  workspaces: Workspace[]
  workspaceMembers: WorkspaceMember[]
  projects: Project[]
  projectMembers: ProjectMember[]
  eventLog: EventLogEntry[]

  // Actions - Users
  registerUser: (email: string) => ActionResult<User>
  deleteUser: (userId: string) => ActionResult

  // Actions - Workspaces
  createWorkspace: (ownerUserId: string, name: string, tier?: WorkspaceTier) => ActionResult<Workspace>
  upgradeWorkspaceTier: (workspaceId: string, newTier: WorkspaceTier) => ActionResult
  inviteToWorkspace: (workspaceId: string, email: string, role: WorkspaceRole, inviterId: string) => ActionResult<WorkspaceMember>
  removeFromWorkspace: (workspaceId: string, userId: string) => ActionResult
  deleteWorkspace: (workspaceId: string) => ActionResult

  // Actions - Projects
  createProject: (workspaceId: string, creatorUserId: string, name: string) => ActionResult<Project>
  setProjectPublic: (projectId: string, isPublic: boolean, actorId: string) => ActionResult
  inviteToProject: (projectId: string, email: string, role: ProjectRole, inviterId: string) => ActionResult<ProjectMember>
  removeFromProject: (projectId: string, userId: string) => ActionResult
  changeProjectRole: (projectId: string, userId: string, newRole: ProjectRole) => ActionResult
  deleteProject: (projectId: string) => ActionResult

  // Utilities
  reset: () => void
  logEvent: (action: string, details: string, entityType?: EventLogEntry['entityType'], entityId?: string) => void

  // Queries
  getUserByEmail: (email: string) => User | undefined
  getWorkspaceProjects: (workspaceId: string) => Project[]
  getWorkspaceMembers: (workspaceId: string) => WorkspaceMember[]
  getProjectMembers: (projectId: string) => ProjectMember[]
  getUserWorkspaces: (userId: string) => Workspace[]
  getProjectCollaboratorCount: (projectId: string) => number
  isWorkspaceOwner: (workspaceId: string, userId: string) => boolean
  isProjectOwner: (projectId: string, userId: string) => boolean
}

const initialState: {
  users: User[]
  workspaces: Workspace[]
  workspaceMembers: WorkspaceMember[]
  projects: Project[]
  projectMembers: ProjectMember[]
  eventLog: EventLogEntry[]
} = {
  users: [],
  workspaces: [],
  workspaceMembers: [],
  projects: [],
  projectMembers: [],
  eventLog: [],
}

// Helper to restore idCounter from persisted state
function getMaxId(state: typeof initialState): number {
  const allIds = [
    ...state.users.map(u => u.id),
    ...state.workspaces.map(w => w.id),
    ...state.workspaceMembers.map(wm => wm.id),
    ...state.projects.map(p => p.id),
    ...state.projectMembers.map(pm => pm.id),
    ...state.eventLog.map(e => e.id),
  ]
  const nums = allIds.map(id => {
    const match = id.match(/_(\d+)$/)
    return match?.[1] ? parseInt(match[1], 10) : 0
  })
  return Math.max(0, ...nums)
}

export const useSimulatorStore = create<SimulatorState>()(
  persist(
    (set, get) => ({
      ...initialState,

  // === USER ACTIONS ===

  registerUser: (email: string): ActionResult<User> => {
    const state = get()

    // Check if email already exists
    if (state.users.some(u => u.email === email)) {
      return { success: false, error: `User with email ${email} already exists` }
    }

    const userId = generateId('user')
    const workspaceId = generateId('ws')
    const memberId = generateId('wm')
    const now = new Date()

    // Create user
    const user: User = {
      id: userId,
      email,
      createdAt: now,
    }

    // Create free-tier workspace for new user
    const workspace: Workspace = {
      id: workspaceId,
      name: `${email.split('@')[0]}'s Workspace`,
      tier: 'free',
      limits: getWorkspaceLimits('free'),
      createdAt: now,
    }

    // Make user the owner of their workspace
    const membership: WorkspaceMember = {
      id: memberId,
      workspaceId,
      userId,
      role: 'owner',
      joinedAt: now,
    }

    set(s => ({
      users: [...s.users, user],
      workspaces: [...s.workspaces, workspace],
      workspaceMembers: [...s.workspaceMembers, membership],
    }))

    get().logEvent('User registered', email, 'user', userId)
    get().logEvent('Workspace created', `${workspace.name} (free tier)`, 'workspace', workspaceId)

    return { success: true, data: user }
  },

  deleteUser: (userId: string): ActionResult => {
    const state = get()
    const user = state.users.find(u => u.id === userId)

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    // Check if user is sole owner of any workspace
    const ownedWorkspaces = state.workspaceMembers.filter(
      wm => wm.userId === userId && wm.role === 'owner'
    )
    for (const wm of ownedWorkspaces) {
      const otherOwners = state.workspaceMembers.filter(
        m => m.workspaceId === wm.workspaceId && m.role === 'owner' && m.userId !== userId
      )
      if (otherOwners.length === 0) {
        const workspace = state.workspaces.find(w => w.id === wm.workspaceId)
        return {
          success: false,
          error: `Cannot delete - user is sole owner of workspace "${workspace?.name}". Transfer ownership first.`
        }
      }
    }

    // Check if user is sole owner of any project
    const ownedProjects = state.projectMembers.filter(
      pm => pm.userId === userId && pm.role === 'owner'
    )
    for (const pm of ownedProjects) {
      const otherOwners = state.projectMembers.filter(
        m => m.projectId === pm.projectId && m.role === 'owner' && m.userId !== userId
      )
      if (otherOwners.length === 0) {
        const project = state.projects.find(p => p.id === pm.projectId)
        return {
          success: false,
          error: `Cannot delete - user is sole owner of project "${project?.name}". Transfer ownership first.`
        }
      }
    }

    // Remove user from all memberships
    set(s => ({
      users: s.users.filter(u => u.id !== userId),
      workspaceMembers: s.workspaceMembers.filter(wm => wm.userId !== userId),
      projectMembers: s.projectMembers.filter(pm => pm.userId !== userId),
    }))

    get().logEvent('User deleted', user.email, 'user', userId)

    return { success: true }
  },

  // === WORKSPACE ACTIONS ===

  createWorkspace: (ownerUserId: string, name: string, tier: WorkspaceTier = 'free'): ActionResult<Workspace> => {
    const state = get()
    const user = state.users.find(u => u.id === ownerUserId)

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    const workspaceId = generateId('ws')
    const memberId = generateId('wm')
    const now = new Date()

    const workspace: Workspace = {
      id: workspaceId,
      name,
      tier,
      limits: getWorkspaceLimits(tier),
      createdAt: now,
    }

    const membership: WorkspaceMember = {
      id: memberId,
      workspaceId,
      userId: ownerUserId,
      role: 'owner',
      joinedAt: now,
    }

    set(s => ({
      workspaces: [...s.workspaces, workspace],
      workspaceMembers: [...s.workspaceMembers, membership],
    }))

    get().logEvent('Workspace created', `${name} (${tier} tier, owner: ${user.email})`, 'workspace', workspaceId)

    return { success: true, data: workspace }
  },

  upgradeWorkspaceTier: (workspaceId: string, newTier: WorkspaceTier): ActionResult => {
    const state = get()
    const workspace = state.workspaces.find(w => w.id === workspaceId)

    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    if (workspace.tier === newTier) {
      return { success: false, error: `Workspace is already on ${newTier} tier` }
    }

    set(s => ({
      workspaces: s.workspaces.map(w =>
        w.id === workspaceId
          ? { ...w, tier: newTier, limits: getWorkspaceLimits(newTier) }
          : w
      ),
    }))

    get().logEvent('Workspace tier changed', `${workspace.name}: ${workspace.tier} → ${newTier}`, 'workspace', workspaceId)

    return { success: true }
  },

  inviteToWorkspace: (workspaceId: string, email: string, role: WorkspaceRole, inviterId: string): ActionResult<WorkspaceMember> => {
    const state = get()
    const workspace = state.workspaces.find(w => w.id === workspaceId)

    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    // Check inviter is workspace owner
    const inviterMembership = state.workspaceMembers.find(
      wm => wm.workspaceId === workspaceId && wm.userId === inviterId && wm.role === 'owner'
    )
    if (!inviterMembership) {
      return { success: false, error: 'Only workspace owners can invite members' }
    }

    // Find or create user
    let user = state.users.find(u => u.email === email)
    if (!user) {
      const result = get().registerUser(email)
      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? 'Failed to create user' }
      }
      user = result.data
    }

    // Check if already a member
    if (state.workspaceMembers.some(wm => wm.workspaceId === workspaceId && wm.userId === user!.id)) {
      return { success: false, error: `${email} is already a member of this workspace` }
    }

    // Check member limit
    const currentMembers = state.workspaceMembers.filter(wm => wm.workspaceId === workspaceId)
    if (currentMembers.length >= workspace.limits.maxMembers) {
      return {
        success: false,
        error: `Member limit reached (${workspace.limits.maxMembers}). Upgrade workspace tier to add more.`
      }
    }

    const memberId = generateId('wm')
    const membership: WorkspaceMember = {
      id: memberId,
      workspaceId,
      userId: user.id,
      role,
      invitedBy: inviterId,
      joinedAt: new Date(),
    }

    set(s => ({
      workspaceMembers: [...s.workspaceMembers, membership],
    }))

    get().logEvent(
      'Member added to workspace',
      `${email} as ${role} in ${workspace.name}`,
      'membership',
      memberId
    )

    return { success: true, data: membership }
  },

  removeFromWorkspace: (workspaceId: string, userId: string): ActionResult => {
    const state = get()
    const workspace = state.workspaces.find(w => w.id === workspaceId)
    const user = state.users.find(u => u.id === userId)

    if (!workspace || !user) {
      return { success: false, error: 'Workspace or user not found' }
    }

    const membership = state.workspaceMembers.find(
      wm => wm.workspaceId === workspaceId && wm.userId === userId
    )
    if (!membership) {
      return { success: false, error: 'User is not a member of this workspace' }
    }

    // Check if last owner
    if (membership.role === 'owner') {
      const otherOwners = state.workspaceMembers.filter(
        wm => wm.workspaceId === workspaceId && wm.role === 'owner' && wm.userId !== userId
      )
      if (otherOwners.length === 0) {
        return { success: false, error: 'Cannot remove last owner. Transfer ownership first.' }
      }
    }

    // Note: Removing from workspace does NOT remove from projects (orthogonal membership)
    set(s => ({
      workspaceMembers: s.workspaceMembers.filter(wm => wm.id !== membership.id),
    }))

    get().logEvent('Member removed from workspace', `${user.email} from ${workspace.name}`, 'membership', membership.id)

    return { success: true }
  },

  deleteWorkspace: (workspaceId: string): ActionResult => {
    const state = get()
    const workspace = state.workspaces.find(w => w.id === workspaceId)

    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    // Delete workspace, its projects, and all memberships
    const projectIds = state.projects.filter(p => p.workspaceId === workspaceId).map(p => p.id)

    set(s => ({
      workspaces: s.workspaces.filter(w => w.id !== workspaceId),
      workspaceMembers: s.workspaceMembers.filter(wm => wm.workspaceId !== workspaceId),
      projects: s.projects.filter(p => p.workspaceId !== workspaceId),
      projectMembers: s.projectMembers.filter(pm => !projectIds.includes(pm.projectId)),
    }))

    get().logEvent('Workspace deleted', workspace.name, 'workspace', workspaceId)

    return { success: true }
  },

  // === PROJECT ACTIONS ===

  createProject: (workspaceId: string, creatorUserId: string, name: string): ActionResult<Project> => {
    const state = get()
    const workspace = state.workspaces.find(w => w.id === workspaceId)
    const creator = state.users.find(u => u.id === creatorUserId)

    if (!workspace || !creator) {
      return { success: false, error: 'Workspace or user not found' }
    }

    // Only workspace owners can create projects
    const membership = state.workspaceMembers.find(
      wm => wm.workspaceId === workspaceId && wm.userId === creatorUserId
    )
    if (!membership || membership.role !== 'owner') {
      return { success: false, error: 'Only workspace owners can create projects' }
    }

    // Check project limit
    const currentProjects = state.projects.filter(p => p.workspaceId === workspaceId)
    if (currentProjects.length >= workspace.limits.maxProjects) {
      return {
        success: false,
        error: `Project limit reached (${workspace.limits.maxProjects}). Upgrade workspace tier to create more.`
      }
    }

    const projectId = generateId('proj')
    const memberId = generateId('pm')
    const now = new Date()

    const project: Project = {
      id: projectId,
      workspaceId,
      name,
      isPublic: false, // default to private
      createdAt: now,
    }

    const projectMembership: ProjectMember = {
      id: memberId,
      projectId,
      userId: creatorUserId,
      role: 'owner',
      joinedAt: now,
    }

    set(s => ({
      projects: [...s.projects, project],
      projectMembers: [...s.projectMembers, projectMembership],
    }))

    get().logEvent('Project created', `${name} in ${workspace.name}`, 'project', projectId)

    return { success: true, data: project }
  },

  setProjectPublic: (projectId: string, isPublic: boolean, actorId: string): ActionResult => {
    const state = get()
    const project = state.projects.find(p => p.id === projectId)

    if (!project) {
      return { success: false, error: 'Project not found' }
    }

    const workspace = state.workspaces.find(w => w.id === project.workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    // Only workspace owners can change public status
    const actorMembership = state.workspaceMembers.find(
      wm => wm.workspaceId === project.workspaceId && wm.userId === actorId && wm.role === 'owner'
    )
    if (!actorMembership) {
      return { success: false, error: 'Only workspace owners can change project visibility' }
    }

    // Check if workspace tier allows public projects
    if (isPublic && !workspace.limits.canHavePublicProjects) {
      return {
        success: false,
        error: 'Public projects require Pro or Enterprise tier. Upgrade workspace to enable.'
      }
    }

    set(s => ({
      projects: s.projects.map(p =>
        p.id === projectId ? { ...p, isPublic } : p
      ),
    }))

    get().logEvent(
      'Project visibility changed',
      `${project.name}: ${isPublic ? 'public' : 'private'}`,
      'project',
      projectId
    )

    return { success: true }
  },

  inviteToProject: (projectId: string, email: string, role: ProjectRole, inviterId: string): ActionResult<ProjectMember> => {
    const state = get()
    const project = state.projects.find(p => p.id === projectId)

    if (!project) {
      return { success: false, error: 'Project not found' }
    }

    const workspace = state.workspaces.find(w => w.id === project.workspaceId)
    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    // Check inviter is project owner
    const inviterMembership = state.projectMembers.find(
      pm => pm.projectId === projectId && pm.userId === inviterId && pm.role === 'owner'
    )
    if (!inviterMembership) {
      return { success: false, error: 'Only project owners can invite collaborators' }
    }

    // Find or create user
    let user = state.users.find(u => u.email === email)
    if (!user) {
      const result = get().registerUser(email)
      if (!result.success || !result.data) {
        return { success: false, error: result.error ?? 'Failed to create user' }
      }
      user = result.data
    }

    // Check if already a project member
    if (state.projectMembers.some(pm => pm.projectId === projectId && pm.userId === user!.id)) {
      return { success: false, error: `${email} is already a collaborator on this project` }
    }

    // Check collaborator limit
    const currentCollaborators = state.projectMembers.filter(pm => pm.projectId === projectId)
    if (currentCollaborators.length >= workspace.limits.maxCollaboratorsPerProject) {
      return {
        success: false,
        error: `Collaborator limit reached (${workspace.limits.maxCollaboratorsPerProject}). Upgrade workspace tier to add more.`
      }
    }

    const memberId = generateId('pm')
    const membership: ProjectMember = {
      id: memberId,
      projectId,
      userId: user.id,
      role,
      joinedAt: new Date(),
    }

    set(s => ({
      projectMembers: [...s.projectMembers, membership],
    }))

    get().logEvent(
      'Collaborator added to project',
      `${email} as ${role} in ${project.name}`,
      'membership',
      memberId
    )

    return { success: true, data: membership }
  },

  removeFromProject: (projectId: string, userId: string): ActionResult => {
    const state = get()
    const project = state.projects.find(p => p.id === projectId)
    const user = state.users.find(u => u.id === userId)

    if (!project || !user) {
      return { success: false, error: 'Project or user not found' }
    }

    const membership = state.projectMembers.find(
      pm => pm.projectId === projectId && pm.userId === userId
    )
    if (!membership) {
      return { success: false, error: 'User is not a collaborator on this project' }
    }

    // Check if last owner
    if (membership.role === 'owner') {
      const otherOwners = state.projectMembers.filter(
        pm => pm.projectId === projectId && pm.role === 'owner' && pm.userId !== userId
      )
      if (otherOwners.length === 0) {
        return { success: false, error: 'Cannot remove last project owner. Transfer ownership first.' }
      }
    }

    set(s => ({
      projectMembers: s.projectMembers.filter(pm => pm.id !== membership.id),
    }))

    get().logEvent('Collaborator removed from project', `${user.email} from ${project.name}`, 'membership', membership.id)

    return { success: true }
  },

  changeProjectRole: (projectId: string, userId: string, newRole: ProjectRole): ActionResult => {
    const state = get()
    const membership = state.projectMembers.find(
      pm => pm.projectId === projectId && pm.userId === userId
    )

    if (!membership) {
      return { success: false, error: 'Project membership not found' }
    }

    // If demoting from owner, check not last owner
    if (membership.role === 'owner' && newRole !== 'owner') {
      const otherOwners = state.projectMembers.filter(
        pm => pm.projectId === projectId && pm.role === 'owner' && pm.userId !== userId
      )
      if (otherOwners.length === 0) {
        return { success: false, error: 'Cannot demote last owner. Promote another owner first.' }
      }
    }

    set(s => ({
      projectMembers: s.projectMembers.map(pm =>
        pm.id === membership.id ? { ...pm, role: newRole } : pm
      ),
    }))

    const user = state.users.find(u => u.id === userId)
    const project = state.projects.find(p => p.id === projectId)
    get().logEvent(
      'Project role changed',
      `${user?.email} in ${project?.name}: ${membership.role} → ${newRole}`,
      'membership',
      membership.id
    )

    return { success: true }
  },

  deleteProject: (projectId: string): ActionResult => {
    const state = get()
    const project = state.projects.find(p => p.id === projectId)

    if (!project) {
      return { success: false, error: 'Project not found' }
    }

    set(s => ({
      projects: s.projects.filter(p => p.id !== projectId),
      projectMembers: s.projectMembers.filter(pm => pm.projectId !== projectId),
    }))

    get().logEvent('Project deleted', project.name, 'project', projectId)

    return { success: true }
  },

  // === UTILITIES ===

  reset: () => {
    idCounter = 0
    set({ ...initialState, eventLog: [] })
  },

  logEvent: (action: string, details: string, entityType?: EventLogEntry['entityType'], entityId?: string) => {
    const entry: EventLogEntry = {
      id: generateId('evt'),
      timestamp: new Date(),
      action,
      details,
      entityType,
      entityId,
    }
    set(s => ({
      eventLog: [...s.eventLog, entry],
    }))
  },

  // === QUERIES ===

  getUserByEmail: (email: string) => {
    return get().users.find(u => u.email === email)
  },

  getWorkspaceProjects: (workspaceId: string) => {
    return get().projects.filter(p => p.workspaceId === workspaceId)
  },

  getWorkspaceMembers: (workspaceId: string) => {
    return get().workspaceMembers.filter(wm => wm.workspaceId === workspaceId)
  },

  getProjectMembers: (projectId: string) => {
    return get().projectMembers.filter(pm => pm.projectId === projectId)
  },

  getUserWorkspaces: (userId: string) => {
    const state = get()
    const membershipIds = state.workspaceMembers
      .filter(wm => wm.userId === userId)
      .map(wm => wm.workspaceId)
    return state.workspaces.filter(w => membershipIds.includes(w.id))
  },

  getProjectCollaboratorCount: (projectId: string) => {
    return get().projectMembers.filter(pm => pm.projectId === projectId).length
  },

  isWorkspaceOwner: (workspaceId: string, userId: string) => {
    return get().workspaceMembers.some(
      wm => wm.workspaceId === workspaceId && wm.userId === userId && wm.role === 'owner'
    )
  },

  isProjectOwner: (projectId: string, userId: string) => {
    return get().projectMembers.some(
      pm => pm.projectId === projectId && pm.userId === userId && pm.role === 'owner'
    )
  },
    }),
    {
      name: 'workspace-sim-storage-v2',
      // Only persist the entity data, not the functions
      partialize: (state) => ({
        users: state.users,
        workspaces: state.workspaces,
        workspaceMembers: state.workspaceMembers,
        projects: state.projects,
        projectMembers: state.projectMembers,
        eventLog: state.eventLog,
      }),
      // Handle Date serialization
      storage: {
        getItem: (name) => {
          const str = localStorage.getItem(name)
          if (!str) return null
          const parsed = JSON.parse(str)
          // Convert date strings back to Date objects
          const convertDates = (obj: Record<string, unknown>): Record<string, unknown> => {
            for (const key in obj) {
              const val = obj[key]
              if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val)) {
                obj[key] = new Date(val)
              } else if (val && typeof val === 'object') {
                convertDates(val as Record<string, unknown>)
              }
            }
            return obj
          }
          if (parsed.state) {
            convertDates(parsed.state)
            // Restore idCounter
            idCounter = getMaxId(parsed.state)
          }
          return parsed
        },
        setItem: (name, value) => {
          localStorage.setItem(name, JSON.stringify(value))
        },
        removeItem: (name) => {
          localStorage.removeItem(name)
        },
      },
    }
  )
)
