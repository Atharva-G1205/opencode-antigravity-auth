/**
 * OpenCode configuration file updater.
 *
 * Updates ~/.config/opencode/opencode.json(c) with plugin models.
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { OPENCODE_MODEL_DEFINITIONS, OPENCODE_WHITELIST_MODELS } from "./models.js";

// =============================================================================
// Types
// =============================================================================

export interface UpdateConfigResult {
  success: boolean;
  configPath: string;
  error?: string;
}

export interface OpencodeConfig {
  $schema?: string;
  /** Legacy singular key (OpenCode v1). */
  plugin?: string[];
  /** Native plural key (OpenCode v2). */
  plugins?: string[];
  /** Legacy singular key (OpenCode v1). */
  provider?: ProviderSection;
  /** Native plural key (OpenCode v2). */
  providers?: ProviderSection;
  [key: string]: unknown;
}

interface ProviderSection {
  google?: {
    models?: Record<string, unknown>;
    whitelist?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface UpdateConfigOptions {
  /** Override the config file path (for testing) */
  configPath?: string;
}

// =============================================================================
// Constants
// =============================================================================

const PLUGIN_NAME = "opencode-antigravity-auth@latest";
const SCHEMA_URL = "https://opencode.ai/config.json";
const OPENCODE_JSON_FILENAME = "opencode.json";
const OPENCODE_JSONC_FILENAME = "opencode.jsonc";
export const ANTIGRAVITY_QUOTA_COMMAND_FILENAME = "antigravity-quota.md";
export const ANTIGRAVITY_UPDATE_COMMAND_FILENAME = "antigravity-update.md";

export const ANTIGRAVITY_QUOTA_COMMAND_CONTENT = `---
description: Consultar estado de cuotas de Antigravity (5h y Semanal)
---

Use the \`antigravity_quota\` tool to check the current quota status.

This will show:
- API quota remaining for each model (Gemini 3 Pro, Flash, Claude via Antigravity)
- Per-account breakdown with visual progress bars
- Time until quota reset
- Local rate limit cache status

Just call the tool directly:
\`\`\`
antigravity_quota()
\`\`\`

IMPORTANT: Display the tool output EXACTLY as it is returned. Do not summarize, reformat, or modify the output in any way.
`;

export const ANTIGRAVITY_UPDATE_COMMAND_CONTENT = `---
description: Actualizar plugin opencode-antigravity-auth a la última versión
---

Ejecuta la actualización del plugin de Antigravity en este entorno:

1. Si el plugin está cargado como ruta local (ej. en /root/proyectos/opencode-antigravity-auth):
   - Ve a ese directorio, haz \`git pull origin main\`, y luego compila con \`npm run build\`.
   - Muestra la versión actualizada resultante de package.json.
2. Si está cargado desde GitHub (\`github:JoshRob297/opencode-antigravity-auth\`):
   - Informa al usuario que reinicie OpenCode para descargar la última versión de GitHub o limpia la caché con rm -rf ~/.cache/opencode/.
`;

/**
 * Ensures the /antigravity-quota and /antigravity-update slash commands are installed in OpenCode's command directory.
 *
 * @param configDir - Optional custom config dir (for testing)
 * @returns Path of the command file created or updated
 */
export function ensureAntigravityQuotaCommand(configDir?: string): string {
  const dir = configDir ?? getOpencodeConfigDir();
  const commandDir = join(dir, "command");
  const quotaCommandPath = join(commandDir, ANTIGRAVITY_QUOTA_COMMAND_FILENAME);
  const updateCommandPath = join(commandDir, ANTIGRAVITY_UPDATE_COMMAND_FILENAME);

  try {
    if (!existsSync(commandDir)) {
      mkdirSync(commandDir, { recursive: true });
    }
    if (!existsSync(quotaCommandPath)) {
      writeFileSync(quotaCommandPath, ANTIGRAVITY_QUOTA_COMMAND_CONTENT, "utf-8");
    }
    if (!existsSync(updateCommandPath)) {
      writeFileSync(updateCommandPath, ANTIGRAVITY_UPDATE_COMMAND_CONTENT, "utf-8");
    }
  } catch {
    // Best-effort creation, ignore permission issues
  }

  return quotaCommandPath;
}

/**
 * OpenCode v2 (2.0+) uses the native plural keys `plugins`/`providers`, while
 * v1 used the legacy singular `plugin`/`provider`. Detect which form the file
 * already uses so we mutate it in place instead of introducing a conflicting
 * key that the runtime would flag as a legacy/native conflict.
 */
export function resolvePluginKey(config: OpencodeConfig): "plugin" | "plugins" {
  if (Array.isArray(config.plugins)) return "plugins";
  if (Array.isArray(config.plugin)) return "plugin";
  return "plugins";
}

export function resolveProviderKey(config: OpencodeConfig): "provider" | "providers" {
  const providers = config.providers;
  if (providers && typeof providers === "object" && !Array.isArray(providers)) {
    return "providers";
  }
  const provider = config.provider;
  if (provider && typeof provider === "object" && !Array.isArray(provider)) {
    return "provider";
  }
  return "providers";
}

function stripJsonCommentsAndTrailingCommas(json: string): string {
  return json
    .replace(
      /\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g,
      (match: string, group: string | undefined) => (group ? "" : match)
    )
    .replace(/,(\s*[}\]])/g, "$1");
}

