import { compare, hash } from "bcryptjs";

export const hashPassword = async (password: string): Promise<string> => hash(password, 12);

export const verifyPassword = async (password: string, passwordHash: string): Promise<boolean> =>
  compare(password, passwordHash);
