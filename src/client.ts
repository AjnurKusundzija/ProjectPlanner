import cors from 'cors'
import express from 'express'
import fs from 'fs'
import path from 'path'

type ToolAction = 'add' | 'toggle' | 'delete'

interface Todo {
    id: number
    text: string
    is_done: boolean
}

interface Project {
    id: number
    project_name: string
    deadline: string
    created_at: string
    todolist: Todo[]
}

interface DB {
    projects: Project[]
}

interface ToolResult {
    success: boolean
    message?: string
    project?: Project
    projects?: Array<Record<string, unknown>>
    todo?: Todo
    [key: string]: unknown
}

const DB_PATH = path.resolve('data/podaci.json')
const FRONTEND_DIR = path.resolve('frontend')
const PORT = Number(process.env.PORT || 3000)

function ensureDB(): void {
    if (!fs.existsSync(DB_PATH)) {
        fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
        fs.writeFileSync(DB_PATH, JSON.stringify({ projects: [] }, null, 2), 'utf-8')
    }
}

function readDB(): DB {
    ensureDB()
    const raw = fs.readFileSync(DB_PATH, 'utf-8')
    return JSON.parse(raw) as DB
}

function writeDB(data: DB): void {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8')
}

function nextId(items: Array<{ id: number }>): number {
    return items.length === 0 ? 1 : Math.max(...items.map((i) => i.id)) + 1
}

function normalizeDate(input: string): string | null {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input

    const dmyMatch = input.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})\.?$/)
    if (!dmyMatch) return null

    const [, d, m, y] = dmyMatch
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

function parseTodos(input: string): string[] {
    const trimmed = input.trim()
    if (!trimmed) return []

    try {
        const parsed = JSON.parse(trimmed)
        if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean)
    } catch {

    }

    return trimmed
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
}

function summarizeProjects(projects: Project[]): Array<Record<string, unknown>> {
    return projects.map((p) => ({
        id: p.id,
        project_name: p.project_name,
        deadline: p.deadline,
        created_at: p.created_at,
        total_todos: p.todolist.length,
        done_todos: p.todolist.filter((t) => t.is_done).length,
        status: new Date(p.deadline) < new Date() ? 'prekoracen' : 'aktivan',
        todolist: p.todolist,
    }))
}

function createProject(args: Record<string, unknown>): ToolResult {
    const project_name = String(args.project_name ?? '').trim()
    const deadline = String(args.deadline ?? '').trim()
    const todosInput = typeof args.todos === 'string' ? args.todos : undefined

    if (!project_name || !deadline) {
        return { success: false, message: 'project_name i deadline su obavezni.' }
    }

    const normalizedDeadline = normalizeDate(deadline)
    if (!normalizedDeadline) {
        return {
            success: false,
            message: `Neispravan format datuma: "${deadline}". Koristite DD.MM.YYYY ili YYYY-MM-DD.`,
        }
    }

    const todos = todosInput ? parseTodos(todosInput) : []
    const data = readDB()

    const project: Project = {
        id: nextId(data.projects),
        project_name,
        deadline: normalizedDeadline,
        created_at: new Date().toISOString(),
        todolist: todos.map((text, i) => ({ id: i + 1, text, is_done: false })),
    }

    data.projects.push(project)
    writeDB(data)
    return { success: true, message: `Projekat "${project_name}" kreiran`, project }
}

function getProject(args: Record<string, unknown>): ToolResult {
    const project_name = String(args.project_name ?? '').trim().toLowerCase()
    if (!project_name) return { success: false, message: 'project_name je obavezan.' }

    const data = readDB()
    const project = data.projects.find((p) => p.project_name.trim().toLowerCase() === project_name)

    if (!project) return { success: false, message: 'Trazeni projekat nije pronadjen.' }
    return { success: true, project }
}

function listProjects(): ToolResult {
    const data = readDB()
    return { success: true, projects: summarizeProjects(data.projects) }
}

