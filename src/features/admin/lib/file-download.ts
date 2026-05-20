export const parseFilenameFromContentDisposition = (
  header: string | null,
  fallback: string
): string => {
  if (!header) {
    return fallback;
  }

  const match = header.match(/filename="([^"]+)"/i);
  if (!match || !match[1]) {
    return fallback;
  }

  return match[1];
};

export const downloadBlobAsFile = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
};

export type DownloadCsvResult = {
  fileName: string;
  sizeBytes: number;
  exportedCount: number | null;
};

export const downloadCsvFromResponse = async (
  response: Response,
  fallbackFilename: string
): Promise<DownloadCsvResult> => {
  const blob = await response.blob();
  const fileName = parseFilenameFromContentDisposition(
    response.headers.get("content-disposition"),
    fallbackFilename
  );
  const exportedCountRaw = response.headers.get("x-exported-count");
  const exportedCount =
    exportedCountRaw && Number.isFinite(Number(exportedCountRaw))
      ? Math.max(0, Math.floor(Number(exportedCountRaw)))
      : null;

  downloadBlobAsFile(blob, fileName);
  return {
    fileName,
    sizeBytes: blob.size,
    exportedCount
  };
};
