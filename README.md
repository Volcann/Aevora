# Aevora

**Enterprise MCP Agent Hub - Gemini AI + centralized Model Context Protocol tools.**
_Connect your tools once. Everyone in the company can use them from the browser._

[Quick Start](#quick-start) · [The Problem](#the-problem) · [What Aevora Does](#what-aevora-does) · [Key Features](#key-features) · [Architecture](#architecture) · [Security & Governance](#security--governance) · [Makefile Reference](#makefile-reference)

---

## The Problem

MCP makes it possible for AI assistants to use real company tools - databases, GitHub, Jira, internal APIs, CRM systems, and more.

The problem is that **setting all of that up on every employee's computer doesn't scale.**

Imagine 100 employees using an MCP-based AI assistant.

With a desktop setup, every employee may need to:

- Install the required software
- Configure MCP servers
- Edit JSON configuration files
- Add API keys or other credentials
- Keep their local configuration up to date
- Troubleshoot things when a tool stops working

And when something changes?

Your developers may have to help those employees fix their setups one machine at a time.

That is a huge amount of repetitive work.

### Why existing approaches become painful

**Claude Desktop** is excellent for developers experimenting with MCP locally. But it assumes the user is comfortable managing the configuration themselves.

You can't realistically ask 100 non-technical employees to find a configuration file, edit JSON correctly, add the right server, and troubleshoot it whenever something changes.

**Cursor, Codex, Gemini CLI and similar tools** are great for developers, but most employees don't work inside terminals or IDEs.

**Giving every employee API keys and database credentials** creates another problem. Credentials end up distributed across many machines and become much harder to control or revoke.

**Running tools directly from employee laptops** also makes access to internal services harder. Your database or private VPC should not need to be exposed just so someone's laptop can access it.

And finally, local setups make centralized permissions difficult.

You may want one employee to be able to **view** customer information while another can **update** it. A local configuration doesn't give you a simple central place to enforce that.

> **The problem isn't MCP itself. The problem is managing MCP separately on 100 different computers.**

---

## The Developer Time Problem

This is one of the biggest reasons Aevora exists.

Without a centralized hub:

```text
Developer
   │
   ├── Configure employee #1
   ├── Configure employee #2
   ├── Configure employee #3
   ├── Fix employee #17's broken JSON
   ├── Update employee #31's MCP server
   ├── Rotate credentials on employee #45
   ├── Fix employee #62's network issue
   └── Repeat...
```

With Aevora:

```text
Developer
   │
   └── Configure MCP server once
              │
              ▼
         Aevora Hub
              │
       ┌──────┼──────┐
       ▼      ▼      ▼
     User    User   User
       │      │      │
       └── Browser ──┘
```

Developers configure the tools **once on the backend**.

Employees simply open the application in their browser.

That means developers spend less time supporting local setups and more time building actual features.

---

## What Aevora Does

Aevora provides a centralized **MCP Agent Hub** inside your organization's infrastructure.

Instead of installing and configuring MCP tools on every employee machine, the MCP servers are connected to Aevora once.

Aevora then:

1. Discovers the available MCP tools.
2. Registers and caches them.
3. Selects the relevant tools for each request.
4. Executes those tools from the backend.
5. Streams the response back to the employee's browser.
6. Records the tool activity for auditing.

The employee doesn't need to know how any of this works.

They just open the browser and start using the tools.

### The main idea

> **Connect once on the backend. Use everywhere from the browser.**

For example, imagine a company with 100 employees.

The developer connects the GitHub, PostgreSQL, Jira, and CRM MCP servers to Aevora once.

After that:

```text
Employee 1  ──┐
Employee 2  ──┤
Employee 3  ──┤
Employee 4  ──┤
Employee 5  ──┤
...           ├──> Aevora ──> MCP Servers
Employee 100 ─┘
```

No 100 individual MCP configurations.

No 100 JSON files.

No 100 local installations.

No repeating the same setup every time a tool changes.

---

## Key Features

### Centralized Tool Setup

Connect an MCP server once instead of configuring it separately for every employee.

This is the biggest developer-time saving in Aevora.

A change to an MCP server can be handled centrally instead of requiring developers to update dozens or hundreds of machines.

### Zero Client Setup

Employees only need a browser.

They don't need:

- Node.js
- Python
- Docker
- Local MCP servers
- Configuration files
- API keys

Open the browser and use the application.

### Saves Developer Time

Developers no longer become the help desk for everyone's MCP configuration.

Instead of spending hours fixing:

```text
"My MCP server isn't showing up."

"Where is claude_desktop_config.json?"

"Why is this JSON invalid?"

"My tool stopped working after the update."

"Which API key am I supposed to use?"
```

the developer manages one centralized system.

That makes Aevora more than an MCP interface - it reduces the amount of repetitive infrastructure work your engineering team has to maintain.

### Centralized Access to Internal Tools

Aevora can run inside your Docker network, private infrastructure, or VPC.

That means MCP servers can communicate with internal systems without exposing those systems directly to employee laptops.

### Centralized Permissions

Access can be controlled from the server instead of relying on whatever configuration happens to exist on someone's computer.

For example:

```text
Support Agent
    └── customer_lookup
    └── ticket_search

Developer
    └── customer_lookup
    └── GitHub
    └── staging_database

Admin
    └── all approved tools
```

This makes it easier to control who can perform sensitive operations.

### Context-Aware Tool Selection

Aevora doesn't need to send every available MCP tool to Gemini for every request.

It can select the tools that are most relevant to the user's question.

For example:

```text
User:
"Show me the open GitHub PRs for the payments service."

                  │
                  ▼

        Tool Selection / Routing

                  │
                  ▼

       github_list_pull_requests
```

Instead of loading a large collection of unrelated tools into every request.

### Centralized Audit Logs

Tool executions are recorded in PostgreSQL.

This provides a central place to inspect:

- Who ran a tool
- Which tool was used
- When it was used
- What arguments were supplied
- How long it took
- Whether it succeeded or failed

### Always-On Backend

The tools don't depend on an employee keeping their laptop running.

Aevora runs the MCP connections and AI workflow on the server side.

This makes it suitable for background jobs, scheduled tasks, and long-running operations.

### Real-Time Streaming

AI responses are streamed back to the browser using Server-Sent Events (SSE).

Users can see the response being generated instead of waiting for the entire request to finish.

Tool activity can also be shown as it happens:

```text
Thinking...

✓ Selected GitHub tool
✓ Fetching pull requests
✓ Found 4 open PRs

Here are the open PRs...
```

### Local Voice Processing

Aevora can use a local Kokoro-ONNX based voice engine for text-to-speech without sending generated audio data to an external speech service.

---

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Volcann/Aevora.git
cd aevora/backend
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Add your required secrets such as:

```env
GEMINI_API_KEY=your-key-here
```

### 3. Start Aevora

```bash
make up.d
```

This starts the required services and initializes the MCP tool cache.

### 4. Open the Browser

Open:

```text
http://localhost:8000
```

Authenticated users can then access the available MCP tools through the web interface.

The important difference is that **users don't need to configure MCP themselves.**

---

## What Startup Looks Like

```text
$ make up.d

================================================================
AEVORA - Enterprise MCP Agent Hub
================================================================

[+] Running 4/4
 ✔ Network aevora_default           Created
 ✔ Container aevora-postgres-1      Started
 ✔ Container aevora-redis-1         Started
 ✔ Container aevora-django-1        Started

================================================================
Registering MCP Gateway...
================================================================

Created ServerConfig 'local_mcp'

Successfully cached 18 tool(s):

  - postgres_query_readonly
  - github_list_pull_requests
  - customer_crm_lookup
  - jira_create_issue
  - server_health_check
  ...

================================================================
Web Hub Ready: http://localhost:8000
================================================================
```

Once the backend is running, employees don't have to repeat this setup.

They just open the browser.

---

## Example

An employee asks:

```text
Check the overdue invoices for Acme Corp
and tell the account manager.
```

Aevora can handle the workflow centrally:

```text
Browser
   │
   ▼
Aevora
   │
   ├── Select relevant MCP tools
   │
   ├── Send request to Gemini
   │
   ├── Execute MCP tool
   │
   ├── Record audit information
   │
   └── Stream result
            │
            ▼
        Browser
```

The employee sees the result.

The employee does not need to know:

- Where the MCP server is running
- Where the database is located
- Which credentials are being used
- How the MCP configuration works
- How the tool is connected

That complexity stays on the backend.

---

## Prerequisites

| Requirement    | Supported Version | Notes                                |
| -------------- | ----------------- | ------------------------------------ |
| Python         | `>= 3.12`         | Managed with `uv`                    |
| Docker         | Modern            | Runs the application services        |
| Docker Compose | Modern            | Used for local deployment            |
| Gemini API Key | Gemini API        | Powers AI reasoning and tool calling |
| MCP Servers    | Standard MCP      | SSE or streamable HTTP               |

---

## Architecture

Aevora keeps the employee experience simple while moving MCP infrastructure to the backend.

```text
                    Employees
               ┌──────┼──────┐
               │      │      │
             Browser Browser Browser
               │      │      │
               └──────┼──────┘
                      HTTPS
                        │
                        ▼
              ┌───────────────────┐
              │    Aevora Hub     │
              │                   │
              │ Django            │
              │ Gemini            │
              │ Tool Routing      │
              │ Authentication    │
              │ Audit Logging     │
              └─────────┬─────────┘
                        │
               Internal network
                        │
          ┌─────────────┼─────────────┐
          ▼             ▼             ▼
      PostgreSQL      GitHub         Jira
         MCP           MCP            MCP
          │             │             │
          └─────────────┼─────────────┘
                        ▼
                 Other internal
                    MCP tools
```

### Main Components

`server_config.py`

Stores information about connected MCP servers.

`tool_call.py`

Stores the audit record of tool executions.

`mcp_manager.py`

Handles communication with MCP servers, including tool discovery and execution.

`selection.py`

Selects the most relevant tools for the user's request.

`stream.py`

Streams AI and tool events back to the browser.

---

## Security & Governance

### No MCP Configuration on Employee Machines

Employees don't need local MCP configuration files.

This reduces configuration mistakes and prevents the same credentials and settings from being copied across many machines.

### No Raw Credentials on Workstations

Database credentials, MCP credentials, and AI provider keys can stay on the backend rather than being distributed to employees.

### Private Network Access

Aevora can communicate with internal services from inside the private network.

Instead of this:

```text
Employee Laptop
      │
      └──> Public/Exposed Database
```

you can have:

```text
Employee Browser
      │
      ▼
   Aevora
      │
      ▼
 Private Database
```

### Centralized Revocation

When an employee leaves the organization, access can be revoked centrally.

There is no need to hunt through their laptop for old MCP configurations and credentials.

### Centralized Logging

Tool activity is recorded centrally, making it easier to understand what happened and who performed an operation.

---

## The Developer-Time Advantage

The real value of Aevora isn't just that it provides a web UI.

It's that it changes **where MCP configuration lives**.

### Without Aevora

```text
100 Employees
      │
      ├── 100 MCP configurations
      ├── 100 local environments
      ├── 100 sets of updates
      └── potentially hundreds of support problems
```

### With Aevora

```text
100 Employees
      │
      ▼
   One Hub
      │
      └── Central MCP configuration
```

A developer can make a change once and have it available to everyone.

That means fewer repetitive support requests, fewer broken local configurations, and less engineering time spent maintaining developer tooling on non-developer machines.

> **Aevora lets your developers build the integration once instead of maintaining the same integration 100 times.**

---

## Makefile Reference

```bash
make up            # Start all containers in the foreground
make up.d          # Start containers in the background and initialize MCP tools
make down          # Stop containers and remove orphan networks
make tools         # Start the host-level MCP gateway
make reboot_tools  # Sync MCP servers and rebuild the tool cache

make test          # Run the test suite
make lint          # Run linting and formatting checks
make ci            # Run the full CI pipeline

make dcshell       # Open a shell inside the Django container
make psql          # Open a PostgreSQL shell
```

---

## The Idea in One Sentence

> **Aevora turns MCP from something every developer has to configure locally into a centralized service that the whole company can use from a browser - saving developers from configuring and troubleshooting the same setup over and over again.**

---

## License

MIT. Built for teams that want to use AI agents with internal tools without turning their developers into full-time MCP support staff.