function updateProject(args: Record<string, unknown>): ToolResult {
    const project_id = Number(args.project_id)
    const project_name = args.project_name ? String(args.project_name).trim() : undefined
    const deadline = args.deadline ? String(args.deadline).trim() : undefined

    if (!Number.isInteger(project_id) || project_id <= 0) {
        return { success: false, message: 'project_id mora biti pozitivan broj.' }
    }
    if (!project_name && !deadline) {
        return { success: false, message: 'Potrebno je navesti project_name ili deadline.' }
    }

    const data = readDB()
    const project = data.projects.find((p) => p.id === project_id)
    if (!project) return { success: false, message: `Projekat sa ID ${project_id} nije pronadjen.` }

    if (project_name) project.project_name = project_name
    if (deadline) {
        const normalized = normalizeDate(deadline)
        if (!normalized) {
            return {
                success: false,
                message: `Neispravan format datuma: "${deadline}". Koristite DD.MM.YYYY ili YYYY-MM-DD.`,
            }
        }
        project.deadline = normalized
    }

    writeDB(data)
    return { success: true, message: `Projekat ID ${project_id} azuriran`, project }
}

function manageTodo(args: Record<string, unknown>): ToolResult {
    const action = String(args.action ?? '') as ToolAction
    const project_id = Number(args.project_id)
    const todo_id = args.todo_id === undefined ? undefined : Number(args.todo_id)
    const text = args.text === undefined ? undefined : String(args.text).trim()

    if (!['add', 'toggle', 'delete'].includes(action)) {
        return { success: false, message: 'action mora biti add, toggle ili delete.' }
    }
    if (!Number.isInteger(project_id) || project_id <= 0) {
        return { success: false, message: 'project_id mora biti pozitivan broj.' }
    }

    const data = readDB()
    const project = data.projects.find((p) => p.id === project_id)
    if (!project) return { success: false, message: `Projekat sa ID ${project_id} nije pronadjen.` }

    if (action === 'add') {
        if (!text) return { success: false, message: 'Za add je potreban text.' }
        const todo: Todo = { id: nextId(project.todolist), text, is_done: false }
        project.todolist.push(todo)
        writeDB(data)
        return { success: true, todo }
    }

    if (!Number.isInteger(todo_id) || (todo_id ?? 0) <= 0) {
        return { success: false, message: 'Za toggle/delete je potreban validan todo_id.' }
    }

    const todo = project.todolist.find((t) => t.id === todo_id)
    if (!todo) return { success: false, message: `Todo ID ${todo_id} nije pronadjen.` }

    if (action === 'toggle') {
        todo.is_done = !todo.is_done
        writeDB(data)
        return { success: true, todo }
    }

    project.todolist = project.todolist.filter((t) => t.id !== todo_id)
    writeDB(data)
    return { success: true, message: `Todo ID ${todo_id} obrisan.` }
}

function deleteProject(args: Record<string, unknown>): ToolResult {
    const project_id = Number(args.project_id)
    if (!Number.isInteger(project_id) || project_id <= 0) {
        return { success: false, message: 'project_id mora biti pozitivan broj.' }
    }

    const data = readDB()
    const index = data.projects.findIndex((p) => p.id === project_id)
    if (index === -1) return { success: false, message: `Projekat sa ID ${project_id} nije pronadjen.` }

    const deleted = data.projects[index]
    data.projects.splice(index, 1)
    writeDB(data)
    return { success: true, message: `Projekat "${deleted.project_name}" obrisan.` }
}

