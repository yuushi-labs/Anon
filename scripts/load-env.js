/**
 * Custom environment loader that prioritizes system environment variables
 * over .env file values. This ensures that Manus platform-injected variables
 * are not overridden by placeholder values in .env.
 *
 * The loader resolves from the project root rather than the current working
 * directory so Expo/Gradle invocations from subfolders (such as android/) still
 * read the repository-level .env file during builds.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

// Try to load from .env.local first, then .env, resolving from the repo root.
const envFiles = [path.join(projectRoot, ".env.local"), path.join(projectRoot, ".env")];

envFiles.forEach((envPath) => {
  if (!fs.existsSync(envPath)) {
    return;
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const lines = envContent.split("\n");

  lines.forEach((line) => {
    // Skip comments and empty lines
    if (!line || line.trim().startsWith("#")) return;

    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^['"]|['"]$/g, ""); // Remove quotes

      // Only set if not already defined in environment (use explicit undefined check to avoid overriding empty strings)
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  });
});

// Map system variables to Expo public variables
const mappings = {
  VITE_APP_ID: "EXPO_PUBLIC_APP_ID",
  VITE_OAUTH_PORTAL_URL: "EXPO_PUBLIC_OAUTH_PORTAL_URL",
  OAUTH_SERVER_URL: "EXPO_PUBLIC_OAUTH_SERVER_URL",
  OWNER_OPEN_ID: "EXPO_PUBLIC_OWNER_OPEN_ID",
  OWNER_NAME: "EXPO_PUBLIC_OWNER_NAME",
};

for (const [systemVar, expoVar] of Object.entries(mappings)) {
  if (process.env[systemVar] !== undefined && process.env[expoVar] === undefined) {
    process.env[expoVar] = process.env[systemVar];
  }
}
