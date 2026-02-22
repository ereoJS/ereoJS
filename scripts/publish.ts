#!/usr/bin/env bun

/**
 * Monorepo package version update and npm publish script
 *
 * Usage:
 *   bun scripts/publish.ts <version>       # Set exact version (e.g., 0.2.0)
 *   bun scripts/publish.ts patch           # Bump patch version (0.1.0 -> 0.1.1)
 *   bun scripts/publish.ts minor           # Bump minor version (0.1.0 -> 0.2.0)
 *   bun scripts/publish.ts major           # Bump major version (0.1.0 -> 1.0.0)
 *
 * Options:
 *   --dry-run      Show what would happen without making changes
 *   --no-build     Skip build step
 *   --no-publish   Update versions only, don't publish to npm
 *   --no-git       Skip git tag creation
 *   --tag <tag>    npm dist-tag (default: "latest", use "next" for prereleases)
 *   --otp <code>   npm one-time password for 2FA
 */

import { $ } from "bun";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const ROOT = import.meta.dirname ? join(import.meta.dirname, "..") : process.cwd();

interface PackageJson {
  name: string;
  version: string;
  private?: boolean;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  [key: string]: unknown;
}

interface PackageInfo {
  path: string;
  packageJson: PackageJson;
  /** Original file content before any version bumps */
  originalContent: string;
  isExample: boolean;
}

// Parse CLI arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    version: "",
    dryRun: false,
    noBuild: false,
    noPublish: false,
    noGit: false,
    tag: "latest",
    otp: "",
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "--no-build") {
      options.noBuild = true;
    } else if (arg === "--no-publish") {
      options.noPublish = true;
    } else if (arg === "--no-git") {
      options.noGit = true;
    } else if (arg === "--tag" && args[i + 1]) {
      options.tag = args[++i];
    } else if (arg === "--otp" && args[i + 1]) {
      options.otp = args[++i];
    } else if (!arg.startsWith("--")) {
      options.version = arg;
    }
  }

  return options;
}

// Calculate new version based on bump type or exact version
function calculateVersion(currentVersion: string, versionArg: string): string {
  const [major, minor, patch] = currentVersion.split(".").map(Number);

  switch (versionArg) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      // Validate exact version format
      if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(versionArg)) {
        throw new Error(`Invalid version format: ${versionArg}`);
      }
      return versionArg;
  }
}

// Get all packages in the monorepo
async function getPackages(): Promise<PackageInfo[]> {
  const packages: PackageInfo[] = [];

  // Regular packages
  const packagesDir = join(ROOT, "packages");
  const packageDirs = await readdir(packagesDir);

  for (const dir of packageDirs) {
    if (dir === "examples") continue;

    const pkgPath = join(packagesDir, dir);
    const pkgJsonPath = join(pkgPath, "package.json");

    try {
      const content = await readFile(pkgJsonPath, "utf-8");
      const packageJson = JSON.parse(content) as PackageJson;

      packages.push({
        path: pkgPath,
        packageJson,
        originalContent: content,
        isExample: false,
      });
    } catch {
      // Skip directories without package.json
    }
  }

  // Example packages (usually private, won't be published)
  const examplesDir = join(packagesDir, "examples");
  try {
    const exampleDirs = await readdir(examplesDir);
    for (const dir of exampleDirs) {
      const pkgPath = join(examplesDir, dir);
      const pkgJsonPath = join(pkgPath, "package.json");

      try {
        const content = await readFile(pkgJsonPath, "utf-8");
        const packageJson = JSON.parse(content) as PackageJson;

        packages.push({
          path: pkgPath,
          packageJson,
          originalContent: content,
          isExample: true,
        });
      } catch {
        // Skip directories without package.json
      }
    }
  } catch {
    // No examples directory
  }

  return packages;
}

// Transform workspace dependencies to actual versions for npm publish
function transformForPublish(
  packageJson: PackageJson,
  newVersion: string,
  allPackageNames: Set<string>
): PackageJson {
  const transformed = JSON.parse(JSON.stringify(packageJson)) as PackageJson;

  const transformDeps = (deps: Record<string, string> | undefined) => {
    if (!deps) return deps;
    for (const [name, version] of Object.entries(deps)) {
      if (allPackageNames.has(name) && version.startsWith("workspace:")) {
        deps[name] = `^${newVersion}`;
      }
    }
    return deps;
  };

  transformDeps(transformed.dependencies);
  transformDeps(transformed.devDependencies);
  transformDeps(transformed.peerDependencies);

  return transformed;
}

