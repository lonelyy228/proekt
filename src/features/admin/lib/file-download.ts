const sanitizeFileNamePart = (value: string): string =>
  value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

const formatUtcStamp = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}${month}${day}-${hours}${minutes}${seconds}Z`;
};

export const buildSnapshotFileName = (prefix: string, extension: "json"): string => {
  const safePrefix = sanitizeFileNamePart(prefix) || "snapshot";
  return `${safePrefix}-${formatUtcStamp(new Date())}.${extension}`;
};

export const downloadJsonFile = (fileName: string, payload: unknown): void => {
  const serialized = JSON.stringify(payload, null, 2);
  const blob = new Blob([serialized], { type: "application/json;charset=utf-8" });
  const objectUrl = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = fileName;
  link.rel = "noopener";

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(objectUrl);
};
