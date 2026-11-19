import React, { useState } from "react";
import {
  Plus,
  CalendarDays,
  MessageSquare,
  CheckSquare,
  Paperclip,
  Clock3,
  Circle,
  LoaderCircle,
  CircleCheck,
  CircleDot,
  SearchX,
  Users,
} from "lucide-react";
import {
  Tag,
  Priority,
  Avatar,
  day,
  lanes,
  duration,
  ProjectArt,
  Empty,
} from "./shared.jsx";
export const statusIcons = [Circle, LoaderCircle, CircleDot, CircleCheck];
function TaskCard({ task: t, data, open, edit }) {
  const checks = data.checklist.filter((c) => c.task === t.id),
    comments = data.comments.filter((c) => c.task === t.id),
    files = data.files.filter((c) => c.task === t.id);
  const person = data.members.find((m) => m.id === t.assignee);
  return (
    <button
      draggable={edit}
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", t.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      onClick={() => open(t)}
      className="taskcard"
    >
      <div className="cardtop">
        <Tag name={t.tag} />
        <span
          className={"prioicon " + t.priority}
          title={
            {
              low: "Низкий приоритет",
              normal: "Средний приоритет",
              high: "Высокий приоритет",
            }[t.priority]
          }
          aria-label="Приоритет"
        >
          <i />
          <i />
          <i />
        </span>
      </div>
      <strong>{t.title}</strong>
      {t.cover && (
        <div className="cardart">
          <ProjectArt small />
        </div>
      )}
      {(checks.length > 0 || comments.length > 0 || files.length > 0) && (
        <div className="counters">
          {checks.length > 0 && (
            <span>
              <CheckSquare />
              {checks.filter((c) => c.done).length}/{checks.length}
            </span>
          )}
          {comments.length > 0 && (
            <span>
              <MessageSquare />
              {comments.length}
            </span>
          )}
          {files.length > 0 && (
            <span>
              <Paperclip />
              {files.length}
            </span>
          )}
        </div>
      )}
      <div className="cardfoot">
        <span>
          {t.due && (
            <>
              <CalendarDays size={14} />
              {day(t.due)}
            </>
          )}
        </span>
        {person && <Avatar person={person} size={25} />}
      </div>
    </button>
  );
}
export function Board({ tasks, data, open, add, move, edit }) {
  const [over, setOver] = useState("");
  return (
    <div className="boardscroll">
      <div className="board">
        {lanes.map(([k, name], i) => {
          const list = tasks.filter((t) => t.status === k),
            Icon = statusIcons[i];
          return (
            <section
              key={k}
              className={"lane " + k + (over === k ? " over" : "")}
              onDragOver={(e) => {
                if (edit) {
                  e.preventDefault();
                  setOver(k);
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget)) setOver("");
              }}
              onDrop={(e) => {
                e.preventDefault();
                setOver("");
                const t = tasks.find(
                  (t) => t.id === e.dataTransfer.getData("text/plain"),
                );
                if (edit && t && t.status !== k) move(t, k);
              }}
            >
              <div className="lanehead">
                <Icon size={16} />
                <h3>{name}</h3>
                <span>{list.length}</span>
                {edit && (
                  <button
                    aria-label={"Добавить задачу в «" + name + "»"}
                    onClick={() => add(k)}
                  >
                    <Plus size={17} />
                  </button>
                )}
              </div>
              <div className="cards">
                {list.map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    data={data}
                    open={open}
                    edit={edit}
                  />
                ))}
                {edit && (
                  <button className="addcard" onClick={() => add(k)}>
                    <Plus size={15} />
                    Добавить задачу
                  </button>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
export function ListView({ tasks, data, open }) {
  if (!tasks.length) return <Empty>Задач по этому запросу нет.</Empty>;
  return (
    <div className="tablescroll">
      <table>
        <thead>
          <tr>
            {["Задача", "Статус", "Исполнитель", "Приоритет", "Срок"].map(
              (x) => (
                <th key={x}>{x}</th>
              ),
            )}
          </tr>
        </thead>
        <tbody>
          {tasks.map((t) => (
            <tr key={t.id}>
              <td>
                <button className="tasklink" onClick={() => open(t)}>
                  {t.title}
                </button>
              </td>
              <td>{lanes.find((l) => l[0] === t.status)[1]}</td>
              <td>
                {data.members.find((m) => m.id === t.assignee)?.name ||
                  "Не назначен"}
              </td>
              <td>
                <Priority value={t.priority} />
              </td>
              <td>{day(t.due) || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
export function Reports({ data }) {
  const total = data.tasks.length,
    done = data.tasks.filter((t) => t.status === "done").length;
  return (
    <div className="reports">
      <div className="stats">
        {[
          [total, "Всего задач"],
          [done, "Завершено"],
          [
            duration(data.logs.reduce((a, l) => a + l.minutes, 0)),
            "Записано времени",
          ],
        ].map(([v, l]) => (
          <div key={l}>
            <small>{l}</small>
            <strong>{v}</strong>
          </div>
        ))}
      </div>
      <h3>Загрузка команды</h3>
      <div className="tablescroll">
        <table>
          <thead>
            <tr>
              {[
                "Исполнитель",
                "Открытые задачи",
                "Завершено",
                "Учтено времени",
              ].map((k) => (
                <th key={k}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...data.members, { id: null, name: "Не назначен" }].map((m) => {
              const tasks = data.tasks.filter((t) => t.assignee === m.id),
                active = tasks.filter((t) => t.status !== "done").length;
              return (
                <tr key={m.id || "none"}>
                  <td>
                    <span className="inline">
                      <Avatar person={m} />
                      {m.name}
                    </span>
                  </td>
                  <td>
                    <span className="loadbar">
                      <i
                        style={{
                          width:
                            Math.round((active / Math.max(total, 1)) * 100) +
                            "%",
                        }}
                      />
                    </span>
                    {active}
                  </td>
                  <td>{tasks.length - active}</td>
                  <td>
                    {duration(
                      data.logs
                        .filter((l) => l.person === m.id)
                        .reduce((v, l) => v + l.minutes, 0),
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
