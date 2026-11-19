import { useEffect, useState } from "react";
import { Timer, Play, Pause, Check, X } from "lucide-react";

function displayTime(ms) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const parts = [Math.floor(seconds / 60) % 60, seconds % 60].map((n) =>
    String(n).padStart(2, "0"),
  );
  return (hours ? hours + ":" : "") + parts.join(":");
}
export function FocusTimer({ session, task, operate, open }) {
  const [now, setNow] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  useEffect(() => setConfirmCancel(false), [session.id]);
  useEffect(() => {
    setNow(Date.now());
    if (session.started == null) return;
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, [session.started]);
  async function act(operation) {
    if (busy) return;
    setBusy(true);
    try {
      await operate(operation, task, session.id);
    } finally {
      setBusy(false);
    }
  }
  const running = session.started != null;
  const elapsed =
    session.elapsed + (running ? Math.max(0, now - session.started) : 0);
  return (
    <aside className="focusDock" aria-label="Фокус-таймер">
      <div className="focusSymbol">
        <Timer size={22} />
      </div>
      <div className="focusTitle">
        <small>{running ? "Фокус-сессия" : "Сессия на паузе"}</small>
        <button title="Открыть задачу таймера" onClick={() => open(task)}>
          {task.title}
        </button>
      </div>
      <output aria-label="Длительность фокус-сессии" aria-live="off">
        {displayTime(elapsed)}
      </output>
      <button
        className="dockAction"
        title={running ? "Пауза" : "Продолжить"}
        disabled={busy}
        onClick={() => act(running ? "pause" : "resume")}
      >
        {running ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <button
        className="dockSave"
        disabled={busy}
        onClick={() => act("finish")}
      >
        <Check size={16} />
        Записать
      </button>
      <button
        className="dockAction"
        title="Отменить без записи"
        disabled={busy}
        onClick={() => setConfirmCancel(true)}
      >
        <X size={15} />
      </button>
      {confirmCancel && (
        <div className="cancelFocus">
          <span>Сбросить время без записи?</span>
          <button onClick={() => setConfirmCancel(false)}>Оставить</button>
          <button disabled={busy} onClick={() => act("cancel")}>
            Сбросить
          </button>
        </div>
      )}
    </aside>
  );
}
