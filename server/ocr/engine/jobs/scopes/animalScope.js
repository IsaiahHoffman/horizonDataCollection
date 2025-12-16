export async function runAnimalScope(r, context) {
  const { PHOTOS_DIR } = context;

  const safe = safeTableNumber(r.request.tableNumber);
  const folder = path.join(PHOTOS_DIR, safe);
  const images = listPngs(folder);

  r.filesTotal = images.length;

  ensureBatchQueueState(r, context.defaultConcurrency);

  for (const f of images) {
    enqueueTask(r, {
      tableNumber: safe,
      fileName: f,
      startRowIndex: 0
    });
  }

  await runQueueWorkers(r, async task => {
    await processOneTableOneFile(r, task, {}, context);
  });
}