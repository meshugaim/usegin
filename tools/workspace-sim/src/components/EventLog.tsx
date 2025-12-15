import { useSimulatorStore } from '../model/store'

export function EventLog() {
  const eventLog = useSimulatorStore(s => s.eventLog)

  if (eventLog.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        No events yet
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {eventLog.slice().reverse().map(event => (
        <div key={event.id} className="text-xs border-l-2 border-gray-200 pl-2 py-0.5">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-mono">
              {event.timestamp.toLocaleTimeString()}
            </span>
            <span className="font-medium text-gray-700">{event.action}</span>
          </div>
          <div className="text-gray-500 truncate" title={event.details}>
            {event.details}
          </div>
        </div>
      ))}
    </div>
  )
}
