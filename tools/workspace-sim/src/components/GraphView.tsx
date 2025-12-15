import { useMemo, useCallback } from 'react'
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  MarkerType,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useSimulatorStore } from '../model/store'

// Custom node components
function UserNode({ data }: { data: { label: string; tier: string; email: string } }) {
  const tierColors = {
    free: 'border-gray-300 bg-gray-50',
    pro: 'border-blue-300 bg-blue-50',
    enterprise: 'border-purple-300 bg-purple-50',
  }
  return (
    <div className={`px-3 py-2 rounded-lg border-2 ${tierColors[data.tier as keyof typeof tierColors] ?? tierColors.free}`}>
      <div className="text-xs text-gray-500">User</div>
      <div className="font-medium text-sm">{data.email}</div>
      <div className="text-xs text-gray-400">{data.tier}</div>
    </div>
  )
}

function WorkspaceNode({ data }: { data: { label: string; type: string; plan?: string; projectCount: number } }) {
  const typeColors = {
    private: 'border-gray-400 bg-white',
    group: 'border-green-400 bg-green-50',
  }
  return (
    <div className={`px-3 py-2 rounded-lg border-2 min-w-[120px] ${typeColors[data.type as keyof typeof typeColors] ?? typeColors.private}`}>
      <div className="text-xs text-gray-500">{data.type === 'private' ? 'Private Workspace' : `Group (${data.plan})`}</div>
      <div className="font-medium text-sm truncate max-w-[150px]">{data.label}</div>
      <div className="text-xs text-gray-400">{data.projectCount} project{data.projectCount !== 1 ? 's' : ''}</div>
    </div>
  )
}

function ProjectNode({ data }: { data: { label: string; collaboratorCount: number } }) {
  return (
    <div className="px-3 py-2 rounded border-2 border-orange-300 bg-orange-50 min-w-[100px]">
      <div className="text-xs text-gray-500">Project</div>
      <div className="font-medium text-sm truncate max-w-[120px]">{data.label}</div>
      <div className="text-xs text-gray-400">{data.collaboratorCount} collab{data.collaboratorCount !== 1 ? 's' : ''}</div>
    </div>
  )
}

const nodeTypes = {
  user: UserNode,
  workspace: WorkspaceNode,
  project: ProjectNode,
}

