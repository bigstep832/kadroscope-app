import { initialBoard } from "./seed.mjs";

export class Problem extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
export function requireThat(ok, status, message) {
  if (!ok) throw new Problem(status, message);
}
export const clean = (value, max = 200) =>
  typeof value === "string" ? value.trim().slice(0, max) : "";
export const stmt = (db, sql, ...args) => db.prepare(sql).bind(...args);
export const rows = async (db, sql, ...args) =>
  (await stmt(db, sql, ...args).all()).results;
const hex = (buf) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join(
    "",
  );
const hash = async (token) =>
  hex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token)));
async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return hex(
    await crypto.subtle.deriveBits(
      {
        name: "PBKDF2",
        salt: new TextEncoder().encode(salt),
        iterations: 210000,
        hash: "SHA-256",
      },
      key,
      256,
    ),
  );
}
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const localToken = (req) =>
  (req.headers.get("cookie") || "").match(
    /(?:^|;\s*)kadr_sid=([a-f\d-]{36})(?:;|$)/,
  )?.[1];
async function issue(db, id) {
  const token = crypto.randomUUID(),
    expires = Date.now() + 30 * 86400000;
  return {
    insert: stmt(
      db,
      "INSERT INTO sessions VALUES (?,?,?)",
      await hash(token),
      id,
      expires,
    ),
    cookie:
      "kadr_sid=" +
      token +
      "; HttpOnly; Path=/; SameSite=Strict; Max-Age=2592000",
  };
}
export async function identity(req, env, allowCreate) {
  const db = env.DB;
  if (!env.LOCAL) {
    const ident = req.headers.get("oai-authenticated-user-id");
    requireThat(ident, 401, "Войдите через ChatGPT.");
    const id = "site:" + ident;
    let person = await stmt(
      db,
      "SELECT id,name,color FROM people WHERE id=?",
      id,
    ).first();
    if (!person) {
      let name =
        req.headers.get("oai-authenticated-user-full-name") || "Участник";
      if (
        req.headers.get("oai-authenticated-user-full-name-encoding") ===
        "percent-encoded-utf-8"
      ) {
        try {
          name = decodeURIComponent(name);
        } catch {}
      }
      try {
        await db.batch([
          stmt(db, "INSERT INTO people(id,name) VALUES (?,?)", id, clean(name)),
          ...initialBoard(db, id),
        ]);
      } catch (err) {
        if (!(await stmt(db, "SELECT id FROM people WHERE id=?", id).first()))
          throw err;
      }
      person = { id, name: clean(name), color: 0 };
    }
    return { person: { ...person, hosted: true } };
  }
  const token = localToken(req);
  if (token) {
    const person = await stmt(
      db,
      "SELECT p.id,p.name,p.email,p.color FROM sessions s JOIN people p ON p.id=s.person WHERE s.token=? AND s.expires>?",
      await hash(token),
      Date.now(),
    ).first();
    if (person) return { person };
  }
  requireThat(allowCreate, 401, "Сессия завершена. Обновите страницу.");
  const id = crypto.randomUUID(),
    session = await issue(db, id);
  await db.batch([
    stmt(db, "INSERT INTO people(id,name) VALUES (?,?)", id, "Алекс Соколов"),
    session.insert,
    ...initialBoard(db, id),
  ]);
  return {
    person: { id, name: "Алекс Соколов", color: 0 },
    cookie: session.cookie,
  };
}
export async function account(req, env, person, action, b) {
  requireThat(env.LOCAL, 400, "Управление аккаунтом доступно через ChatGPT.");
  const db = env.DB,
    token = localToken(req);
  if (action === "logout") {
    if (token)
      await stmt(
        db,
        "DELETE FROM sessions WHERE token=?",
        await hash(token),
      ).run();
    return {
      cookie: "kadr_sid=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0",
    };
  }
  const email = clean(b.email, 254).toLowerCase(),
    pass = b.password;
  requireThat(
    emailPattern.test(email) &&
      typeof pass === "string" &&
      pass.length >= 8 &&
      pass.length <= 128,
    400,
    "Введите почту и пароль длиной от 8 до 128 символов.",
  );
  if (action === "register") {
    requireThat(!person.email, 409, "Этот профиль уже зарегистрирован.");
    const name = clean(b.name, 80),
      salt = crypto.randomUUID();
    requireThat(name, 400, "Введите имя.");
    requireThat(
      !(await stmt(db, "SELECT id FROM people WHERE email=?", email).first()),
      409,
      "Эта почта занята.",
    );
    const s = await issue(db, person.id);
    const digest = await passwordHash(pass, salt);
    try {
      await db.batch([
        stmt(
          db,
          "UPDATE people SET email=?,password=?,name=? WHERE id=?",
          email,
          salt + ":" + digest,
          name,
          person.id,
        ),
        stmt(db, "DELETE FROM sessions WHERE person=?", person.id),
        s.insert,
      ]);
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        throw new Problem(409, "Эта почта занята.");
      throw e;
    }
    return { cookie: s.cookie };
  }
  const user = await stmt(
    db,
    "SELECT id,password FROM people WHERE email=?",
    email,
  ).first();
  const [salt, digest] = (user?.password || "missing:missing").split(":");
  requireThat(
    (await passwordHash(pass, salt)) === digest,
    401,
    "Почта или пароль не совпадают.",
  );
  const s = await issue(db, user.id);
  await db.batch([
    s.insert,
    stmt(db, "DELETE FROM sessions WHERE token=?", await hash(token || "")),
  ]);
  return { cookie: s.cookie };
}
