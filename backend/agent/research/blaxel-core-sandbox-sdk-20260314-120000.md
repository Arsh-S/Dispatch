# Research Topic: Blaxel TypeScript SDK (@blaxel/core) - Sandbox Management

**Research Date**: 2026-03-14
**Sources**: 8+ pages analyzed (npm, GitHub, official docs)
**Target SDK Version**: 0.2.66

---

## Executive Summary

The `@blaxel/core` npm package is Blaxel's TypeScript SDK for creating and managing sandboxes — persistent, near-instant compute environments designed for AI agents. Sandboxes resume from standby in under 25ms and scale to zero automatically after inactivity.

The SDK provides a `SandboxInstance` class with static factory methods (`create`, `get`, `createIfNotExists`) and instance-level sub-clients for the filesystem (`sandbox.fs.*`) and process execution (`sandbox.process.*`). Ports are configured at creation time or via preview URLs. TTL is set as a duration string (e.g., `"24h"`) in the creation payload.

Version 0.2.66 was published approximately in early March 2026 and is the current stable release.

---

## Installation

```bash
npm install @blaxel/core
# or
pnpm add @blaxel/core
# or
yarn add @blaxel/core
```

**Authentication** (required): Set environment variables before running any SDK calls:

```bash
export BL_WORKSPACE=your-workspace-name
export BL_API_KEY=your-api-key
```

Alternatively, credentials are picked up automatically from the Blaxel CLI config file if you have run `bl login`.

---

## Key Findings

### Finding 1: SandboxInstance API — Create, Get, Delete

The primary class is `SandboxInstance` imported from `@blaxel/core`.

**Create a new sandbox:**

```typescript
import { SandboxInstance } from "@blaxel/core";

const sandbox = await SandboxInstance.create({
  metadata: {
    name: "my-sandbox",
    labels: { env: "dev", project: "my-project" }
  },
  spec: {
    image: "blaxel/base-image:latest",
    memory: 4096,          // MB
    region: "us-pdx-1",
    ttl: "24h",            // automatic deletion after 24 hours
    ports: [
      { target: 3000, protocol: "HTTP" }
    ]
  }
});
```

**Create or reuse if already exists (idempotent):**

```typescript
const sandbox = await SandboxInstance.createIfNotExists({
  metadata: {
    name: "my-sandbox"
  },
  spec: {
    image: "blaxel/base-image:latest",
    memory: 4096,
    region: "us-pdx-1",
    ttl: "24h",
    ports: [{ target: 3000, protocol: "HTTP" }]
  }
});
```

**Get an existing sandbox by name:**

```typescript
const sandbox = await SandboxInstance.get("my-sandbox");
```

**Delete a sandbox:**

```typescript
await sandbox.delete();
```

**List all sandboxes:**

```typescript
const sandboxes = await SandboxInstance.list();
```

---

### Finding 2: Filesystem Operations — `sandbox.fs.*`

The filesystem API lives under `sandbox.fs` and covers text files, binary files, directories, and search.

#### Write a text file

```typescript
await sandbox.fs.write("/app/config.json", '{"key": "value"}');
```

#### Read a text file

```typescript
const content = await sandbox.fs.read("/app/config.json");
console.log(content); // string
```

#### Write a binary file

```typescript
import * as fs from "fs";

const binaryData = fs.readFileSync("./image.png");
await sandbox.fs.writeBinary("/app/image.png", binaryData);
```

#### Read a binary file

```typescript
const blob = await sandbox.fs.readBinary("/app/image.png");
// Returns a Blob or Buffer-compatible object
```

#### Create a directory

```typescript
await sandbox.fs.mkdir("/app/uploads");
```

#### List directory contents

```typescript
const { subdirectories, files } = await sandbox.fs.ls("/app");
```

#### Search for text within files (grep)

```typescript
const matches = await sandbox.fs.grep("searchPattern", "/app", {
  caseSensitive: true,
  contextLines: 2,
  maxResults: 50,
  filePattern: "*.ts",
  excludeDirs: ["node_modules", ".git"]
});
```

