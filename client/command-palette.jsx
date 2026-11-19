import { useDeferredValue, useEffect, useId, useRef, useState } from "react";
import {
  Search,
  CornerDownLeft,
  Command,
  ChevronRight,
  ListTodo,
} from "lucide-react";
import { Modal } from "./shared.jsx";

export function CommandPalette({ actions, tasks, open, close }) {
  const [query, setQuery] = useState(""),
    [cursor, setCursor] = useState(0);
  const resultList = useId(),
    container = useRef(null);
  const term = useDeferredValue(query).trim().toLocaleLowerCase("ru");
  const items = [
    ...actions.map((a) => ({ ...a, group: "Команды" })),
    ...tasks.map((t) => ({
      id: t.id,
      title: t.title,
      hint: t.tag,
      group: "Задачи",
      execute: () => open(t),
    })),
  ].filter((item) =>
    (item.title + " " + (item.hint || ""))
      .toLocaleLowerCase("ru")
      .includes(term),
  );
  const active = Math.min(cursor, Math.max(items.length - 1, 0));
  useEffect(() => {
    container.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
  }, [active, term]);
  function run(item) {
    if (item) {
      close();
      item.execute();
    }
  }
  function handleKey(e) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (items.length)
        setCursor(
          (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
            items.length,
        );
    }
    if (e.key === "Enter" && !e.nativeEvent.isComposing) {
      e.preventDefault();
      run(items[active]);
    }
  }
  return (
    <Modal title="Палитра команд" close={close} wide>
      <div className="palette">
        <label className="commandSearch">
          <Search size={18} />
          <input
            data-initial-focus
            placeholder="Найти команду или задачу…"
            aria-label="Найти команду или задачу"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-controls={resultList}
            aria-activedescendant={
              items.length ? resultList + "-" + active : undefined
            }
            value={query}
            onKeyDown={handleKey}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
          />
        </label>
        <div
          ref={container}
          id={resultList}
          className="commandResults"
          role="listbox"
          aria-label="Результаты"
        >
          {items.map((item, i) => {
            const Icon = item.group === "Команды" ? Command : ListTodo;
            return (
              <div key={item.group + item.id} role="presentation">
                {items[i - 1]?.group !== item.group && (
                  <div className="resultGroup">{item.group}</div>
                )}
                <button
                  id={resultList + "-" + i}
                  className="commandItem"
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  tabIndex={-1}
                  onClick={() => run(item)}
                >
                  <Icon size={16} />
                  <span>{item.title}</span>
                  {item.hint && <small>{item.hint}</small>}
                  <ChevronRight size={14} />
                </button>
              </div>
            );
          })}
        </div>
        {!items.length && (
          <p className="paletteEmpty">
            Ничего не найдено. Попробуйте другое слово.
          </p>
        )}
        <div className="paletteFoot">
          <kbd>↑ ↓</kbd> Выбор <CornerDownLeft size={13} /> Открыть{" "}
          <kbd>Esc</kbd> Закрыть
        </div>
      </div>
    </Modal>
  );
}
