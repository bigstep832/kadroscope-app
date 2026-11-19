import { FolderKanban, Activity } from "lucide-react";
import { lanes } from "./shared.jsx";
export function ProjectPulse({ project, tasks, filter, choose }) {
  const counts = lanes.map(
    ([status]) => tasks.filter((t) => t.status === status).length,
  );
  const percent = tasks.length
    ? Math.round((100 * counts[3]) / tasks.length)
    : 0;
  return (
    <header className="pulseHero">
      <div className="pulseIntro">
        <span className="pulseLabel">
          <FolderKanban size={15} />
          {project.description || "Командный проект"}
        </span>
        <h1>{project.title}</h1>
        <div className="pulseProgress">
          <span className="pixelTrack" aria-hidden="true">
            {Array.from({ length: 20 }, (_, i) => (
              <i
                key={i}
                className={i < Math.round(percent / 5) ? "filled" : ""}
              />
            ))}
          </span>
          <span>
            <b>{percent}%</b> завершено
          </span>
        </div>
      </div>
      <div className="pulsePlot">
        <span className="plotTitle">
          <Activity size={14} />
          Задачи по статусам
        </span>
        <div className="plotColumns">
          {lanes.map(([key, name], i) => (
            <button
              key={key}
              className={"plotCol " + key}
              aria-pressed={filter === key}
              title={"Показать задачи: " + name}
              onClick={() => choose(key)}
            >
              <span className="barArea">
                <i
                  style={{
                    height:
                      8 + (48 * counts[i]) / Math.max(...counts, 1) + "px",
                  }}
                />
                <b>{counts[i]}</b>
              </span>
              <span className="plotName">{name}</span>
            </button>
          ))}
        </div>
      </div>
    </header>
  );
}
