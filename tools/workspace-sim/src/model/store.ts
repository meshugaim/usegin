import { create } from 'zustand'
import type {
  User,
  Workspace,
  WorkspaceMember,
  Project,
  ProjectMember,
  EventLogEntry,
  ActionResult,
  UserTier,
  WorkspaceRole,
  ProjectRole,
  WorkspacePlan,
} from './types'
import { getPrivateLimits, getGroupLimits, canCreateGroupWorkspace } from './limits'

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
  upgradeTier: (userId: string, newTier: UserTier) => ActionResult
  deleteUser: (userId: string) => ActionResult

  // Actions - Workspaces
  createGroupWorkspace: (ownerUserId: string, name: string, plan?: WorkspacePlan) => ActionResult<Workspace>
  inviteToWorkspace: (workspaceId: string, email: string, role: WorkspaceRole, inviterId: string) => ActionResult<WorkspaceMember>
  removeFromWorkspace: (workspaceId: string, userId: string) => ActionResult
  setMemberCanCreateProjects: (workspaceId: string, userId: string, canCreate: boolean) => ActionResult
  transferBillingContact: (workspaceId: string, newContactId: string) => ActionResult
  deleteGroupWorkspace: (workspaceId: string) => ActionResult

  // Actions - Projects
  createProject: (workspaceId: string, creatorUserId: string, name: string) => ActionResult<Project>
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
}

const initialState = {
  users: [],
  workspaces: [],
  workspaceMembers: [],
  projects: [],
  projectMembers: [],
  eventLog: [],
}

