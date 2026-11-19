ALTER TABLE tasks ADD COLUMN archived INTEGER NOT NULL DEFAULT 0;
--> statement-breakpoint
CREATE TABLE focus_sessions (
  id TEXT PRIMARY KEY,
  project TEXT NOT NULL REFERENCES projects(id),
  person TEXT NOT NULL REFERENCES people(id),
  task TEXT NOT NULL REFERENCES tasks(id),
  started INTEGER,
  elapsed INTEGER NOT NULL DEFAULT 0,
  UNIQUE(project, person)
);
