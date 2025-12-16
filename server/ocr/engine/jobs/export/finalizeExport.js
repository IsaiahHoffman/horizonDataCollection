export function tryFinalizeExport(r, context) {
  const { PHOTOS_DIR } = context;

  if (!r || r.status !== "done") return null;
  if (r.request?.exportOnComplete === false) return null;

  const pending = countPendingIssuesForScope({
    PHOTOS_DIR,
    request: r.request
  });

  if (pending !== 0) return null;
  if (r.exportPath) return r.exportPath;

  const exportObj = buildExportObjectForScope({
    PHOTOS_DIR,
    request: r.request
  });

  const abs = writeExportFile({
    projectRootDir: process.cwd(),
    exportObj
  });

  r.exportPath = abs;
  r.finalizedAt = Date.now();
  return abs;
}