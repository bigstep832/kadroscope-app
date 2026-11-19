import { useState } from "react";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Plus,
  CalendarOff,
} from "lucide-react";

export function dateKey(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
function offset(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
function monday(date) {
  return offset(date, -(date.getDay() + 6) % 7);
}
const shortDate = new Intl.DateTimeFormat("ru", {
  month: "short",
  day: "numeric",
});
const fullDate = new Intl.DateTimeFormat("ru", { dateStyle: "full" });
const weekdays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
export function Planner({ tasks, edit, open, add, reschedule }) {
  const [week, setWeek] = useState(() => monday(new Date()));
  const [hover, setHover] = useState(null);
  const today = dateKey(new Date());
  function dropProps(key) {
    return {
      onDragOver: (e) => {
        if (edit) {
          e.preventDefault();
          setHover(key);
        }
      },
      onDragLeave: (e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHover(null);
      },
      onDrop: (e) => {
        e.preventDefault();
        setHover(null);
        const task = tasks.find(
          (t) => t.id === e.dataTransfer.getData("text/plain"),
        );
        if (edit && task && task.due !== key) reschedule(task, { due: key });
      },
    };
  }
  function card(task) {
    return (
      <button
        key={task.id}
        draggable={edit}
        onDragStart={(e) => {
          e.dataTransfer.setData("text/plain", task.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => setHover(null)}
        onClick={() => open(task)}
        className={"planTask " + task.status}
      >
        <span className="planLabel">
          {task.tag}
          {edit && <GripVertical size={12} />}
        </span>
        <strong>{task.title}</strong>
      </button>
    );
  }
  const unscheduled = tasks.filter((t) => !t.due);
  return (
    <section className="planner">
      <div className="weekbar">
        <div>
          <CalendarDays size={19} />
          <h3>
            {shortDate.format(week)} — {shortDate.format(offset(week, 6))}{" "}
            {offset(week, 6).getFullYear()}
          </h3>
        </div>
        <nav aria-label="Выбор недели">
          <button
            className="ico"
            title="Предыдущая неделя"
            onClick={() => setWeek(offset(week, -7))}
          >
            <ChevronLeft size={18} />
          </button>
          <button className="btn" onClick={() => setWeek(monday(new Date()))}>
            Сегодня
          </button>
          <button
            className="ico"
            title="Следующая неделя"
            onClick={() => setWeek(offset(week, 7))}
          >
            <ChevronRight size={18} />
          </button>
        </nav>
      </div>
      <div className="weekgrid">
        {weekdays.map((weekday, index) => {
          const date = offset(week, index),
            key = dateKey(date),
            items = tasks.filter((t) => t.due === key);
          return (
            <section
              key={key}
              aria-label={fullDate.format(date)}
              {...dropProps(key)}
              className={
                "weekday " +
                (key === today ? "today " : "") +
                (hover === key ? "dropTarget" : "")
              }
            >
              <div className="dayhead">
                <span>{weekday}</span>
                <b>{date.getDate()}</b>
                {edit && (
                  <button
                    className="ico"
                    title={"Новая задача на " + fullDate.format(date)}
                    onClick={() => add("todo", key)}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
              <div className="daytasks">
                {items.map(card)}
                {!items.length && <span className="noPlan">Нет задач</span>}
              </div>
            </section>
          );
        })}
      </div>
      <div
        className={"noDate " + (hover === "" ? "dropTarget" : "")}
        {...dropProps("")}
      >
        <h3>
          <CalendarOff size={16} />
          Без срока <span>{unscheduled.length}</span>
        </h3>
        {unscheduled.length ? (
          <div className="unscheduled">{unscheduled.map(card)}</div>
        ) : (
          <p>
            {edit
              ? "Перетащите задачу сюда, чтобы снять срок."
              : "Все задачи имеют срок."}
          </p>
        )}
      </div>
    </section>
  );
}
