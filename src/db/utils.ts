import { desc, eq } from "drizzle-orm";
import { getDB, messages, type NewUser, users } from ".";

export const getUser = async (userId: number, options?: { withMessages?: boolean }) => {
  const db = getDB();
  const user = await db.query.users.findFirst({
    where: eq(users.userId, userId),
    with: options?.withMessages
      ? {
          messages: {
            orderBy: [desc(messages.timestamp)],
          },
        }
      : undefined,
  });
  return user;
};

export const upsertUser = async (user: NewUser) => {
  const db = getDB();
  await db.insert(users).values(user).onConflictDoUpdate({
    target: users.userId,
    set: user,
  });
};
