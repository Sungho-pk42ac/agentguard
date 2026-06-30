# AgentGuard 위험 리포트

**판정:** BLOCK
**위험 점수:** 14
**탐지 건수:** 4

| 심각도 | 분류 | 파일 | 탐지 내용 | 증거 |
|---|---|---|---|---|
| critical | secret | diff | OpenAI 형식 API 키 | `sk-p…0000` |
| critical | secret | diff | Anthropic API 키 | `sk-a…0000` |
| high | dangerous-command | diff | 금지된 command pattern: rm -rf | `rm -rf` |
| high | mcp-risk | diff | MCP 서버가 credential-like 환경 변수를 전달받음 | `credential env` |

## 권장 조치
- **OpenAI 형식 API 키:** 비밀 값을 제거하고 회전한 뒤 secret manager나 환경 변수에서 불러오세요.
- **Anthropic API 키:** 비밀 값을 제거하고 회전한 뒤 secret manager나 환경 변수에서 불러오세요.
- **금지된 command pattern: rm -rf:** 사람의 승인을 요구하거나 더 안전하게 scope가 제한된 command로 대체하세요.
- **MCP 서버가 credential-like 환경 변수를 전달받음:** 최소 권한 token을 사용하고 write scope를 피하며 agent session 후 credential을 회전하세요.
