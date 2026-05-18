export const sanitizeText = (input: string): string => input.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