---

### Finding 3: Process Execution — `sandbox.process.*`

The process API lives under `sandbox.process`.

#### Execute a command and wait for completion

```typescript
const result = await sandbox.process.exec({
  name: "build-process",      // human-readable name; use to retrieve logs later
  command: "npm run build",
  workingDir: "/app",
  waitForCompletion: true,
  timeout: 60000              // ms — max 60 seconds when waitForCompletion: true
});

// When waitForCompletion: true, the result contains logs:
console.log(result.logs?.stdout);
console.log(result.logs?.stderr);
```

> **Important constraint**: When `waitForCompletion: true`, Blaxel enforces a hard timeout of **60 seconds**. For longer-running commands use `waitForCompletion: false` and poll with `sandbox.process.wait()`.

#### Execute a long-running command, then wait separately

```typescript
// Fire off a long task
await sandbox.process.exec({
  name: "long-task",
  command: "npm install && npm run build",
  workingDir: "/app",
  waitForCompletion: false
});

// Poll until completion (up to 10 minutes, checking every 5 seconds)
await sandbox.process.wait("long-task", {
  maxWait: 600000,   // 10 minutes in ms
  interval: 5000     // poll every 5 seconds
});
```

#### Kill a running process

```typescript
await sandbox.process.kill("build-process");
```

#### Execute with auto-restart on failure

```typescript
await sandbox.process.exec({
  name: "web-server",
  command: "node server.js",
  workingDir: "/app",
  waitForCompletion: false,
  autoRestart: true,
  maxRestarts: 3
});
```

#### Set working directory context

```typescript
await sandbox.process.exec({
  name: "list-files",
  command: "ls -al",
  workingDir: "/app/src"
});
```

---

### Finding 4: Port Configuration

Ports are configured **at sandbox creation time** via the `spec.ports` array:

```typescript
const sandbox = await SandboxInstance.create({
  metadata: { name: "web-sandbox" },
  spec: {
    image: "blaxel/base-image:latest",
    memory: 2048,
    ports: [
      { target: 3000, protocol: "HTTP" },
      { target: 8080, protocol: "HTTP" }
    ]
  }
});
```

To expose a port as an externally accessible URL after the sandbox is running, create a **preview**:

```typescript
const preview = await sandbox.previews.create({
  metadata: { name: "app-preview" },
  spec: {
    port: 3000,
    public: true,
    responseHeaders: {
      "Access-Control-Allow-Origin": "https://your-domain.com",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    }
  }
});

const previewUrl = preview.spec?.url;
console.log("Preview URL:", previewUrl);
```

For a private preview (token-authenticated):

```typescript
const preview = await sandbox.previews.create({
  metadata: { name: "private-preview" },
  spec: {
    port: 3000,
    public: false
  }
});
```

For an idempotent preview creation:

```typescript
const preview = await sandbox.previews.createIfNotExists({
  metadata: { name: "app-preview" },
  spec: { port: 3000, public: true }
});
```

> **Troubleshooting**: If you see a 502 error when accessing the preview URL, your server is not reachable externally. Ensure it binds to `0.0.0.0` (not `localhost` or `127.0.0.1`). Example: `npm run dev -- --host 0.0.0.0 --port 3000`

---

### Finding 5: TTL (Time-to-Live) and Cleanup

TTL is set in the spec at creation time as a duration string:

```typescript
const sandbox = await SandboxInstance.create({
  metadata: { name: "ephemeral-sandbox" },
  spec: {
    image: "blaxel/base-image:latest",
    memory: 1024,
    ttl: "1h"     // auto-delete after 1 hour
    // other valid values: "30m", "6h", "24h", "7d"
  }
});
```

**Manual cleanup:**

```typescript
// Delete a specific sandbox immediately
await sandbox.delete();

// Or get by name then delete
const s = await SandboxInstance.get("my-sandbox");
await s.delete();
```