function createRandomProject(): ToolResult {
    const names = [
        'TaskPulse',
        'BugRadar',
        'SprintPilot',
        'DocFlow',
        'API Monitor',
    ]
    const todoTemplates = [
        'Definisati scope i milestone plan',
        'Postaviti backend strukturu',
        'Implementirati glavne API rute',
        'Dodati validaciju input podataka',
        'Napisati osnovne test scenarije',
        'Pripremiti deployment checklistu',
    ]

    const data = readDB()
    const projectName = `${names[Math.floor(Math.random() * names.length)]} ${Math.floor(100 + Math.random() * 900)}`
    const monthsOffset = 1 + Math.floor(Math.random() * 6)
    const deadlineDate = new Date()
    deadlineDate.setMonth(deadlineDate.getMonth() + monthsOffset)
    const deadline = deadlineDate.toISOString().split('T')[0]

    const todos = [...todoTemplates]
        .sort(() => Math.random() - 0.5)
        .slice(0, 5)

    const project: Project = {
        id: nextId(data.projects),
        project_name: projectName,
        deadline,
        created_at: new Date().toISOString(),
        todolist: todos.map((text, i) => ({ id: i + 1, text, is_done: false })),
    }

    data.projects.push(project)
    writeDB(data)
    return { success: true, message: `Random projekat "${projectName}" kreiran`, project }
}

function buildDailyOverviewPrompt(): string {
    const data = readDB()
    const summary = data.projects.map((p) => ({
        id: p.id,
        project_name: p.project_name,
        deadline: p.deadline,
        total_todos: p.todolist.length,
        done_todos: p.todolist.filter((t) => t.is_done).length,
        pending_todos: p.todolist.filter((t) => !t.is_done).map((t) => t.text),
        status: new Date(p.deadline) < new Date() ? 'prekoracen' : 'aktivan',
    }))

    return `Ovo su moji trenutni projekti:\n${JSON.stringify(summary, null, 2)}\n\nNa osnovu ovih podataka napravi dnevni pregled i prioritete.`
}

function buildAnalyzeProjectPrompt(args: Record<string, unknown>): string {
    const project_name = String(args.project_name ?? '').trim()
    if (!project_name) return 'project_name je obavezan argument za analyze_project.'

    const data = readDB()
    const project = data.projects.find((p) => p.project_name.toLowerCase() === project_name.toLowerCase())

    if (!project) return `Projekat "${project_name}" nije pronadjen u sistemu.`

    const doneTodos = project.todolist.filter((t) => t.is_done)
    const pendingTodos = project.todolist.filter((t) => !t.is_done)

    return [
        `Analiziraj projekat: ${project.project_name}`,
        `Deadline: ${project.deadline}`,
        `Zavrseno: ${doneTodos.length}/${project.todolist.length}`,
        `Preostalo: ${pendingTodos.map((t) => t.text).join(', ') || '(nema)'}`,
    ].join('\n')
}

function buildSuggestTodosPrompt(args: Record<string, unknown>): string {
    const project_name = String(args.project_name ?? '').trim()
    if (!project_name) return 'project_name je obavezan argument za suggest_todos.'

    const data = readDB()
    const project = data.projects.find((p) => p.project_name.toLowerCase() === project_name.toLowerCase())
    const existing = project?.todolist.map((t) => t.text) ?? []

    return [
        `Predlozi 8-10 todo zadataka za projekat "${project_name}" iz oblasti software engineeringa.`,
        existing.length > 0 ? `Ne ponavljaj postojece: ${existing.join(', ')}` : 'Projekat jos nema zadatke.',
    ].join('\n')
}

