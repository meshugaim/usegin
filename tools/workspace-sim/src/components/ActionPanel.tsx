import { useState, useMemo } from 'react'
import { useSimulatorStore } from '../model/store'
import type { UserTier, WorkspaceRole, ProjectRole, WorkspacePlan } from '../model/types'

type ActionType =
  | 'registerUser'
  | 'upgradeTier'
  | 'deleteUser'
  | 'createGroupWorkspace'
  | 'inviteToWorkspace'
  | 'removeFromWorkspace'
  | 'createProject'
  | 'inviteToProject'
  | 'removeFromProject'
  | 'changeProjectRole'
  | 'deleteProject'
  | 'deleteWorkspace'

interface ActionConfig {
  label: string
  category: 'user' | 'workspace' | 'project'
}

const ACTIONS: Record<ActionType, ActionConfig> = {
  registerUser: { label: 'Register User', category: 'user' },
  upgradeTier: { label: 'Upgrade Tier', category: 'user' },
  deleteUser: { label: 'Delete User', category: 'user' },
  createGroupWorkspace: { label: 'Create Group Workspace', category: 'workspace' },
  inviteToWorkspace: { label: 'Invite to Workspace', category: 'workspace' },
  removeFromWorkspace: { label: 'Remove from Workspace', category: 'workspace' },
  deleteWorkspace: { label: 'Delete Workspace', category: 'workspace' },
  createProject: { label: 'Create Project', category: 'project' },
  inviteToProject: { label: 'Invite to Project', category: 'project' },
  removeFromProject: { label: 'Remove from Project', category: 'project' },
  changeProjectRole: { label: 'Change Project Role', category: 'project' },
  deleteProject: { label: 'Delete Project', category: 'project' },
}

export function ActionPanel() {
  const [selectedAction, setSelectedAction] = useState<ActionType | null>(null)
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null)

  const store = useSimulatorStore()

  const handleResult = (res: { success: boolean; error?: string }, successMsg: string) => {
    if (res.success) {
      setResult({ success: true, message: successMsg })
    } else {
      setResult({ success: false, message: res.error ?? 'Unknown error' })
    }
    setTimeout(() => setResult(null), 3000)
  }

  const renderForm = () => {
    switch (selectedAction) {
      case 'registerUser':
        return <RegisterUserForm onResult={handleResult} />
      case 'upgradeTier':
        return <UpgradeTierForm onResult={handleResult} users={store.users} />
      case 'deleteUser':
        return <DeleteUserForm onResult={handleResult} users={store.users} />
      case 'createGroupWorkspace':
        return <CreateGroupWorkspaceForm onResult={handleResult} users={store.users} />
      case 'inviteToWorkspace':
        return <InviteToWorkspaceForm onResult={handleResult} />
      case 'removeFromWorkspace':
        return <RemoveFromWorkspaceForm onResult={handleResult} />
      case 'deleteWorkspace':
        return <DeleteWorkspaceForm onResult={handleResult} />
      case 'createProject':
        return <CreateProjectForm onResult={handleResult} />
      case 'inviteToProject':
        return <InviteToProjectForm onResult={handleResult} />
      case 'removeFromProject':
        return <RemoveFromProjectForm onResult={handleResult} />
      case 'changeProjectRole':
        return <ChangeProjectRoleForm onResult={handleResult} />
      case 'deleteProject':
        return <DeleteProjectForm onResult={handleResult} />
      default:
        return <p className="text-sm text-gray-500">Select an action above</p>
    }
  }

  const categories = ['user', 'workspace', 'project'] as const

  return (
    <div className="space-y-4">
      {result && (
        <div
          className={`p-2 rounded text-sm ${
            result.success
              ? 'bg-green-100 text-green-800 border border-green-200'
              : 'bg-red-100 text-red-800 border border-red-200'
          }`}
        >
          {result.message}
        </div>
      )}

      {categories.map(cat => (
        <div key={cat}>
          <h3 className="text-xs font-medium text-gray-500 uppercase mb-1">
            {cat}
          </h3>
          <div className="flex flex-wrap gap-1">
            {(Object.entries(ACTIONS) as [ActionType, ActionConfig][])
              .filter(([, config]) => config.category === cat)
              .map(([action, config]) => (
                <button
                  key={action}
                  onClick={() => setSelectedAction(action)}
                  className={`px-2 py-1 text-xs rounded ${
                    selectedAction === action
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700'
                  }`}
                >
                  {config.label}
                </button>
              ))}
          </div>
        </div>
      ))}

      <div className="border-t pt-4">
        {renderForm()}
      </div>
    </div>
  )
}

// === FORM COMPONENTS ===

interface FormProps {
  onResult: (res: { success: boolean; error?: string }, successMsg: string) => void
}

