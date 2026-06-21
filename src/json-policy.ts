export function hasDuplicateJsonObjectKey(contents: string): boolean {
  const objectKeyStack: Array<Set<string> | undefined> = []
  for (let index = 0; index < contents.length; index += 1) {
    const char = contents[index]
    if (char === '{') objectKeyStack.push(new Set())
    else if (char === '[') objectKeyStack.push(undefined)
    else if (char === '}' || char === ']') objectKeyStack.pop()
    else if (char === '"') {
      const token = readJsonString(contents, index)
      index = token.nextIndex - 1
      if (nextJsonToken(contents, token.nextIndex) !== ':') continue

      const currentKeys = objectKeyStack[objectKeyStack.length - 1]
      if (!currentKeys) continue
      if (currentKeys.has(token.value)) return true
      currentKeys.add(token.value)
    }
  }
  return false
}

function readJsonString(contents: string, startIndex: number): { readonly value: string; readonly nextIndex: number } {
  let value = ''
  for (let index = startIndex + 1; index < contents.length; index += 1) {
    const char = contents[index]
    if (char === '"') return { value, nextIndex: index + 1 }
    if (char !== '\\') {
      value += char
      continue
    }

    const escaped = contents[index + 1]
    if (escaped === undefined) throw new SyntaxError('Unterminated JSON escape')
    if (escaped === 'u') {
      value += String.fromCharCode(Number.parseInt(contents.slice(index + 2, index + 6), 16))
      index += 5
      continue
    }

    value += decodeJsonEscape(escaped)
    index += 1
  }
  throw new SyntaxError('Unterminated JSON string')
}

function decodeJsonEscape(escaped: string): string {
  switch (escaped) {
    case '"':
    case '\\':
    case '/':
      return escaped
    case 'b':
      return '\b'
    case 'f':
      return '\f'
    case 'n':
      return '\n'
    case 'r':
      return '\r'
    case 't':
      return '\t'
    default:
      throw new SyntaxError('Invalid JSON escape')
  }
}

function nextJsonToken(contents: string, startIndex: number): string | undefined {
  for (let index = startIndex; index < contents.length; index += 1) {
    const char = contents[index]
    if (char !== ' ' && char !== '\n' && char !== '\r' && char !== '\t') return char
  }
  return undefined
}