const tools = [
    {
        name: 'create_project',
        description: 'Kreira novi projekat sa imenom, rokom i opcionalnim todo stavkama',
        inputSchema: {
            type: 'object',
            required: ['project_name', 'deadline'],
            properties: {
                project_name: { type: 'string', description: 'Ime projekta' },
                deadline: { type: 'string', description: 'DD.MM.YYYY, DD/MM/YYYY ili YYYY-MM-DD' },
                todos: { type: 'string', description: 'Todo stavke (JSON niz, zarez ili novi red)' },
            },
        },
        run: createProject,
    },
    {
        name: 'get_project',
        description: 'Dohvata projekat po imenu zajedno sa svim todo stavkama',
        inputSchema: {
            type: 'object',
            required: ['project_name'],
            properties: {
                project_name: { type: 'string', description: 'Ime projekta' },
            },
        },
        run: getProject,
    },
    {
        name: 'list_projects',
        description: 'Lista sve projekte sa statusom roka i progresom todosa',
        inputSchema: { type: 'object', required: [], properties: {} },
        run: () => listProjects(),
    },
    {
        name: 'update_project',
        description: 'Mijenja ime i/ili rok projekta',
        inputSchema: {
            type: 'object',
            required: ['project_id'],
            properties: {
                project_id: { type: 'integer', description: 'ID projekta' },
                project_name: { type: 'string', description: 'Novo ime projekta' },
                deadline: { type: 'string', description: 'Novi rok' },
            },
        },
        run: updateProject,
    },
    {
        name: 'manage_todo',
        description: 'Dodaje, toggleuje ili brise todo stavku unutar projekta',
        inputSchema: {
            type: 'object',
            required: ['action', 'project_id'],
            properties: {
                action: { type: 'string', description: 'add, toggle ili delete' },
                project_id: { type: 'integer', description: 'ID projekta' },
                todo_id: { type: 'integer', description: 'Potrebno za toggle i delete' },
                text: { type: 'string', description: 'Tekst todo stavke, potrebno za add' },
            },
        },
        run: manageTodo,
    },
    {
        name: 'delete_project',
        description: 'Brise projekat i sve njegove todo stavke',
        inputSchema: {
            type: 'object',
            required: ['project_id'],
            properties: {
                project_id: { type: 'integer', description: 'ID projekta' },
            },
        },
        run: deleteProject,
    },
    {
        name: 'create_random_project',
        description: 'Kreira random projekat sa todos listom',
        inputSchema: { type: 'object', required: [], properties: {} },
        run: () => createRandomProject(),
    },
] as const

const prompts = [
    {
        name: 'daily_overview',
        description: 'Dnevni pregled svih projekata',
        arguments: [],
        run: (_args: Record<string, unknown>) => buildDailyOverviewPrompt(),
    },
    {
        name: 'analyze_project',
        description: 'Analiza jednog projekta po nazivu',
        arguments: [
            { name: 'project_name', description: 'Ime projekta', required: true },
        ],
        run: (args: Record<string, unknown>) => buildAnalyzeProjectPrompt(args),
    },
    {
        name: 'suggest_todos',
        description: 'Predlog zadataka za projekat',
        arguments: [
            { name: 'project_name', description: 'Ime projekta', required: true },
        ],
        run: (args: Record<string, unknown>) => buildSuggestTodosPrompt(args),
    },
] as const

const app = express()

app.use(cors())
app.use(express.json())

app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'planner-bridge' })
})

app.get('/api/tools', (_req, res) => {
    res.json({ tools: tools.map(({ run, ...meta }) => meta) })
})

app.post('/api/tools/execute', (req, res) => {
    const name = String(req.body?.name ?? '')
    const args = (req.body?.args ?? {}) as Record<string, unknown>

    const tool = tools.find((t) => t.name === name)
    if (!tool) {
        res.status(404).json({ error: `Tool "${name}" nije pronadjen.` })
        return
    }

    const result = tool.run(args)
    res.json({
        content: [{
            type: 'text',
            text: JSON.stringify(result),
        }],
    })
})

app.get('/api/prompts', (_req, res) => {
    res.json({ prompts: prompts.map(({ run, ...meta }) => meta) })
})

app.post('/api/prompts/execute', (req, res) => {
    const name = String(req.body?.name ?? '')
    const args = (req.body?.args ?? {}) as Record<string, unknown>

    const prompt = prompts.find((p) => p.name === name)
    if (!prompt) {
        res.status(404).json({ error: `Prompt "${name}" nije pronadjen.` })
        return
    }

    const text = prompt.run(args)
    res.json({
        messages: [{
            role: 'user',
            content: {
                type: 'text',
                text,
            },
        }],
    })
})

app.use(express.static(FRONTEND_DIR))
app.get(/.*/, (_req, res) => {
    res.sendFile(path.join(FRONTEND_DIR, 'index.html'))
})

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
})