**Quota notes:**
- Starter tier enforces mandatory TTLs
- Higher tiers allow unlimited persistence (no TTL required)
- Sandboxes automatically scale to zero after a few seconds of inactivity (no cost while idle)
- Resume from standby takes under 25ms

---

### Finding 6: Volume Management (Persistent Storage)

Volumes provide persistent storage that survives sandbox restarts:

```typescript
import { VolumeInstance, SandboxInstance } from "@blaxel/core";

// Create a volume
const volume = await VolumeInstance.createIfNotExists({
  metadata: {
    name: "my-volume",
    labels: { project: "my-project" }
  },
  spec: {
    size: 1024,           // MB
    region: "us-pdx-1"
  }
});

// Attach volume to a sandbox at mount path
const sandbox = await SandboxInstance.create({
  metadata: { name: "sandbox-with-volume" },
  spec: {
    image: "blaxel/base-image:latest",
    memory: 2048,
    volumes: [
      {
        name: volume.metadata.name,
        mountPath: "/data"
      }
    ]
  }
});

// Delete a volume when done
await volume.delete();
```

---

## Complete End-to-End Example

The following example demonstrates a full sandbox workflow: create, write a file, execute a command, read back the output, and clean up.

```typescript
import { SandboxInstance } from "@blaxel/core";

async function runSandboxWorkflow() {
  // 1. Create sandbox (or reuse if it already exists)
  const sandbox = await SandboxInstance.createIfNotExists({
    metadata: {
      name: "dispatch-worker",
      labels: { project: "dispatch", env: "production" }
    },
    spec: {
      image: "blaxel/base-image:latest",
      memory: 2048,
      region: "us-pdx-1",
      ttl: "1h",
      ports: [{ target: 8080, protocol: "HTTP" }]
    }
  });

  // 2. Write a script file into the sandbox
  const script = `
    const result = { status: "ok", computed: 2 + 2 };
    const fs = require("fs");
    fs.writeFileSync("/tmp/result.json", JSON.stringify(result));
  `;
  await sandbox.fs.write("/tmp/worker.js", script);

  // 3. Execute the script (short task — use waitForCompletion: true)
  const execResult = await sandbox.process.exec({
    name: "run-worker",
    command: "node /tmp/worker.js",
    workingDir: "/tmp",
    waitForCompletion: true,
    timeout: 30000
  });

  if (execResult.logs?.stderr) {
    console.error("STDERR:", execResult.logs.stderr);
  }

  // 4. Read result back from the sandbox filesystem
  const rawResult = await sandbox.fs.read("/tmp/result.json");
  const parsed = JSON.parse(rawResult);
  console.log("Result:", parsed); // { status: "ok", computed: 4 }

  // 5. Clean up
  await sandbox.delete();
}

runSandboxWorkflow().catch(console.error);
```

---

## Detailed Analysis

### API Structure

The `SandboxInstance` class exposes:

| Member | Type | Description |
|--------|------|-------------|
| `SandboxInstance.create(spec)` | static | Create a new sandbox |
| `SandboxInstance.get(name)` | static | Retrieve existing sandbox by name |
| `SandboxInstance.createIfNotExists(spec)` | static | Idempotent create-or-get |
| `SandboxInstance.list()` | static | List all sandboxes in workspace |
| `sandbox.delete()` | instance | Delete this sandbox |
| `sandbox.fs` | sub-client | Filesystem operations |
| `sandbox.process` | sub-client | Process execution |
| `sandbox.previews` | sub-client | Preview URL management |

### `sandbox.fs` Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `write` | `(path: string, content: string) => Promise<void>` | Write text file |
| `read` | `(path: string) => Promise<string>` | Read text file |
| `writeBinary` | `(path: string, data: Buffer) => Promise<void>` | Write binary file |
| `readBinary` | `(path: string) => Promise<Blob>` | Read binary file |
| `mkdir` | `(path: string) => Promise<void>` | Create directory |
| `ls` | `(path: string) => Promise<{subdirectories, files}>` | List directory |
| `grep` | `(pattern: string, path: string, opts?) => Promise<matches>` | Search in files |

