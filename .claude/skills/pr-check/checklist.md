## MCA PDF Scrubber PR Checklist

- [ ] Frontend tests added/updated for React component changes
- [ ] Backend tests added/updated for Laravel service/controller changes
- [ ] Python service tests added/updated for API changes
- [ ] No console.log or debugger statements in production code
- [ ] PII detection regex patterns still correctly match expected formats
- [ ] API contract between frontend/backend unchanged or properly versioned
- [ ] API contract between backend/Python service unchanged or properly versioned
- [ ] Docker build succeeds (docker-compose build)
- [ ] No hardcoded credentials or secrets in code
- [ ] .env.example updated if new environment variables added