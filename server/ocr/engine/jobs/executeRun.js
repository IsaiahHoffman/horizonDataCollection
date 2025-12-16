export async function executeRun(r, context) {
  r.status = "running";
  r.startedAt = now();
  r.waiting = null;

  // cleanStart here ✅

  switch (r.request.scope) {
    case "row":
      return runRowScope(r, context);
    case "file":
      return runFileScope(r, context);
    case "animal":
      return runAnimalScope(r, context);
    case "all":
      return runAllScope(r, context);
    default:
      throw new Error(`Unknown scope: ${r.request.scope}`);
  }
}