export function GraphView() {
  const users = useSimulatorStore(s => s.users)
  const workspaces = useSimulatorStore(s => s.workspaces)
  const workspaceMembers = useSimulatorStore(s => s.workspaceMembers)
  const projects = useSimulatorStore(s => s.projects)
  const projectMembers = useSimulatorStore(s => s.projectMembers)

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []

    // Layout constants
    const USER_WIDTH = 180
    const USER_HEIGHT = 80
    const WORKSPACE_WIDTH = 200
    const WORKSPACE_HEIGHT = 100
    const PROJECT_WIDTH = 140
    const PROJECT_HEIGHT = 70
    const SPACING_X = 50
    const SPACING_Y = 40

    let currentX = 0

    // Create user nodes with their private workspaces
    users.forEach((user, userIndex) => {
      const userX = currentX
      const userY = 0

      nodes.push({
        id: `user-${user.id}`,
        type: 'user',
        position: { x: userX, y: userY },
        data: { label: user.email, tier: user.tier, email: user.email },
      })

      // Private workspace below user
      const privateWs = workspaces.find(w => w.id === user.privateWorkspaceId)
      if (privateWs) {
        const wsProjects = projects.filter(p => p.workspaceId === privateWs.id)

        nodes.push({
          id: `ws-${privateWs.id}`,
          type: 'workspace',
          position: { x: userX, y: userY + USER_HEIGHT + SPACING_Y },
          data: {
            label: privateWs.name,
            type: privateWs.type,
            plan: privateWs.plan,
            projectCount: wsProjects.length,
          },
        })

        // Edge from user to private workspace
        edges.push({
          id: `edge-user-${user.id}-ws-${privateWs.id}`,
          source: `user-${user.id}`,
          target: `ws-${privateWs.id}`,
          label: 'owns',
          style: { stroke: '#9ca3af' },
          labelStyle: { fontSize: 10 },
        })

        // Projects in private workspace
        wsProjects.forEach((proj, projIndex) => {
          const projX = userX + projIndex * (PROJECT_WIDTH + SPACING_X / 2)
          const projY = userY + USER_HEIGHT + SPACING_Y + WORKSPACE_HEIGHT + SPACING_Y

          nodes.push({
            id: `proj-${proj.id}`,
            type: 'project',
            position: { x: projX, y: projY },
            data: {
              label: proj.name,
              collaboratorCount: projectMembers.filter(pm => pm.projectId === proj.id).length,
            },
          })

          edges.push({
            id: `edge-ws-${privateWs.id}-proj-${proj.id}`,
            source: `ws-${privateWs.id}`,
            target: `proj-${proj.id}`,
            style: { stroke: '#d1d5db' },
          })
        })

        currentX += Math.max(
          USER_WIDTH,
          WORKSPACE_WIDTH,
          wsProjects.length * (PROJECT_WIDTH + SPACING_X / 2)
        ) + SPACING_X * 2
      } else {
        currentX += USER_WIDTH + SPACING_X * 2
      }
    })

    // Group workspaces (not private)
    const groupWorkspaces = workspaces.filter(w => w.type === 'group')
    const groupStartY = 350 // Below users and their private workspaces

    groupWorkspaces.forEach((ws, wsIndex) => {
      const wsProjects = projects.filter(p => p.workspaceId === ws.id)
      const members = workspaceMembers.filter(wm => wm.workspaceId === ws.id)

      const wsX = wsIndex * (WORKSPACE_WIDTH + SPACING_X * 3)
      const wsY = groupStartY

      nodes.push({
        id: `ws-${ws.id}`,
        type: 'workspace',
        position: { x: wsX, y: wsY },
        data: {
          label: ws.name,
          type: ws.type,
          plan: ws.plan,
          projectCount: wsProjects.length,
        },
      })

      // Projects in group workspace
      wsProjects.forEach((proj, projIndex) => {
        const projX = wsX + projIndex * (PROJECT_WIDTH + SPACING_X / 2)
        const projY = wsY + WORKSPACE_HEIGHT + SPACING_Y

        nodes.push({
          id: `proj-${proj.id}`,
          type: 'project',
          position: { x: projX, y: projY },
          data: {
            label: proj.name,
            collaboratorCount: projectMembers.filter(pm => pm.projectId === proj.id).length,
          },
        })

        edges.push({
          id: `edge-ws-${ws.id}-proj-${proj.id}`,
          source: `ws-${ws.id}`,
          target: `proj-${proj.id}`,
          style: { stroke: '#d1d5db' },
        })
      })

      // Membership edges from users to group workspace
      members.forEach(member => {
        edges.push({
          id: `edge-member-${member.id}`,
          source: `user-${member.userId}`,
          target: `ws-${ws.id}`,
          label: member.role,
          animated: member.role === 'owner',
          style: { stroke: member.role === 'owner' ? '#eab308' : '#6b7280' },
          labelStyle: { fontSize: 10 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: member.role === 'owner' ? '#eab308' : '#6b7280',
          },
        })
      })
    })

    // Project membership edges (for users who are collaborators but not through workspace ownership)
    projectMembers.forEach(pm => {
      const project = projects.find(p => p.id === pm.projectId)
      if (!project) return

      const workspace = workspaces.find(w => w.id === project.workspaceId)
      if (!workspace) return

      // For private workspaces, owner is implicit - skip
      if (workspace.type === 'private' && workspace.ownerUserId === pm.userId) return

      // For group workspaces, check if user is already connected via workspace membership
      if (workspace.type === 'group') {
        const isWsMember = workspaceMembers.some(
          wm => wm.workspaceId === workspace.id && wm.userId === pm.userId
        )
        // If they're a workspace member, their primary connection is to the workspace
        // Only show direct project edges for non-workspace members (external collaborators)
        if (isWsMember) return
      }

      // Direct project collaboration edge
      edges.push({
        id: `edge-projmember-${pm.id}`,
        source: `user-${pm.userId}`,
        target: `proj-${pm.projectId}`,
        label: pm.role,
        style: {
          stroke: pm.role === 'owner' ? '#eab308' : pm.role === 'internal' ? '#3b82f6' : '#9ca3af',
          strokeDasharray: pm.role === 'external' ? '5,5' : undefined,
        },
        labelStyle: { fontSize: 10 },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: pm.role === 'owner' ? '#eab308' : pm.role === 'internal' ? '#3b82f6' : '#9ca3af',
        },
      })
    })

    return { initialNodes: nodes, initialEdges: edges }
  }, [users, workspaces, workspaceMembers, projects, projectMembers])

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  // Update nodes/edges when data changes
  useMemo(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

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
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
      >
        <Background color="#e5e7eb" gap={20} />
        <Controls />
      </ReactFlow>
    </div>
  )
}
