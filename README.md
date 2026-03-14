# Dispatch
Agent Dispatch Pentester - Security Agent with Slack Integration

## 🚀 Features

- **Slack Communication** - Message your agent through Slack with natural language commands
- **Security Scanning** - Automated vulnerability detection in OWASP Juice Shop and target applications
- **GitHub Integration** - Automatically create security issues with findings
- **Linear Integration** - Manage security tickets in Linear
- **Observability** - Built-in Sentry error tracking and Datadog APM tracing
- **Socket Mode** - No public endpoint needed, works behind firewalls

## 📱 Slack Integration

### Quick Start

```bash
# 1. Setup Slack app (see SLACK_QUICK_START.md)
# 2. Configure environment
cp .env.example .env
# Edit .env with your tokens

# 3. Install and run
cd backend
pnpm install
pnpm slack
```

### Usage Examples

```
@Dispatch help                    - Show available commands
@Dispatch scan /api/login        - Scan an endpoint
@Dispatch juice test /rest/admin - Test Juice Shop endpoint
@Dispatch create issue XSS Bug   - Create GitHub issue
```

### Documentation

- **[SLACK_QUICK_START.md](./SLACK_QUICK_START.md)** - 30-second setup guide
- **[SLACK_INTEGRATION_GUIDE.md](./SLACK_INTEGRATION_GUIDE.md)** - Complete setup walkthrough
- **[SLACK_TECHNICAL_REFERENCE.md](./SLACK_TECHNICAL_REFERENCE.md)** - For developers
- **[SLACK_IMPLEMENTATION_EXAMPLES.md](./SLACK_IMPLEMENTATION_EXAMPLES.md)** - Code examples
- **[SLACK_IMPLEMENTATION_CHECKLIST.md](./SLACK_IMPLEMENTATION_CHECKLIST.md)** - Implementation tracker
- **[.env.example](./.env.example)** - Environment variables template

## 🔑 Required Environment Variables

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-...
SLACK_APP_TOKEN=xapp-...

# GitHub (optional)
GITHUB_TOKEN=ghp_...
GITHUB_REPO=owner/repo

# Target Application
JUICE_SHOP_URL=http://localhost:3000

# Observability (optional)
SENTRY_DSN=https://...
DD_AGENT_HOST=localhost
```

## 📦 Project Structure

```
Dispatch/
├── backend/              - Node.js/TypeScript backend
│   ├── src/
│   │   ├── slack/       - Slack integration module
│   │   ├── orchestrator/- Security scanner
│   │   └── github/      - GitHub integration
│   └── package.json
├── frontend/            - Next.js dashboard (optional)
├── sample-app/          - Test application
└── docs/               - Additional documentation
```

## 🛠️ Development

### Commands

```bash
cd backend

# Install dependencies
pnpm install

# Run Slack agent
pnpm slack

# Run security scanner
pnpm scan ./target-app

# View dashboard
pnpm dashboard

# Run tests
pnpm test
```

### Architecture

The Slack agent works by:
1. Connecting to Slack via Socket Mode (WebSocket)
2. Listening for mentions and direct messages
3. Routing commands to appropriate handlers
4. Processing security logic
5. Formatting responses with Block Kit
6. Sending results back to Slack
7. Optionally creating GitHub issues or Linear tickets

## 🔐 Security

- **Token Management** - Sensitive tokens stored in `.env`, never committed to git
- **Input Validation** - User input sanitized before external API calls
- **Minimal Scopes** - Only requested OAuth scopes needed
- **Error Handling** - Graceful error handling with Sentry tracking
- **Rate Limiting** - Built-in rate limit handling from Slack

## 📊 Monitoring

- **Datadog APM** - Track performance and latency of agent operations
- **Sentry** - Automatic error and exception tracking
- **Slack Logs** - All activities logged with timestamps
- **Health Checks** - Monitor agent uptime and connectivity

## 🚀 Deployment

### Local Development
```bash
pnpm slack
```

### Production (with PM2)
```bash
pm2 start dist/slack/index.js --name dispatch-agent
pm2 logs dispatch-agent
```

## 📝 License

[Your License Here]

## 👥 Contributors

- Arsh Singh
- Mateo del Rio Lanse
- Jimmy Mulosmani
- Diya Sheth

## 📚 Additional Resources

- [Slack API Documentation](https://api.slack.com/)
- [Socket Mode](https://api.slack.com/socket-mode)
- [Block Kit Reference](https://api.slack.com/reference/block-kit)
- [OWASP Juice Shop](https://owasp.org/www-project-juice-shop/)
- [Datadog Documentation](https://docs.datadoghq.com/)
- [Sentry Documentation](https://docs.sentry.io/)

---

**Last Updated:** March 14, 2026
