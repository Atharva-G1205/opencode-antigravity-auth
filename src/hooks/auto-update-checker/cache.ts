import * as fs from "node:fs";
import * as path from "node:path";
import { CACHE_DIR, PACKAGE_NAME } from "./constants";
import { logAutoUpdate } from "./logging";

interface BunLockfile {
  workspaces?: {
    ""?: {
      dependencies?: Record<string, string>;
    };
  };
  packages?: Record<string, unknown>;
}

function stripTrailingCommas(json: string): string {
  return json.replace(/,(\s*[}\]])/g, "$1");
}

function removeFromBunLock(packageName: string): boolean {
  const lockPath = path.join(CACHE_DIR, "bun.lock");
  if (!fs.existsSync(lockPath)) return false;

  try {
    const content = fs.readFileSync(lockPath, "utf-8");
    const lock = JSON.parse(stripTrailingCommas(content)) as BunLockfile;
    let modified = false;

    if (lock.workspaces?.[""]?.dependencies?.[packageName]) {
      delete lock.workspaces[""].dependencies[packageName];
      modified = true;
    }

    if (lock.packages?.[packageName]) {
      delete lock.packages[packageName];
      modified = true;
    }

    if (modified) {
      fs.writeFileSync(lockPath, JSON.stringify(lock, null, 2));
      logAutoUpdate(`Removed from bun.lock: ${packageName}`);
    }

    return modified;
  } catch {
    return false;
  }
}

export function invalidatePackage(packageName: string = PACKAGE_NAME): boolean {
  try {
    const pkgDir = path.join(CACHE_DIR, "node_modules", packageName);
    const pkgJsonPath = path.join(CACHE_DIR, "package.json");

    let packageRemoved = false;
    let dependencyRemoved = false;
    let lockRemoved = false;

    if (fs.existsSync(pkgDir)) {
      fs.rmSync(pkgDir, { recursive: true, force: true });
      logAutoUpdate(`Package removed: ${pkgDir}`);
      packageRemoved = true;
    }

    if (fs.existsSync(pkgJsonPath)) {
      const content = fs.readFileSync(pkgJsonPath, "utf-8");
      const pkgJson = JSON.parse(content);
      if (pkgJson.dependencies?.[packageName]) {
        delete pkgJson.dependencies[packageName];
        fs.writeFileSync(pkgJsonPath, JSON.stringify(pkgJson, null, 2));
        logAutoUpdate(`Dependency removed from package.json: ${packageName}`);
        dependencyRemoved = true;
      }
    }

    lockRemoved = removeFromBunLock(packageName);

    if (!packageRemoved && !dependencyRemoved && !lockRemoved) {
      logAutoUpdate(`Package not found, nothing to invalidate: ${packageName}`);
      return false;
    }

    return true;
  } catch (err) {
    logAutoUpdate(`Failed to invalidate package: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export function invalidateCache(): boolean {
  logAutoUpdate("WARNING: invalidateCache is deprecated, use invalidatePackage");
  return invalidatePackage();
}
