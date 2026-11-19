CREATE TABLE people (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, password TEXT, color INTEGER NOT NULL DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE sessions (token TEXT PRIMARY KEY, person TEXT NOT NULL REFERENCES people(id), expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE projects (id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE members (project TEXT NOT NULL REFERENCES projects(id), person TEXT NOT NULL REFERENCES people(id), role TEXT NOT NULL CHECK(role IN ('owner','member','viewer')), PRIMARY KEY(project,person));
--> statement-breakpoint
CREATE TABLE invites (code TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id), role TEXT NOT NULL CHECK(role IN ('member','viewer')), expires INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE tasks (
 id TEXT PRIMARY KEY, project TEXT NOT NULL REFERENCES projects(id), title TEXT NOT NULL, description TEXT NOT NULL,
 status TEXT NOT NULL, priority TEXT NOT NULL, tag TEXT NOT NULL, assignee TEXT REFERENCES people(id), due TEXT NOT NULL,
 cover TEXT NOT NULL DEFAULT '', version INTEGER NOT NULL DEFAULT 1, created INTEGER NOT NULL
);
--> statement-breakpoint
CREATE INDEX task_project ON tasks(project,created);
--> statement-breakpoint
CREATE TABLE checklist (id TEXT PRIMARY KEY, task TEXT NOT NULL REFERENCES tasks(id), title TEXT NOT NULL, done INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE comments (id TEXT PRIMARY KEY, task TEXT NOT NULL REFERENCES tasks(id), person TEXT NOT NULL REFERENCES people(id), body TEXT NOT NULL, created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE files (id TEXT PRIMARY KEY, task TEXT NOT NULL REFERENCES tasks(id), name TEXT NOT NULL, size INTEGER NOT NULL, content TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE time_logs (id TEXT PRIMARY KEY, task TEXT NOT NULL REFERENCES tasks(id), person TEXT NOT NULL REFERENCES people(id), minutes INTEGER NOT NULL CHECK(minutes>0), created INTEGER NOT NULL);
--> statement-breakpoint
CREATE TABLE events (id INTEGER PRIMARY KEY AUTOINCREMENT, project TEXT NOT NULL REFERENCES projects(id), person TEXT NOT NULL REFERENCES people(id), text TEXT NOT NULL, task TEXT REFERENCES tasks(id), created INTEGER NOT NULL);
--> statement-breakpoint
CREATE INDEX events_project ON events(project,id);
