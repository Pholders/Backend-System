const fs = require('fs');
const os = require('os');

/**
 * How much memory this process is actually allowed, in bytes.
 *
 * `os.totalmem()` reports the host's memory, which on a container platform
 * is the whole machine and wildly more than we may use — it said 8GB on a
 * 512MB Render instance. The real ceiling is the cgroup limit, so that is
 * read first and the host figure is only a fallback (a plain VM, or a
 * developer's laptop, where the two are the same thing).
 *
 * Returns null when neither can be determined, so callers can tell "no
 * limit found" apart from "a small limit".
 */
function containerMemoryLimitBytes() {
  // cgroup v2, then v1. "max" means no limit was set on the group.
  for (const path of [
    '/sys/fs/cgroup/memory.max',
    '/sys/fs/cgroup/memory/memory.limit_in_bytes',
  ]) {
    try {
      const raw = fs.readFileSync(path, 'utf8').trim();
      if (raw === 'max') continue;
      const bytes = Number(raw);
      // v1 writes an enormous sentinel rather than "max" when unlimited.
      if (Number.isFinite(bytes) && bytes > 0 && bytes < Number.MAX_SAFE_INTEGER) {
        return bytes;
      }
    } catch (error) {
      // Not Linux, or the file is not readable. Try the next one.
    }
  }

  const total = os.totalmem();
  return Number.isFinite(total) && total > 0 ? total : null;
}

module.exports = { containerMemoryLimitBytes };
