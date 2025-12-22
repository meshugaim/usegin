# Session module

default *args:
    bun {{args}}

install:
    bun install

update:
    bun update

test:
    bun test

cli *args:
    bun run src/cli.ts {{args}}

pick *args:
    bun run src/cli.ts pick {{args}}

# Browse sessions interactively
find *args:
    bun run src/cli.ts find {{args}}

# Parse a session file
parse file:
    bun run src/cli.ts {{file}}
