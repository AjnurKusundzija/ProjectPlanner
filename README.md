# Project Planner

This project is developed as a final thesis implementation with the topic:
**Model Context Protocol: arhitektura, dizajn i praktična primjena u agentnim sistemima**.

This system is a **Project Planner** application.

## Project Overview

The application demonstrates how MCP can be used in a real software engineering workflow for **Project Planner** functionalities, including project and task management.

It includes:
- MCP server tools for project lifecycle management
- Prompt-based workflow support
- Local JSON data storage
- Web frontend connected to backend endpoints

## Thesis Topic

This repository represents the practical part of the final thesis.

**Final thesis theme:** Model Context Protocol: arhitektura, dizajn i practicalna primjena u agentnim sistemima.

## Main Features

- Create, read, update, and delete projects
- Manage todo items (add, toggle, delete)
- List project summaries and statuses
- Execute MCP prompts for planning and analysis
- Generate random project data using MCP sampling tool

## Tech Stack

- TypeScript
- Node.js
- Express
- MCP SDK (`@modelcontextprotocol/sdk`)
- Frontend: HTML, CSS, JavaScript
- Data storage: `data/podaci.json`

## Project Structure

- `src/server.ts` - MCP server tools, resources, and prompts
- `src/client.ts` - HTTP bridge/backend for frontend integration
- `frontend/index.html` - Application UI
- `frontend/app.js` - Frontend logic
- `frontend/styles.css` - Styling
- `data/podaci.json` - Local JSON database

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Build TypeScript

```bash
npm run server:build
```

### 3. Run the application

```bash
npm run client:dev
```

### 4. Open in browser

Go to:

```text
http://localhost:3000
```

## Available Scripts

- `npm run server:build` - Compile TypeScript
- `npm run server:build:watch` - Compile in watch mode
- `npm run server:dev` - Run MCP server directly
- `npm run client:dev` - Run backend bridge + frontend serving
- `npm run frontend:dev` - Alias for client dev run
- `npm run server:inspect` - Run MCP inspector

## Notes

- The system uses local JSON persistence for simplicity and transparency in academic demonstration.
- This implementation is focused on demonstrating practical MCP integration patterns.
