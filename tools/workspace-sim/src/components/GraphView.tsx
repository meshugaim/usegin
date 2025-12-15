import { useMemo } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  Handle,
  Position,
  MarkerType,
  ConnectionLineType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useSimulatorStore } from '../model/store'

// Custom node with handles for proper edge connections
function UserNode({ data }: { data: { email: string; tier: string } }) {
  const tierColors = {
    free: 'border-gray-400 bg-gray-50',
    pro: 'border-blue-400 bg-blue-50',
    enterprise: 'border-purple-400 bg-purple-50',
  }
  return (
    <div className={`px-4 py-3 rounded-lg border-2 shadow-sm ${tierColors[data.tier as keyof typeof tierColors] ?? tierColors.free}`}>
      <Handle type="source" position={Position.Bottom} className="!bg-gray-400" />
      <Handle type="source" position={Position.Right} id="right" className="!bg-gray-400" />
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-gray-600 text-sm font-medium">
          {data.email[0]?.toUpperCase()}
        </div>
        <div>
          <div className="font-medium text-sm">{data.email}</div>
          <div className="text-xs text-gray-500">{data.tier} tier</div>
        </div>
      </div>
    </div>
  )
}

function PrivateWorkspaceNode({ data }: { data: { name: string; projects: { id: string; name: string; collabs: number }[] } }) {
  return (
    <div className="p-3 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50/50 min-w-[200px]">
      <Handle type="target" position={Position.Top} className="!bg-gray-400" />
      <div className="text-xs text-gray-400 mb-2">Private Workspace</div>
      <div className="font-medium text-sm mb-2 truncate">{data.name}</div>
      {data.projects.length > 0 ? (
        <div className="space-y-1">
          {data.projects.map(proj => (
            <div key={proj.id} className="px-2 py-1 bg-orange-100 border border-orange-300 rounded text-xs">
              <div className="font-medium truncate">{proj.name}</div>
              <div className="text-gray-500">{proj.collabs} collaborator{proj.collabs !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic">No projects</div>
      )}
    </div>
  )
}

function GroupWorkspaceNode({ data }: { data: { name: string; plan: string; projects: { id: string; name: string; collabs: number }[] } }) {
  const planColors = {
    team: 'border-green-400 bg-green-50',
    business: 'border-orange-400 bg-orange-50',
    enterprise: 'border-purple-400 bg-purple-50',
  }
  return (
    <div className={`p-3 rounded-lg border-2 min-w-[220px] ${planColors[data.plan as keyof typeof planColors] ?? planColors.team}`}>
      <Handle type="target" position={Position.Top} className="!bg-green-500" />
      <Handle type="target" position={Position.Left} id="left" className="!bg-green-500" />
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs text-gray-500">Group Workspace</div>
        <div className="text-xs px-1.5 py-0.5 bg-white rounded border">{data.plan}</div>
      </div>
      <div className="font-medium text-sm mb-2">{data.name}</div>
      {data.projects.length > 0 ? (
        <div className="space-y-1">
          {data.projects.map(proj => (
            <div key={proj.id} className="px-2 py-1 bg-white border border-gray-200 rounded text-xs">
              <div className="font-medium truncate">{proj.name}</div>
              <div className="text-gray-500">{proj.collabs} collaborator{proj.collabs !== 1 ? 's' : ''}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-xs text-gray-400 italic">No projects</div>
      )}
    </div>
  )
}

const nodeTypes = {
  user: UserNode,
  privateWorkspace: PrivateWorkspaceNode,
  groupWorkspace: GroupWorkspaceNode,
}

export function GraphView() {
  const users = useSimulatorStore(s => s.users)
  const workspaces = useSimulatorStore(s => s.workspaces)
  const workspaceMembers = useSimulatorStore(s => s.workspaceMembers)
  const projects = useSimulatorStore(s => s.projects)
  const projectMembers = useSimulatorStore(s => s.projectMembers)

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Layout constants
    const USER_SPACING_X = 280
    const PRIVATE_WS_OFFSET_Y = 100
    const GROUP_WS_START_Y = 380
    const GROUP_WS_SPACING_X = 300

    // Create user nodes with their private workspaces
    users.forEach((user, userIndex) => {
      const userX = userIndex * USER_SPACING_X
      const userY = 0

      nodes.push({
        id: `user-${user.id}`,
        type: 'user',
        position: { x: userX, y: userY },
        data: { email: user.email, tier: user.tier },
      })

      // Private workspace below user
      const privateWs = workspaces.find(w => w.id === user.privateWorkspaceId)
      if (privateWs) {
        const wsProjects = projects.filter(p => p.workspaceId === privateWs.id)

        nodes.push({
          id: `ws-${privateWs.id}`,
          type: 'privateWorkspace',
          position: { x: userX - 20, y: userY + PRIVATE_WS_OFFSET_Y },
          data: {
            name: privateWs.name,
            projects: wsProjects.map(p => ({
              id: p.id,
              name: p.name,
              collabs: projectMembers.filter(pm => pm.projectId === p.id).length,
            })),
          },
        })

        // Edge: User owns private workspace
        edges.push({
          id: `edge-owns-${user.id}`,
          source: `user-${user.id}`,
          target: `ws-${privateWs.id}`,
          type: 'smoothstep',
          animated: false,
          style: { stroke: '#9ca3af', strokeWidth: 2 },
          label: 'owns',
          labelStyle: { fontSize: 10, fill: '#6b7280' },
          labelBgStyle: { fill: '#f9fafb' },
        })
      }
    })

    // Group workspaces
    const groupWorkspaces = workspaces.filter(w => w.type === 'group')

    groupWorkspaces.forEach((ws, wsIndex) => {
      const wsProjects = projects.filter(p => p.workspaceId === ws.id)
      const wsX = wsIndex * GROUP_WS_SPACING_X
      const wsY = GROUP_WS_START_Y

      nodes.push({
        id: `ws-${ws.id}`,
        type: 'groupWorkspace',
        position: { x: wsX, y: wsY },
        data: {
          name: ws.name,
          plan: ws.plan ?? 'team',
          projects: wsProjects.map(p => ({
            id: p.id,
            name: p.name,
            collabs: projectMembers.filter(pm => pm.projectId === p.id).length,
          })),
        },
      })

      // Membership edges
      const members = workspaceMembers.filter(wm => wm.workspaceId === ws.id)
      members.forEach(member => {
        const isOwner = member.role === 'owner'
        edges.push({
          id: `edge-member-${member.id}`,
          source: `user-${member.userId}`,
          sourceHandle: 'right',
          target: `ws-${ws.id}`,
          targetHandle: 'left',
          type: 'smoothstep',
          animated: isOwner,
          style: {
            stroke: isOwner ? '#eab308' : '#6b7280',
            strokeWidth: isOwner ? 2 : 1,
          },
          label: member.role,
          labelStyle: { fontSize: 10, fill: isOwner ? '#ca8a04' : '#6b7280' },
          labelBgStyle: { fill: '#f9fafb' },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isOwner ? '#eab308' : '#6b7280',
            width: 15,
            height: 15,
          },
        })
      })
    })

    // External project collaborator edges (users not in workspace but on project)
    projectMembers.forEach(pm => {
      const project = projects.find(p => p.id === pm.projectId)
      if (!project) return

      const workspace = workspaces.find(w => w.id === project.workspaceId)
      if (!workspace) return

      // Skip if this is the private workspace owner (implicit)
      if (workspace.type === 'private' && workspace.ownerUserId === pm.userId) return

      // Skip if user is a workspace member (already connected)
      if (workspace.type === 'group') {
        const isWsMember = workspaceMembers.some(
          wm => wm.workspaceId === workspace.id && wm.userId === pm.userId
        )
        if (isWsMember) return
      }

      // This is an external collaborator - show direct link to workspace
      const roleColors = {
        owner: '#eab308',
        internal: '#3b82f6',
        external: '#9ca3af',
      }
      const color = roleColors[pm.role as keyof typeof roleColors] ?? roleColors.external

      edges.push({
        id: `edge-external-${pm.id}`,
        source: `user-${pm.userId}`,
        target: `ws-${workspace.id}`,
        type: 'smoothstep',
        style: {
          stroke: color,
          strokeWidth: 1,
          strokeDasharray: pm.role === 'external' ? '5,5' : undefined,
        },
        label: `${pm.role} on ${project.name}`,
        labelStyle: { fontSize: 9, fill: '#6b7280' },
        labelBgStyle: { fill: '#f9fafb' },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color,
          width: 12,
          height: 12,
        },
      })
    })

    return { nodes, edges }
  }, [users, workspaces, workspaceMembers, projects, projectMembers])

  if (users.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <p>No data to visualize</p>
          <p className="text-sm mt-1">Register a user to get started</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        connectionLineType={ConnectionLineType.SmoothStep}
        fitView
        fitViewOptions={{ padding: 0.3 }}
        minZoom={0.3}
        maxZoom={1.5}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
