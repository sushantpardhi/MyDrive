# Gin Security Checklist

## Input Validation
- [ ] All request bodies bound via `ShouldBindJSON` with `binding:` struct tags
- [ ] Query params bound via `ShouldBindQuery` — never read raw with `c.Query()` for required fields
- [ ] Path params validated for expected format (e.g. UUID) before use
- [ ] File uploads: validate MIME type, enforce max size with `c.Request.Body = http.MaxBytesReader(...)`

## SQL / Database
- [ ] All queries use parameterized placeholders (`$1`, `?`) — never string-interpolate user input
- [ ] ORM scopes / raw queries reviewed for N+1 and injection risks

## Authentication & Tokens
- [ ] Tokens generated with `crypto/rand` (not `math/rand`)
- [ ] JWT signature verified with a strong secret (HS256 min) or RS256 key pair
- [ ] Token expiry enforced; refresh token rotation implemented
- [ ] `Authorization: Bearer <token>` header checked in middleware, not in handlers

## HTTP Server Hardening
- [ ] `gin.New()` used — recovery middleware attached explicitly
- [ ] `ReadTimeout`, `WriteTimeout`, `IdleTimeout` set on `http.Server`
- [ ] `gin.SetMode(gin.ReleaseMode)` in production (disables debug output)
- [ ] CORS restricted to known origins if browser-facing (`github.com/gin-contrib/cors`)
- [ ] Rate limiting applied to public/auth endpoints

## Secrets & Logging
- [ ] No passwords, tokens, or PII logged at any level
- [ ] Secrets loaded from environment variables — never hardcoded
- [ ] Internal error messages never returned to clients; log server-side, return generic message

## Response Headers
- [ ] `X-Content-Type-Options: nosniff`
- [ ] `X-Frame-Options: DENY`
- [ ] `Content-Security-Policy` set for any HTML responses

## Dependency Management
- [ ] `go mod tidy` run; no unused dependencies
- [ ] `govulncheck ./...` passes with no known vulnerabilities
