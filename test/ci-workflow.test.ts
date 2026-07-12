import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import YAML from 'yaml'

type WorkflowStep = {
  run?: string
  uses?: string
  'working-directory'?: string
  with?: Record<string, unknown>
}

type WorkflowJob = {
  defaults?: { run?: { 'working-directory'?: string } }
  steps?: WorkflowStep[]
}

test('CI workflow gates the control-plane package typecheck and tests', () => {
  const workflow = YAML.parse(readFileSync('.github/workflows/ci.yml', 'utf8')) as { jobs?: Record<string, WorkflowJob> }

  const jobs = workflow.jobs ?? {}
  const controlPlaneJob = Object.entries(jobs).find(([name, job]) => {
    const text = JSON.stringify({ name, defaults: job.defaults ?? {}, steps: job.steps ?? [] })
    return /control-plane/i.test(text)
  })

  assert.notEqual(controlPlaneJob, undefined, 'CI must include an explicit control-plane job')
  const job = controlPlaneJob?.[1]
  assert.notEqual(job, undefined, 'CI must include an explicit control-plane job')
  const steps = job?.steps ?? []
  const runSteps = steps.map((step) => step.run).filter((run): run is string => typeof run === 'string')
  const joinedRuns = runSteps.join('\n')

  assert.match(joinedRuns, /npm ci/, 'control-plane job must install dependencies')
  assert.match(joinedRuns, /npm run typecheck/, 'control-plane job must run typecheck')
  assert.match(joinedRuns, /npm test/, 'control-plane job must run tests')

  const stepFor = (run: string) => steps.find((step) => step.run === run)
  assert.equal(stepFor('npm ci')?.['working-directory'], undefined, 'root npm ci must run from the repo root for shared CLI contract imports')
  assert.equal(stepFor('npm ci') !== undefined, true, 'control-plane job must install root dependencies for ../src imports')
  assert.equal(stepFor('npm run typecheck')?.['working-directory'], 'control-plane')
  assert.equal(stepFor('npm test')?.['working-directory'], 'control-plane')
  assert.ok(
    steps.some((step) => step.run === 'npm ci' && step['working-directory'] === 'control-plane'),
    'control-plane job must install control-plane dependencies in control-plane/',
  )
})
