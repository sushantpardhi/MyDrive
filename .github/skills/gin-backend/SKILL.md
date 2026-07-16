---
name: gin-backend
description: "Scaffold and implement Go backend code using the Gin framework. Use when: creating Gin REST API, adding Gin route or handler, Gin middleware, Gin router group, Gin request binding, Gin response helpers, Gin error handling, Gin server setup, Go Gin project structure, gin.Context, gin.Engine, gin.RouterGroup, ShouldBindJSON, AbortWithStatusJSON."
argument-hint: "Describe what to build — e.g. 'scaffold a CRUD API for users', 'add JWT auth middleware', 'add file upload endpoint'"
---

# Gin Backend Skill

Scaffolds and implements production-ready Go backend code with the [Gin](https://github.com/gin-gonic/gin) HTTP framework, following idiomatic patterns and OWASP security practices.

## When to Use

- Creating a new Gin REST API or microservice
- Adding routes, handler functions, or middleware to an existing Gin project
- Structuring a Gin project (packages, layers, wiring)
- Implementing request binding, validation, and structured responses
- Writing Gin middleware (auth, logging, recovery, rate-limiting)

---

## Procedure

### Step 1 — Understand the Existing Codebase

Before writing any code:

1. Check `go.mod` for the Go version and existing dependencies (especially whether `github.com/gin-gonic/gin` is already imported).
2. Read the existing `main.go` or router setup file to understand how routes are registered.
3. Identify the project layout (flat vs. `handler/service/repository` layered).

### Step 2 — Project Layout

Use this standard layout for new Gin projects or when adding new layers:

```
.
├── main.go                  # Entry point — wires everything and starts the server
├── go.mod
├── go.sum
├── config/
│   └── config.go            # Env-based config struct, loaded at startup
├── handler/
│   └── user.go              # Gin handler functions (thin — delegate to service)
├── middleware/
│   ├── auth.go              # JWT / session auth middleware
│   ├── logger.go            # Structured request logger
│   └── recovery.go          # Panic recovery → 500
├── service/
│   └── user.go              # Business logic (no gin.Context here)
├── repository/
│   └── user.go              # DB queries (parameterized only)
├── model/
│   └── user.go              # Domain structs + JSON tags
└── router/
    └── router.go            # Route registration, middleware attachment
```

### Step 3 — Server Wiring (`main.go`)

```go
package main

import (
    "context"
    "errors"
    "log/slog"
    "net/http"
    "os"
    "os/signal"
    "syscall"
    "time"

    "github.com/gin-gonic/gin"
    "myapp/router"
)

func main() {
    // Fail fast on missing required config
    port := os.Getenv("PORT")
    if port == "" {
        port = "8080"
    }

    r := gin.New() // Use gin.New(), not gin.Default() — attach middleware explicitly
    router.Register(r)

    srv := &http.Server{
        Addr:         ":" + port,
        Handler:      r,
        ReadTimeout:  10 * time.Second,
        WriteTimeout: 10 * time.Second,
        IdleTimeout:  60 * time.Second,
    }

    go func() {
        slog.Info("server starting", "port", port)
        if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
            slog.Error("server error", "err", err)
            os.Exit(1)
        }
    }()

    quit := make(chan os.Signal, 1)
    signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
    <-quit

    ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
    defer cancel()
    if err := srv.Shutdown(ctx); err != nil {
        slog.Error("graceful shutdown failed", "err", err)
    }
}
```

### Step 4 — Router Registration

```go
// router/router.go
package router

import (
    "github.com/gin-gonic/gin"
    "myapp/handler"
    "myapp/middleware"
)

func Register(r *gin.Engine) {
    r.Use(middleware.Logger())
    r.Use(middleware.Recovery())

    v1 := r.Group("/api/v1")
    {
        users := v1.Group("/users")
        users.Use(middleware.Auth())
        {
            users.GET("",        handler.ListUsers)
            users.POST("",       handler.CreateUser)
            users.GET("/:id",    handler.GetUser)
            users.PUT("/:id",    handler.UpdateUser)
            users.DELETE("/:id", handler.DeleteUser)
        }
    }
}
```

### Step 5 — Handler Pattern

Handlers must be thin — validate input, call service, write response.

```go
// handler/user.go
package handler

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "myapp/model"
    "myapp/service"
)

type UserHandler struct {
    svc service.UserService
}

func NewUserHandler(svc service.UserService) *UserHandler {
    return &UserHandler{svc: svc}
}

func (h *UserHandler) CreateUser(c *gin.Context) {
    var req model.CreateUserRequest
    if err := c.ShouldBindJSON(&req); err != nil {
        c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{"error": err.Error()})
        return
    }

    user, err := h.svc.CreateUser(c.Request.Context(), req)
    if err != nil {
        c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{"error": "internal error"})
        return
    }

    c.JSON(http.StatusCreated, user)
}
```

> **Rule:** Never put business logic or DB queries directly in handlers.

### Step 6 — Request Binding & Validation

Use struct tags for binding and `binding:"required"` for validation:

```go
// model/user.go
package model

type CreateUserRequest struct {
    Name     string `json:"name"     binding:"required,min=2,max=100"`
    Email    string `json:"email"    binding:"required,email"`
    Password string `json:"password" binding:"required,min=8"`
}

type UserResponse struct {
    ID    string `json:"id"`
    Name  string `json:"name"`
    Email string `json:"email"`
}
```

Gin uses `go-playground/validator` under the hood. Never access raw form values without binding.

### Step 7 — Middleware

**Auth middleware pattern:**

```go
// middleware/auth.go
package middleware

import (
    "net/http"
    "strings"

    "github.com/gin-gonic/gin"
)

const UserIDKey = "userID"

func Auth() gin.HandlerFunc {
    return func(c *gin.Context) {
        header := c.GetHeader("Authorization")
        if !strings.HasPrefix(header, "Bearer ") {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "missing token"})
            return
        }
        token := strings.TrimPrefix(header, "Bearer ")

        userID, err := validateToken(token) // your JWT validation logic
        if err != nil {
            c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{"error": "invalid token"})
            return
        }

        c.Set(UserIDKey, userID)
        c.Next()
    }
}
```

**Structured logger middleware:**

```go
// middleware/logger.go
package middleware

import (
    "log/slog"
    "time"

    "github.com/gin-gonic/gin"
)

func Logger() gin.HandlerFunc {
    return func(c *gin.Context) {
        start := time.Now()
        c.Next()
        slog.Info("request",
            "method",  c.Request.Method,
            "path",    c.Request.URL.Path,
            "status",  c.Writer.Status(),
            "latency", time.Since(start),
            "ip",      c.ClientIP(),
        )
    }
}
```

### Step 8 — Error Response Convention

Use a consistent error envelope across all endpoints:

```go
// Standard error response — always use this shape
c.AbortWithStatusJSON(status, gin.H{"error": "<user-safe message>"})

// Never leak internal errors to the client:
// BAD:  c.JSON(500, gin.H{"error": err.Error()})
// GOOD: log the real error server-side, return generic message to client
```

### Step 9 — Security Checklist

Before finalising any handler or middleware:

- [ ] All inputs are bound via `ShouldBindJSON` / `ShouldBindQuery` with `binding:` tags — never read raw `c.PostForm` without validation
- [ ] SQL queries use parameterized placeholders — no string interpolation
- [ ] Tokens generated with `crypto/rand`, not `math/rand`
- [ ] HTTP server has `ReadTimeout`, `WriteTimeout`, `IdleTimeout` set
- [ ] Sensitive fields (passwords, tokens) are never logged or included in JSON responses
- [ ] `gin.New()` used instead of `gin.Default()` so panic recovery is explicit
- [ ] CORS configured restrictively if the API is browser-facing

### Step 10 — Testing Handlers

Use `net/http/httptest` with `gin.New()` — no live server needed:

```go
func TestCreateUser(t *testing.T) {
    gin.SetMode(gin.TestMode)
    r := gin.New()
    
    mockSvc := &mockUserService{}
    h := handler.NewUserHandler(mockSvc)
    r.POST("/users", h.CreateUser)

    body := `{"name":"Alice","email":"alice@example.com","password":"secret123"}`
    req := httptest.NewRequest(http.MethodPost, "/users", strings.NewReader(body))
    req.Header.Set("Content-Type", "application/json")
    w := httptest.NewRecorder()

    r.ServeHTTP(w, req)

    assert.Equal(t, http.StatusCreated, w.Code)
}
```

---

## Quality Criteria (Definition of Done)

- [ ] Routes are registered under a versioned group (`/api/v1/...`)
- [ ] Handlers are thin — no business logic, no direct DB calls
- [ ] All request structs use `binding:` tags for validation
- [ ] Middleware is attached explicitly via `r.Use()` or group-level `Use()`
- [ ] Error responses use a consistent `{"error": "..."}` envelope
- [ ] Server uses `gin.New()` with explicit middleware, not `gin.Default()`
- [ ] Graceful shutdown with context timeout is wired in `main.go`
- [ ] Handler tests written using `httptest`

---

## Reference Files

- [Project layout template](./assets/project-layout.txt)
- [Security checklist](./references/security.md)
