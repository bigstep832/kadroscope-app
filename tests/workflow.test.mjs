import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));

test(
  "Два участника, живое обновление, роли, файлы и сохранение после рестарта",
  { timeout: 30000 },
  async (t) => {
    const dir = await mkdtemp(join(tmpdir(), "kadr-test-"));
    let proc, origin;
    async function boot() {
      proc = spawn(process.execPath, ["server/local.mjs"], {
        cwd: root,
        env: {
          ...process.env,
          PORT: "0",
          HOST: "127.0.0.1",
          KADR_DB: join(dir, "test.sqlite"),
        },
        stdio: ["ignore", "pipe", "pipe"],
      });
      const [msg] = await Promise.race([
        once(proc.stdout, "data"),
        once(proc, "exit").then(() => {
          throw Error("Сервер не запустился");
        }),
      ]);
      origin = msg.toString().match(/http:\/\/127\.0\.0\.1:\d+/)[0];
    }
    async function stop() {
      if (proc && proc.exitCode === null) {
        const ended = once(proc, "exit");
        proc.kill();
        await ended;
      }
    }
    t.after(async () => {
      await stop();
      await rm(dir, { recursive: true, force: true });
    });
    // Start with an actual version-one database, as on an existing installation.
    const legacy = new DatabaseSync(join(dir, "test.sqlite"));
    legacy.exec(
      await readFile(join(root, "drizzle/0000_workspace.sql"), "utf8"),
    );
    legacy.exec(
      "INSERT INTO projects VALUES ('legacy','Существующий проект','',0); PRAGMA user_version=1;",
    );
    legacy.close();
    await boot();
    const migrated = new DatabaseSync(join(dir, "test.sqlite"));
    assert.equal(
      migrated.prepare("SELECT title FROM projects WHERE id='legacy'").get()
        .title,
      "Существующий проект",
    );
    assert.equal(migrated.prepare("PRAGMA user_version").get().user_version, 2);
    migrated.close();
    function browser() {
      let cookie = "";
      return async (path, body, status = 200) => {
        const h = { cookie };
        if (body) h["Content-Type"] = "application/json";
        const r = await fetch(origin + "/api/" + path, {
          method: body ? "POST" : "GET",
          headers: h,
          body: body ? JSON.stringify(body) : undefined,
        });
        if (r.headers.has("set-cookie"))
          cookie = r.headers.get("set-cookie").split(";")[0];
        if (path.endsWith("/live")) return r.body.getReader();
        if (r.headers.get("content-type") === "application/octet-stream")
          return r.text();
        const result = await r.json();
        assert.equal(r.status, status, JSON.stringify(result));
        return result;
      };
    }
    const owner = browser(),
      colleague = browser(),
      observer = browser();
    await owner("me");
    await colleague("me");
    await observer("me");
    const password = crypto.randomUUID();
    await owner("auth/register", {
      name: "Тестовый владелец",
      email: "owner@example.test",
      password,
    });
    const p = await owner("projects", { title: "Запуск приложения" }, 201);
    const path = "projects/" + p.id;
    await colleague(path, null, 403);
    for (const [client, role] of [
      [colleague, "member"],
      [observer, "viewer"],
    ]) {
      const invite = await owner(path + "/invite", { role });
      await client("join", { code: invite.code });
      await client("join", { code: invite.code }, 404);
    }
    await colleague(path + "/invite", { role: "member" }, 403);
    const user = (await colleague("me")).person;
    const task = await owner(
      path + "/tasks",
      {
        title: "Подготовить сборку",
        status: "todo",
        priority: "high",
        tag: "Разработка",
        assignee: user.id,
      },
      201,
    );
    const id = task.id,
      stream = await colleague(path + "/live");
    await stream.read();
    await owner(path + "/tasks", { id, status: "doing", version: 1 });
    assert.match(
      new TextDecoder().decode((await stream.read()).value),
      /refresh/,
    );
    await stream.cancel();
    const fresh = await colleague(path);
    assert.equal(fresh.tasks[0].status, "doing");
    await colleague(
      path + "/tasks",
      { id, title: "Устаревшая правка", version: 1 },
      409,
    );
    await observer(path + "/comment", { id, body: "Запись" }, 403);
    await colleague(path + "/check", { id, title: "Собрать бандл" });
    await colleague(path + "/comment", { id, body: "Готово к проверке" });
    await colleague(path + "/file", {
      id,
      name: "notes.txt",
      content: btoa("build OK"),
    });
    await colleague(path + "/time", { id, minutes: 45 });
    const saved = await observer(path);
    assert.equal(saved.logs[0].minutes, 45);
    assert.equal(saved.comments[0].body, "Готово к проверке");
    assert.equal(saved.checklist[0].title, "Собрать бандл");
    assert.equal(
      await observer(path + "/files/" + saved.files[0].id),
      "build OK",
    );
    await colleague(path + "/tasks", { id, version: 2, due: "2028-02-29" });
    assert.equal((await observer(path)).tasks[0].due, "2028-02-29");
    await observer(path + "/focus", { id, operation: "start" }, 403);
    await colleague(path + "/focus", { id, operation: "start" });
    const session = (await colleague(path)).focus.id;
    await colleague(path + "/focus", { id, operation: "start" }, 409);
    assert.equal((await owner(path)).focus, null);
    await owner(path + "/archive", { id, version: 3 }, 409);
    const clockFixture = new DatabaseSync(join(dir, "test.sqlite"));
    clockFixture
      .prepare("UPDATE focus_sessions SET started=started-90000 WHERE id=?")
      .run(session);
    clockFixture.close();
    await colleague(path + "/focus", { id, session, operation: "pause" });
    await stop();
    await boot();
    const paused = (await colleague(path)).focus;
    assert.equal(paused.id, session);
    assert.equal(paused.started, null);
    assert.ok(paused.elapsed >= 90000);
    await colleague(path + "/focus", { id, session, operation: "resume" });
    await colleague(path + "/focus", { id, session, operation: "finish" });
    await colleague(path + "/focus", { id, session, operation: "finish" }, 409);
    const finished = await colleague(path);
    assert.equal(finished.focus, null);
    assert.equal(finished.logs.filter((l) => l.id === session).length, 1);
    assert.equal(finished.logs.find((l) => l.id === session).minutes, 2);
    await observer(path + "/archive", { id, version: 3 }, 403);
    await owner(path + "/archive", { id, version: 3 });
    assert.equal((await observer(path)).tasks[0].archived, 1);
    await colleague(path + "/comment", { id, body: "В архив" }, 409);
    await owner(path + "/restore", { id, version: 3 }, 409);
    await owner(path + "/restore", { id, version: 4 });
    const restored = await observer(path);
    assert.equal(restored.tasks[0].archived, 0);
    assert.equal(restored.comments[0].body, "Готово к проверке");
    assert.equal(restored.files[0].id, saved.files[0].id);
    assert.equal((await observer(path)).tasks[0].status, "doing");
    await owner("auth/logout", {});
    const returning = browser();
    await returning("me");
    await returning("auth/login", { email: "owner@example.test", password });
    assert.equal((await returning(path)).tasks[0].assignee, user.id);
  },
);
