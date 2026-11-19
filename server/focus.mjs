import { requireThat, stmt } from "./auth.mjs";

export async function updateFocus(db, project, person, task, body) {
  const at = Date.now();
  const sql = (query, ...params) => stmt(db, query, ...params);
  const guard = "id=? AND project=? AND person=? AND task=?";
  const args = [
    typeof body.session === "string" ? body.session : "",
    project,
    person,
    task.id,
  ];
  const actions = {
    start: () =>
      sql(
        "INSERT OR IGNORE INTO focus_sessions(id,project,person,task,started) SELECT ?,?,?,id,? FROM tasks WHERE id=? AND project=? AND archived=0",
        crypto.randomUUID(),
        project,
        person,
        at,
        task.id,
        project,
      ),
    pause: () =>
      sql(
        "UPDATE focus_sessions SET elapsed=elapsed+MAX(0,?-started),started=NULL WHERE " +
          guard +
          " AND started IS NOT NULL",
        at,
        ...args,
      ),
    resume: () =>
      sql(
        "UPDATE focus_sessions SET started=? WHERE " +
          guard +
          " AND started IS NULL",
        at,
        ...args,
      ),
    cancel: () => sql("DELETE FROM focus_sessions WHERE " + guard, ...args),
    finish: () =>
      sql(
        "INSERT INTO time_logs(id,task,person,minutes,created) SELECT id,task,person,MAX(1,CAST((elapsed+COALESCE(MAX(0,?-started),0)+59999)/60000 AS INTEGER)),? FROM focus_sessions WHERE " +
          guard,
        at,
        at,
        ...args,
      ),
  };
  requireThat(
    Object.hasOwn(actions, body.operation),
    400,
    "Неизвестная команда таймера.",
  );
  const messages = {
    start: "Запущен таймер",
    pause: "Таймер на паузе",
    resume: "Таймер продолжен",
    cancel: "Таймер отменён",
    finish: "Время записано",
  };
  const batch = [
    actions[body.operation](),
    sql(
      "INSERT INTO events(project,person,text,task,created) SELECT ?,?,?,?,? WHERE changes()=1",
      project,
      person,
      messages[body.operation] + " · " + task.title,
      task.id,
      at,
    ),
  ];
  if (body.operation === "finish")
    batch.push(sql("DELETE FROM focus_sessions WHERE " + guard, ...args));
  const result = await db.batch(batch);
  requireThat(
    result[0].meta.changes,
    409,
    "Состояние таймера изменилось. Проверьте текущую сессию.",
  );
}
