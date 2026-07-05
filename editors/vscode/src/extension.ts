import { execFile } from 'node:child_process'
import * as vscode from 'vscode'
import { findingToDiagnostic, parseScanJson, type MappedDiagnostic } from './diagnostics.js'

let diagnosticCollection: vscode.DiagnosticCollection | undefined

function severityToVsCode(name: MappedDiagnostic['severity']): vscode.DiagnosticSeverity {
  switch (name) {
    case 'Error':
      return vscode.DiagnosticSeverity.Error
    case 'Warning':
      return vscode.DiagnosticSeverity.Warning
    case 'Information':
      return vscode.DiagnosticSeverity.Information
    case 'Hint':
      return vscode.DiagnosticSeverity.Hint
  }
}

function toVsCodeDiagnostic(mapped: MappedDiagnostic): vscode.Diagnostic {
  const range = new vscode.Range(mapped.range.startLine, mapped.range.startChar, mapped.range.endLine, mapped.range.endChar)
  const diagnostic = new vscode.Diagnostic(range, mapped.message, severityToVsCode(mapped.severity))
  diagnostic.source = mapped.source
  diagnostic.code = mapped.code
  return diagnostic
}

function runScan(cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('agentguard', ['scan-files', '--json'], { cwd, maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      // agentguard exits non-zero when findings are present; stdout still has JSON in that case.
      if (stdout && stdout.trim()) {
        resolve(stdout)
        return
      }
      if (error) {
        reject(new Error(stderr || error.message))
        return
      }
      resolve(stdout)
    })
  })
}

async function scanWorkspace(collection: vscode.DiagnosticCollection): Promise<void> {
  const folders = vscode.workspace.workspaceFolders
  if (!folders || folders.length === 0) {
    vscode.window.showWarningMessage('AgentGuard: open a workspace folder to scan.')
    return
  }

  collection.clear()

  for (const folder of folders) {
    let stdout: string
    try {
      stdout = await runScan(folder.uri.fsPath)
    } catch (err) {
      vscode.window.showErrorMessage(`AgentGuard scan failed: ${(err as Error).message}`)
      continue
    }

    const findings = parseScanJson(stdout)
    const byFile = new Map<string, vscode.Diagnostic[]>()
    for (const finding of findings) {
      const mapped = findingToDiagnostic(finding)
      if (!mapped.file) continue
      const absolute = vscode.Uri.joinPath(folder.uri, mapped.file).fsPath
      const list = byFile.get(absolute) ?? []
      list.push(toVsCodeDiagnostic(mapped))
      byFile.set(absolute, list)
    }

    for (const [file, diagnostics] of byFile) {
      collection.set(vscode.Uri.file(file), diagnostics)
    }

    if (findings.some((finding) => finding.severity === 'critical')) {
      vscode.window.showErrorMessage('AgentGuard: critical findings detected. See Problems panel.')
    }
  }
}

export function activate(context: vscode.ExtensionContext): void {
  diagnosticCollection = vscode.languages.createDiagnosticCollection('agentguard')
  context.subscriptions.push(diagnosticCollection)

  const command = vscode.commands.registerCommand('agentguard.scan', () => {
    if (diagnosticCollection) void scanWorkspace(diagnosticCollection)
  })
  context.subscriptions.push(command)
}

export function deactivate(): void {
  diagnosticCollection?.dispose()
  diagnosticCollection = undefined
}
