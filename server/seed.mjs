export const statuses = ["todo", "doing", "review", "done"];
export const priorities = ["low", "normal", "high"];
export const tags = [
  "Дизайн",
  "Разработка",
  "Контент",
  "Исследование",
  "Проект",
];
const samples = [
  ["Собрать референсы для главной", "Исследование", "todo", "normal", 1, "", 2],
  ["Описать сценарий онбординга", "Контент", "todo", "high", 0, "", 3],
  ["Проверить контраст компонентов", "Дизайн", "todo", "low", 2, "", 5],
  ["Обновить визуальную концепцию", "Дизайн", "doing", "high", 0, "orbit", 1],
  ["Сверстать навигацию", "Разработка", "doing", "normal", 2, "", 4],
  ["Согласовать набор иконок", "Дизайн", "review", "normal", 1, "", 0],
  ["Подготовить тексты для форм", "Контент", "review", "low", 3, "", 2],
  ["Провести интервью с командой", "Исследование", "done", "normal", 3, "", -1],
  ["Составить карту платформы", "Проект", "done", "low", 0, "", -2],
];
export function initialBoard(db, person) {
  const project = crypto.randomUUID(),
    now = Date.now();
  const q = (sql, ...values) => db.prepare(sql).bind(...values);
  const team = [
    person,
    ...Array.from({ length: 3 }, () => crypto.randomUUID()),
  ];
  const rows = [
    q(
      "INSERT INTO projects VALUES (?,?,?,?)",
      project,
      "Редизайн платформы",
      "Продуктовая команда",
      now,
    ),
  ];
  ["Анна Ким", "Михаил Орлов", "Лиза Волкова"].forEach((name, i) =>
    rows.push(
      q(
        "INSERT INTO people(id,name,color) VALUES (?,?,?)",
        team[i + 1],
        name,
        i + 1,
      ),
    ),
  );
  team.forEach((id, i) =>
    rows.push(
      q(
        "INSERT INTO members VALUES (?,?,?)",
        project,
        id,
        i ? "member" : "owner",
      ),
    ),
  );
  samples.forEach(([title, tag, status, priority, idx, cover, offset], i) => {
    const id = crypto.randomUUID(),
      due = new Date(now + offset * 86400000).toISOString().slice(0, 10);
    rows.push(
      q(
        "INSERT INTO tasks(id,project,title,description,status,priority,tag,assignee,due,cover,created) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        id,
        project,
        title,
        i === 3
          ? "Собрать направление для главной страницы, подобрать типографику и показать варианты команде."
          : "",
        status,
        priority,
        tag,
        team[idx],
        due,
        cover,
        now + i,
      ),
    );
    if (i === 0 || i === 3 || i === 7)
      [
        "Подготовить материалы",
        "Обсудить с командой",
        "Зафиксировать результат",
      ].forEach((s, j) =>
        rows.push(
          q(
            "INSERT INTO checklist VALUES (?,?,?,?)",
            crypto.randomUUID(),
            id,
            s,
            Number(i === 7 || j === 0),
          ),
        ),
      );
    if (i === 3)
      rows.push(
        q(
          "INSERT INTO comments VALUES (?,?,?,?,?)",
          crypto.randomUUID(),
          id,
          team[1],
          "Добавила в подборку примеры с крупной типографикой. Посмотрим вместе на ревью.",
          now,
        ),
      );
  });
  rows.push(
    q(
      "INSERT INTO events(project,person,text,created) VALUES (?,?,?,?)",
      project,
      person,
      "Открыт проект «Редизайн платформы»",
      now,
    ),
  );
  return rows;
}
