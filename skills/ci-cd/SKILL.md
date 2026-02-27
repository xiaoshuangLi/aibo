---
name: ci-cd
description: CI/CD pipeline design and implementation. Use this skill when setting up GitHub Actions workflows, configuring quality gates, automating deployments, or adding CI checks (lint, test, build, security scan).
---

# CI/CD Skill

## 🎯 Purpose
Provides battle-tested CI/CD pipeline patterns for automating builds, tests, security scans, and deployments. Ensures every code change is validated before reaching production.

## 🚀 When to Use
- Setting up CI/CD for a new project
- Adding automated test execution to existing pipelines
- Configuring deployment automation
- Adding security scanning (npm audit, CodeQL, Trivy)
- Implementing quality gates (coverage thresholds, lint checks)
- Setting up matrix testing across multiple OS/versions
- Configuring environment-specific deployments (staging, production)

## 📁 Standard GitHub Actions Structure
```
.github/
  workflows/
    ci.yml          # Run on every PR and push to main
    release.yml     # Run on version tags
    security.yml    # Weekly security scanning
    deploy.yml      # Deploy on merge to main
```

## 🔧 CI Pipeline Template (Node.js)
```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  quality:
    name: Quality Checks
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Lint
        run: npm run lint
      
      - name: Type check
        run: npm run typecheck
      
      - name: Test with coverage
        run: npm run test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          token: ${{ secrets.CODECOV_TOKEN }}

  build:
    name: Build
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run build
      - name: Upload build artifact
        uses: actions/upload-artifact@v4
        with:
          name: dist
          path: dist/
```

## 🔒 Security Scan Template
```yaml
name: Security

on:
  schedule:
    - cron: '0 8 * * 1'  # Every Monday at 8am UTC
  push:
    branches: [main]

jobs:
  dependency-audit:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm audit --audit-level=high

  codeql:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: javascript
      - uses: github/codeql-action/analyze@v3
```

## 🚀 Deployment Template (with approval gate)
```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    environment: staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to staging
        run: ./scripts/deploy.sh staging
        env:
          DEPLOY_KEY: ${{ secrets.STAGING_DEPLOY_KEY }}

  deploy-production:
    environment: production  # Requires manual approval
    needs: deploy-staging
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to production
        run: ./scripts/deploy.sh production
        env:
          DEPLOY_KEY: ${{ secrets.PROD_DEPLOY_KEY }}
```

## ✅ Quality Gate Checklist
- [ ] All tests pass (0 failures)
- [ ] Test coverage ≥ configured threshold
- [ ] No lint errors
- [ ] TypeScript compilation succeeds
- [ ] `npm audit` has no high/critical vulnerabilities
- [ ] Build artifact is created successfully
- [ ] Secrets are managed via environment variables, not code

## 💡 Best Practices
- Use `npm ci` instead of `npm install` in CI (deterministic, no lockfile updates)
- Cache `node_modules` via `cache: 'npm'` in actions/setup-node
- Use `--audit-level=high` to fail only on high/critical npm vulnerabilities
- Pin action versions to a specific SHA for security (`uses: actions/checkout@abc123`)
- Set `timeout-minutes` on long-running jobs to prevent runaway billing
- Use matrix strategy for cross-platform testing when needed
