import {
  identity,
  account,
  clean,
  requireThat as check,
  stmt,
  rows,
  Problem,
} from "./auth.mjs";
import { statuses, priorities, tags } from "./seed.mjs";
import { updateFocus } from "./focus.mjs";

const json = (data, status = 200, cookie) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...(cookie ? { "Set-Cookie": cookie } : {}),
    },
  });
const requireText = (v, max, label) => {
  check(
    typeof v === "string" && v.trim() && v.trim().length <= max,
    400,
    label,
  );
  return v.trim();
};
const now = () => Date.now();
const uid = () => crypto.randomUUID();
const qEvent = (db, project, person, text, task = null) =>
  stmt(
    db,
    "INSERT INTO events(project,person,text,task,created) VALUES (?,?,?,?,?)",
    project,
    person,
    text,
    task,
    now(),
  );
async function state(db, project, user) {
  const queries = [
    [
      "members",
      "SELECT p.id,p.name,p.color,m.role FROM members m JOIN people p ON p.id=m.person WHERE m.project=? ORDER BY m.rowid",
    ],
    ["tasks", "SELECT * FROM tasks WHERE project=? ORDER BY created"],
    [
      "checklist",
      "SELECT c.* FROM checklist c JOIN tasks t ON t.id=c.task WHERE t.project=? ORDER BY c.rowid",
    ],
    [
      "comments",
      "SELECT c.* FROM comments c JOIN tasks t ON t.id=c.task WHERE t.project=? ORDER BY c.created",
    ],
    [
      "files",
      "SELECT f.id,f.task,f.name,f.size FROM files f JOIN tasks t ON t.id=f.task WHERE t.project=? ORDER BY f.rowid",
    ],
    [
      "logs",
      "SELECT l.* FROM time_logs l JOIN tasks t ON t.id=l.task WHERE t.project=? ORDER BY l.created",
    ],
    [
      "events",
      "SELECT * FROM events WHERE project=? ORDER BY id DESC LIMIT 60",
    ],
  ];
  const results = await db.batch([
    ...queries.map(([, sql]) => stmt(db, sql, project)),
    stmt(
      db,
      "SELECT id,task,started,elapsed FROM focus_sessions WHERE project=? AND person=?",
      project,
      user,
    ),
  ]);
  const board = Object.fromEntries(
    queries.map(([name], i) => [name, results[i].results]),
  );
  return { ...board, focus: results.at(-1).results[0] || null };
}
async function validTask(db, p, b) {
  const title = requireText(
    b.title,
    160,
    "Название должно содержать от 1 до 160 символов.",
  );
  check(
    statuses.includes(b.status) &&
      priorities.includes(b.priority) &&
      tags.includes(b.tag),
    400,
    "Проверьте статус, приоритет и категорию.",
  );
  const due = b.due || "";
  check(
    !due ||
      (/^\d{4}-\d\d-\d\d$/.test(due) &&
        !isNaN(Date.parse(due)) &&
        new Date(due).toISOString().startsWith(due)),
    400,
    "Проверьте дату.",
  );
  const assignee = b.assignee || null;
  if (assignee)
    check(
      await stmt(
        db,
        "SELECT 1 FROM members WHERE project=? AND person=?",
        p,
        assignee,
      ).first(),
      400,
      "Исполнитель не состоит в проекте.",
    );
  return [
    title,
    clean(b.description, 5000),
    b.status,
    b.priority,
    b.tag,
    assignee,
    due,
  ];
}
async function route(req, env) {
  const url = new URL(req.url),
    parts = url.pathname.slice(5).split("/"),
    [scope, p, action] = parts,
    db = env.DB;
  const post = req.method === "POST";
  check(post || req.method === "GET", 405, "Метод недоступен.");
  const origin = req.headers.get("origin");
  if (post && origin)
    check(origin === url.origin, 403, "Источник запроса не разрешён.");
  const b = post
    ? await req.json().catch(() => {
        throw new Problem(400, "Нужен JSON.");
      })
    : {};
  check(b && typeof b === "object", 400, "Проверьте данные.");
  const { person, cookie } = await identity(req, env, !post && scope === "me");
  const user = person.id;
  if (scope === "me" && !post) {
    const projects = await rows(
      db,
      "SELECT p.*,m.role FROM projects p JOIN members m ON p.id=m.project WHERE m.person=? ORDER BY p.created,p.rowid",
      user,
    );
    return json({ person, projects, live: !!env.LOCAL }, 200, cookie);
  }
  if (scope === "auth" && post && ["register", "login", "logout"].includes(p)) {
    const result = await account(req, env, person, p, b);
    return json({ ok: true }, 200, result.cookie);
  }
  if (scope === "projects" && !p && post) {
    const title = requireText(b.title, 80, "Введите название до 80 символов."),
      id = uid();
    await db.batch([
      stmt(
        db,
        "INSERT INTO projects VALUES (?,?,?,?)",
        id,
        title,
        clean(b.description, 140),
        now(),
      ),
      stmt(db, "INSERT INTO members VALUES (?,?,?)", id, user, "owner"),
      qEvent(db, id, user, "Создан проект «" + title + "»"),
    ]);
    return json({ id }, 201);
  }
  if (scope === "join" && post) {
    const code = clean(b.code, 60),
      iv = await stmt(
        db,
        "SELECT * FROM invites WHERE code=? AND expires>?",
        code,
        now(),
      ).first();
    check(iv, 404, "Приглашение не найдено или истекло.");
    await db.batch([
      stmt(
        db,
        "INSERT OR IGNORE INTO members(project,person,role) SELECT project,?,role FROM invites WHERE code=? AND expires>?",
        user,
        code,
        now(),
      ),
      stmt(
        db,
        "INSERT INTO events(project,person,text,created) SELECT ?,?,?,? WHERE changes()=1",
        iv.project,
        user,
        "Присоединение к команде",
        now(),
      ),
      stmt(db, "DELETE FROM invites WHERE code=?", code),
    ]);
    check(
      await stmt(
        db,
        "SELECT role FROM members WHERE person=? AND project=?",
        user,
        iv.project,
      ).first(),
      409,
      "Приглашение уже использовано.",
    );
    env.notify?.(iv.project);
    return json({ id: iv.project });
  }
  check(scope === "projects" && p, 404, "Адрес не найден.");
  const member = await stmt(
    db,
    "SELECT role FROM members WHERE project=? AND person=?",
    p,
    user,
  ).first();
  check(member, 403, "У вас нет доступа к проекту.");
  if (!post) {
    if (!action) return json(await state(db, p, user));
    if (action === "revision")
      return json(
        await stmt(
          db,
          "SELECT MAX(id) AS revision FROM events WHERE project=?",
          p,
        ).first(),
      );
    if (action === "live" && env.subscribe) return env.subscribe(p, req.signal);
    if (action === "files") {
      const f = await stmt(
        db,
        "SELECT f.* FROM files f JOIN tasks t ON t.id=f.task WHERE t.project=? AND f.id=?",
        p,
        parts[3] || "",
      ).first();
      check(f, 404, "Файл не найден.");
      return new Response(
        Uint8Array.from(atob(f.content), (c) => c.charCodeAt(0)),
        {
          headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition":
              "attachment; filename*=UTF-8''" + encodeURIComponent(f.name),
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    }
    throw new Problem(404, "Адрес не найден.");
  }
  if (action === "invite") {
    check(
      member.role === "owner",
      403,
      "Приглашения создаёт владелец проекта.",
    );
    check(["member", "viewer"].includes(b.role), 400, "Выберите роль.");
    const code = uid();
    await stmt(
      db,
      "INSERT INTO invites VALUES (?,?,?,?)",
      code,
      p,
      b.role,
      now() + 48 * 3600000,
    ).run();
    return json({ code });
  }
  check(member.role !== "viewer", 403, "У вас доступ только для просмотра.");
  if (action === "tasks" && !b.id) {
    const id = uid(),
      fields = await validTask(db, p, b);
    await db.batch([
      stmt(
        db,
        "INSERT INTO tasks(id,project,title,description,status,priority,tag,assignee,due,created) VALUES (?,?,?,?,?,?,?,?,?,?)",
        id,
        p,
        ...fields,
        now(),
      ),
      qEvent(db, p, user, "Создана задача «" + fields[0] + "»", id),
    ]);
    env.notify?.(p);
    return json({ id }, 201);
  }
  const task = await stmt(
    db,
    "SELECT * FROM tasks WHERE project=? AND id=?",
    p,
    typeof b.id === "string" ? b.id : "",
  ).first();
  check(task, 404, "Задача не найдена.");
  const id = task.id;
  if (action === "archive" || action === "restore") {
    const archive = action === "archive";
    const result = await db.batch([
      stmt(
        db,
        "UPDATE tasks SET archived=?,version=version+1 WHERE id=? AND version=? AND archived=? AND NOT EXISTS(SELECT 1 FROM focus_sessions WHERE task=?)",
        archive ? 1 : 0,
        id,
        b.version || 0,
        archive ? 0 : 1,
        id,
      ),
      stmt(
        db,
        "INSERT INTO events(project,person,text,task,created) SELECT ?,?,?,?,? WHERE changes()=1",
        p,
        user,
        (archive ? "В архиве" : "Восстановлена задача") + " · " + task.title,
        id,
        now(),
      ),
    ]);
    check(
      result[0].meta.changes,
      409,
      "Проверьте версию карточки и завершите активные таймеры задачи.",
    );
    env.notify?.(p);
    return json({ ok: true });
  }
  check(!task.archived, 409, "Для изменений восстановите задачу из архива.");
  if (action === "focus") {
    await updateFocus(db, p, user, task, b);
    env.notify?.(p);
    return json({ ok: true });
  }
  if (action === "tasks") {
    const fields = await validTask(db, p, { ...task, ...b });
    const result = await db.batch([
      stmt(
        db,
        "UPDATE tasks SET title=?,description=?,status=?,priority=?,tag=?,assignee=?,due=?,version=version+1 WHERE id=? AND version=?",
        ...fields,
        id,
        b.version || 0,
      ),
      stmt(
        db,
        "INSERT INTO events(project,person,text,task,created) SELECT ?,?,?,?,? WHERE changes()=1",
        p,
        user,
        "Обновлена задача «" + fields[0] + "»",
        id,
        now(),
      ),
    ]);
    check(
      result[0].meta.changes,
      409,
      "Другой участник изменил задачу. Откройте её заново.",
    );
  } else {
    let mutation, verb;
    if (action === "comment") {
      mutation = stmt(
        db,
        "INSERT INTO comments VALUES (?,?,?,?,?)",
        uid(),
        id,
        user,
        requireText(b.body, 2500, "Введите комментарий до 2500 символов."),
        now(),
      );
      verb = "Комментарий";
    } else if (action === "check") {
      if (b.item) {
        check(
          await stmt(
            db,
            "SELECT id FROM checklist WHERE task=? AND id=?",
            id,
            b.item,
          ).first(),
          404,
          "Подзадача не найдена.",
        );
        mutation = stmt(
          db,
          "UPDATE checklist SET done=? WHERE id=? AND task=?",
          b.done ? 1 : 0,
          b.item,
          id,
        );
      } else
        mutation = stmt(
          db,
          "INSERT INTO checklist(id,task,title) VALUES (?,?,?)",
          uid(),
          id,
          requireText(b.title, 200, "Введите текст подзадачи до 200 символов."),
        );
      verb = "Изменены подзадачи";
    } else if (action === "time") {
      check(
        Number.isInteger(b.minutes) && b.minutes > 0 && b.minutes <= 1440,
        400,
        "Введите от 1 до 1440 минут.",
      );
      mutation = stmt(
        db,
        "INSERT INTO time_logs VALUES (?,?,?,?,?)",
        uid(),
        id,
        user,
        b.minutes,
        now(),
      );
      verb = "Записано время";
    } else if (action === "file") {
      check(
        typeof b.content === "string" &&
          b.content.length <= 1400000 &&
          /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
            b.content,
          ),
        400,
        "Загрузите файл до 1 МБ.",
      );
      const size = atob(b.content).length;
      check(size <= 1000000, 400, "Максимальный размер файла — 1 МБ.");
      mutation = stmt(
        db,
        "INSERT INTO files VALUES (?,?,?,?,?)",
        uid(),
        id,
        requireText(b.name, 180, "Проверьте название файла."),
        size,
        b.content,
      );
      verb = "Прикреплён файл";
    } else throw new Problem(404, "Действие не найдено.");
    await db.batch([
      mutation,
      qEvent(db, p, user, verb + " · " + task.title, id),
    ]);
  }
  env.notify?.(p);
  return json({ ok: true });
}
export async function api(req, env) {
  try {
    return await route(req, env);
  } catch (e) {
    if (!e.status) console.error(e.message);
    return json(
      { error: e.status ? e.message : "Не удалось обработать запрос." },
      e.status || 500,
    );
  }
}
