# Policy files

AgentGuard supports YAML and JSON policy files through `--policy`.

```bash
agentguard scan-files . --policy examples/agent-policy.yaml
agentguard scan-diff --policy agent-policy.yaml < pr.diff
agentguard scan-log --policy agent-policy.yaml < transcript.log
agentguard scan-mcp --policy agent-policy.yaml < config.json
```

If `--policy` is omitted, AgentGuard looks for a local policy file such as `agent-policy.yaml`, `agent-policy.yml`, or `agent-policy.json` in the current working tree or nearest parent.

## Example policy

See [`examples/agent-policy.yaml`](../examples/agent-policy.yaml).

```yaml
deny_reads:
  - "**/.env"
  - "**/.ssh/**"
approval_required_operations:
  - "git push --force"
mcp:
  denied_servers:
    - filesystem
  approval_required_tools:
    - shell
```

### Read-only filesystem MCP example

See [`examples/agent-policy.readonly.yaml`](../examples/agent-policy.readonly.yaml) for teams that want to allow a
filesystem MCP server but keep it effectively read-only. It overrides the default `mcp.deny_servers` list to permit
`filesystem` (instead of denying the whole server), then guards the write-capable tools individually:

```yaml
overrides:
  mcp:
    deny_servers:
      - postgres
      - supabase
      - github
      - slack
      - google
      - drive
deny_read:
  - .aws/**
  - .kube/**
  - .gnupg/**
mcp:
  deny_tools:
    - filesystem.delete_file
  require_approval_tools:
    - filesystem.write_file
    - filesystem.move_file
    - filesystem.create_directory
```

## Supported shapes

AgentGuard intentionally accepts several aliases so teams can write policy files in the language they already use.

### Denied read paths

```yaml
deny_reads:
  - "**/.env"
  - "**/.ssh/**"
```

Accepted aliases include `deny_reads`, `denied_reads`, `denied_read`, and hyphenated or camelCase variants.

### Approval-required operations

```yaml
approval_required_operations:
  - "git push --force"
  - "rm -rf"
```

These patterns are used when scanning agent transcripts and shell logs.

### MCP permissions

```yaml
mcp:
  denied_servers:
    - filesystem
  approval_required_tools:
    - shell
```

This lets teams flag sensitive MCP integrations or tool access that should require review.

## Safety behavior

Policy parsing is defensive:

- malformed YAML/JSON fails closed with a clear error
- duplicate or conflicting aliases are rejected
- YAML aliases/custom tags/prototype-pollution keys are rejected
- secret-shaped policy values are redacted in findings
