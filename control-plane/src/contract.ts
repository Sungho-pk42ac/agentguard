// Single source of truth for the wire contract: re-export the CLI's canonical
// schema so the report agent (client) and the control plane (server) validate
// against the EXACT same zod object. No duplication -> no drift. The
// contract-parity test asserts this re-export equals the CLI module.
export * from '../../src/contract/report-payload.js'