/**
 * Get the opencode config directory path.
 */
export function getOpencodeConfigDir(): string {
  const xdgConfig = process.env.XDG_CONFIG_HOME || join(homedir(), ".config");
  return join(xdgConfig, "opencode");
}

/**
 * Get the opencode config file path.
 *
 * Prefers opencode.jsonc when present so we update the active config file
 * instead of creating a new opencode.json.
 */
export function getOpencodeConfigPath(): string {
  const configDir = getOpencodeConfigDir();
  const jsoncPath = join(configDir, OPENCODE_JSONC_FILENAME);
  const jsonPath = join(configDir, OPENCODE_JSON_FILENAME);

  if (existsSync(jsoncPath)) {
    return jsoncPath;
  }
  if (existsSync(jsonPath)) {
    return jsonPath;
  }

  return jsonPath;
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Updates the opencode configuration file with plugin models.
 *
 * This function:
 * 1. Reads existing opencode.json/opencode.jsonc (or creates default structure)
 * 2. Replaces `provider(s).google.models` with plugin models, keeping whichever
 *    of the legacy singular (`plugin`/`provider`) or native plural
 *    (`plugins`/`providers`) key form the file already uses
 * 3. Writes back to disk with proper formatting
 *
 * Preserves:
 * - $schema and other top-level config keys
 * - Non-google provider sections
 * - Other settings within google provider (except models)
 *
 * @param options - Optional configuration (e.g., custom configPath for testing)
 * @returns UpdateConfigResult with success status and path
 */
export async function updateOpencodeConfig(
  options: UpdateConfigOptions = {}
): Promise<UpdateConfigResult> {
  const configPath = options.configPath ?? getOpencodeConfigPath();

  try {
    let config: OpencodeConfig;

    // Read existing config or create default
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, "utf-8");
      config = JSON.parse(stripJsonCommentsAndTrailingCommas(content)) as OpencodeConfig;
    } else {
      // Create default config structure using native OpenCode v2 plural keys
      config = {
        $schema: SCHEMA_URL,
        plugins: [],
        providers: {},
      };
    }

    // Ensure $schema is set
    if (!config.$schema) {
      config.$schema = SCHEMA_URL;
    }

    // Detect whether this file uses the legacy singular or native plural keys
    // so we never write a conflicting key that OpenCode v2 would discard.
    const pluginKey = resolvePluginKey(config);
    const providerKey = resolveProviderKey(config);

    // Ensure plugin array exists and contains our plugin
    if (!Array.isArray(config[pluginKey])) {
      config[pluginKey] = [];
    }
    const pluginList = config[pluginKey] as string[];

    // Check if plugin is already in the list (any version)
    const hasPlugin = pluginList.some((p) =>
      typeof p === "string" && p.includes("opencode-antigravity-auth")
    );
    if (!hasPlugin) {
      pluginList.push(PLUGIN_NAME);
    }

    // Ensure provider.google structure exists under the resolved key
    if (!config[providerKey] || typeof config[providerKey] !== "object" || Array.isArray(config[providerKey])) {
      config[providerKey] = {};
    }
    const providerSection = config[providerKey] as ProviderSection;
    if (!providerSection.google || typeof providerSection.google !== "object") {
      providerSection.google = {};
    }
    const googleSection = providerSection.google;

    // Replace google models with plugin models
    googleSection.models = { ...OPENCODE_MODEL_DEFINITIONS };

    // Whitelist only official Antigravity models to hide 18+ unauthenticated native Google models
    googleSection.whitelist = [...OPENCODE_WHITELIST_MODELS];

    // Automatically ensure /antigravity-quota command is installed
    ensureAntigravityQuotaCommand(getOpencodeConfigDir());

    // Ensure config directory exists
    const configDir = dirname(configPath);
    if (!existsSync(configDir)) {
      mkdirSync(configDir, { recursive: true });
    }

    // Write config with proper formatting (2-space indent)
    writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");

    return {
      success: true,
      configPath,
    };
  } catch (error) {
    return {
      success: false,
      configPath,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
