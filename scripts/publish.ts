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
}

interface PackageInfo {
  path: string;
  packageJson: PackageJson;
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

// Update version in a package.json and update workspace dependencies
function updatePackageJson(
  packageJson: PackageJson,
  newVersion: string,
  allPackageNames: Set<string>
): PackageJson {
  const updated = { ...packageJson, version: newVersion };

  // Update workspace dependencies to use the new version
  const updateDeps = (deps: Record<string, string> | undefined) => {
    if (!deps) return deps;
    const newDeps = { ...deps };
    for (const [name, version] of Object.entries(newDeps)) {
      if (allPackageNames.has(name) && version.startsWith("workspace:")) {
        // Keep workspace: protocol for local development
        // npm publish will automatically replace with actual version
      }
    }
    return newDeps;
  };

  updated.dependencies = updateDeps(updated.dependencies);
  updated.devDependencies = updateDeps(updated.devDependencies);
  updated.peerDependencies = updateDeps(updated.peerDependencies);

  return updated;
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

  // Update all package.json files
  console.log("📝 Updating package.json files...");
  for (const pkg of packages) {
    const updated = updatePackageJson(pkg.packageJson, newVersion, allPackageNames);
    const pkgJsonPath = join(pkg.path, "package.json");

    if (!options.dryRun) {
      await writeFile(pkgJsonPath, JSON.stringify(updated, null, 2) + "\n");
    }

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

    for (const pkg of sortedPackages) {
      const publishCmd = ["npm", "publish", "--access", "public", "--tag", options.tag];

      if (options.otp) {
        publishCmd.push("--otp", options.otp);
      }

      if (!options.dryRun) {
        try {
          await $`${publishCmd}`.cwd(pkg.path);
          console.log(`   ✓ ${pkg.packageJson.name}@${newVersion}`);
        } catch (error) {
          console.error(`   ✗ ${pkg.packageJson.name} - publish failed`);
          // Continue with other packages
        }
      } else {
        console.log(`   (dry-run) ${pkg.packageJson.name}@${newVersion}`);
      }
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
