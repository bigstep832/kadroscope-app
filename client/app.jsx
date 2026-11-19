import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  PanelsTopLeft,
  SquareCheckBig,
  Bell,
  FolderClosed,
  Plus,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  LayoutGrid,
  Columns3,
  List,
  ChartNoAxesColumn,
  Users,
  UserPlus,
  Search,
  SlidersHorizontal,
  X,
  LogIn,
  Layers3,
  FolderKanban,
  CalendarDays,
  Menu,
  Check,
  Activity,
  ArrowUpRight,
  Settings2,
  BriefcaseBusiness,
  Keyboard,
  Archive,
  Command,
} from "lucide-react";
import {
  Avatar,
  Logo,
  ProjectArt,
  request,
  Empty,
  Modal,
  prios,
  lanes,
} from "./shared.jsx";
import { WorkspaceDialog, TaskDialog } from "./forms.jsx";
import { Board, ListView, Reports } from "./board.jsx";
import { CommandPalette } from "./command-palette.jsx";
import { Planner } from "./planner.jsx";
import { ProjectPulse } from "./project-pulse.jsx";
import { FocusTimer } from "./focus-timer.jsx";
import { ArchiveView } from "./archive.jsx";
import "./style.css";
import "./workbench.css";

function App() {
  const [session, setSession] = useState(null),
    [projectId, setPid] = useState(""),
    [data, setData] = useState(null),
    [page, setPage] = useState("board"),
    [tab, setTab] = useState("board");
  const [dialog, setDialog] = useState(null),
    [error, setError] = useState(""),
    [query, setQuery] = useState(""),
    [filters, setFilters] = useState(false),
    [priority, setPriority] = useState(""),
    [assignee, setAssignee] = useState("");
  const [mobile, setMobile] = useState(false),
    [collapsed, setCollapsed] = useState(false),
    [read, setRead] = useState(0);
  const [reload, setReload] = useState(0);
  const [statusFilter, setStatusFilter] = useState("");
  const [toast, setToast] = useState(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 7000);
    return () => clearTimeout(t);
  }, [toast]);
  const currentPid = useRef(""),
    seq = useRef(0),
    searchRef = useRef(null);
  const current = session?.projects.find((p) => p.id === projectId);
  const select = useCallback((id) => {
    currentPid.current = id;
    seq.current++;
    setPid(id);
    setData(null);
    setDialog(null);
    setToast(null);
    setStatusFilter("");
    setMobile(false);
    setPage("board");
    setTab("board");
    setQuery("");
    setPriority("");
    setAssignee("");
    setFilters(false);
    setReload((v) => v + 1);
    localStorage.setItem("kadr-project", id);
  }, []);
  async function loadSession(id) {
    const s = await request("me");
    setSession(s);
    const chosen =
      [id, localStorage.getItem("kadr-project")].find((v) =>
        s.projects.some((p) => p.id === v),
      ) || s.projects[0]?.id;
    if (chosen) select(chosen);
  }
  useEffect(() => {
    loadSession().catch((e) => setError(e.message));
  }, []);
  const refresh = useCallback(async () => {
    const id = currentPid.current,
      serial = ++seq.current;
    if (!id) return;
    const fresh = await request("projects/" + id);
    if (currentPid.current === id && serial === seq.current) setData(fresh);
  }, []);
  useEffect(() => {
    if (!projectId) return;
    let active = true;
    const guarded = () =>
      refresh().catch((e) => {
        if (active) setError(e.message);
      });
    guarded();
    let es, timer;
    if (session.live) {
      es = new EventSource("/api/projects/" + projectId + "/live");
      es.onmessage = guarded;
    } else {
      let rev = null;
      timer = setInterval(async () => {
        if (!active || document.hidden) return;
        try {
          const r = await request("projects/" + projectId + "/revision");
          if (active && r.revision !== rev) {
            rev = r.revision;
            await guarded();
          }
        } catch (e) {
          if (active) setError(e.message);
        }
      }, 2500);
    }
    return () => {
      active = false;
      es?.close();
      clearInterval(timer);
    };
  }, [projectId, reload, refresh]);
  const readKey = "kadr-read-" + session?.person.id + "-" + projectId;
  useEffect(
    () => setRead(Number(localStorage.getItem(readKey) || 0)),
    [readKey],
  );
  useEffect(() => {
    if (page === "inbox" && data?.events.length) {
      const n = data.events[0].id;
      localStorage.setItem(readKey, n);
      setRead(n);
    }
  }, [page, data, readKey]);
  useEffect(() => {
    const key = (e) => {
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key.toLowerCase() === "k" &&
        (!dialog || dialog.kind === "palette") &&
        data
      ) {
        e.preventDefault();
        setDialog(dialog ? null : { kind: "palette" });
      }
      if (
        e.key === "/" &&
        !dialog &&
        !e.target.closest?.("input,select,textarea,[contenteditable=true]") &&
        searchRef.current
      ) {
        e.preventDefault();
        searchRef.current.focus();
      }
      if (e.key === "Escape") {
        setFilters(false);
        setMobile(false);
      }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [dialog, data]);
  const close = () => setDialog(null);
  const nav = (p) => {
    setStatusFilter("");
    setPage(p);
    setTab("board");
    setMobile(false);
    setFilters(false);
    setQuery("");
    setPriority("");
    setAssignee("");
  };
  const add = (status, due = "") => setDialog({ kind: "task", status, due }),
    open = (t) => setDialog({ kind: "task", initial: t });
  const updateTask = async (t, fields, allowUndo = true) => {
    try {
      await request("projects/" + projectId + "/tasks", {
        id: t.id,
        version: t.version,
        ...fields,
      });
      await refresh();
      if (allowUndo && currentPid.current === projectId) {
        const previous = Object.fromEntries(
          Object.keys(fields).map((key) => [key, t[key]]),
        );
        setToast({
          text: fields.status ? "Статус задачи изменён" : "Срок задачи изменён",
          undo: async () => {
            setToast(null);
            await updateTask({ ...t, version: t.version + 1 }, previous, false);
          },
        });
      }
    } catch (e) {
      setError(e.message);
      await refresh();
    }
  };
  const activeTasks = data?.tasks.filter((t) => !t.archived) || [];
  const archivedTasks = data?.tasks.filter((t) => t.archived) || [];
  async function changeArchive(task, archive) {
    await request(
      "projects/" + projectId + "/" + (archive ? "archive" : "restore"),
      { id: task.id, version: task.version },
    );
    await refresh();
    setToast({
      text: archive ? "Задача в архиве" : "Задача восстановлена",
      undo: async () => {
        await changeArchive({ ...task, version: task.version + 1 }, !archive);
        setToast(null);
      },
    });
  }
  async function focus(operation, task, session) {
    try {
      await request("projects/" + projectId + "/focus", {
        id: task.id,
        operation,
        session,
      });
      await refresh();
      if (operation === "finish") setToast({ text: "Время записано в задачу" });
      if (operation === "start") close();
    } catch (e) {
      await refresh();
      if (operation === "start") throw e;
      setError(e.message);
    }
  }
  function showView(id) {
    nav("board");
    setTab(id);
  }
  const edit = current?.role !== "viewer",
    unread =
      data?.events.filter((e) => e.id > read && e.person !== session.person.id)
        .length || 0;
  const tasks =
    activeTasks.filter(
      (t) =>
        (page !== "mine" || t.assignee === session.person.id) &&
        (!statusFilter || t.status === statusFilter) &&
        (!priority || t.priority === priority) &&
        (!assignee || (t.assignee || "none") === assignee) &&
        [t.title, t.description, t.tag]
          .join(" ")
          .toLocaleLowerCase("ru")
          .includes(query.trim().toLocaleLowerCase("ru")),
    ) || [];
  if (!session || !current)
    return (
      <div className="loading">
        <Logo />
        <h1>Кадр</h1>
        <p>{error || "Открываем рабочее пространство…"}</p>
        {error && (
          <>
            <button className="btn" onClick={() => location.reload()}>
              Повторить
            </button>
            {error.includes("ChatGPT") && (
              <a href="/signin-with-chatgpt?return_to=/" target="_top">
                Войти через ChatGPT
              </a>
            )}
          </>
        )}
      </div>
    );
  const person = session.person;
  const commands = [
    ...[
      ["board", "Открыть доску"],
      ["list", "Открыть список задач"],
      ["calendar", "Открыть календарь"],
      ["reports", "Посмотреть отчёты"],
    ].map(([id, title]) => ({ id, title, execute: () => showView(id) })),
    { id: "mine", title: "Показать мои задачи", execute: () => nav("mine") },
    { id: "archive", title: "Открыть архив", execute: () => nav("archive") },
    {
      id: "project",
      title: "Создать проект",
      execute: () => setDialog({ kind: "project" }),
    },
    ...(edit
      ? [{ id: "task", title: "Создать задачу", execute: () => add("todo") }]
      : []),
  ];
  const sideBtn = (k, Icon, title, count) => (
    <button
      className={"sidelink " + (page === k ? "active" : "")}
      onClick={() => nav(k)}
      title={title}
    >
      <Icon size={18} />
      <span>{title}</span>
      {count > 0 && <em>{count}</em>}
    </button>
  );
  return (
    <div
      className={
        "shell " + (collapsed ? "compact " : "") + (mobile ? "mobile-open" : "")
      }
    >
      {mobile && (
        <button
          className="scrim"
          aria-label="Закрыть меню"
          onClick={() => setMobile(false)}
        />
      )}
      <aside className="sidebar">
        <div className="brand">
          <Logo />
          <b>Кадр</b>
          <button
            className="ico collapse"
            title="Свернуть меню"
            onClick={() => {
              setCollapsed(!collapsed);
              setMobile(false);
            }}
          >
            <PanelLeftClose size={16} />
          </button>
        </div>
        <div className="workspace">
          <span className="workspaceicon">
            <Layers3 size={19} />
          </span>
          <div>
            <b>Мастерская</b>
            <small>Рабочее пространство</small>
          </div>
        </div>
        <nav>
          <div className="sidelabel">Рабочая область</div>
          {sideBtn("board", PanelsTopLeft, "Доска проекта")}
          {sideBtn("mine", SquareCheckBig, "Мои задачи")}
          {sideBtn("inbox", Bell, "Уведомления", unread)}
          {sideBtn("archive", Archive, "Архив", archivedTasks.length)}
          <div className="sidelabel projectlabel">
            Проекты
            <button
              className="ico"
              aria-label="Новый проект"
              onClick={() => setDialog({ kind: "project" })}
            >
              <Plus size={15} />
            </button>
          </div>
          {session.projects.map((p, i) => (
            <button
              key={p.id}
              title={p.title}
              className={
                "projectlink " + (p.id === projectId ? "selected" : "")
              }
              onClick={() => select(p.id)}
            >
              <span className={"projectdot dot" + (i % 3)} />
              <span>{p.title}</span>
            </button>
          ))}
          <button
            className="joinlink"
            onClick={() => setDialog({ kind: "join" })}
            title="Вступить в проект"
          >
            <LogIn size={15} />
            <span>Вступить в проект</span>
          </button>
        </nav>
        <button
          className="profile"
          onClick={() => setDialog({ kind: "account" })}
        >
          <Avatar person={person} size={34} />
          <div>
            <b>{person.name}</b>
            <small>Мой профиль</small>
          </div>
          <Settings2 size={15} />
        </button>
      </aside>
      <div className="main">
        <header className="topbar">
          <button
            className="ico menu"
            aria-label="Открыть меню"
            onClick={() => setMobile(true)}
          >
            <Menu size={20} />
          </button>
          {collapsed && (
            <button
              className="ico expand"
              onClick={() => setCollapsed(false)}
              aria-label="Развернуть меню"
            >
              <PanelLeftOpen size={17} />
            </button>
          )}
          <span className="breadcrumb">
            <FolderClosed size={16} />
            Проекты <ChevronRight size={13} />
            <b>{current.title}</b>
          </span>
          <div className="toolbarRight">
            <button
              className="cmdTrigger"
              aria-label="Открыть палитру команд"
              title="Палитра команд (Ctrl/⌘ K)"
              disabled={!data}
              onClick={() => setDialog({ kind: "palette" })}
            >
              <Command size={15} />
              <span>Команды</span>
              <kbd>Ctrl K</kbd>
            </button>
            <button
              className="ico"
              title="Уведомления"
              onClick={() => nav("inbox")}
            >
              <Bell size={18} />
              {unread > 0 && <i />}
            </button>
            <span className="sep" />
            <button
              className="avatarbtn"
              title="Мой профиль"
              onClick={() => setDialog({ kind: "account" })}
            >
              <Avatar person={person} size={31} />
            </button>
          </div>
        </header>
        <main>
          <ProjectPulse
            project={current}
            tasks={activeTasks}
            filter={statusFilter}
            choose={(status) => {
              const next = statusFilter === status ? "" : status;
              showView("list");
              setStatusFilter(next);
            }}
          />
          <div className="viewbar">
            <div className="tabs">
              {[
                ["board", Columns3, "Доска"],
                ["list", List, "Список"],
                ["calendar", CalendarDays, "Календарь"],
                ["reports", ChartNoAxesColumn, "Отчёты"],
              ].map(([id, I, name]) => (
                <button
                  key={id}
                  className={page === "board" && tab === id ? "selected" : ""}
                  onClick={() => {
                    nav("board");
                    setTab(id);
                  }}
                >
                  <I size={17} />
                  {name}
                </button>
              ))}
            </div>
            {data && (
              <button
                className="team"
                onClick={() => setDialog({ kind: "team" })}
              >
                <span className="stack">
                  {data.members.slice(0, 3).map((m) => (
                    <Avatar key={m.id} person={m} size={25} />
                  ))}
                </span>
                <span>Команда</span>
                <ChevronDown size={14} />
              </button>
            )}
          </div>
          {error && (
            <div className="errorbar" role="alert">
              {error}
              <button
                className="ico"
                onClick={() => {
                  setError("");
                  refresh().catch((e) => setError(e.message));
                }}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!data ? (
            <p className="muted">Загрузка проекта…</p>
          ) : (
            <>
              <div className="sectionhead">
                <div>
                  <h2>
                    {page === "mine"
                      ? "Мои задачи"
                      : page === "inbox"
                        ? "Уведомления"
                        : page === "archive"
                          ? "Архив задач"
                          : tab === "calendar"
                            ? "Календарь задач"
                            : tab === "reports"
                              ? "Отчёты проекта"
                              : tab === "list"
                                ? "Список задач"
                                : "Доска задач"}
                  </h2>
                  {page !== "inbox" && tab !== "reports" && (
                    <span className="total">
                      {page === "archive" ? archivedTasks.length : tasks.length}
                    </span>
                  )}
                </div>
                {edit &&
                  page !== "archive" &&
                  page !== "inbox" &&
                  tab !== "reports" && (
                    <button className="primary" onClick={() => add("todo")}>
                      <Plus size={16} />
                      Новая задача
                    </button>
                  )}
              </div>
              {page === "archive" ? (
                <ArchiveView
                  tasks={archivedTasks}
                  open={open}
                  edit={edit}
                  restore={(task) =>
                    changeArchive(task, false).catch((e) => setError(e.message))
                  }
                />
              ) : page === "inbox" ? (
                <div className="activitylist">
                  {data.events.length ? (
                    data.events.map((e) => (
                      <button
                        key={e.id}
                        disabled={!e.task}
                        onClick={() => {
                          const t = data.tasks.find((t) => t.id === e.task);
                          if (t) open(t);
                        }}
                      >
                        <Avatar
                          person={data.members.find((m) => m.id === e.person)}
                        />
                        <div>
                          <strong>{e.text}</strong>
                          <small>
                            {data.members.find((m) => m.id === e.person)?.name}{" "}
                            · {new Date(e.created).toLocaleString("ru")}
                          </small>
                        </div>
                      </button>
                    ))
                  ) : (
                    <Empty>Здесь появятся изменения проекта.</Empty>
                  )}
                </div>
              ) : page === "board" && tab === "reports" ? (
                <Reports data={{ ...data, tasks: activeTasks }} />
              ) : (
                <>
                  <div className="filterrow">
                    <label className="search">
                      <Search size={16} />
                      <input
                        ref={searchRef}
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Поиск задач…"
                        aria-label="Поиск задач"
                      />
                      {query ? (
                        <button
                          className="ico"
                          aria-label="Очистить поиск"
                          onClick={() => setQuery("")}
                        >
                          <X size={13} />
                        </button>
                      ) : (
                        <kbd>/</kbd>
                      )}
                    </label>
                    <div className="filterwrap">
                      <button
                        className={"btn " + (priority || assignee ? "on" : "")}
                        onClick={() => setFilters(!filters)}
                        aria-expanded={filters}
                      >
                        <SlidersHorizontal size={15} />
                        Фильтры
                        {(priority || assignee) && (
                          <b>{Number(!!priority) + Number(!!assignee)}</b>
                        )}
                      </button>
                      {filters && (
                        <div className="filterpanel form">
                          <label>
                            Приоритет
                            <select
                              value={priority}
                              onChange={(e) => setPriority(e.target.value)}
                            >
                              <option value="">Все приоритеты</option>
                              {Object.entries(prios).map(([k, v]) => (
                                <option key={k} value={k}>
                                  {v}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Исполнитель
                            <select
                              value={assignee}
                              onChange={(e) => setAssignee(e.target.value)}
                            >
                              <option value="">Все исполнители</option>
                              <option value="none">Не назначен</option>
                              {data.members.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.name}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="actions">
                            <button
                              className="btn"
                              onClick={() => {
                                setPriority("");
                                setAssignee("");
                              }}
                            >
                              Сбросить
                            </button>
                            <button
                              className="primary"
                              onClick={() => setFilters(false)}
                            >
                              Готово
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    {statusFilter && (
                      <button
                        className="statusChip"
                        onClick={() => setStatusFilter("")}
                      >
                        {lanes.find(([id]) => id === statusFilter)?.[1]}
                        <X size={13} />
                      </button>
                    )}
                  </div>
                  {tab === "calendar" ? (
                    <Planner
                      tasks={tasks}
                      add={add}
                      edit={edit}
                      open={open}
                      reschedule={updateTask}
                    />
                  ) : tab === "list" || page === "mine" ? (
                    <ListView tasks={tasks} data={data} open={open} />
                  ) : (
                    <Board
                      tasks={tasks}
                      data={data}
                      open={open}
                      move={(task, status) => updateTask(task, { status })}
                      add={add}
                      edit={edit}
                    />
                  )}
                </>
              )}
            </>
          )}
        </main>
      </div>
      {data?.focus && (
        <FocusTimer
          session={data.focus}
          task={data.tasks.find((t) => t.id === data.focus.task)}
          operate={focus}
          open={open}
        />
      )}
      {toast && (
        <div
          className={"workToast " + (data?.focus ? "withDock" : "")}
          role="status"
        >
          <Check size={16} />
          {toast.text}
          {toast.undo && (
            <button
              onClick={() =>
                toast.undo().catch((e) => {
                  setToast(null);
                  setError(e.message);
                })
              }
            >
              Отменить
            </button>
          )}
          <button
            aria-label="Закрыть уведомление"
            onClick={() => setToast(null)}
          >
            <X size={14} />
          </button>
        </div>
      )}
      {dialog?.kind === "palette" && data ? (
        <CommandPalette
          actions={commands}
          tasks={activeTasks}
          open={open}
          close={close}
        />
      ) : dialog?.kind === "task" && data ? (
        <TaskDialog
          key={dialog.initial?.id || "new"}
          initial={dialog.initial}
          initialStatus={dialog.status}
          initialDue={dialog.due}
          canManage={edit}
          onArchive={changeArchive}
          onFocus={(task) => focus("start", task)}
          edit={
            edit &&
            !data.tasks.find((t) => t.id === dialog.initial?.id)?.archived
          }
          project={projectId}
          board={data}
          refresh={refresh}
          close={close}
        />
      ) : (
        dialog && (
          <WorkspaceDialog
            key={dialog.kind}
            kind={dialog.kind}
            close={close}
            current={current}
            person={person}
            board={data}
            done={loadSession}
          />
        )
      )}
    </div>
  );
}
createRoot(document.getElementById("root")).render(<App />);
