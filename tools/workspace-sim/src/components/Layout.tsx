import { ActionPanel } from './ActionPanel'
import { useSimulatorStore } from '../model/store'

export function Layout() {
  const reset = useSimulatorStore(s => s.reset)
  const userCount = useSimulatorStore(s => s.users.length)
  const workspaceCount = useSimulatorStore(s => s.workspaces.length)
  const projectCount = useSimulatorStore(s => s.projects.length)

  return (
    <div className="h-screen flex flex-col">
      <header className="bg-white border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-semibold">Workspace Model Simulator</h1>
          <div className="flex gap-2 text-xs text-gray-500">
            <span>{userCount} users</span>
            <span>·</span>
            <span>{workspaceCount} workspaces</span>
            <span>·</span>
            <span>{projectCount} projects</span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={reset}
            className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
          >
            Reset
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left: Action Panel */}
        <aside className="w-72 border-r bg-white overflow-y-auto p-4">
          <h2 className="font-medium mb-3">Actions</h2>
          <ActionPanel />
        </aside>

        {/* Center: Graph View */}
        <main className="flex-1 flex flex-col">
          <div className="flex-1 bg-gray-100 flex items-center justify-center">
            <p className="text-gray-500">Graph visualization coming soon...</p>
          </div>
        </main>

        {/* Right: Tables & Event Log */}
        <aside className="w-96 border-l bg-white flex flex-col">
          <div className="flex-1 overflow-y-auto p-4 border-b">
            <h2 className="font-medium mb-3">Entities</h2>
            <p className="text-sm text-gray-500">Entity tables coming soon...</p>
          </div>
          <div className="h-48 overflow-y-auto p-4">
            <h2 className="font-medium mb-3">Event Log</h2>
            <p className="text-sm text-gray-500">Event log coming soon...</p>
          </div>
        </aside>
      </div>
    </div>
  )
}
