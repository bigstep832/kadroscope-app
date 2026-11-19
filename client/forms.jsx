import React, { useState } from "react";
import {
  Paperclip,
  Clock3,
  Plus,
  MessageSquare,
  CheckSquare,
  Download,
  UserPlus,
  Copy,
  Link,
  LogOut,
  Archive,
  ArchiveRestore,
  Timer,
} from "lucide-react";
import {
  Modal,
  request,
  Avatar,
  lanes,
  tags,
  prios,
  duration,
} from "./shared.jsx";

function useSubmit() {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function run(fn) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return { run, busy, error };
}
function ErrorText({ text }) {
  return text ? (
    <p className="formerror" role="alert">
      {text}
    </p>
  ) : null;
}
const values = (f) => Object.fromEntries(new FormData(f));
export function TaskDialog({
  initial,
  board,
  project,
  close,
  refresh,
  edit,
  initialStatus,
  initialDue,
  onArchive,
  onFocus,
  canManage,
}) {
  const existing = !!initial,
    base = initial || {
      title: "",
      description: "",
      status: initialStatus || "todo",
      priority: "normal",
      tag: "Проект",
      assignee: "",
      due: initialDue || "",
    };
  const [draft, setDraft] = useState(base),
    [tab, setTab] = useState("task");
  const { run, busy, error } = useSubmit();
  const id = initial?.id;
  const liveTask = board.tasks.find((task) => task.id === id);
  const archived = Boolean(liveTask?.archived);
  const bind = (k) => ({
    value: draft[k] || "",
    onChange: (e) => setDraft({ ...draft, [k]: e.target.value }),
    disabled: !edit,
  });
  const extra = (action, data) =>
    request("projects/" + project + "/" + action, { id, ...data });
  const submitExtra = (action, field) => (e) => {
    e.preventDefault();
    const f = e.currentTarget,
      data = values(f);
    run(async () => {
      await extra(action, field ? { minutes: Number(data.minutes) } : data);
      f.reset();
      await refresh();
    });
  };
  const list = (key) => board[key].filter((x) => x.task === id);
  return (
    <Modal
      title={existing ? "Карточка задачи" : "Новая задача"}
      close={close}
      wide
    >
      {existing && (
        <div className="dialogtabs">
          {[
            ["task", "Задача"],
            ["discussion", "Обсуждение"],
            ["files", "Файлы и время"],
          ].map(([k, v]) => (
            <button
              key={k}
              className={tab === k ? "sel" : ""}
              onClick={() => setTab(k)}
            >
              {v}
            </button>
          ))}
        </div>
      )}
      <ErrorText text={error} />
      {existing && (
        <div className="taskTools">
          {archived ? (
            <span className="archivedHint">
              <Archive size={15} />В архиве
            </span>
          ) : (
            edit && (
              <button
                className="toolButton"
                disabled={busy || !!board.focus}
                title={
                  board.focus
                    ? "Уже есть открытая фокус-сессия"
                    : "Начать учёт времени"
                }
                onClick={() => run(() => onFocus(initial))}
              >
                <Timer size={16} />
                {board.focus?.task === id
                  ? "Идёт фокус-сессия"
                  : "Начать фокус"}
              </button>
            )
          )}
          {canManage && (
            <button
              className="toolButton archiveAction"
              disabled={busy}
              onClick={() =>
                run(async () => {
                  await onArchive(liveTask, !archived);
                  close();
                })
              }
            >
              {archived ? <ArchiveRestore size={15} /> : <Archive size={15} />}{" "}
              {archived ? "Восстановить" : "В архив"}
            </button>
          )}
        </div>
      )}
      {tab === "task" && (
        <>
          <form
            className="form"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await request("projects/" + project + "/tasks", {
                  ...draft,
                  id,
                });
                await refresh();
                close();
              });
            }}
          >
            <label>
              Название
              <input
                autoFocus
                required
                maxLength={160}
                placeholder="Что нужно сделать?"
                data-initial-focus
                {...bind("title")}
              />
            </label>
            <label>
              Описание
              <textarea
                rows={3}
                placeholder="Детали и ожидаемый результат"
                maxLength={5000}
                {...bind("description")}
              />
            </label>
            <div className="formgrid">
              <label>
                Статус
                <select {...bind("status")}>
                  {lanes.map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Исполнитель
                <select {...bind("assignee")}>
                  <option value="">Не назначен</option>
                  {board.members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Приоритет
                <select {...bind("priority")}>
                  {Object.entries(prios).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Срок
                <input type="date" {...bind("due")} />
              </label>
              <label>
                Категория
                <select {...bind("tag")}>
                  {tags.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>
            </div>
            {edit && (
              <div className="actions">
                <button type="button" className="btn" onClick={close}>
                  Отмена
                </button>
                <button className="primary" disabled={busy}>
                  {existing ? "Сохранить" : "Создать задачу"}
                </button>
              </div>
            )}
          </form>
          {existing && (
            <section className="extra">
              <h3>
                <CheckSquare size={17} />
                Подзадачи
              </h3>
              {list("checklist").map((c) => (
                <label className="check" key={c.id}>
                  <input
                    type="checkbox"
                    checked={!!c.done}
                    disabled={!edit || busy}
                    onChange={() =>
                      run(async () => {
                        await extra("check", { item: c.id, done: !c.done });
                        await refresh();
                      })
                    }
                  />
                  {c.title}
                </label>
              ))}
              {edit && (
                <form className="inlineform" onSubmit={submitExtra("check")}>
                  <input
                    name="title"
                    required
                    maxLength={200}
                    placeholder="Новая подзадача"
                    aria-label="Новая подзадача"
                  />
                  <button
                    className="btn"
                    disabled={busy}
                    aria-label="Добавить подзадачу"
                  >
                    <Plus size={18} />
                  </button>
                </form>
              )}
            </section>
          )}
        </>
      )}
      {tab === "discussion" && (
        <section className="extra">
          <h3>
            <MessageSquare size={17} />
            Комментарии
          </h3>
          {list("comments").length === 0 && (
            <p className="muted">Комментариев пока нет.</p>
          )}
          {list("comments").map((c) => {
            const m = board.members.find((m) => m.id === c.person);
            return (
              <div className="comment" key={c.id}>
                <Avatar person={m} />
                <div>
                  <b>{m?.name}</b>
                  <small>{new Date(c.created).toLocaleString("ru")}</small>
                  <p>{c.body}</p>
                </div>
              </div>
            );
          })}
          {edit && (
            <form className="form" onSubmit={submitExtra("comment")}>
              <textarea
                name="body"
                required
                maxLength={2500}
                placeholder="Написать комментарий"
                aria-label="Комментарий"
              />
              <button className="primary" disabled={busy}>
                Отправить
              </button>
            </form>
          )}
        </section>
      )}
      {tab === "files" && (
        <>
          <section className="extra">
            <h3>
              <Paperclip size={17} />
              Вложения
            </h3>
            {list("files").map((f) => (
              <a
                className="file"
                key={f.id}
                href={"/api/projects/" + project + "/files/" + f.id}
                download={f.name}
              >
                <Download size={16} />
                {f.name} <small>{Math.ceil(f.size / 1024)} КБ</small>
              </a>
            ))}
            {edit && (
              <label className="upload">
                Прикрепить файл до 1 МБ
                <input
                  type="file"
                  disabled={busy}
                  onChange={(e) => {
                    const file = e.target.files[0];
                    e.target.value = "";
                    if (file)
                      run(async () => {
                        if (file.size > 1000000)
                          throw Error("Максимальный размер файла — 1 МБ.");
                        const content = await new Promise((ok, fail) => {
                          const r = new FileReader();
                          r.onload = () => ok(r.result.split(",")[1]);
                          r.onerror = () =>
                            fail(Error("Не удалось прочитать файл."));
                          r.readAsDataURL(file);
                        });
                        await extra("file", { name: file.name, content });
                        await refresh();
                      });
                  }}
                />
              </label>
            )}
          </section>
          <section className="extra">
            <h3>
              <Clock3 size={17} />
              Учёт времени
            </h3>
            {list("logs").map((l) => (
              <div className="lineitem" key={l.id}>
                <span>
                  {board.members.find((m) => m.id === l.person)?.name}
                </span>
                <b>{duration(l.minutes)}</b>
              </div>
            ))}
            {edit && (
              <form className="inlineform" onSubmit={submitExtra("time", true)}>
                <input
                  aria-label="Минуты работы"
                  name="minutes"
                  type="number"
                  min="1"
                  max="1440"
                  required
                  placeholder="Минуты работы"
                />
                <button className="btn" disabled={busy}>
                  Записать
                </button>
              </form>
            )}
          </section>
        </>
      )}
    </Modal>
  );
}
export function WorkspaceDialog({ kind, close, current, person, done, board }) {
  const { run, busy, error } = useSubmit();
  const [mode, setMode] = useState("register"),
    [invite, setInvite] = useState(""),
    [copied, setCopied] = useState(false);
  const title = {
    project: "Новый проект",
    join: "Вступить в проект",
    team: "Команда проекта",
    account: "Мой профиль",
  }[kind];
  async function action(e, fn) {
    e.preventDefault();
    const data = values(e.currentTarget);
    await run(() => fn(data));
  }
  return (
    <Modal title={title} close={close}>
      <ErrorText text={error} />
      {kind === "project" && (
        <form
          className="form"
          onSubmit={(e) =>
            action(e, async (d) => {
              const p = await request("projects", d);
              await done(p.id);
            })
          }
        >
          <label>
            Название проекта
            <input
              name="title"
              required
              maxLength={80}
              autoFocus
              placeholder="Например, мобильное приложение"
            />
          </label>
          <label>
            Команда или описание
            <input
              name="description"
              maxLength={140}
              placeholder="Например, продуктовая команда"
            />
          </label>
          <button className="primary" disabled={busy}>
            Создать проект
          </button>
        </form>
      )}
      {kind === "join" && (
        <form
          className="form"
          onSubmit={(e) =>
            action(e, async (d) => {
              const p = await request("join", d);
              await done(p.id);
            })
          }
        >
          <label>
            Код приглашения
            <input
              name="code"
              required
              autoFocus
              placeholder="Код от владельца проекта"
            />
          </label>
          <button className="primary" disabled={busy}>
            Вступить
          </button>
        </form>
      )}
      {kind === "team" && (
        <>
          <div className="memberlist">
            {board.members.map((m) => (
              <div className="lineitem" key={m.id}>
                <span>
                  <Avatar person={m} />
                  {m.name}
                </span>
                <small>
                  {
                    {
                      owner: "Владелец",
                      member: "Участник",
                      viewer: "Наблюдатель",
                    }[m.role]
                  }
                </small>
              </div>
            ))}
          </div>
          {current.role === "owner" && (
            <form
              className="form extra"
              onSubmit={(e) =>
                action(e, async (d) => {
                  const r = await request(
                    "projects/" + current.id + "/invite",
                    d,
                  );
                  setInvite(r.code);
                  setCopied(false);
                })
              }
            >
              <label>
                Доступ по приглашению
                <select name="role">
                  <option value="member">Участник — может редактировать</option>
                  <option value="viewer">Наблюдатель — может смотреть</option>
                </select>
              </label>
              <button className="btn" disabled={busy}>
                <UserPlus size={16} />
                Создать приглашение
              </button>
            </form>
          )}
          {invite && (
            <div className="inviteresult">
              <p>
                Одноразовый код действует 48 часов. Передайте его коллеге для
                входа через «Вступить в проект».
              </p>
              <input
                aria-label="Код приглашения"
                readOnly
                value={invite}
                onFocus={(e) => e.target.select()}
              />
              <button
                className="btn"
                onClick={() =>
                  run(async () => {
                    await navigator.clipboard.writeText(invite);
                    setCopied(true);
                  })
                }
              >
                <Copy size={15} />
                {copied ? "Скопировано" : "Копировать"}
              </button>
            </div>
          )}
        </>
      )}
      {kind === "account" && (
        <>
          <div className="accountrow">
            <Avatar person={person} size={42} />
            <div>
              <b>{person.name}</b>
              <small>
                {person.hosted
                  ? "Аккаунт ChatGPT"
                  : person.email || "Демонстрационный профиль"}
              </small>
            </div>
          </div>
          {person.hosted ? (
            <a
              className="btn"
              href="/signout-with-chatgpt?return_to=/"
              target="_top"
            >
              Выйти из аккаунта
            </a>
          ) : person.email ? (
            <button
              className="btn"
              onClick={() =>
                run(async () => {
                  await request("auth/logout", {});
                  await done();
                })
              }
            >
              <LogOut size={16} />
              Выйти
            </button>
          ) : (
            <>
              <div className="dialogtabs">
                {[
                  ["register", "Создать аккаунт"],
                  ["login", "Войти"],
                ].map(([k, v]) => (
                  <button
                    className={k === mode ? "sel" : ""}
                    key={k}
                    onClick={() => setMode(k)}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <form
                className="form"
                onSubmit={(e) =>
                  action(e, async (d) => {
                    await request("auth/" + mode, d);
                    await done();
                  })
                }
              >
                {mode === "register" && (
                  <label>
                    Ваше имя
                    <input name="name" required maxLength={80} />
                  </label>
                )}
                <label>
                  Почта
                  <input
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                  />
                </label>
                <label>
                  Пароль
                  <input
                    name="password"
                    type="password"
                    minLength={8}
                    maxLength={128}
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    required
                    placeholder="От 8 символов"
                  />
                </label>
                <button className="primary" disabled={busy}>
                  {mode === "login" ? "Войти" : "Сохранить профиль"}
                </button>
              </form>
            </>
          )}
        </>
      )}
    </Modal>
  );
}
