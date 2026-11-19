import { Archive, ArchiveRestore } from "lucide-react";
import { day, Empty, Tag } from "./shared.jsx";
export function ArchiveView({ tasks, open, restore, edit }) {
  if (!tasks.length)
    return (
      <div className="archiveBlank">
        <Archive size={29} />
        <h3>Архив пуст</h3>
        <p>
          Отправьте задачу в архив из её карточки. Комментарии, файлы и учтённое
          время сохранятся.
        </p>
      </div>
    );
  return (
    <div className="archiveRows">
      {tasks.map((task) => (
        <div className="archiveRow" key={task.id}>
          <Archive size={17} />
          <button className="tasklink" onClick={() => open(task)}>
            {task.title}
          </button>
          <Tag name={task.tag} />
          {edit && (
            <button className="btn" onClick={() => restore(task)}>
              <ArchiveRestore size={15} />
              Восстановить
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
