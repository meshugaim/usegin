# Design Task Quick Reference

## Feature Toggle

Enable new UI:
```bash
# Set cookie in browser
document.cookie = "effi-new-ui=true; path=/"
```

Code check:
- Client: `newUI` prop passed from server
- Server: `await isNewUIEnabledServer()` from `@/lib/feature-flags-server`

## Routes

- `/workspaces` - workspace list
- `/workspaces/[workspaceId]` - workspace detail (projects list)
- `/projects/[projectId]/chat` - project chat
- `/projects/[projectId]/settings` - share project page

## Figma Screenshots

```
docs/figma_ss/
├── chat/
├── settings_etc/
└── workspace/
```

## Custom Icons

```
nextjs-app/components/icons/
├── index.ts          # exports all
├── projects-icon.tsx
├── files-icon.tsx
├── ai-icon.tsx
├── bolt-icon.tsx
└── ...
```

Usage: `import { ProjectsIcon, FilesIcon } from "@/components/icons"`

## MCP Servers

- `mcp__figma__get_figma_data` - fetch Figma designs
- `mcp__figma__download_figma_images` - download images/icons
- `mcp__playwright__browser_*` - visual testing

## Styling

Effi tokens: `text-effi-deep-denim`, `text-effi-gray-text`, `font-effi`, `bg-effi-card-fill`, `border-effi-border`, `text-effi-primary`
