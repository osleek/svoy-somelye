import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { db, hasDb } from '@/lib/db';
import type { TasteAxes } from '@/lib/taste';

export type User = {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  createdAt: string;
};

export type Favorite = { userId: string; slug: string; createdAt: string };
export type HistoryItem = { userId: string; slug: string; query: string; createdAt: string };
export type Session = { token: string; userId: string; createdAt: string };
export type ChatMessage = { role: 'user' | 'assistant'; content: string; slugs: string[] };
export type ConversationRow = { id: string; title: string; updatedAt: string; count: number };

export type Feedback = { userId: string; slug: string; value: 1 | -1; query: string; createdAt: string };

type FileDb = {
  users: User[];
  sessions: Session[];
  favorites: Favorite[];
  history: HistoryItem[];
  messages: Array<ChatMessage & { conversationId: string; createdAt: string }>;
  feedback?: Array<{ userId: string; slug: string; value: number; query: string; createdAt: string }>;
  taste?: Record<string, TasteAxes>;
};

const FILE = path.join(process.cwd(), 'data', 'app.json');
const EMPTY: FileDb = { users: [], sessions: [], favorites: [], history: [], messages: [] };

function read(): FileDb {
  try {
    if (!existsSync(FILE)) return { ...EMPTY };
    const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<FileDb>;
    return {
      users: parsed.users ?? [],
      sessions: parsed.sessions ?? [],
      favorites: parsed.favorites ?? [],
      history: parsed.history ?? [],
      messages: parsed.messages ?? [],
    };
  } catch {
    return { ...EMPTY };
  }
}

