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
    description: 'User creates workspace, projects, hits limits, upgrades workspace tier',
    run: () => {
      const store = useSimulatorStore.getState()
      store.reset()

      // Register user (gets free-tier workspace automatically)
      const aliceResult = store.registerUser('alice@example.com')
      if (!aliceResult.data) return

      // Find Alice's auto-created workspace
      const aliceWorkspaces = store.getUserWorkspaces(aliceResult.data.id)
      const wsId = aliceWorkspaces[0]?.id
      if (!wsId) return

      // Create projects (free tier allows 3)
      store.createProject(wsId, aliceResult.data.id, 'My First Project')
      store.createProject(wsId, aliceResult.data.id, 'Second Project')
      store.createProject(wsId, aliceResult.data.id, 'Third Project')

      // Try to create another (will fail due to limit)
      const failedResult = store.createProject(wsId, aliceResult.data.id, 'Fourth Project')
      if (!failedResult.success) {
        store.logEvent('Limit hit', failedResult.error ?? 'Project limit reached')
      }

      // Upgrade workspace to pro
      store.upgradeWorkspaceTier(wsId, 'pro')

      // Now can create more projects
      store.createProject(wsId, aliceResult.data.id, 'Fourth Project')
      store.createProject(wsId, aliceResult.data.id, 'Fifth Project')
    },
  },
  {
    id: 'consultant',
    name: 'Consultant Multi-Workspace',
    description: 'Consultant invited to multiple client workspaces (orthogonal membership)',
    run: () => {
      const store = useSimulatorStore.getState()
      store.reset()

      // Create two company owners
      const acmeOwner = store.registerUser('ceo@acme.com')
      const betaOwner = store.registerUser('ceo@beta.com')
      if (!acmeOwner.data || !betaOwner.data) return

      // Upgrade their workspaces
      const acmeWs = store.getUserWorkspaces(acmeOwner.data.id)[0]
      const betaWs = store.getUserWorkspaces(betaOwner.data.id)[0]
      if (!acmeWs || !betaWs) return

      store.upgradeWorkspaceTier(acmeWs.id, 'pro')
      store.upgradeWorkspaceTier(betaWs.id, 'pro')

      // Create projects in each workspace
      const acmeProj = store.createProject(acmeWs.id, acmeOwner.data.id, 'Acme Website Redesign')
      const betaProj = store.createProject(betaWs.id, betaOwner.data.id, 'Beta Platform')

      if (!acmeProj.data || !betaProj.data) return

      // Register consultant (gets their own workspace)
      const consultant = store.registerUser('consultant@freelance.com')
      if (!consultant.data) return

      // Invite consultant to PROJECTS (not workspace) - demonstrates orthogonal membership
      store.inviteToProject(acmeProj.data.id, consultant.data.email, 'external', acmeOwner.data.id)
      store.inviteToProject(betaProj.data.id, consultant.data.email, 'internal', betaOwner.data.id)

      // Note: Consultant is NOT a workspace member of either Acme or Beta
      // They only have project-level access
      store.logEvent('Orthogonal membership demo', 'Consultant has project access without workspace membership')
    },
  },
  {
    id: 'team-oversight',
    name: 'Team Workspace Oversight',
    description: 'Workspace owners, members, and public projects',
    run: () => {
      const store = useSimulatorStore.getState()
      store.reset()

      // Create main workspace owner
      const carol = store.registerUser('carol@megacorp.com')
      if (!carol.data) return

      // Upgrade to enterprise for public projects
      const carolWs = store.getUserWorkspaces(carol.data.id)[0]
      if (!carolWs) return
      store.upgradeWorkspaceTier(carolWs.id, 'enterprise')

      // Rename workspace (by creating a new one for clarity)
      const ws = store.createWorkspace(carol.data.id, 'MegaCorp Engineering', 'enterprise')
      if (!ws.data) return

      // Invite co-owners
      store.inviteToWorkspace(ws.data.id, 'dave@megacorp.com', 'owner', carol.data.id)
      store.inviteToWorkspace(ws.data.id, 'eve@megacorp.com', 'owner', carol.data.id)

      // Invite regular members
      store.inviteToWorkspace(ws.data.id, 'frank@megacorp.com', 'member', carol.data.id)
      store.inviteToWorkspace(ws.data.id, 'grace@megacorp.com', 'member', carol.data.id)

      // Create various projects (only owners can create)
      const projAlpha = store.createProject(ws.data.id, carol.data.id, 'Project Alpha')
      const projBeta = store.createProject(ws.data.id, carol.data.id, 'Project Beta')
      store.createProject(ws.data.id, carol.data.id, 'Project Gamma')

      if (!projAlpha.data || !projBeta.data) return

      // Make Project Alpha public (visible to all workspace members)
      store.setProjectPublic(projAlpha.data.id, true, carol.data.id)

      // Add Dave to Project Beta as collaborator
      const dave = store.getUserByEmail('dave@megacorp.com')
      if (dave) {
        store.inviteToProject(projBeta.data.id, dave.email, 'internal', carol.data.id)
      }

      store.logEvent('Public project demo', 'Project Alpha is public - all workspace members can see it')
    },
  },
  {
    id: 'orthogonal-membership',
    name: 'Orthogonal Membership Demo',
    description: 'Project collaborators without workspace membership',
    run: () => {
      const store = useSimulatorStore.getState()
      store.reset()

      // Create workspace owner
      const owner = store.registerUser('owner@company.com')
      if (!owner.data) return

      const ownerWs = store.getUserWorkspaces(owner.data.id)[0]
      if (!ownerWs) return
      store.upgradeWorkspaceTier(ownerWs.id, 'pro')

      // Create a project
      const proj = store.createProject(ownerWs.id, owner.data.id, 'Client Project')
      if (!proj.data) return

      // Invite external collaborators directly to project
      // They will NOT be workspace members
      store.inviteToProject(proj.data.id, 'client@external.com', 'external', owner.data.id)
      store.inviteToProject(proj.data.id, 'contractor@freelance.com', 'internal', owner.data.id)

      // Also invite someone as workspace member
      store.inviteToWorkspace(ownerWs.id, 'employee@company.com', 'member', owner.data.id)

      // Now demonstrate: employee is workspace member but NOT on project
      // client and contractor are on project but NOT workspace members
      store.logEvent('Orthogonal membership', 'client@external.com and contractor@freelance.com have project access but are NOT workspace members')
      store.logEvent('Orthogonal membership', 'employee@company.com is a workspace member but NOT on any project')
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

      const aliceWs = store.getUserWorkspaces(alice.data.id)[0]
      if (!aliceWs) return

      const proj = store.createProject(aliceWs.id, alice.data.id, 'Important Project')
      if (!proj.data) return

      // Try to remove sole project owner (will fail)
      const removeResult = store.removeFromProject(proj.data.id, alice.data.id)
      if (!removeResult.success) {
        store.logEvent('Blocked action', removeResult.error ?? 'Cannot remove sole owner')
      }

      // Try to delete user who owns workspace (will fail)
      const deleteResult = store.deleteUser(alice.data.id)
      if (!deleteResult.success) {
        store.logEvent('Blocked action', deleteResult.error ?? 'Cannot delete user with owned workspaces')
      }

      // Add collaborator, promote to co-owner, then original can leave
      store.inviteToProject(proj.data.id, 'bob@example.com', 'internal', alice.data.id)
      const bob = store.getUserByEmail('bob@example.com')
      if (bob) {
        store.changeProjectRole(proj.data.id, bob.id, 'owner')
        store.logEvent('Ownership transferred', 'Bob promoted to co-owner')

        // Now alice can leave the project
        const leaveResult = store.removeFromProject(proj.data.id, alice.data.id)
        if (leaveResult.success) {
          store.logEvent('Owner left project', 'Alice left after promoting Bob')
        }

        // But Alice still can't be deleted - she owns the workspace
        const deleteResult2 = store.deleteUser(alice.data.id)
        if (!deleteResult2.success) {
          store.logEvent('Still blocked', deleteResult2.error ?? 'Still owns workspace')
        }

        // Invite Bob to workspace as owner
        store.inviteToWorkspace(aliceWs.id, bob.email, 'owner', alice.data.id)

        // Now Alice can leave workspace
        const leaveWsResult = store.removeFromWorkspace(aliceWs.id, alice.data.id)
        if (leaveWsResult.success) {
          store.logEvent('Owner left workspace', 'Alice left after adding Bob as co-owner')
        }

        // Now Alice can be deleted
        const finalDelete = store.deleteUser(alice.data.id)
        if (finalDelete.success) {
          store.logEvent('User deleted', 'Alice successfully deleted after transferring all ownership')
        }
      }
    },
  },
  {
    id: 'public-projects',
    name: 'Public Projects Demo',
    description: 'Shows how public projects work with workspace tiers',
    run: () => {
      const store = useSimulatorStore.getState()
      store.reset()

      // Create user with free workspace
      const owner = store.registerUser('owner@startup.com')
      if (!owner.data) return

      const ws = store.getUserWorkspaces(owner.data.id)[0]
      if (!ws) return

      // Create a project
      const proj = store.createProject(ws.id, owner.data.id, 'Shared Resources')
      if (!proj.data) return

      // Try to make it public (will fail on free tier)
      const publicResult = store.setProjectPublic(proj.data.id, true, owner.data.id)
      if (!publicResult.success) {
        store.logEvent('Tier limit', publicResult.error ?? 'Public projects require upgrade')
      }

      // Upgrade to pro
      store.upgradeWorkspaceTier(ws.id, 'pro')

      // Now can make it public
      const publicResult2 = store.setProjectPublic(proj.data.id, true, owner.data.id)
      if (publicResult2.success) {
        store.logEvent('Project now public', 'Shared Resources is now visible to all workspace members')
      }

      // Add some workspace members who will see the public project
      store.inviteToWorkspace(ws.id, 'member1@startup.com', 'member', owner.data.id)
      store.inviteToWorkspace(ws.id, 'member2@startup.com', 'member', owner.data.id)

      store.logEvent('Public project visibility', 'member1 and member2 can see Shared Resources because it is public')
    },
  },
]

export function runScenario(id: string) {
  const scenario = scenarios.find(s => s.id === id)
  if (scenario) {
    scenario.run()
  }
}
