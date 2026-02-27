---
name: api-design
description: RESTful and GraphQL API design principles, versioning strategies, and contract-first development. Use this skill when designing new APIs, reviewing API contracts, or improving existing API design.
---

# API Design Skill

## 🎯 Purpose
Provides comprehensive API design guidelines for building consistent, intuitive, and evolvable APIs. Covers REST, GraphQL, and general API best practices aligned with industry standards (Google API Design Guide, Stripe, GitHub).

## 🚀 When to Use
- Designing a new REST or GraphQL API
- Reviewing an existing API for consistency issues
- Creating API documentation (OpenAPI/Swagger)
- Planning API versioning strategy
- Designing pagination and filtering patterns
- Handling authentication and authorization in APIs

## 🌐 REST API Design Principles

### Resource Naming
```
# Use nouns, not verbs
✅ GET /users
✅ GET /users/{id}/orders
❌ GET /getUser
❌ POST /createUser

# Use plural nouns for collections
✅ /users, /orders, /products
❌ /user, /order

# Use kebab-case for multi-word paths
✅ /order-items, /user-profiles
❌ /orderItems, /user_profiles
```

### HTTP Methods
| Method | Purpose | Idempotent | Safe |
|--------|---------|-----------|------|
| `GET` | Retrieve resource | ✅ | ✅ |
| `POST` | Create resource | ❌ | ❌ |
| `PUT` | Replace entire resource | ✅ | ❌ |
| `PATCH` | Partial update | ❌ | ❌ |
| `DELETE` | Delete resource | ✅ | ❌ |

### HTTP Status Codes
```
200 OK                  - Success (GET, PUT, PATCH)
201 Created             - Resource created (POST)
204 No Content          - Success with no body (DELETE)
400 Bad Request         - Invalid input (validation error)
401 Unauthorized        - Not authenticated
403 Forbidden           - Authenticated but not authorized
404 Not Found           - Resource doesn't exist
409 Conflict            - State conflict (duplicate, version mismatch)
422 Unprocessable Entity- Business logic validation failure
429 Too Many Requests   - Rate limit exceeded
500 Internal Server Error - Unexpected server error
```

### Standard Response Format
```typescript
// Success (single resource)
{
  "data": { "id": "1", "name": "Alice" },
  "meta": { "request_id": "abc123" }
}

// Success (collection with pagination)
{
  "data": [...],
  "pagination": {
    "total": 100,
    "page": 1,
    "per_page": 20,
    "next_cursor": "eyJpZCI6MjB9"
  }
}

// Error
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Email is required",
    "details": [
      { "field": "email", "message": "Email is required" }
    ]
  }
}
```

### Pagination Patterns
```
# Cursor-based (preferred for large datasets / real-time data)
GET /users?cursor=eyJpZCI6MjB9&limit=20

# Offset-based (simple, good for small datasets)
GET /users?page=2&per_page=20

# Avoid: numeric page + total count for large tables (expensive COUNT(*))
```

### Filtering and Sorting
```
# Filtering
GET /orders?status=pending&created_after=2024-01-01

# Sorting
GET /users?sort=-created_at,name   # - means descending

# Field selection (reduce payload size)
GET /users?fields=id,name,email
```

## 📐 API Versioning Strategy

### URL versioning (recommended for major breaking changes)
```
/v1/users
/v2/users  # Breaking change: different response structure
```

### Header versioning (for non-breaking evolution)
```
Accept: application/vnd.api+json;version=2
```

### Deprecation Process
1. Add `Deprecation: Sat, 01 Jan 2026 00:00:00 GMT` header
2. Add `Sunset: Sat, 01 Jul 2026 00:00:00 GMT` header
3. Notify API consumers with migration guide
4. Keep old version running until Sunset date
5. Return 410 Gone after Sunset

## 📝 OpenAPI/Swagger Documentation
```yaml
openapi: 3.0.0
info:
  title: User API
  version: 1.0.0
paths:
  /users/{id}:
    get:
      summary: Get user by ID
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
      responses:
        '200':
          description: User found
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/User'
        '404':
          description: User not found
```

## 🔐 Authentication Patterns
- **JWT Bearer tokens**: `Authorization: Bearer <token>` for stateless APIs
- **API Keys**: `X-API-Key: <key>` for server-to-server integrations
- **OAuth 2.0**: For third-party access delegation
- **mTLS**: For high-security internal service communication

## ✅ API Design Review Checklist
- [ ] Resources use nouns, not verbs
- [ ] HTTP methods used semantically correctly
- [ ] Consistent error response format
- [ ] Pagination on all list endpoints
- [ ] API versioning strategy defined
- [ ] Authentication/authorization documented
- [ ] Rate limiting headers included (`X-RateLimit-Limit`, `X-RateLimit-Remaining`)
- [ ] OpenAPI specification written
- [ ] Breaking vs non-breaking changes policy defined