function write(data: FileDb): void {
  try {
    const dir = path.dirname(FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch {
    return;
  }
}

function rowToUser(r: Record<string, unknown>): User {
  return {
    id: String(r.id),
    email: String(r.email),
    name: String(r.name),
    passwordHash: String(r.password_hash),
    createdAt: (r.created_at as Date).toISOString(),
  };
}

export const store = {
  async findUserByEmail(email: string): Promise<User | undefined> {
    if (hasDb()) {
      const { rows } = await db().query(
        'select id, email, name, password_hash, created_at from users where email = $1',
        [email],
      );
      return rows[0] ? rowToUser(rows[0]) : undefined;
    }
    return read().users.find((u) => u.email === email.toLowerCase());
  },

  async findUserById(id: string): Promise<User | undefined> {
    if (hasDb()) {
      const { rows } = await db().query(
        'select id, email, name, password_hash, created_at from users where id = $1',
        [id],
      );
      return rows[0] ? rowToUser(rows[0]) : undefined;
    }
    return read().users.find((u) => u.id === id);
  },

  async addUser(user: User): Promise<void> {
    if (hasDb()) {
      await db().query('insert into users (id, email, name, password_hash) values ($1,$2,$3,$4)', [
        user.id,
        user.email,
        user.name,
        user.passwordHash,
      ]);
      return;
    }
    const data = read();
    data.users.push(user);
    write(data);
  },

  async addSession(session: Session): Promise<void> {
    if (hasDb()) {
      await db().query('insert into sessions (token, user_id) values ($1,$2)', [
        session.token,
        session.userId,
      ]);
      return;
    }
    const data = read();
    data.sessions.push(session);
    write(data);
  },

  async findSession(token: string): Promise<Session | undefined> {
    if (hasDb()) {
      const { rows } = await db().query('select token, user_id from sessions where token = $1', [
        token,
      ]);
      if (!rows[0]) return undefined;
      return {
        token: rows[0].token,
        userId: rows[0].user_id,
        createdAt: new Date().toISOString(),
      };
    }
    return read().sessions.find((s) => s.token === token);
  },

  async removeSession(token: string): Promise<void> {
    if (hasDb()) {
      await db().query('delete from sessions where token = $1', [token]);
      return;
    }
    const data = read();
    data.sessions = data.sessions.filter((s) => s.token !== token);
    write(data);
  },

  async listFavorites(userId: string): Promise<Favorite[]> {
    if (hasDb()) {
      const { rows } = await db().query(
        'select slug, created_at from favorites where user_id = $1 order by created_at desc',
        [userId],
      );
      return rows.map((r) => ({ userId, slug: r.slug, createdAt: r.created_at.toISOString() }));
    }
    return read()
      .favorites.filter((f) => f.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  async toggleFavorite(userId: string, slug: string): Promise<boolean> {
    if (hasDb()) {
      const { rowCount } = await db().query(
        'delete from favorites where user_id = $1 and slug = $2',
        [userId, slug],
      );
      if (rowCount) return false;
      await db().query('insert into favorites (user_id, slug) values ($1,$2)', [userId, slug]);
      return true;
    }
    const data = read();
    const index = data.favorites.findIndex((f) => f.userId === userId && f.slug === slug);
    if (index >= 0) {
      data.favorites.splice(index, 1);
      write(data);
      return false;
    }
    data.favorites.push({ userId, slug, createdAt: new Date().toISOString() });
    write(data);
    return true;
  },

  async listHistory(userId: string): Promise<HistoryItem[]> {
    if (hasDb()) {
      const { rows } = await db().query(
        'select slug, query, created_at from history where user_id = $1 order by created_at desc limit 50',
        [userId],
      );
      return rows.map((r) => ({
        userId,
        slug: r.slug,
        query: r.query,
        createdAt: r.created_at.toISOString(),
      }));
    }
    return read()
      .history.filter((h) => h.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50);
  },

  async addHistory(item: HistoryItem): Promise<void> {
    if (hasDb()) {
      await db().query('insert into history (user_id, slug, query) values ($1,$2,$3)', [
        item.userId,
        item.slug,
        item.query,
      ]);
      return;
    }
    const data = read();
    data.history.push(item);
    data.history = data.history.slice(-500);
    write(data);
  },

  async ensureConversation(id: string, userId: string | null): Promise<string> {
    if (hasDb()) {
      await db().query(
        'insert into conversations (id, user_id) values ($1,$2) on conflict (id) do nothing',
        [id, userId],
      );
    }
    return id;
  },

  async addMessage(conversationId: string, message: ChatMessage): Promise<void> {
    if (hasDb()) {
      await db().query(
        'insert into messages (conversation_id, role, content, slugs) values ($1,$2,$3,$4)',
        [conversationId, message.role, message.content, message.slugs],
      );
      return;
    }
    const data = read();
    data.messages.push({
      conversationId,
      role: message.role,
      content: message.content,
      slugs: message.slugs,
      createdAt: new Date().toISOString(),
    });
    data.messages = data.messages.slice(-2000);
    write(data);
  },

  async listMessages(conversationId: string): Promise<ChatMessage[]> {
    if (hasDb()) {
      const { rows } = await db().query(
        'select role, content, slugs from messages where conversation_id = $1 order by id',
        [conversationId],
      );
      return rows.map((r) => ({ role: r.role, content: r.content, slugs: r.slugs ?? [] }));
    }
    return read()
      .messages.filter((m) => m.conversationId === conversationId)
      .map((m) => ({ role: m.role, content: m.content, slugs: m.slugs }));
  },

  async listConversations(userId: string): Promise<ConversationRow[]> {
    if (hasDb()) {
      const { rows } = await db().query(
        `select c.id,
                coalesce((select content from messages m2 where m2.conversation_id = c.id and m2.role = 'user' order by m2.id limit 1), 'Диалог') as title,
                max(m.created_at) as updated_at,
                count(m.id)::int as cnt
           from conversations c
           join messages m on m.conversation_id = c.id
          where c.user_id = $1
          group by c.id
          order by updated_at desc
          limit 30`,
        [userId],
      );
      return rows.map((r) => ({
        id: r.id,
        title: String(r.title).slice(0, 80),
        updatedAt: r.updated_at.toISOString(),
        count: r.cnt,
      }));
    }

    const data = read();
    const grouped = new Map<string, { title: string; updatedAt: string; count: number }>();
    for (const m of data.messages) {
      const entry = grouped.get(m.conversationId);
      if (!entry) {
        grouped.set(m.conversationId, {
          title: m.role === 'user' ? m.content.slice(0, 80) : 'Диалог',
          updatedAt: m.createdAt,
          count: 1,
        });
      } else {
        entry.count += 1;
        if (m.role === 'user' && entry.title === 'Диалог') entry.title = m.content.slice(0, 80);
        entry.updatedAt = m.createdAt;
      }
    }
    return [...grouped.entries()]
      .map(([id, v]) => ({ id, ...v }))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 30);
  },

  async getTasteProfile(userId: string): Promise<TasteAxes | null> {
    if (hasDb()) {
      const { rows } = await db().query(
        'select acidity, tannin, body, sweetness, aroma from taste_profiles where user_id = $1',
        [userId],
      );
      if (!rows[0]) return null;
      const r = rows[0];
      return {
        acidity: Number(r.acidity),
        tannin: Number(r.tannin),
        body: Number(r.body),
        sweetness: Number(r.sweetness),
        aroma: Number(r.aroma),
      };
    }
    return read().taste?.[userId] ?? null;
  },

  async saveTasteProfile(userId: string, axes: TasteAxes): Promise<void> {
    if (hasDb()) {
      await db().query(
        `insert into taste_profiles (user_id, acidity, tannin, body, sweetness, aroma)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (user_id) do update set
           acidity = excluded.acidity,
           tannin = excluded.tannin,
           body = excluded.body,
           sweetness = excluded.sweetness,
           aroma = excluded.aroma,
           updated_at = now()`,
        [userId, axes.acidity, axes.tannin, axes.body, axes.sweetness, axes.aroma],
      );
      return;
    }
    const data = read();
    data.taste = data.taste ?? {};
    data.taste[userId] = axes;
    write(data);
  },

  async listFeedback(userId: string): Promise<Feedback[]> {
    if (hasDb()) {
      const { rows } = await db().query(
        'select slug, value, query, created_at from feedback where user_id = $1 order by created_at desc limit 50',
        [userId],
      );
      return rows.map((r) => ({
        userId,
        slug: r.slug,
        value: r.value,
        query: r.query,
        createdAt: r.created_at.toISOString(),
      }));
    }
    const data = read();
    return (data.feedback ?? [])
      .filter((f) => f.userId === userId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 50)
      .map((f) => ({ ...f, value: f.value as 1 | -1 }));
  },

  async addFeedback(item: Feedback): Promise<void> {
    if (hasDb()) {
      await db().query(
        'insert into feedback (user_id, slug, value, query) values ($1,$2,$3,$4)',
        [item.userId, item.slug, item.value, item.query],
      );
      return;
    }
    const data = read();
    data.feedback = data.feedback ?? [];
    data.feedback.push({ ...item, createdAt: new Date().toISOString() });
    write(data);
  },
};