function RegisterUserForm({ onResult }: FormProps) {
  const [email, setEmail] = useState('')
  const registerUser = useSimulatorStore(s => s.registerUser)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    const res = registerUser(email)
    onResult(res, `User ${email} registered`)
    if (res.success) setEmail('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Email address"
        className="w-full px-2 py-1 text-sm border rounded"
      />
      <button type="submit" className="w-full px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
        Register
      </button>
    </form>
  )
}

function UpgradeTierForm({ onResult, users }: FormProps & { users: { id: string; email: string; tier: string }[] }) {
  const [userId, setUserId] = useState('')
  const [tier, setTier] = useState<UserTier>('pro')
  const upgradeTier = useSimulatorStore(s => s.upgradeTier)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    const res = upgradeTier(userId, tier)
    const user = users.find(u => u.id === userId)
    onResult(res, `${user?.email} upgraded to ${tier}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={userId}
        onChange={e => setUserId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select user...</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>{u.email} ({u.tier})</option>
        ))}
      </select>
      <select
        value={tier}
        onChange={e => setTier(e.target.value as UserTier)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="free">Free</option>
        <option value="pro">Pro</option>
        <option value="enterprise">Enterprise</option>
      </select>
      <button type="submit" className="w-full px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
        Upgrade
      </button>
    </form>
  )
}

function DeleteUserForm({ onResult, users }: FormProps & { users: { id: string; email: string }[] }) {
  const [userId, setUserId] = useState('')
  const deleteUser = useSimulatorStore(s => s.deleteUser)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId) return
    const user = users.find(u => u.id === userId)
    const res = deleteUser(userId)
    onResult(res, `User ${user?.email} deleted`)
    if (res.success) setUserId('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={userId}
        onChange={e => setUserId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select user...</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>{u.email}</option>
        ))}
      </select>
      <button type="submit" className="w-full px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
        Delete User
      </button>
    </form>
  )
}

function CreateGroupWorkspaceForm({ onResult, users }: FormProps & { users: { id: string; email: string; tier: string }[] }) {
  const [ownerId, setOwnerId] = useState('')
  const [name, setName] = useState('')
  const [plan, setPlan] = useState<WorkspacePlan>('team')
  const createGroupWorkspace = useSimulatorStore(s => s.createGroupWorkspace)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!ownerId || !name) return
    const res = createGroupWorkspace(ownerId, name, plan)
    onResult(res, `Workspace "${name}" created`)
    if (res.success) setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={ownerId}
        onChange={e => setOwnerId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select owner...</option>
        {users.map(u => (
          <option key={u.id} value={u.id}>{u.email} ({u.tier})</option>
        ))}
      </select>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Workspace name"
        className="w-full px-2 py-1 text-sm border rounded"
      />
      <select
        value={plan}
        onChange={e => setPlan(e.target.value as WorkspacePlan)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="team">Team</option>
        <option value="business">Business</option>
        <option value="enterprise">Enterprise</option>
      </select>
      <button type="submit" className="w-full px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
        Create Workspace
      </button>
    </form>
  )
}

function InviteToWorkspaceForm({ onResult }: FormProps) {
  const [workspaceId, setWorkspaceId] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<WorkspaceRole>('member')
  const [inviterId, setInviterId] = useState('')

  const allWorkspaces = useSimulatorStore(s => s.workspaces)
  const workspaceMembers = useSimulatorStore(s => s.workspaceMembers)
  const users = useSimulatorStore(s => s.users)
  const inviteToWorkspace = useSimulatorStore(s => s.inviteToWorkspace)

  const workspaces = useMemo(() => allWorkspaces.filter(w => w.type === 'group'), [allWorkspaces])

  const owners = workspaceId
    ? workspaceMembers
        .filter(wm => wm.workspaceId === workspaceId && wm.role === 'owner')
        .map(wm => users.find(u => u.id === wm.userId))
        .filter(Boolean)
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId || !email || !inviterId) return
    const res = inviteToWorkspace(workspaceId, email, role, inviterId)
    onResult(res, `${email} invited to workspace`)
    if (res.success) setEmail('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={workspaceId}
        onChange={e => { setWorkspaceId(e.target.value); setInviterId('') }}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select workspace...</option>
        {workspaces.map(w => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <select
        value={inviterId}
        onChange={e => setInviterId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Inviter (owner)...</option>
        {owners.map(u => u && (
          <option key={u.id} value={u.id}>{u.email}</option>
        ))}
      </select>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Invitee email"
        className="w-full px-2 py-1 text-sm border rounded"
      />
      <select
        value={role}
        onChange={e => setRole(e.target.value as WorkspaceRole)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="member">Member</option>
        <option value="owner">Owner</option>
      </select>
      <button type="submit" className="w-full px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
        Invite
      </button>
    </form>
  )
}

function RemoveFromWorkspaceForm({ onResult }: FormProps) {
  const [workspaceId, setWorkspaceId] = useState('')
  const [userId, setUserId] = useState('')

  const allWorkspaces = useSimulatorStore(s => s.workspaces)
  const workspaceMembers = useSimulatorStore(s => s.workspaceMembers)
  const users = useSimulatorStore(s => s.users)
  const removeFromWorkspace = useSimulatorStore(s => s.removeFromWorkspace)

  const workspaces = useMemo(() => allWorkspaces.filter(w => w.type === 'group'), [allWorkspaces])

  const members = workspaceId
    ? workspaceMembers
        .filter(wm => wm.workspaceId === workspaceId)
        .map(wm => ({ ...wm, user: users.find(u => u.id === wm.userId) }))
        .filter(m => m.user)
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId || !userId) return
    const user = users.find(u => u.id === userId)
    const res = removeFromWorkspace(workspaceId, userId)
    onResult(res, `${user?.email} removed from workspace`)
    if (res.success) setUserId('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={workspaceId}
        onChange={e => { setWorkspaceId(e.target.value); setUserId('') }}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select workspace...</option>
        {workspaces.map(w => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <select
        value={userId}
        onChange={e => setUserId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select member...</option>
        {members.map(m => (
          <option key={m.userId} value={m.userId}>{m.user?.email} ({m.role})</option>
        ))}
      </select>
      <button type="submit" className="w-full px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
        Remove
      </button>
    </form>
  )
}

function DeleteWorkspaceForm({ onResult }: FormProps) {
  const [workspaceId, setWorkspaceId] = useState('')
  const allWorkspaces = useSimulatorStore(s => s.workspaces)
  const deleteGroupWorkspace = useSimulatorStore(s => s.deleteGroupWorkspace)

  const workspaces = useMemo(() => allWorkspaces.filter(w => w.type === 'group'), [allWorkspaces])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId) return
    const ws = workspaces.find(w => w.id === workspaceId)
    const res = deleteGroupWorkspace(workspaceId)
    onResult(res, `Workspace "${ws?.name}" deleted`)
    if (res.success) setWorkspaceId('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={workspaceId}
        onChange={e => setWorkspaceId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select workspace...</option>
        {workspaces.map(w => (
          <option key={w.id} value={w.id}>{w.name}</option>
        ))}
      </select>
      <button type="submit" className="w-full px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
        Delete Workspace
      </button>
    </form>
  )
}

function CreateProjectForm({ onResult }: FormProps) {
  const [workspaceId, setWorkspaceId] = useState('')
  const [creatorId, setCreatorId] = useState('')
  const [name, setName] = useState('')

  const workspaces = useSimulatorStore(s => s.workspaces)
  const workspaceMembers = useSimulatorStore(s => s.workspaceMembers)
  const users = useSimulatorStore(s => s.users)
  const createProject = useSimulatorStore(s => s.createProject)

  const selectedWs = workspaces.find(w => w.id === workspaceId)
  const eligibleCreators = workspaceId
    ? selectedWs?.type === 'private'
      ? users.filter(u => u.privateWorkspaceId === workspaceId)
      : workspaceMembers
          .filter(wm => wm.workspaceId === workspaceId && (wm.role === 'owner' || wm.canCreateProjects))
          .map(wm => users.find(u => u.id === wm.userId))
          .filter(Boolean)
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!workspaceId || !creatorId || !name) return
    const res = createProject(workspaceId, creatorId, name)
    onResult(res, `Project "${name}" created`)
    if (res.success) setName('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={workspaceId}
        onChange={e => { setWorkspaceId(e.target.value); setCreatorId('') }}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select workspace...</option>
        {workspaces.map(w => (
          <option key={w.id} value={w.id}>{w.name} ({w.type})</option>
        ))}
      </select>
      <select
        value={creatorId}
        onChange={e => setCreatorId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select creator...</option>
        {eligibleCreators.map(u => u && (
          <option key={u.id} value={u.id}>{u.email}</option>
        ))}
      </select>
      <input
        type="text"
        value={name}
        onChange={e => setName(e.target.value)}
        placeholder="Project name"
        className="w-full px-2 py-1 text-sm border rounded"
      />
      <button type="submit" className="w-full px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
        Create Project
      </button>
    </form>
  )
}

function InviteToProjectForm({ onResult }: FormProps) {
  const [projectId, setProjectId] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ProjectRole>('internal')
  const [inviterId, setInviterId] = useState('')

  const projects = useSimulatorStore(s => s.projects)
  const projectMembers = useSimulatorStore(s => s.projectMembers)
  const users = useSimulatorStore(s => s.users)
  const inviteToProject = useSimulatorStore(s => s.inviteToProject)

  const owners = projectId
    ? projectMembers
        .filter(pm => pm.projectId === projectId && pm.role === 'owner')
        .map(pm => users.find(u => u.id === pm.userId))
        .filter(Boolean)
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !email || !inviterId) return
    const res = inviteToProject(projectId, email, role, inviterId)
    onResult(res, `${email} invited to project`)
    if (res.success) setEmail('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={projectId}
        onChange={e => { setProjectId(e.target.value); setInviterId('') }}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select project...</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select
        value={inviterId}
        onChange={e => setInviterId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Inviter (owner)...</option>
        {owners.map(u => u && (
          <option key={u.id} value={u.id}>{u.email}</option>
        ))}
      </select>
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Invitee email"
        className="w-full px-2 py-1 text-sm border rounded"
      />
      <select
        value={role}
        onChange={e => setRole(e.target.value as ProjectRole)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="internal">Internal</option>
        <option value="external">External</option>
        <option value="owner">Owner</option>
      </select>
      <button type="submit" className="w-full px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
        Invite
      </button>
    </form>
  )
}

function RemoveFromProjectForm({ onResult }: FormProps) {
  const [projectId, setProjectId] = useState('')
  const [userId, setUserId] = useState('')

  const projects = useSimulatorStore(s => s.projects)
  const projectMembers = useSimulatorStore(s => s.projectMembers)
  const users = useSimulatorStore(s => s.users)
  const removeFromProject = useSimulatorStore(s => s.removeFromProject)

  const members = projectId
    ? projectMembers
        .filter(pm => pm.projectId === projectId)
        .map(pm => ({ ...pm, user: users.find(u => u.id === pm.userId) }))
        .filter(m => m.user)
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !userId) return
    const user = users.find(u => u.id === userId)
    const res = removeFromProject(projectId, userId)
    onResult(res, `${user?.email} removed from project`)
    if (res.success) setUserId('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={projectId}
        onChange={e => { setProjectId(e.target.value); setUserId('') }}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select project...</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select
        value={userId}
        onChange={e => setUserId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select collaborator...</option>
        {members.map(m => (
          <option key={m.userId} value={m.userId}>{m.user?.email} ({m.role})</option>
        ))}
      </select>
      <button type="submit" className="w-full px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
        Remove
      </button>
    </form>
  )
}

function ChangeProjectRoleForm({ onResult }: FormProps) {
  const [projectId, setProjectId] = useState('')
  const [userId, setUserId] = useState('')
  const [role, setRole] = useState<ProjectRole>('internal')

  const projects = useSimulatorStore(s => s.projects)
  const projectMembers = useSimulatorStore(s => s.projectMembers)
  const users = useSimulatorStore(s => s.users)
  const changeProjectRole = useSimulatorStore(s => s.changeProjectRole)

  const members = projectId
    ? projectMembers
        .filter(pm => pm.projectId === projectId)
        .map(pm => ({ ...pm, user: users.find(u => u.id === pm.userId) }))
        .filter(m => m.user)
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId || !userId) return
    const user = users.find(u => u.id === userId)
    const res = changeProjectRole(projectId, userId, role)
    onResult(res, `${user?.email} role changed to ${role}`)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={projectId}
        onChange={e => { setProjectId(e.target.value); setUserId('') }}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select project...</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <select
        value={userId}
        onChange={e => setUserId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select collaborator...</option>
        {members.map(m => (
          <option key={m.userId} value={m.userId}>{m.user?.email} ({m.role})</option>
        ))}
      </select>
      <select
        value={role}
        onChange={e => setRole(e.target.value as ProjectRole)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="owner">Owner</option>
        <option value="internal">Internal</option>
        <option value="external">External</option>
      </select>
      <button type="submit" className="w-full px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700">
        Change Role
      </button>
    </form>
  )
}

function DeleteProjectForm({ onResult }: FormProps) {
  const [projectId, setProjectId] = useState('')
  const projects = useSimulatorStore(s => s.projects)
  const deleteProject = useSimulatorStore(s => s.deleteProject)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!projectId) return
    const proj = projects.find(p => p.id === projectId)
    const res = deleteProject(projectId)
    onResult(res, `Project "${proj?.name}" deleted`)
    if (res.success) setProjectId('')
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <select
        value={projectId}
        onChange={e => setProjectId(e.target.value)}
        className="w-full px-2 py-1 text-sm border rounded"
      >
        <option value="">Select project...</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
      <button type="submit" className="w-full px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700">
        Delete Project
      </button>
    </form>
  )
}
