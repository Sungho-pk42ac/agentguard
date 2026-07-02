import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import { z } from 'zod'
import { scanInput } from './core.js'

const DEFAULT_PORT = 8787
const MAX_BODY_BYTES = 1_048_576
const scanRequestSchema = z.object({
  mode: z.enum(['diff', 'mcp', 'log', 'text']),
  input: z.string(),
  lang: z.enum(['ko', 'en']).optional(),
})

export interface ServeOptions {
  readonly port?: number
  readonly host?: string
}

export async function startPreviewServer(options: ServeOptions = {}): Promise<Server> {
  const host = options.host ?? '127.0.0.1'
  const port = options.port ?? DEFAULT_PORT
  const server = createServer((request, response) => {
    handleRequest(request, response).catch((error: unknown) => {
      writeJson(response, 500, { error: 'internal server error' })
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Unhandled request error: ${message}`)
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      server.off('error', reject)
      const address = server.address()
      const actualPort = typeof address === 'object' && address !== null ? address.port : port
      console.log(`AgentGuard local preview: http://${host}:${actualPort}`)
      resolve()
    })
  })

  return server
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  try {
    const url = new URL(request.url ?? '/', 'http://127.0.0.1')
    if (request.method === 'GET' && url.pathname === '/') {
      writeHtml(response, demoPage())
      return
    }
    if (request.method === 'GET' && url.pathname === '/healthz') {
      writeJson(response, 200, { ok: true })
      return
    }
    if (request.method === 'POST' && url.pathname === '/api/scan') {
      await handleScan(request, response)
      return
    }
    writeJson(response, 404, { error: 'not found' })
  } catch (error: unknown) {
    if (error instanceof RequestError) {
      writeJson(response, 400, { error: error.message })
      return
    }
    writeJson(response, 500, { error: 'internal server error' })
  }
}

async function handleScan(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const body = await readRequestBody(request)
  const parsedJson: unknown = parseJsonBody(body)
  const parsedRequest = scanRequestSchema.safeParse(parsedJson)
  if (!parsedRequest.success) {
    writeJson(response, 400, { error: 'expected JSON body with mode, input, and optional lang' })
    return
  }
  writeJson(response, 200, scanInput(parsedRequest.data.mode, parsedRequest.data.input, { lang: parsedRequest.data.lang }))
}

function readRequestBody(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    let receivedBytes = 0
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      receivedBytes += Buffer.byteLength(chunk)
      if (receivedBytes > MAX_BODY_BYTES) {
        reject(new RequestError('request body too large'))
        request.destroy()
        return
      }
      body += chunk
    })
    request.on('end', () => {
      resolve(body)
    })
    request.on('error', reject)
  })
}

function parseJsonBody(body: string): unknown {
  try {
    const parsed: unknown = JSON.parse(body)
    return parsed
  } catch (error: unknown) {
    if (error instanceof SyntaxError) throw new RequestError('invalid JSON')
    throw error
  }
}

function writeJson(response: ServerResponse, statusCode: number, body: unknown): void {
  if (!canWriteResponse(response)) return
  try {
    response.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' })
    response.end(`${JSON.stringify(body)}\n`)
  } catch {
    // The client may close the socket before an error response can be sent.
  }
}

function writeHtml(response: ServerResponse, body: string): void {
  if (!canWriteResponse(response)) return
  try {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(body)
  } catch {
    // The client may close the socket before the page can be sent.
  }
}

function canWriteResponse(response: ServerResponse): boolean {
  return !response.destroyed && response.writable && !response.headersSent
}

function demoPage(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>AgentGuard 로컬 SaaS 미리보기</title>
  <style>
    :root { color-scheme: light; --ink: #162033; --muted: #5f6b7a; --line: #d8dee8; --panel: #ffffff; --accent: #1368e8; --soft: #eef5ff; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: var(--ink); background: #f6f8fb; }
    main { width: min(960px, calc(100% - 32px)); margin: 0 auto; padding: 40px 0; }
    h1 { margin: 0 0 12px; font-size: clamp(30px, 5vw, 48px); line-height: 1.08; letter-spacing: 0; }
    p { color: var(--muted); line-height: 1.65; }
    form, .result, .hint { background: var(--panel); border: 1px solid var(--line); border-radius: 8px; padding: 18px; }
    label { display: block; font-weight: 700; margin-bottom: 8px; }
    textarea { width: 100%; min-height: 220px; resize: vertical; border: 1px solid var(--line); border-radius: 6px; padding: 12px; font: 14px/1.5 ui-monospace, SFMono-Regular, Consolas, monospace; }
    .controls { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; margin-top: 14px; }
    select, button { min-height: 40px; border-radius: 6px; border: 1px solid var(--line); padding: 0 12px; background: #fff; color: var(--ink); }
    button { border-color: var(--accent); background: var(--accent); color: #fff; font-weight: 700; cursor: pointer; }
    button:focus-visible, select:focus-visible, textarea:focus-visible { outline: 3px solid #9dc2ff; outline-offset: 2px; }
    .result { margin-top: 16px; white-space: pre-wrap; overflow-wrap: anywhere; }
    .hint { margin-top: 16px; background: var(--soft); }
    code, pre { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; }
    pre { overflow: auto; margin: 0; }
  </style>
</head>
<body>
  <main>
    <h1>AgentGuard 로컬 SaaS 미리보기</h1>
    <p>브라우저나 API에서 기존 CLI 스캐너를 그대로 실행해 MCP 설정, PR diff, 에이전트 로그, 일반 텍스트를 점검합니다. 이 화면은 로컬 테스트 전용입니다.</p>
    <form id="scan-form">
      <label for="input">스캔할 입력</label>
      <textarea id="input" name="input">{"mcpServers":{"filesystem":{"args":["--allow-write","/"],"env":{"GITHUB_TOKEN":"$GITHUB_TOKEN"}}}}</textarea>
      <div class="controls">
        <label for="mode">mode
          <select id="mode" name="mode">
            <option value="mcp">mcp</option>
            <option value="diff">diff</option>
            <option value="log">log</option>
            <option value="text">text</option>
          </select>
        </label>
        <button type="submit">Scan</button>
      </div>
    </form>
    <section class="result" id="result" aria-live="polite">결과가 여기에 표시됩니다.</section>
    <section class="hint">
      <label>curl/API hint</label>
      <pre><code>curl -s http://127.0.0.1:8787/api/scan \\
  -H 'content-type: application/json' \\
  -d '{"mode":"mcp","input":"{\\"mcpServers\\":{}}"}'</code></pre>
    </section>
  </main>
  <script>
    const form = document.querySelector('#scan-form');
    const result = document.querySelector('#result');
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      result.textContent = '스캔 중...';
      const formData = new FormData(form);
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ mode: formData.get('mode'), input: formData.get('input'), lang: 'ko' }),
      });
      const body = await response.json();
      result.textContent = response.ok ? body.markdown : body.error;
    });
  </script>
</body>
</html>`
}

class RequestError extends Error {}