// Verify that a package.json string has no workspace: protocol references in deps
function verifyNoWorkspaceRefs(content: string, pkgName: string): void {
  const parsed = JSON.parse(content);
  const depTypes = ["dependencies", "devDependencies", "peerDependencies"] as const;

  for (const depType of depTypes) {
    const deps = parsed[depType];
    if (!deps) continue;
    for (const [name, version] of Object.entries(deps)) {
      if (typeof version === "string" && version.startsWith("workspace:")) {
        throw new Error(
          `PUBLISH ABORT: ${pkgName} still has workspace protocol in ${depType}: ${name} = "${version}"`
        );
      }
    }
  }
}

// Sort packages by dependency order (packages with no internal deps first)
function sortByDependencyOrder(packages: PackageInfo[]): PackageInfo[] {
  const packageNames = new Set(packages.map((p) => p.packageJson.name));
  const sorted: PackageInfo[] = [];
  const remaining = [...packages];

  const getInternalDeps = (pkg: PackageInfo): string[] => {
    const deps: string[] = [];
    const allDeps = {
      ...pkg.packageJson.dependencies,
      ...pkg.packageJson.devDependencies,
      ...pkg.packageJson.peerDependencies,
    };

    for (const name of Object.keys(allDeps)) {
      if (packageNames.has(name)) {
        deps.push(name);
      }
    }
    return deps;
  };

  while (remaining.length > 0) {
    const sortedNames = new Set(sorted.map((p) => p.packageJson.name));

    // Find packages whose dependencies are all already sorted
    const ready = remaining.filter((pkg) => {
      const deps = getInternalDeps(pkg);
      return deps.every((dep) => sortedNames.has(dep));
    });

    if (ready.length === 0 && remaining.length > 0) {
      console.warn("Warning: Circular dependencies detected, adding remaining packages");
      sorted.push(...remaining);
      break;
    }

    for (const pkg of ready) {
      sorted.push(pkg);
      remaining.splice(remaining.indexOf(pkg), 1);
    }
  }

  return sorted;
}

