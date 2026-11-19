import React, { useEffect, useRef } from "react";
import {
  X,
  Equal,
  ChevronsUp,
  ChevronDown,
  LayoutDashboard,
} from "lucide-react";
export const lanes = [
  ["todo", "К работе"],
  ["doing", "В работе"],
  ["review", "На проверке"],
  ["done", "Готово"],
];
export const tags = [
  "Дизайн",
  "Разработка",
  "Контент",
  "Исследование",
  "Проект",
];
export const prios = { high: "Высокий", normal: "Средний", low: "Низкий" };
export const day = (d) =>
  d
    ? new Intl.DateTimeFormat("ru", { day: "numeric", month: "short" })
        .format(new Date(d + "T12:00:00"))
        .replace(".", "")
    : "";
export const duration = (n) =>
  n >= 60
    ? Math.floor(n / 60) + " ч" + (n % 60 ? " " + (n % 60) + " мин" : "")
    : n + " мин";
export async function request(path, body) {
  const r = await fetch(
    "/api/" + path,
    body === undefined
      ? { cache: "no-store" }
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  let data;
  try {
    data = await r.json();
  } catch {
    throw Error("Сервер недоступен. Проверьте соединение.");
  }
  if (!r.ok) throw Error(data.error || "Не удалось выполнить действие.");
  return data;
}
export function Avatar({ person, size = 28 }) {
  return (
    <span
      title={person?.name || "Без исполнителя"}
      className={"ava av" + ((person?.color || 0) % 6)}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.35) }}
    >
      {(person?.name || "—")
        .split(/\s+/)
        .slice(0, 2)
        .map((s) => s[0])
        .join("")}
    </span>
  );
}
export function Priority({ value }) {
  const Icon =
    value === "high" ? ChevronsUp : value === "normal" ? Equal : ChevronDown;
  return (
    <span className={"priority " + value}>
      <Icon size={14} />
      {prios[value]}
    </span>
  );
}
export function Tag({ name }) {
  return <span className={"tag tag" + tags.indexOf(name)}>{name}</span>;
}
export function Modal({ title, close, children, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    d.showModal();
    d.querySelector("[data-initial-focus]:not(:disabled)")?.focus();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === ref.current) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
      aria-label={title}
    >
      <div className="modalhead">
        <h2>{title}</h2>
        <button className="ico" onClick={close} aria-label="Закрыть">
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function Logo() {
  return (
    <span className="logo">
      <i />
      <i />
      <i />
    </span>
  );
}
export function ProjectArt({ small = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    function paint() {
      const box = c.getBoundingClientRect(),
        w = Math.max(1, box.width),
        h = Math.max(1, box.height),
        scale = Math.min(window.devicePixelRatio || 1, 2);
      c.width = w * scale;
      c.height = h * scale;
      const ctx = c.getContext("2d");
      ctx.scale(scale, scale);
      ctx.clearRect(0, 0, w, h);
      ctx.save();
      const size = small
        ? Math.min(w / 1.95, h / 1.03)
        : Math.min(w / 2.1, h / 1.08);
      ctx.translate(w * (small ? 0.52 : 0.56), h * (small ? 0.52 : 0.52));
      ctx.rotate(small ? -0.24 : -0.29);
      // A stack of continuous folded sheets, drawn back to front with a lit bevel.
      const n = small ? 36 : 58,
        steps = 150;
      for (let j = 0; j < n; j++) {
        const depth = j / (n - 1),
          off = (depth - 0.5) * size * 0.65;
        const path = new Path2D();
        for (let k = 0; k <= steps; k++) {
          const a = (k / steps) * Math.PI * 2;
          const x =
            size * (0.77 * Math.cos(a) + 0.17 * Math.cos(3 * a + 0.7)) +
            off * 0.66;
          const y =
            size * (0.46 * Math.sin(a) + 0.22 * Math.sin(2 * a - 0.65)) +
            off * 0.58;
          if (k === 0) path.moveTo(x, y);
          else path.lineTo(x, y);
        }
        path.closePath();
        const g = ctx.createLinearGradient(
          -size,
          -size * 0.4,
          size,
          size * 0.45,
        );
        const l = 30 + depth * 35;
        const hue = small ? 19 : 255;
        g.addColorStop(0, "hsl(" + hue + ",78%," + (l + 10) + "%)");
        g.addColorStop(0.32, "hsl(" + (hue + 7) + ",91%," + (l + 18) + "%)");
        g.addColorStop(0.56, "hsl(" + hue + ",72%," + (l - 12) + "%)");
        g.addColorStop(0.8, "hsl(" + (hue + 9) + ",90%," + (l + 16) + "%)");
        g.addColorStop(1, "hsl(" + hue + ",76%," + l + "%)");
        ctx.strokeStyle = g;
        ctx.lineWidth = size * 0.18;
        ctx.lineJoin = "round";
        ctx.stroke(path);
        if (j % 3 === 1) {
          ctx.lineWidth = 0.8;
          ctx.strokeStyle = "rgba(255,255,255,.20)";
          ctx.stroke(path);
        }
      }
      ctx.restore();
    }
    const ro = new ResizeObserver(paint);
    ro.observe(c);
    paint();
    return () => ro.disconnect();
  }, [small]);
  return (
    <canvas
      className={small ? "art smallart" : "art"}
      ref={ref}
      aria-hidden="true"
    />
  );
}
export function Empty({ children }) {
  return (
    <div className="empty">
      <LayoutDashboard size={24} />
      <p>{children}</p>
    </div>
  );
}
