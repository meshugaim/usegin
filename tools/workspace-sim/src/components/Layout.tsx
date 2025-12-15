import { useState } from 'react'
import { ActionPanel } from './ActionPanel'
import { EntityTables } from './EntityTables'
import { EventLog } from './EventLog'
import { GraphView } from './GraphView'
import { useSimulatorStore } from '../model/store'
import { scenarios, runScenario } from '../model/scenarios'

export function Layout() {
  const reset = useSimulatorStore(s => s.reset)
  const userCount = useSimulatorStore(s => s.users.length)
  const workspaceCount = useSimulatorStore(s => s.workspaces.length)
  const projectCount = useSimulatorStore(s => s.projects.length)

  const [showScenarios, setShowScenarios] = useState(false)

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
        <div className="flex gap-2 items-center">
          <div className="relative">
            <button
              onClick={() => setShowScenarios(!showScenarios)}
              className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded"
            >
              Scenarios ▾
            </button>
            {showScenarios && (
              <div className="absolute right-0 mt-1 w-72 bg-white border rounded-lg shadow-lg z-50">
                <div className="p-2 border-b">
                  <div className="text-xs text-gray-500 font-medium">Load a preset scenario</div>
                </div>
                {scenarios.map(scenario => (
                  <button
                    key={scenario.id}
                    onClick={() => {
                      runScenario(scenario.id)
                      setShowScenarios(false)
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b last:border-b-0"
                  >
                    <div className="font-medium text-sm">{scenario.name}</div>
                    <div className="text-xs text-gray-500">{scenario.description}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
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
          <div className="flex-1 bg-gray-50">
            <GraphView />
          </div>
        </main>

        {/* Right: Tables & Event Log */}
        <aside className="w-96 border-l bg-white flex flex-col">
          <div className="flex-1 overflow-hidden border-b">
            <EntityTables />
          </div>
          <div className="h-48 overflow-y-auto p-3">
            <h2 className="font-medium mb-2 text-sm">Event Log</h2>
            <EventLog />
          </div>
        </aside>
      </div>
    </div>
  )
}
