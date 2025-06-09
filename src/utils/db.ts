import { eq, notInArray } from "drizzle-orm";
import { getDB, type NewUser, User, users } from "../db";

const db = getDB();

export const getUsers = async (): Promise<User[]> => {
  const allUsers = await db.query.users.findMany();
  return allUsers;
};

export const getUserIds = async (excludeUserIds: string[] = []): Promise<string[]> => {
  const allUserIds = await db
    .select({ userId: users.userId })
    .from(users)
    .where(notInArray(users.userId, excludeUserIds));
  return allUserIds.map((u) => u.userId);
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  const [user] = await db.select().from(users).where(eq(users.userId, userId));
  return user;
};

export const updateUserProfile = async (userId: string, profile: Partial<NewUser>): Promise<User | null> => {
  const [user] = await db.update(users).set(profile).where(eq(users.userId, userId)).returning();
  return user;
};

export const createUserProfile = async (profile: NewUser): Promise<User> => {
  const [user] = await db.insert(users).values(profile).returning();
  return user;
};

export const upsertUserProfile = async (profile: NewUser): Promise<User> => {
  const [user] = await db
    .insert(users)
    .values(profile)
    .onConflictDoUpdate({
      target: users.userId,
      set: profile,
    })
    .returning();
  return user;
};

export const getUserProfileByWalletAddress = async (walletAddress: string): Promise<User | null> => {
  const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
  return user;
};