export const useSimulatorStore = create<SimulatorState>((set, get) => ({
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
    const now = new Date()

    // Create private workspace
    const workspace: Workspace = {
      id: workspaceId,
      name: `${email}'s Workspace`,
      type: 'private',
      ownerUserId: userId,
      limits: getPrivateLimits('free'),
      createdAt: now,
    }

    // Create user
    const user: User = {
      id: userId,
      email,
      tier: 'free',
      privateWorkspaceId: workspaceId,
      createdAt: now,
    }

    set(s => ({
      users: [...s.users, user],
      workspaces: [...s.workspaces, workspace],
    }))

    get().logEvent('User registered', email, 'user', userId)
    get().logEvent('Private workspace created', workspace.name, 'workspace', workspaceId)

    return { success: true, data: user }
  },

  upgradeTier: (userId: string, newTier: UserTier): ActionResult => {
    const state = get()
    const user = state.users.find(u => u.id === userId)

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    if (user.tier === newTier) {
      return { success: false, error: `User is already on ${newTier} tier` }
    }

    // Update user tier
    set(s => ({
      users: s.users.map(u =>
        u.id === userId ? { ...u, tier: newTier } : u
      ),
      // Update private workspace limits
      workspaces: s.workspaces.map(w =>
        w.id === user.privateWorkspaceId
          ? { ...w, limits: getPrivateLimits(newTier) }
          : w
      ),
    }))

    get().logEvent('Tier upgraded', `${user.email}: ${user.tier} → ${newTier}`, 'user', userId)

    return { success: true }
  },

  deleteUser: (userId: string): ActionResult => {
    const state = get()
    const user = state.users.find(u => u.id === userId)

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    // Check if user owns any projects (must transfer first)
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
          error: `Cannot delete - user is sole owner of project "${project?.name}"`
        }
      }
    }

    // Check if user is sole owner of any group workspace
    const ownedWorkspaces = state.workspaceMembers.filter(
      wm => wm.userId === userId && wm.role === 'owner'
    )
    for (const wm of ownedWorkspaces) {
      const workspace = state.workspaces.find(w => w.id === wm.workspaceId)
      if (workspace?.type === 'group') {
        const otherOwners = state.workspaceMembers.filter(
          m => m.workspaceId === wm.workspaceId && m.role === 'owner' && m.userId !== userId
        )
        if (otherOwners.length === 0) {
          return {
            success: false,
            error: `Cannot delete - user is sole owner of workspace "${workspace.name}"`
          }
        }
      }
    }

    // Delete user's private workspace and its projects
    const privateWorkspace = state.workspaces.find(w => w.id === user.privateWorkspaceId)
    const privateProjectIds = state.projects
      .filter(p => p.workspaceId === user.privateWorkspaceId)
      .map(p => p.id)

    set(s => ({
      users: s.users.filter(u => u.id !== userId),
      workspaces: s.workspaces.filter(w => w.id !== user.privateWorkspaceId),
      workspaceMembers: s.workspaceMembers.filter(wm => wm.userId !== userId),
      projects: s.projects.filter(p => !privateProjectIds.includes(p.id)),
      projectMembers: s.projectMembers.filter(
        pm => !privateProjectIds.includes(pm.projectId) && pm.userId !== userId
      ),
    }))

    get().logEvent('User deleted', user.email, 'user', userId)
    if (privateWorkspace) {
      get().logEvent('Private workspace deleted', privateWorkspace.name, 'workspace', privateWorkspace.id)
    }

    return { success: true }
  },

  // === WORKSPACE ACTIONS ===

  createGroupWorkspace: (ownerUserId: string, name: string, plan: WorkspacePlan = 'team'): ActionResult<Workspace> => {
    const state = get()
    const user = state.users.find(u => u.id === ownerUserId)

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    if (!canCreateGroupWorkspace(user.tier)) {
      return { success: false, error: `Free tier users cannot create group workspaces. Upgrade to Pro or Enterprise.` }
    }

    const workspaceId = generateId('ws')
    const memberId = generateId('wm')
    const now = new Date()

    const workspace: Workspace = {
      id: workspaceId,
      name,
      type: 'group',
      plan,
      billingContactId: ownerUserId,
      limits: getGroupLimits(plan),
      createdAt: now,
    }

    const membership: WorkspaceMember = {
      id: memberId,
      workspaceId,
      userId: ownerUserId,
      role: 'owner',
      canCreateProjects: true,
      joinedAt: now,
    }

    set(s => ({
      workspaces: [...s.workspaces, workspace],
      workspaceMembers: [...s.workspaceMembers, membership],
    }))

    get().logEvent('Group workspace created', `${name} (owner: ${user.email})`, 'workspace', workspaceId)

    return { success: true, data: workspace }
  },

  inviteToWorkspace: (workspaceId: string, email: string, role: WorkspaceRole, inviterId: string): ActionResult<WorkspaceMember> => {
    const state = get()
    const workspace = state.workspaces.find(w => w.id === workspaceId)

    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    if (workspace.type === 'private') {
      return { success: false, error: 'Cannot add members to private workspaces. Invite collaborators to projects instead.' }
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

    const memberId = generateId('wm')
    const membership: WorkspaceMember = {
      id: memberId,
      workspaceId,
      userId: user.id,
      role,
      canCreateProjects: role === 'owner',
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

    // Check if user owns projects in this workspace
    const workspaceProjects = state.projects.filter(p => p.workspaceId === workspaceId)
    for (const project of workspaceProjects) {
      const isOwner = state.projectMembers.some(
        pm => pm.projectId === project.id && pm.userId === userId && pm.role === 'owner'
      )
      const otherOwners = state.projectMembers.filter(
        pm => pm.projectId === project.id && pm.role === 'owner' && pm.userId !== userId
      )
      if (isOwner && otherOwners.length === 0) {
        return {
          success: false,
          error: `Cannot remove - user is sole owner of project "${project.name}"`
        }
      }
    }

    // Check if last owner
    if (membership.role === 'owner') {
      const otherOwners = state.workspaceMembers.filter(
        wm => wm.workspaceId === workspaceId && wm.role === 'owner' && wm.userId !== userId
      )
      if (otherOwners.length === 0) {
        return { success: false, error: 'Cannot remove - must transfer ownership first' }
      }
    }

    // Remove from workspace and all projects in it
    set(s => ({
      workspaceMembers: s.workspaceMembers.filter(wm => wm.id !== membership.id),
      projectMembers: s.projectMembers.filter(pm => {
        const project = s.projects.find(p => p.id === pm.projectId)
        return !(project?.workspaceId === workspaceId && pm.userId === userId)
      }),
    }))

    get().logEvent('Member removed from workspace', `${user.email} from ${workspace.name}`, 'membership', membership.id)

    return { success: true }
  },

  setMemberCanCreateProjects: (workspaceId: string, userId: string, canCreate: boolean): ActionResult => {
    const state = get()
    const membership = state.workspaceMembers.find(
      wm => wm.workspaceId === workspaceId && wm.userId === userId
    )

    if (!membership) {
      return { success: false, error: 'Membership not found' }
    }

    set(s => ({
      workspaceMembers: s.workspaceMembers.map(wm =>
        wm.id === membership.id ? { ...wm, canCreateProjects: canCreate } : wm
      ),
    }))

    const user = state.users.find(u => u.id === userId)
    get().logEvent(
      'Project creation permission changed',
      `${user?.email}: ${canCreate ? 'enabled' : 'disabled'}`,
      'membership',
      membership.id
    )

    return { success: true }
  },

  transferBillingContact: (workspaceId: string, newContactId: string): ActionResult => {
    const state = get()
    const workspace = state.workspaces.find(w => w.id === workspaceId)

    if (!workspace || workspace.type !== 'group') {
      return { success: false, error: 'Group workspace not found' }
    }

    const newContact = state.workspaceMembers.find(
      wm => wm.workspaceId === workspaceId && wm.userId === newContactId && wm.role === 'owner'
    )
    if (!newContact) {
      return { success: false, error: 'New billing contact must be a workspace owner' }
    }

    set(s => ({
      workspaces: s.workspaces.map(w =>
        w.id === workspaceId ? { ...w, billingContactId: newContactId } : w
      ),
    }))

    const user = state.users.find(u => u.id === newContactId)
    get().logEvent('Billing contact transferred', `${workspace.name} → ${user?.email}`, 'workspace', workspaceId)

    return { success: true }
  },

  deleteGroupWorkspace: (workspaceId: string): ActionResult => {
    const state = get()
    const workspace = state.workspaces.find(w => w.id === workspaceId)

    if (!workspace) {
      return { success: false, error: 'Workspace not found' }
    }

    if (workspace.type === 'private') {
      return { success: false, error: 'Cannot delete private workspace. Delete the user instead.' }
    }

    // Delete workspace, its projects, and all memberships
    const projectIds = state.projects.filter(p => p.workspaceId === workspaceId).map(p => p.id)

    set(s => ({
      workspaces: s.workspaces.filter(w => w.id !== workspaceId),
      workspaceMembers: s.workspaceMembers.filter(wm => wm.workspaceId !== workspaceId),
      projects: s.projects.filter(p => p.workspaceId !== workspaceId),
      projectMembers: s.projectMembers.filter(pm => !projectIds.includes(pm.projectId)),
    }))

    get().logEvent('Group workspace deleted', workspace.name, 'workspace', workspaceId)

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

    // Check permissions
    if (workspace.type === 'private') {
      if (workspace.ownerUserId !== creatorUserId) {
        return { success: false, error: 'Only the owner can create projects in a private workspace' }
      }
    } else {
      const membership = state.workspaceMembers.find(
        wm => wm.workspaceId === workspaceId && wm.userId === creatorUserId
      )
      if (!membership) {
        return { success: false, error: 'User is not a member of this workspace' }
      }
      if (!membership.canCreateProjects && membership.role !== 'owner') {
        return { success: false, error: 'User does not have permission to create projects' }
      }
    }

    // Check project limit
    const currentProjects = state.projects.filter(p => p.workspaceId === workspaceId)
    if (currentProjects.length >= workspace.limits.maxProjects) {
      return {
        success: false,
        error: `Project limit reached (${workspace.limits.maxProjects}). Upgrade to create more projects.`
      }
    }

    const projectId = generateId('proj')
    const memberId = generateId('pm')
    const now = new Date()

    const project: Project = {
      id: projectId,
      workspaceId,
      name,
      createdAt: now,
    }

    const membership: ProjectMember = {
      id: memberId,
      projectId,
      userId: creatorUserId,
      role: 'owner',
      joinedAt: now,
    }

    set(s => ({
      projects: [...s.projects, project],
      projectMembers: [...s.projectMembers, membership],
    }))

    get().logEvent('Project created', `${name} in ${workspace.name}`, 'project', projectId)

    return { success: true, data: project }
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
        error: `Collaborator limit reached (${workspace.limits.maxCollaboratorsPerProject}). Upgrade to add more.`
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
        return { success: false, error: 'Cannot remove - must transfer ownership first' }
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
        return { success: false, error: 'Cannot demote - must have at least one project owner' }
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
    const user = state.users.find(u => u.id === userId)
    if (!user) return []

    // Private workspace
    const privateWs = state.workspaces.find(w => w.id === user.privateWorkspaceId)

    // Group workspaces where user is member
    const groupWsIds = state.workspaceMembers
      .filter(wm => wm.userId === userId)
      .map(wm => wm.workspaceId)
    const groupWs = state.workspaces.filter(w => groupWsIds.includes(w.id))

    return privateWs ? [privateWs, ...groupWs] : groupWs
  },

  getProjectCollaboratorCount: (projectId: string) => {
    return get().projectMembers.filter(pm => pm.projectId === projectId).length
  },
}))
