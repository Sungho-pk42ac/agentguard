import assert from 'node:assert/strict'
import { once } from 'node:events'
import { request } from 'node:http'
import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'

interface HttpResponse {
  readonly statusCode: number
  readonly headers: Record<string, string | string[] | undefined>
  readonly body: string
}

interface ScanApiResponse {
  readonly verdict: string
  readonly findingCount: number
  readonly findings: readonly { readonly id: string }[]
  readonly markdown: string
}

async function startServer(): Promise<{ readonly baseUrl: string; readonly child: ChildProcessWithoutNullStreams; readonly stdout: () => string }> {
  const child = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts', 'serve', '--port=0'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let stdout = ''
  let stderr = ''
  child.stdout.setEncoding('utf8')
  child.stderr.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    stdout += chunk
  })
  child.stderr.on('data', (chunk: string) => {
    stderr += chunk
  })

  for (let attempt = 0; attempt < 50; attempt += 1) {
    const match = stdout.match(/http:\/\/127\.0\.0\.1:(\d+)/)
    if (match?.[1] !== undefined) return { baseUrl: `http://127.0.0.1:${match[1]}`, child, stdout: () => stdout }
    if (child.exitCode !== null) {
      throw new Error(`server exited early: ${stderr}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 50))
  }
  throw new Error(`server did not print a localhost URL. stdout=${stdout}`)
}

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const { baseUrl, child } = await startServer()
  try {
    await run(baseUrl)
  } finally {
    child.kill()
    await once(child, 'exit').catch(() => undefined)
  }
}

function httpRequest(url: string, options: { readonly method?: string; readonly body?: string } = {}): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      {
        method: options.method ?? 'GET',
        headers: options.body === undefined ? undefined : {
          'content-type': 'application/json',
          'content-length': Buffer.byteLength(options.body),
        },
      },
      (res) => {
        let body = ''
        res.setEncoding('utf8')
        res.on('data', (chunk: string) => {
          body += chunk
        })
        res.on('end', () => {
          resolve({ statusCode: res.statusCode ?? 0, headers: res.headers, body })
        })
      },
    )
    req.on('error', reject)
    if (options.body !== undefined) req.write(options.body)
    req.end()
  })
}

function isScanApiResponse(value: unknown): value is ScanApiResponse {
  if (value === null || typeof value !== 'object') return false
  if (!('verdict' in value) || !('findingCount' in value) || !('findings' in value) || !('markdown' in value)) return false
  return typeof value.verdict === 'string' &&
    typeof value.findingCount === 'number' &&
    Array.isArray(value.findings) &&
    value.findings.every((finding) => finding !== null && typeof finding === 'object' && 'id' in finding && typeof finding.id === 'string') &&
    typeof value.markdown === 'string'
}

test('serve health route returns ok JSON', async () => {
  await withServer(async (baseUrl) => {
    const response = await httpRequest(`${baseUrl}/healthz`)

    assert.equal(response.statusCode, 200)
    assert.match(String(response.headers['content-type']), /^application\/json/)
    assert.deepEqual(JSON.parse(response.body), { ok: true })
  })
})

test('serve startup prints an ASCII banner before the local URL', async () => {
  const { child, stdout } = await startServer()
  try {
    assert.match(stdout(), /___\s+__  ______/)
    assert.match(stdout(), /AgentOps Risk Gate :: PASS \/ REVIEW \/ BLOCK/)
    assert.match(stdout(), /AgentGuard local preview: http:\/\/127\.0\.0\.1:\d+/)
  } finally {
    child.kill()
    await once(child, 'exit').catch(() => undefined)
  }
})

test('serve scan route returns shared scanner report for risky MCP input', async () => {
  await withServer(async (baseUrl) => {
    const response = await httpRequest(`${baseUrl}/api/scan`, {
      method: 'POST',
      body: JSON.stringify({
        mode: 'mcp',
        input: '{"mcpServers":{"filesystem":{"args":["--allow-write","/"],"env":{"GITHUB_TOKEN":"$GITHUB_TOKEN"}}}}',
      }),
    })

    const body: unknown = JSON.parse(response.body)
    assert.ok(isScanApiResponse(body), 'expected scan API response shape')
    assert.equal(response.statusCode, 200)
    assert.equal(body.verdict, 'BLOCK')
    assert.equal(body.findingCount, body.findings.length)
    assert.ok(body.findings.some((finding) => finding.id === 'mcp-filesystem-wide-root'))
    assert.match(body.markdown, /^# AgentGuard 위험 리포트/)
  })
})

test('serve scan route rejects invalid modes with JSON error and no stack trace', async () => {
  await withServer(async (baseUrl) => {
    const response = await httpRequest(`${baseUrl}/api/scan`, {
      method: 'POST',
      body: JSON.stringify({ mode: 'files', input: 'hello' }),
    })

    assert.equal(response.statusCode, 400)
    assert.match(String(response.headers['content-type']), /^application\/json/)
    assert.match(response.body, /"error"/)
    assert.doesNotMatch(response.body, /src\/index\.ts|Error:/)
  })
})

test('serve static page is Korean-first and includes an API hint', async () => {
  await withServer(async (baseUrl) => {
    const response = await httpRequest(`${baseUrl}/`)

    assert.equal(response.statusCode, 200)
    assert.match(String(response.headers['content-type']), /^text\/html/)
    assert.match(response.body, /AgentGuard 로컬 SaaS 미리보기/)
    assert.match(response.body, /AgentOps Risk Gate :: PASS \/ REVIEW \/ BLOCK/)
    assert.match(response.body, /aria-label="AgentGuard ASCII banner"/)
    assert.match(response.body, /<textarea/)
    assert.match(response.body, /mode/)
    assert.match(response.body, /curl/)
  })
})

test('README and examples document the local SaaS preview without production claims', () => {
  const readme = readFileSync('README.md', 'utf8')
  const examples = readFileSync('docs/examples.md', 'utf8')

  assert.match(readme, /agentguard serve --port 8787/)
  assert.match(readme, /로컬 SaaS 미리보기/)
  assert.match(readme, /hosted production SaaS, auth, billing, database/)
  assert.match(examples, /Local SaaS preview/)
  assert.match(examples, /\/api\/scan/)
  assert.match(examples, /Supported API modes are `diff`, `mcp`, `log`, and `text`/)
  assert.doesNotMatch(`${readme}\n${examples}`, /https:\/\/agentguard\.(?:app|ai|com)|production-ready SaaS|customer uploads enabled/i)
})