async function main() {
  const options = parseArgs();

  if (!options.version) {
    console.error("Usage: bun scripts/publish.ts <version|patch|minor|major> [options]");
    console.error("\nOptions:");
    console.error("  --dry-run      Show what would happen without making changes");
    console.error("  --no-build     Skip build step");
    console.error("  --no-publish   Update versions only, don't publish to npm");
    console.error("  --no-git       Skip git tag creation");
    console.error('  --tag <tag>    npm dist-tag (default: "latest")');
    console.error("  --otp <code>   npm one-time password for 2FA");
    process.exit(1);
  }

  console.log("📦 Ereo Monorepo Publisher\n");

  if (options.dryRun) {
    console.log("🔍 DRY RUN MODE - No changes will be made\n");
  }

  // Get all packages
  const packages = await getPackages();
  const publishablePackages = packages.filter((p) => !p.packageJson.private && !p.isExample);

  console.log(`Found ${packages.length} packages (${publishablePackages.length} publishable)\n`);

  // Get current version from core package
  const corePackage = packages.find((p) => p.packageJson.name === "@ereo/core");
  if (!corePackage) {
    console.error("Error: Could not find @ereo/core package");
    process.exit(1);
  }

  const currentVersion = corePackage.packageJson.version;
  const newVersion = calculateVersion(currentVersion, options.version);

  console.log(`Version: ${currentVersion} → ${newVersion}\n`);

  // Collect all package names for dependency updates
  const allPackageNames = new Set(packages.map((p) => p.packageJson.name));

  // Update all package.json files with new version (keeping workspace: protocol)
  console.log("📝 Updating package.json versions...");
  for (const pkg of packages) {
    const parsed = JSON.parse(pkg.originalContent);
    parsed.version = newVersion;
    const updatedContent = JSON.stringify(parsed, null, 2) + "\n";

    if (!options.dryRun) {
      await writeFile(join(pkg.path, "package.json"), updatedContent);
    }
    // Update in-memory version for transforms
    pkg.packageJson.version = newVersion;

    console.log(`   ✓ ${pkg.packageJson.name}`);
  }

  // Build all packages
  if (!options.noBuild) {
    console.log("\n🔨 Building packages...");
    if (!options.dryRun) {
      try {
        await $`bun run build`.cwd(ROOT);
        console.log("   ✓ Build complete");
      } catch (error) {
        console.error("   ✗ Build failed");
        process.exit(1);
      }
    } else {
      console.log("   (skipped in dry-run)");
    }
  }

  // Publish packages in dependency order
  if (!options.noPublish) {
    console.log("\n🚀 Publishing to npm...");

    const sortedPackages = sortByDependencyOrder(publishablePackages);
    const failedPackages: string[] = [];

    for (const pkg of sortedPackages) {
      const pkgJsonPath = join(pkg.path, "package.json");
      const pkgName = pkg.packageJson.name;

      if (!options.dryRun) {
        // Transform workspace:* to actual versions for publishing
        // Use deep clone via JSON round-trip to avoid shared references
        const originalOnDisk = await readFile(pkgJsonPath, "utf-8");
        const publishReady = transformForPublish(
          JSON.parse(originalOnDisk),
          newVersion,
          allPackageNames
        );
        const publishContent = JSON.stringify(publishReady, null, 2) + "\n";

        // Write transformed package.json
        await writeFile(pkgJsonPath, publishContent);

        // Verify the transform worked by reading the file back
        try {
          const written = await readFile(pkgJsonPath, "utf-8");
          verifyNoWorkspaceRefs(written, pkgName);
        } catch (verifyError) {
          console.error(`   ✗ ${pkgName} - ${verifyError}`);
          // Restore and skip this package
          await writeFile(pkgJsonPath, originalOnDisk);
          failedPackages.push(pkgName);
          continue;
        }

        // Publish using npm publish with explicit args
        try {
          const publishArgs = ["--access", "public", "--tag", options.tag];
          if (options.otp) {
            publishArgs.push("--otp", options.otp);
          }
          await $`npm publish ${publishArgs}`.cwd(pkg.path);
          console.log(`   ✓ ${pkgName}@${newVersion}`);
        } catch (error) {
          console.error(`   ✗ ${pkgName} - publish failed`);
          failedPackages.push(pkgName);
        } finally {
          // Always restore the original file (with version bump, workspace:* intact)
          await writeFile(pkgJsonPath, originalOnDisk);
        }
      } else {
        // Dry-run: show what would be transformed
        const publishReady = transformForPublish(pkg.packageJson, newVersion, allPackageNames);
        const deps = publishReady.dependencies ?? {};
        const peerDeps = publishReady.peerDependencies ?? {};
        const allDeps = { ...deps, ...peerDeps };
        const internalDeps = Object.entries(allDeps)
          .filter(([name]) => allPackageNames.has(name))
          .map(([name, ver]) => `${name}: ${ver}`)
          .join(", ");

        console.log(`   (dry-run) ${pkgName}@${newVersion}`);
        if (internalDeps) {
          console.log(`      deps: ${internalDeps}`);
        }
      }
    }

    if (failedPackages.length > 0) {
      console.error(`\n⚠️  Failed to publish: ${failedPackages.join(", ")}`);
    }
  }

  // Create git tag
  if (!options.noGit) {
    console.log("\n🏷️  Creating git tag...");
    const tagName = `v${newVersion}`;

    if (!options.dryRun) {
      try {
        await $`git add -A`.cwd(ROOT);
        await $`git commit -m "chore: release ${tagName}"`.cwd(ROOT);
        await $`git tag -a ${tagName} -m "Release ${tagName}"`.cwd(ROOT);
        console.log(`   ✓ Created tag ${tagName}`);
        console.log(`   Run 'git push && git push --tags' to push to remote`);
      } catch (error) {
        console.error(`   ✗ Git operations failed`);
      }
    } else {
      console.log(`   (dry-run) Would create tag ${tagName}`);
    }
  }

  console.log("\n✨ Done!");
}

main().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
