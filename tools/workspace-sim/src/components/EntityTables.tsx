import { useState } from 'react'
import { useSimulatorStore } from '../model/store'

type Tab = 'users' | 'workspaces' | 'wsMembers' | 'projects' | 'projMembers'

const TABS: { id: Tab; label: string }[] = [
  { id: 'users', label: 'Users' },
  { id: 'workspaces', label: 'Workspaces' },
  { id: 'wsMembers', label: 'WS Members' },
  { id: 'projects', label: 'Projects' },
  { id: 'projMembers', label: 'Proj Members' },
]

export function EntityTables() {
  const [activeTab, setActiveTab] = useState<Tab>('users')

  return (
    <div className="flex flex-col h-full">
      <div className="flex border-b">
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-2 py-1 text-xs ${
              activeTab === tab.id
                ? 'border-b-2 border-blue-600 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'users' && <UsersTable />}
        {activeTab === 'workspaces' && <WorkspacesTable />}
        {activeTab === 'wsMembers' && <WorkspaceMembersTable />}
        {activeTab === 'projects' && <ProjectsTable />}
        {activeTab === 'projMembers' && <ProjectMembersTable />}
      </div>
    </div>
  )
}

function UsersTable() {
  const users = useSimulatorStore(s => s.users)
  const workspaces = useSimulatorStore(s => s.workspaces)

  if (users.length === 0) {
    return <EmptyState message="No users yet" />
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 sticky top-0">
        <tr>
          <th className="text-left p-2 font-medium">Email</th>
          <th className="text-left p-2 font-medium">Tier</th>
          <th className="text-left p-2 font-medium">Private WS</th>
        </tr>
      </thead>
      <tbody>
        {users.map(user => {
          const privateWs = workspaces.find(w => w.id === user.privateWorkspaceId)
          return (
            <tr key={user.id} className="border-t hover:bg-gray-50">
              <td className="p-2 font-mono">{user.email}</td>
              <td className="p-2">
                <TierBadge tier={user.tier} />
              </td>
              <td className="p-2 text-gray-500 truncate max-w-[100px]" title={privateWs?.name}>
                {privateWs?.name}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function WorkspacesTable() {
  const workspaces = useSimulatorStore(s => s.workspaces)
  const users = useSimulatorStore(s => s.users)
  const projects = useSimulatorStore(s => s.projects)
  const workspaceMembers = useSimulatorStore(s => s.workspaceMembers)

  if (workspaces.length === 0) {
    return <EmptyState message="No workspaces yet" />
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 sticky top-0">
        <tr>
          <th className="text-left p-2 font-medium">Name</th>
          <th className="text-left p-2 font-medium">Type</th>
          <th className="text-left p-2 font-medium">Projects</th>
          <th className="text-left p-2 font-medium">Members</th>
        </tr>
      </thead>
      <tbody>
        {workspaces.map(ws => {
          const projectCount = projects.filter(p => p.workspaceId === ws.id).length
          const memberCount = ws.type === 'private'
            ? 1
            : workspaceMembers.filter(wm => wm.workspaceId === ws.id).length
          const owner = ws.type === 'private'
            ? users.find(u => u.id === ws.ownerUserId)
            : null

          return (
            <tr key={ws.id} className="border-t hover:bg-gray-50">
              <td className="p-2 truncate max-w-[120px]" title={ws.name}>{ws.name}</td>
              <td className="p-2">
                <TypeBadge type={ws.type} plan={ws.plan} />
              </td>
              <td className="p-2">
                {projectCount}/{ws.limits.maxProjects}
              </td>
              <td className="p-2">
                {ws.type === 'private' ? (
                  <span className="text-gray-500" title={owner?.email}>{owner?.email?.split('@')[0]}</span>
                ) : (
                  memberCount
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function WorkspaceMembersTable() {
  const workspaceMembers = useSimulatorStore(s => s.workspaceMembers)
  const workspaces = useSimulatorStore(s => s.workspaces)
  const users = useSimulatorStore(s => s.users)

  if (workspaceMembers.length === 0) {
    return <EmptyState message="No workspace members yet" />
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 sticky top-0">
        <tr>
          <th className="text-left p-2 font-medium">Workspace</th>
          <th className="text-left p-2 font-medium">User</th>
          <th className="text-left p-2 font-medium">Role</th>
          <th className="text-left p-2 font-medium">Create?</th>
        </tr>
      </thead>
      <tbody>
        {workspaceMembers.map(wm => {
          const workspace = workspaces.find(w => w.id === wm.workspaceId)
          const user = users.find(u => u.id === wm.userId)
          return (
            <tr key={wm.id} className="border-t hover:bg-gray-50">
              <td className="p-2 truncate max-w-[80px]" title={workspace?.name}>
                {workspace?.name}
              </td>
              <td className="p-2 truncate max-w-[80px]" title={user?.email}>
                {user?.email?.split('@')[0]}
              </td>
              <td className="p-2">
                <RoleBadge role={wm.role} />
              </td>
              <td className="p-2">
                {wm.canCreateProjects ? '✓' : '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ProjectsTable() {
  const projects = useSimulatorStore(s => s.projects)
  const workspaces = useSimulatorStore(s => s.workspaces)
  const projectMembers = useSimulatorStore(s => s.projectMembers)

  if (projects.length === 0) {
    return <EmptyState message="No projects yet" />
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 sticky top-0">
        <tr>
          <th className="text-left p-2 font-medium">Name</th>
          <th className="text-left p-2 font-medium">Workspace</th>
          <th className="text-left p-2 font-medium">Collaborators</th>
        </tr>
      </thead>
      <tbody>
        {projects.map(proj => {
          const workspace = workspaces.find(w => w.id === proj.workspaceId)
          const collabCount = projectMembers.filter(pm => pm.projectId === proj.id).length
          return (
            <tr key={proj.id} className="border-t hover:bg-gray-50">
              <td className="p-2 truncate max-w-[100px]" title={proj.name}>{proj.name}</td>
              <td className="p-2 truncate max-w-[80px]" title={workspace?.name}>
                {workspace?.name}
              </td>
              <td className="p-2">
                {collabCount}/{workspace?.limits.maxCollaboratorsPerProject}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function ProjectMembersTable() {
  const projectMembers = useSimulatorStore(s => s.projectMembers)
  const projects = useSimulatorStore(s => s.projects)
  const users = useSimulatorStore(s => s.users)

  if (projectMembers.length === 0) {
    return <EmptyState message="No project members yet" />
  }

  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-50 sticky top-0">
        <tr>
          <th className="text-left p-2 font-medium">Project</th>
          <th className="text-left p-2 font-medium">User</th>
          <th className="text-left p-2 font-medium">Role</th>
        </tr>
      </thead>
      <tbody>
        {projectMembers.map(pm => {
          const project = projects.find(p => p.id === pm.projectId)
          const user = users.find(u => u.id === pm.userId)
          return (
            <tr key={pm.id} className="border-t hover:bg-gray-50">
              <td className="p-2 truncate max-w-[80px]" title={project?.name}>
                {project?.name}
              </td>
              <td className="p-2 truncate max-w-[80px]" title={user?.email}>
                {user?.email?.split('@')[0]}
              </td>
              <td className="p-2">
                <ProjectRoleBadge role={pm.role} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// Badge components
function TierBadge({ tier }: { tier: string }) {
  const colors = {
    free: 'bg-gray-100 text-gray-700',
    pro: 'bg-blue-100 text-blue-700',
    enterprise: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[tier as keyof typeof colors] ?? colors.free}`}>
      {tier}
    </span>
  )
}

function TypeBadge({ type, plan }: { type: string; plan?: string }) {
  if (type === 'private') {
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
        private
      </span>
    )
  }
  const colors = {
    team: 'bg-green-100 text-green-700',
    business: 'bg-orange-100 text-orange-700',
    enterprise: 'bg-purple-100 text-purple-700',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[plan as keyof typeof colors] ?? colors.team}`}>
      {plan}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const colors = {
    owner: 'bg-yellow-100 text-yellow-700',
    member: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[role as keyof typeof colors] ?? colors.member}`}>
      {role}
    </span>
  )
}

function ProjectRoleBadge({ role }: { role: string }) {
  const colors = {
    owner: 'bg-yellow-100 text-yellow-700',
    internal: 'bg-blue-100 text-blue-700',
    external: 'bg-gray-100 text-gray-700',
  }
  return (
    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${colors[role as keyof typeof colors] ?? colors.external}`}>
      {role}
    </span>
  )
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
      {message}
    </div>
  )
}
