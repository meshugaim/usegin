import { useSimulatorStore } from './store'

type ScenarioFn = () => void

export interface Scenario {
  id: string
  name: string
  description: string
  run: ScenarioFn
}

export const scenarios: Scenario[] = [
  {
    id: 'solo-user',
    name: 'Solo User Journey',
    description: 'Free user creates project, hits limits, upgrades to Pro',
    run: () => {
      const store = useSimulatorStore.getState()
      store.reset()

      // Register free user
      const aliceResult = store.registerUser('alice@example.com')
      if (!aliceResult.data) return

      // Create a project (uses up the 1 free project)
      const wsId = aliceResult.data.privateWorkspaceId
      store.createProject(wsId, aliceResult.data.id, 'My First Project')

      // Try to create another (will fail due to limit)
      const failedResult = store.createProject(wsId, aliceResult.data.id, 'Second Project')
      if (!failedResult.success) {
        store.logEvent('Limit hit', failedResult.error ?? 'Project limit reached')
      }

      // Upgrade to pro
      store.upgradeTier(aliceResult.data.id, 'pro')

      // Now can create more projects
      store.createProject(wsId, aliceResult.data.id, 'Second Project')
      store.createProject(wsId, aliceResult.data.id, 'Third Project')
    },
  },
  {
    id: 'consultant',
    name: 'Consultant Multi-Workspace',
    description: 'Consultant invited to multiple client workspaces',
    run: () => {
      const store = useSimulatorStore.getState()
      store.reset()

      // Create two company owners (pro tier)
      const acmeOwner = store.registerUser('ceo@acme.com')
      if (!acmeOwner.data) return
      store.upgradeTier(acmeOwner.data.id, 'pro')

      const betaOwner = store.registerUser('ceo@beta.com')
      if (!betaOwner.data) return
      store.upgradeTier(betaOwner.data.id, 'pro')

      // Create group workspaces
      const acmeWs = store.createGroupWorkspace(acmeOwner.data.id, 'Acme Corp', 'team')
      const betaWs = store.createGroupWorkspace(betaOwner.data.id, 'Beta Inc', 'business')

      if (!acmeWs.data || !betaWs.data) return

      // Create projects in each workspace
      store.createProject(acmeWs.data.id, acmeOwner.data.id, 'Acme Website Redesign')
      store.createProject(acmeWs.data.id, acmeOwner.data.id, 'Acme Mobile App')
      store.createProject(betaWs.data.id, betaOwner.data.id, 'Beta Platform')

      // Invite consultant (creates new user on free tier)
      store.inviteToWorkspace(acmeWs.data.id, 'consultant@freelance.com', 'member', acmeOwner.data.id)
      store.inviteToWorkspace(betaWs.data.id, 'consultant@freelance.com', 'member', betaOwner.data.id)
    },
  },
  {
    id: 'team-oversight',
    name: 'Team Workspace Oversight',
    description: 'Workspace owners, members, and project visibility',
    run: () => {
      const store = useSimulatorStore.getState()
      store.reset()

      // Create main workspace owner
      const carol = store.registerUser('carol@megacorp.com')
      if (!carol.data) return
      store.upgradeTier(carol.data.id, 'enterprise')

      // Create group workspace
      const ws = store.createGroupWorkspace(carol.data.id, 'MegaCorp Engineering', 'enterprise')
      if (!ws.data) return

      // Invite co-owners
      store.inviteToWorkspace(ws.data.id, 'dave@megacorp.com', 'owner', carol.data.id)
      store.inviteToWorkspace(ws.data.id, 'eve@megacorp.com', 'owner', carol.data.id)

      // Invite regular members
      store.inviteToWorkspace(ws.data.id, 'frank@megacorp.com', 'member', carol.data.id)
      store.inviteToWorkspace(ws.data.id, 'grace@megacorp.com', 'member', carol.data.id)

      // Allow Frank to create projects
      const frank = store.getUserByEmail('frank@megacorp.com')
      if (frank) {
        store.setMemberCanCreateProjects(ws.data.id, frank.id, true)
      }

      // Create various projects
      store.createProject(ws.data.id, carol.data.id, 'Project Alpha')
      store.createProject(ws.data.id, carol.data.id, 'Project Beta')

      if (frank) {
        store.createProject(ws.data.id, frank.id, 'Project Gamma')
      }

      // Add Dave to Project Alpha as collaborator
      const dave = store.getUserByEmail('dave@megacorp.com')
      const projAlpha = store.getWorkspaceProjects(ws.data.id).find(p => p.name === 'Project Alpha')
      if (dave && projAlpha) {
        store.inviteToProject(projAlpha.id, dave.email, 'internal', carol.data.id)
      }
    },
  },
  {
    id: 'invitation-flow',
    name: 'Invitation Flow',
    description: 'New user invited to existing project',
    run: () => {
      const store = useSimulatorStore.getState()
      store.reset()

      // Create project owner
      const owner = store.registerUser('owner@company.com')
      if (!owner.data) return
      store.upgradeTier(owner.data.id, 'pro')

      // Create a project in private workspace
      const proj = store.createProject(owner.data.privateWorkspaceId, owner.data.id, 'Client Project')
      if (!proj.data) return

      // Invite new users as different roles
      store.inviteToProject(proj.data.id, 'internal@company.com', 'internal', owner.data.id)
      store.inviteToProject(proj.data.id, 'client@external.com', 'external', owner.data.id)

      // Promote internal to co-owner
      const internal = store.getUserByEmail('internal@company.com')
      if (internal) {
        store.changeProjectRole(proj.data.id, internal.id, 'owner')
      }
    },
  },
  {
    id: 'edge-cases',
    name: 'Edge Cases Demo',
    description: 'Demonstrates blocked actions and ownership rules',
    run: () => {
      const store = useSimulatorStore.getState()
      store.reset()

      // Create user with project
      const alice = store.registerUser('alice@example.com')
      if (!alice.data) return

      const proj = store.createProject(alice.data.privateWorkspaceId, alice.data.id, 'Important Project')
      if (!proj.data) return

      // Try to remove sole owner (will fail)
      const removeResult = store.removeFromProject(proj.data.id, alice.data.id)
      if (!removeResult.success) {
        store.logEvent('Blocked action', removeResult.error ?? 'Cannot remove sole owner')
      }

      // Try to delete user who owns project (will fail)
      const deleteResult = store.deleteUser(alice.data.id)
      if (!deleteResult.success) {
        store.logEvent('Blocked action', deleteResult.error ?? 'Cannot delete user with owned projects')
      }

      // Add collaborator, promote to co-owner, then original can leave
      store.inviteToProject(proj.data.id, 'bob@example.com', 'internal', alice.data.id)
      const bob = store.getUserByEmail('bob@example.com')
      if (bob) {
        store.changeProjectRole(proj.data.id, bob.id, 'owner')
        store.logEvent('Ownership transferred', 'Bob promoted to co-owner')

        // Now alice can leave
        const leaveResult = store.removeFromProject(proj.data.id, alice.data.id)
        if (leaveResult.success) {
          store.logEvent('Owner left', 'Alice left after transferring ownership')
        }
      }
    },
  },
]

export function runScenario(id: string) {
  const scenario = scenarios.find(s => s.id === id)
  if (scenario) {
    scenario.run()
  }
}