### `sandbox.process` Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `exec` | `(opts: ExecOptions) => Promise<ProcessResult>` | Execute a command |
| `wait` | `(name: string, opts?) => Promise<void>` | Poll until process done |
| `kill` | `(name: string) => Promise<void>` | Kill a named process |

### `ExecOptions` Parameters

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Human-readable process name (use to retrieve logs) |
| `command` | `string` | Shell command to run |
| `workingDir` | `string` | Working directory inside sandbox |
| `waitForCompletion` | `boolean` | Block until done (max 60s timeout) |
| `timeout` | `number` | Timeout in ms (60000 max for synchronous wait) |
| `autoRestart` | `boolean` | Restart process on failure |
| `maxRestarts` | `number` | Max restart attempts |

---

## Sources

1. [Sandboxes Overview - Blaxel Documentation](https://docs.blaxel.ai/Sandboxes/Overview) - Primary sandbox lifecycle documentation
2. [Process Execution - Blaxel Documentation](https://docs.blaxel.ai/Sandboxes/Processes) - `sandbox.process.exec`, wait, kill
3. [Real-time Previews - Blaxel Documentation](https://docs.blaxel.ai/Sandboxes/Preview-url) - Port exposure and preview URL management
4. [TypeScript SDK - Blaxel Documentation](https://docs.blaxel.ai/sdk-reference/sdk-ts) - SDK reference guide
5. [@blaxel/core - npm](https://www.npmjs.com/package/@blaxel/core) - Package page with version history
6. [GitHub - blaxel-ai/sdk-typescript](https://github.com/blaxel-ai/sdk-typescript) - Source code and README
7. [Blaxel llms-full.txt](https://docs.blaxel.ai/llms-full.txt) - Machine-readable full documentation
8. [Volumes - Blaxel Documentation](https://docs.blaxel.ai/Sandboxes/Volumes) - Persistent volume management

---

## Conclusions

1. **SandboxInstance is the core abstraction.** Use `createIfNotExists` for idempotent agent workflows; use `create` when you always want a fresh environment.

2. **Filesystem writes precede process execution.** The standard pattern is: write files via `sandbox.fs.write` → execute via `sandbox.process.exec` → read results via `sandbox.fs.read`.

3. **Process timeouts are split into two modes.** For quick tasks (\u226460s), use `waitForCompletion: true`. For anything longer, use `waitForCompletion: false` and then call `sandbox.process.wait("name", { maxWait, interval })`.

4. **Ports are declared at creation; previews expose them.** Declare `spec.ports` at creation time for internal routing, then call `sandbox.previews.create({ spec: { port, public } })` to get an external HTTPS URL.

5. **TTL is a string duration.** Examples: `"30m"`, `"1h"`, `"24h"`, `"7d"`. Starter tier enforces this; higher tiers can omit it for persistent sandboxes.

6. **Always bind servers to `0.0.0.0`.** Servers bound to `localhost` or `127.0.0.1` will not be reachable via preview URLs (502 errors).

---

## Additional Notes

- **Environment variables in sandbox**: The search results show `envs` as a spec-level array in YAML examples but exact TypeScript field names for runtime env vars were not confirmed from the scrapes. Check the TypeScript type definitions in `@blaxel/core` directly if you need to inject secrets into the sandbox environment.
- **Sessions API**: There is a client-side sessions API (`docs.blaxel.ai/Sandboxes/Sessions`) for browser-side sandbox interaction that was not researched in depth here.
- **MCP server integration**: Sandboxes can expose an MCP server endpoint for tool-calling integration with AI agent frameworks — covered at `docs.blaxel.ai/Sandboxes/Overview`.
- **Further research recommended**: Inspect the raw TypeScript types from `@blaxel/core/dist` or the GitHub source to confirm exact field names for `envs`, `volumes` attachment, and `process.list()` if needed.
