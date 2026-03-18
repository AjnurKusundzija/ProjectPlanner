"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const stdio_js_1 = require("@modelcontextprotocol/sdk/server/stdio.js");
const zod_1 = require("zod");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
// ─── JSON file helpers ────────────────────────────────────────────────────────
const DB_PATH = path_1.default.resolve('data/podaci.json');
function readDB() {
    if (!fs_1.default.existsSync(DB_PATH)) {
        fs_1.default.mkdirSync(path_1.default.dirname(DB_PATH), { recursive: true });
        fs_1.default.writeFileSync(DB_PATH, JSON.stringify({ projects: [] }, null, 2), 'utf-8');
    }
    const raw = fs_1.default.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(raw);
}
function writeDB(data) {
    fs_1.default.mkdirSync(path_1.default.dirname(DB_PATH), { recursive: true });
    fs_1.default.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
}
function nextId(items) {
    return items.length === 0 ? 1 : Math.max(...items.map((i) => i.id)) + 1;
}
// Pretvara datume kao "19.12.2222", "19/12/2222" ili "2222-12-19" u "YYYY-MM-DD"
function normalizeDate(input) {
    // već ispravan format
    if (/^\d{4}-\d{2}-\d{2}$/.test(input))
        return input;
    // DD.MM.YYYY ili DD/MM/YYYY
    const dmyMatch = input.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})\.?$/);
    if (dmyMatch) {
        const [, d, m, y] = dmyMatch;
        return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return null;
}
// Parsira todos — prihvata JSON array string ili plain tekst odvojen zarezima/novim redom
function parseTodos(input) {
    const trimmed = input.trim();
    if (!trimmed)
        return [];
    // pokušaj JSON parse
    try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed))
            return parsed.map(String).filter(Boolean);
    }
    catch { }
    // fallback: split po novom redu ili zarezu
    return trimmed
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
}
// ─── MCP Server ───────────────────────────────────────────────────────────────
const server = new mcp_js_1.McpServer({
    name: 'MCPServer',
    version: '1.0.0',
});
// ─── TOOL 1: create_project ───────────────────────────────────────────────────
server.registerTool('create_project', {
    description: 'Kreira novi projekat sa imenom, rokom i opcionalnim todo stavkama',
    inputSchema: {
        project_name: zod_1.z.string().min(1, 'Ime projekta ne može biti prazno'),
        deadline: zod_1.z
            .string()
            .min(1)
            .describe('Datum roka — prihvata DD.MM.YYYY, DD/MM/YYYY ili YYYY-MM-DD'),
        todos: zod_1.z
            .string()
            .optional()
            .describe('Todo stavke — plain tekst odvojen zarezom/novim redom, ili JSON array'),
    },
}, async ({ project_name, deadline, todos }) => {
    const normalizedDeadline = normalizeDate(deadline);
    if (!normalizedDeadline) {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        message: `Neispravan format datuma: "${deadline}". Koristite DD.MM.YYYY ili YYYY-MM-DD.`,
                    }),
                }],
        };
    }
    const todoList = todos ? parseTodos(todos) : [];
    const data = readDB();
    const newProject = {
        id: nextId(data.projects),
        project_name,
        deadline: normalizedDeadline,
        created_at: new Date().toISOString(),
        todolist: todoList.map((text, i) => ({
            id: i + 1,
            text,
            is_done: false,
        })),
    };
    data.projects.push(newProject);
    writeDB(data);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: `Projekat "${project_name}" kreiran`,
                    project: newProject,
                }),
            }],
    };
});
// ─── TOOL 2: get_project ──────────────────────────────────────────────────────
server.registerTool('get_project', {
    description: 'Dohvata projekat po imenu zajedno sa svim todo stavkama',
    inputSchema: {
        project_name: zod_1.z.string().min(1, 'Ime projekta ne može biti prazno'),
    },
}, async ({ project_name }) => {
    const data = readDB();
    const normalizedInput = project_name.trim().toLowerCase();
    const project = data.projects.find((p) => p.project_name.trim().toLowerCase() === normalizedInput);
    if (!project) {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        message: `Projekat sa imenom "${project_name}" nije pronađen`,
                    }),
                }],
        };
    }
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({ success: true, project }),
            }],
    };
});
// ─── TOOL 3: list_projects ────────────────────────────────────────────────────
server.registerTool('list_projects', {
    description: 'Lista sve projekte sa statusom roka i progresom todosa',
    inputSchema: {},
}, async () => {
    const data = readDB();
    const projects = data.projects.map((p) => ({
        id: p.id,
        project_name: p.project_name,
        deadline: p.deadline,
        created_at: p.created_at,
        total_todos: p.todolist.length,
        done_todos: p.todolist.filter((t) => t.is_done).length,
        status: new Date(p.deadline) < new Date() ? 'prekoracen' : 'aktivan',
    }));
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({ success: true, projects }),
            }],
    };
});
// ─── TOOL 4: update_project ───────────────────────────────────────────────────
server.registerTool('update_project', {
    description: 'Mijenja ime i/ili rok projekta',
    inputSchema: {
        project_id: zod_1.z.number().int().positive(),
        project_name: zod_1.z.string().min(1).optional().describe('Novo ime projekta'),
        deadline: zod_1.z
            .string()
            .min(1)
            .optional()
            .describe('Novi rok — prihvata DD.MM.YYYY, DD/MM/YYYY ili YYYY-MM-DD'),
    },
}, async ({ project_id, project_name, deadline }) => {
    if (!project_name && !deadline) {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        message: 'Potrebno je navesti project_name ili deadline',
                    }),
                }],
        };
    }
    const data = readDB();
    const project = data.projects.find((p) => p.id === project_id);
    if (!project) {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        message: `Projekat sa ID ${project_id} nije pronađen`,
                    }),
                }],
        };
    }
    if (project_name)
        project.project_name = project_name;
    if (deadline) {
        const normalizedDeadline = normalizeDate(deadline);
        if (!normalizedDeadline) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({
                            success: false,
                            message: `Neispravan format datuma: "${deadline}". Koristite DD.MM.YYYY ili YYYY-MM-DD.`,
                        }),
                    }],
            };
        }
        project.deadline = normalizedDeadline;
    }
    writeDB(data);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: `Projekat ID ${project_id} ažuriran`,
                    project,
                }),
            }],
    };
});
// ─── TOOL 5: manage_todo ──────────────────────────────────────────────────────
server.registerTool('manage_todo', {
    description: 'Dodaje, toggleuje ili briše todo stavku unutar projekta',
    inputSchema: {
        action: zod_1.z.enum(['add', 'toggle', 'delete']),
        project_id: zod_1.z.number().int().positive(),
        todo_id: zod_1.z.number().int().positive().optional().describe('Potrebno za toggle i delete'),
        text: zod_1.z.string().min(1).optional().describe('Tekst — potrebno za add'),
    },
}, async ({ action, project_id, todo_id, text }) => {
    const data = readDB();
    const project = data.projects.find((p) => p.id === project_id);
    if (!project) {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        message: `Projekat sa ID ${project_id} nije pronađen`,
                    }),
                }],
        };
    }
    if (action === 'add') {
        if (!text) {
            return {
                content: [{
                        type: 'text',
                        text: JSON.stringify({ success: false, message: 'add zahtijeva text' }),
                    }],
            };
        }
        const newTodo = {
            id: nextId(project.todolist),
            text,
            is_done: false,
        };
        project.todolist.push(newTodo);
        writeDB(data);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({ success: true, todo: newTodo }),
                }],
        };
    }
    if (!todo_id) {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({ success: false, message: 'toggle i delete zahtijevaju todo_id' }),
                }],
        };
    }
    const todo = project.todolist.find((t) => t.id === todo_id);
    if (!todo) {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({ success: false, message: `Todo ID ${todo_id} nije pronađen` }),
                }],
        };
    }
    if (action === 'toggle') {
        todo.is_done = !todo.is_done;
        writeDB(data);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({ success: true, todo }),
                }],
        };
    }
    if (action === 'delete') {
        project.todolist = project.todolist.filter((t) => t.id !== todo_id);
        writeDB(data);
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({ success: true, message: `Todo ID ${todo_id} obrisan` }),
                }],
        };
    }
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({ success: false, message: `Nepoznata akcija: ${action}` }),
            }],
    };
});
// ─── TOOL 6: delete_project ───────────────────────────────────────────────────
server.registerTool('delete_project', {
    description: 'Briše projekat i sve njegove todo stavke',
    inputSchema: {
        project_id: zod_1.z.number().int().positive(),
    },
}, async ({ project_id }) => {
    const data = readDB();
    const index = data.projects.findIndex((p) => p.id === project_id);
    if (index === -1) {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        message: `Projekat sa ID ${project_id} nije pronađen`,
                    }),
                }],
        };
    }
    const deleted = data.projects[index];
    data.projects.splice(index, 1);
    writeDB(data);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: `Projekat "${deleted.project_name}" obrisan`,
                }),
            }],
    };
});
// ─── RESOURCE 1: projects://all ──────────────────────────────────────────────
// Vraća listu svih projekata sa statusom i progresom todosa
server.registerResource('all-projects', 'projects://all', {
    description: 'Lista svih projekata sa statusom roka i progresom todosa',
    mimeType: 'application/json',
}, async (uri) => {
    const data = readDB();
    const projects = data.projects.map((p) => ({
        id: p.id,
        project_name: p.project_name,
        deadline: p.deadline,
        created_at: p.created_at,
        total_todos: p.todolist.length,
        done_todos: p.todolist.filter((t) => t.is_done).length,
        status: new Date(p.deadline) < new Date() ? 'prekoracen' : 'aktivan',
    }));
    return {
        contents: [{
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify({ success: true, count: projects.length, projects }, null, 2),
            }],
    };
});
// ─── RESOURCE 2: projects://details ──────────────────────────────────────────
// Vraća sve projekte sa kompletnim podacima uključujući todolistu
server.registerResource('all-projects-details', 'projects://details', {
    description: 'Svi projekti sa kompletnim podacima i todolistama',
    mimeType: 'application/json',
}, async (uri) => {
    const data = readDB();
    return {
        contents: [{
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify({ success: true, count: data.projects.length, projects: data.projects }, null, 2),
            }],
    };
});
// ─── RESOURCE 3: projects://todos ────────────────────────────────────────────
// Vraća sve todo stavke iz svih projekata u jednoj listi
server.registerResource('all-todos', 'projects://todos', {
    description: 'Sve todo stavke iz svih projekata u jedinstvenoj listi',
    mimeType: 'application/json',
}, async (uri) => {
    const data = readDB();
    const todos = data.projects.flatMap((p) => p.todolist.map((t) => ({
        todo_id: t.id,
        text: t.text,
        is_done: t.is_done,
        project_id: p.id,
        project_name: p.project_name,
    })));
    const total = todos.length;
    const done = todos.filter((t) => t.is_done).length;
    const pending = total - done;
    return {
        contents: [{
                uri: uri.href,
                mimeType: 'application/json',
                text: JSON.stringify({ success: true, total, done, pending, todos }, null, 2),
            }],
    };
});
// ─── PROMPT 1: daily_overview ────────────────────────────────────────────────
server.registerPrompt('daily_overview', {}, async () => {
    const data = readDB();
    const summary = data.projects.map((p) => ({
        id: p.id,
        project_name: p.project_name,
        deadline: p.deadline,
        total_todos: p.todolist.length,
        done_todos: p.todolist.filter((t) => t.is_done).length,
        pending_todos: p.todolist.filter((t) => !t.is_done).map((t) => t.text),
        status: new Date(p.deadline) < new Date() ? 'prekoracen' : 'aktivan',
        days_left: Math.ceil((new Date(p.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)),
    }));
    return {
        messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: `Ovo su moji trenutni projekti:\n${JSON.stringify(summary, null, 2)}
 
Na osnovu ovih podataka napravi mi koncizan dnevni pregled:
- Koji projekti hitno trebaju pažnju (malo dana do deadlinea, puno pending todos)
- Koji projekti kasne (status: prekoracen)
- Šta mi je sljedeći korak za danas
Budi konkretan i kratak.`,
                },
            }],
    };
});
// ─── PROMPT 2: analyze_project ───────────────────────────────────────────────
server.registerPrompt('analyze_project', { argsSchema: { project_name: zod_1.z.string().min(1) } }, async ({ project_name }) => {
    const data = readDB();
    const project = data.projects.find((p) => p.project_name.toLowerCase() === project_name.toLowerCase());
    if (!project) {
        return {
            messages: [{
                    role: 'user',
                    content: {
                        type: 'text',
                        text: `Projekat "${project_name}" nije pronađen u sistemu.`,
                    },
                }],
        };
    }
    const daysLeft = Math.ceil((new Date(project.deadline).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
    const doneTodos = project.todolist.filter((t) => t.is_done);
    const pendingTodos = project.todolist.filter((t) => !t.is_done);
    const progressPercent = project.todolist.length === 0
        ? 0
        : Math.round((doneTodos.length / project.todolist.length) * 100);
    return {
        messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: `Analiziraj mi ovaj projekat i daj mi konkretne savjete:
 
Projekat: ${project.project_name}
Deadline: ${project.deadline} (${daysLeft > 0 ? `još ${daysLeft} dana` : `kasnimo ${Math.abs(daysLeft)} dana`})
Progres: ${progressPercent}% (${doneTodos.length}/${project.todolist.length} zadataka završeno)
 
Završeni zadaci:
${doneTodos.length > 0 ? doneTodos.map((t) => `  ✓ ${t.text}`).join('\n') : '  (nema)'}
 
Preostali zadaci:
${pendingTodos.length > 0 ? pendingTodos.map((t) => `  ○ ${t.text}`).join('\n') : '  (nema)'}
 
Na osnovu ovoga:
1. Da li sam na dobrom putu s obzirom na deadline?
2. Koji zadatak treba uraditi sljedeći i zašto?
3. Postoji li rizik da ne završim na vrijeme?`,
                },
            }],
    };
});
// ─── PROMPT 3: suggest_todos ─────────────────────────────────────────────────
server.registerPrompt('suggest_todos', { argsSchema: { project_name: zod_1.z.string().min(1) } }, async ({ project_name }) => {
    const data = readDB();
    const project = data.projects.find((p) => p.project_name.toLowerCase() === project_name.toLowerCase());
    const existingTodos = project && project.todolist.length > 0
        ? `\nVec postoje sljedeći zadaci u projektu:\n${project.todolist.map((t) => `  - ${t.text}`).join('\n')}\nNemoj ponavljati ove zadatke.`
        : '\nProjekat još nema nijedan zadatak.';
    return {
        messages: [{
                role: 'user',
                content: {
                    type: 'text',
                    text: `Generiši mi konkretnu listu todo stavki za projekat pod nazivom "${project_name}".
${existingTodos}
 
Projekat je završni rad iz oblasti software engineeringa — implementacija MCP servera u TypeScriptu.
 
Predloži 8-10 konkretnih, akcionih zadataka koji pokrivaju:
- Planiranje i dokumentaciju
- Implementaciju
- Testiranje
- Finalizaciju i predaju
 
Vrati samo listu zadataka, jedan po redu, bez dodatnog teksta.`,
                },
            }],
    };
});
// ─── Start ────────────────────────────────────────────────────────────────────
//Primjer samplinga kroz tool
// ─── TOOL 7: create_random_project (sampling) ────────────────────────────────
server.registerTool('create_random_project', {
    description: 'Koristi LLM sampling da generiše i kreira random projekat sa todos listom',
    inputSchema: {},
}, async () => {
    // 1. Pozivamo LLM preko sampling-a da generiše projekat kao JSON
    const samplingResult = await server.server.createMessage({
        maxTokens: 500,
        messages: [
            {
                role: 'user',
                content: {
                    type: 'text',
                    text: `Generiši jedan random softverski projekat. 
Vrati SAMO validan JSON objekat u ovom formatu, bez ikakvog dodatnog teksta:
{
  "project_name": "naziv projekta",
  "deadline": "YYYY-MM-DD",
  "todos": [
    "prvi zadatak",
    "drugi zadatak",
    "treći zadatak"
  ]
}
 
Deadline mora biti između 1 i 6 mjeseci od danas (${new Date().toISOString().split('T')[0]}).
Generiši 4-6 konkretnih todos stavki vezanih za projekat.`,
                },
            },
        ],
    });
    // 2. Parsiramo odgovor LLM-a
    const rawText = samplingResult.content.type === 'text' ? samplingResult.content.text : '';
    let parsed;
    try {
        const cleaned = rawText.replace(/```json|```/g, '').trim();
        parsed = JSON.parse(cleaned);
    }
    catch {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        message: 'LLM nije vratio validan JSON',
                        raw: rawText,
                    }),
                }],
        };
    }
    // 3. Zod validacija LLM outputa
    const schema = zod_1.z.object({
        project_name: zod_1.z.string().min(1),
        deadline: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        todos: zod_1.z.array(zod_1.z.string().min(1)).min(1),
    });
    const validated = schema.safeParse(parsed);
    if (!validated.success) {
        return {
            content: [{
                    type: 'text',
                    text: JSON.stringify({
                        success: false,
                        message: 'LLM je vratio neispravan format',
                        errors: validated.error.format(),
                    }),
                }],
        };
    }
    // 4. Upisujemo u podaci.json
    const data = readDB();
    const newProject = {
        id: nextId(data.projects),
        project_name: validated.data.project_name,
        deadline: validated.data.deadline,
        created_at: new Date().toISOString(),
        todolist: validated.data.todos.map((text, i) => ({
            id: i + 1,
            text,
            is_done: false,
        })),
    };
    data.projects.push(newProject);
    writeDB(data);
    return {
        content: [{
                type: 'text',
                text: JSON.stringify({
                    success: true,
                    message: `Random projekat "${newProject.project_name}" kreiran putem LLM samplinga`,
                    project: newProject,
                }),
            }],
    };
});
async function main() {
    const transport = new stdio_js_1.StdioServerTransport();
    await server.connect(transport);
}
main();
