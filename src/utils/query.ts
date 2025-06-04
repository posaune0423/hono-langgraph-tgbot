import { eq } from "drizzle-orm";
import { getDB, type NewUser, users } from "../db";

const db = getDB();

export const getUserProfile = async (userId: string) => {
  const [user] = await db.select().from(users).where(eq(users.userId, userId));
  return user;
};

export const updateUserProfile = async (userId: string, profile: Partial<NewUser>) => {
  const [user] = await db.update(users).set(profile).where(eq(users.userId, userId)).returning();
  return user;
};

export const createUserProfile = async (profile: NewUser) => {
  const [user] = await db.insert(users).values(profile).returning();
  return user;
};

export const upsertUserProfile = async (profile: NewUser) => {
  const [user] = await db.insert(users).values(profile).onConflictDoUpdate({
    target: users.userId,
    set: profile
  }).returning();
  return user;
};

export const getUserProfileByWalletAddress = async (walletAddress: string) => {
  const [user] = await db.select().from(users).where(eq(users.walletAddress, walletAddress));
  return user;
};
