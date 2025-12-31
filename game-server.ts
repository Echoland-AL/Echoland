import * as path from "node:path"
import { Elysia, t } from 'elysia'
import * as fs from "node:fs/promises";
import { AreaInfoSchema } from "./lib/schemas";

// Simple mutex for preventing concurrent account.json modifications
class AsyncMutex {
  private mutex = Promise.resolve();

  lock(): Promise<() => void> {
    let release: () => void;
    const acquire = new Promise<void>((resolve) => {
      release = resolve;
    });
    const prevMutex = this.mutex;
    this.mutex = prevMutex.then(() => acquire);
    return prevMutex.then(() => release!);
  }

  async runExclusive<T>(callback: () => Promise<T>): Promise<T> {
    const release = await this.lock();
    try {
      return await callback();
    } finally {
      release();
    }
  }
}

const accountMutex = new AsyncMutex();
const textEncoder = new TextEncoder();

const ACCOUNTS_DIR = "./data/person/accounts";
const LEGACY_ACCOUNT_PATH = "./data/person/account.json";

// Track the currently active profile (for Unity clients that don't send cookies)
let currentActiveProfile: string | null = null;

// Track the next client profile to auto-assign
let nextClientProfile: string | null = null;

function getAccountPathForProfile(profileName: string): string {
  return `${ACCOUNTS_DIR}/${profileName}.json`;
}

// Get the path to the account file - always use legacy path so sync works correctly
async function getAccountPath(): Promise<string> {
  return LEGACY_ACCOUNT_PATH;
}

// Sync legacy file to profile and vice versa
async function syncProfileToLegacy(profileName: string): Promise<void> {
  const profilePath = getAccountPathForProfile(profileName);
  try {
    const data = await fs.readFile(profilePath, "utf-8");
    await fs.mkdir(path.dirname(LEGACY_ACCOUNT_PATH), { recursive: true });
    await fs.writeFile(LEGACY_ACCOUNT_PATH, data);
  } catch (e) {
    console.warn(`[PROFILE] Could not sync ${profileName} to legacy:`, e);
  }
}

async function syncLegacyToProfile(profileName: string): Promise<void> {
  const profilePath = getAccountPathForProfile(profileName);
  try {
    const data = await fs.readFile(LEGACY_ACCOUNT_PATH, "utf-8");
    await fs.mkdir(ACCOUNTS_DIR, { recursive: true });
    await fs.writeFile(profilePath, data);
    console.log(`[PROFILE] Saved data for ${profileName}`);
  } catch (e) {
    console.warn(`[PROFILE] Could not sync legacy to ${profileName}:`, e);
  }
}

const HOST = Bun.env.HOST ?? "0.0.0.0";
const PORT_API = Number(Bun.env.PORT_API ?? 8000);
const PORT_CDN_THINGDEFS = Number(Bun.env.PORT_CDN_THINGDEFS ?? 8001);
const PORT_CDN_AREABUNDLES = Number(Bun.env.PORT_CDN_AREABUNDLES ?? 8002);
const PORT_CDN_UGCIMAGES = Number(Bun.env.PORT_CDN_UGCIMAGES ?? 8003);

const getDynamicAreaList = async () => {
  const arealistPath = "./data/area/arealist.json";
  try {
    const file = Bun.file(arealistPath);
    if (await file.exists()) {
      const parsed = await file.json();
      return {
        visited: parsed.visited ?? [],
        created: parsed.created ?? [],
        newest: parsed.newest ?? [],
        popular: parsed.popular ?? [],
        popular_rnd: parsed.popular_rnd ?? [],
        popularNew: parsed.popularNew ?? [],
        popularNew_rnd: parsed.popularNew_rnd ?? [],
        lively: parsed.lively ?? [],
        favorite: parsed.favorite ?? [],
        mostFavorited: parsed.mostFavorited ?? [],
        totalOnline: parsed.totalOnline ?? 0,
        totalAreas: parsed.totalAreas ?? 0,
        totalPublicAreas: parsed.totalPublicAreas ?? 0,
        totalSearchablePublicAreas: parsed.totalSearchablePublicAreas ?? 0
      };
    }
  } catch {
    console.warn("Failed to read arealist.json");
  }

  return {
    visited: [],
    created: [],
    newest: [],
    popular: [],
    popular_rnd: [],
    popularNew: [],
    popularNew_rnd: [],
    lively: [],
    favorite: [],
    mostFavorited: [],
    totalOnline: 0,
    totalAreas: 0,
    totalPublicAreas: 0,
    totalSearchablePublicAreas: 0
  };
};


let objIdCounter = 0
const generateObjectId_ = (timestamp: number, machineId: number, processId: number, counter: number) => {
  const hexTimestamp = Math.floor(timestamp / 1000).toString(16).padStart(8, "0")
  const hexMachineId = machineId.toString(16).padStart(6, "0")
  const hexProcessId = processId.toString(16).padStart(4, "0")
  const hexCounter = counter.toString(16).padStart(6, "0")
  return hexTimestamp + hexMachineId + hexProcessId + hexCounter
}
const generateObjectId = () => generateObjectId_(Date.now(), 0, 0, objIdCounter++)

async function injectInitialAreaToList(areaId: string, areaName: string) {
  const basePath = "./data/area";
  const listPath = `${basePath}/arealist.json`;

  let areaList: any = {};
  try {
    const listFile = Bun.file(listPath);
    if (await listFile.exists()) {
      areaList = await listFile.json();
    }
  } catch {
    console.warn("Couldn't read arealist.json, starting fresh.");
  }

  const newEntry = { id: areaId, name: areaName, playerCount: 0 };

  areaList.visited = [...(areaList.visited ?? []), newEntry];
  areaList.created = [...(areaList.created ?? []), newEntry];
  areaList.newest = [newEntry, ...(areaList.newest ?? [])].slice(0, 50);
  areaList.totalAreas = (areaList.totalAreas ?? 0) + 1;
  areaList.totalPublicAreas = (areaList.totalPublicAreas ?? 0) + 1;
  areaList.totalSearchablePublicAreas = (areaList.totalSearchablePublicAreas ?? 0) + 1;

  await fs.writeFile(listPath, JSON.stringify(areaList, null, 2));
}

// removed duplicate default imports; using namespace imports declared above

async function initDefaults() {
  const accountPath = "./data/person/account.json";

  let accountData: Record<string, any> = {};
  try {
    accountData = JSON.parse(await fs.readFile(accountPath, "utf-8"));
  } catch {
    // Create new identity
    const personId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const screenName = "User" + Math.floor(Math.random() * 10000);
    const homeAreaId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);

    accountData = {
      personId,
      screenName,
      homeAreaId,
      attachments: {}
    };

    await fs.mkdir("./data/person", { recursive: true });
    await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));
    console.log(`🧠 Memory card initialized for ${screenName}`);
  }

  // Ensure required fields exist for existing accounts
  let needsUpdate = false;
  if (!accountData.attachments) {
    accountData.attachments = {};
    needsUpdate = true;
  }
  
  // Save updated account data if needed
  if (needsUpdate) {
    await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));
    console.log(`🔄 Updated account data with missing fields`);
  }

  // Create person info file
  const infoPath = `./data/person/info/${accountData.personId}.json`;
  try {
    await fs.access(infoPath);
  } catch {
    const personInfo = {
      id: accountData.personId,
      screenName: accountData.screenName,
      age: 0,
      statusText: "",
      isFindable: true,
      isBanned: false,
      lastActivityOn: new Date().toISOString(),
      isFriend: false,
      isEditorHere: true,
      isListEditorHere: true,
      isOwnerHere: true,
      isAreaLocked: false,
      isOnline: true
    };

    await fs.mkdir("./data/person/info", { recursive: true });
    await fs.writeFile(infoPath, JSON.stringify(personInfo, null, 2));
    console.log(`📇 Created person info file for ${accountData.screenName}`);
  }
  // Check if home area already exists
  const areaInfoPath = `./data/area/info/${accountData.homeAreaId}.json`;

  try {
    await fs.access(areaInfoPath);
    console.log(`✅ Home area already exists for ${accountData.screenName}, skipping creation`);
    return; // Exit early, skip creating area again
  } catch {
    console.log(`🆕 Creating home area for ${accountData.screenName}`);
  }

  // Create default home area
  const areaId = accountData.homeAreaId;
  const areaName = `${accountData.screenName}'s home`;
  const areaKey = `rr${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const initDefaultsBundleFolder = `./data/area/bundle/${areaId}`;
  await fs.mkdir(initDefaultsBundleFolder, { recursive: true });
  const initDefaultsBundlePath = `${initDefaultsBundleFolder}/${areaKey}.json`;
  await fs.writeFile(initDefaultsBundlePath, JSON.stringify({ thingDefinitions: [], serveTime: 0 }, null, 2));
  const subareaPath = `./data/area/subareas/${areaId}.json`;
  await fs.writeFile(subareaPath, JSON.stringify({ subareas: [] }, null, 2));

  const areaInfo = {
    editors: [
      {
        id: accountData.personId,
        name: accountData.screenName,
        isOwner: true
      }
    ],
    listEditors: [],
    copiedFromAreas: [],
    name: areaName,
    creationDate: new Date().toISOString(),
    totalVisitors: 0,
    isZeroGravity: false,
    hasFloatingDust: false,
    isCopyable: false,
    isExcluded: false,
    renameCount: 0,
    copiedCount: 0,
    isFavorited: false
  };

  const areaLoad = {
    ok: true,
    areaId,
    areaName,
    areaKey,
    areaCreatorId: accountData.personId,
    isPrivate: false,
    isZeroGravity: false,
    hasFloatingDust: false,
    isCopyable: false,
    onlyOwnerSetsLocks: false,
    isExcluded: false,
    environmentChangersJSON: JSON.stringify({ environmentChangers: [] }),
    requestorIsEditor: true,
    requestorIsListEditor: true,
    requestorIsOwner: true,
    placements: [
      {
        Id: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
        Tid: "000000000000000000000001", // Ground object ID
        P: { x: 0, y: -0.3, z: 0 },
        R: { x: 0, y: 0, z: 0 }
      }
    ],
    serveTime: 17
  };

  const areaBundle = {
    thingDefinitions: [],
    serveTime: 3
  };

  await fs.mkdir(`./data/area/info`, { recursive: true });
  await fs.mkdir(`./data/area/load`, { recursive: true });
  await fs.mkdir(`./data/area/bundle`, { recursive: true });

  await fs.writeFile(`./data/area/info/${areaId}.json`, JSON.stringify(areaInfo, null, 2));
  await fs.writeFile(`./data/area/load/${areaId}.json`, JSON.stringify(areaLoad, null, 2));

  // Create bundle in subfolder with proper structure: bundle/{areaId}/{bundleKey}.json
  const ensureHomeAreaBundleFolder = `./data/area/bundle/${areaId}`;
  await fs.mkdir(ensureHomeAreaBundleFolder, { recursive: true });
  const ensureHomeAreaBundlePath = `${ensureHomeAreaBundleFolder}/${areaKey}.json`;
  await fs.writeFile(ensureHomeAreaBundlePath, JSON.stringify(areaBundle, null, 2));

  console.log(`🌍 Created default home area for ${accountData.screenName}`);
}

async function listProfiles(): Promise<string[]> {
  try {
    await fs.mkdir(ACCOUNTS_DIR, { recursive: true });
    const files = await fs.readdir(ACCOUNTS_DIR);
    return files.filter((name) => name.endsWith(".json")).map((name) => name.replace(".json", ""));
  } catch {
    return [];
  }
}

async function loadAccountData(profileName: string): Promise<Record<string, any> | null> {
  try {
    const data = await fs.readFile(getAccountPathForProfile(profileName), "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

async function saveAccountData(profileName: string, data: Record<string, any>): Promise<void> {
  await fs.mkdir(ACCOUNTS_DIR, { recursive: true });
  await fs.writeFile(getAccountPathForProfile(profileName), JSON.stringify(data, null, 2));
}

async function createProfileAccount(profileName: string): Promise<Record<string, any>> {
  const personId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const homeAreaId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const accountData = {
    personId,
    screenName: profileName,
    homeAreaId,
    attachments: {},
    ownedAreas: [homeAreaId] // Include home area in owned areas
  };
  await saveAccountData(profileName, accountData);
  await ensurePersonInfo(accountData);
  await ensureHomeArea(accountData);
  return accountData;
}

async function ensurePersonInfo(account: Record<string, any>) {
  const infoPath = `./data/person/info/${account.personId}.json`;
  try {
    await fs.access(infoPath);
  } catch {
    const personInfo = {
      id: account.personId,
      screenName: account.screenName,
      age: 0,
      statusText: "",
      isFindable: true,
      isBanned: false,
      lastActivityOn: new Date().toISOString(),
      isFriend: false,
      isEditorHere: true,
      isListEditorHere: true,
      isOwnerHere: true,
      isAreaLocked: false,
      isOnline: true
    };
    await fs.mkdir("./data/person/info", { recursive: true });
    await fs.writeFile(infoPath, JSON.stringify(personInfo, null, 2));
    console.log(`📇 [PROFILE] Created person info for ${account.screenName}`);
  }
}

async function ensureHomeArea(account: Record<string, any>) {
  const areaInfoPath = `./data/area/info/${account.homeAreaId}.json`;
  try {
    await fs.access(areaInfoPath);
    return;
  } catch {
    console.log(`[PROFILE] Creating home area for ${account.screenName}`);
  }

  const areaId = account.homeAreaId;
  const areaName = `${account.screenName}'s home`;
  const areaKey = `rr${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;

  const setupClientProfileBundleFolder = `./data/area/bundle/${areaId}`;
  await fs.mkdir(setupClientProfileBundleFolder, { recursive: true });
  const setupClientProfileBundlePath = `${setupClientProfileBundleFolder}/${areaKey}.json`;
  await fs.writeFile(setupClientProfileBundlePath, JSON.stringify({ thingDefinitions: [], serveTime: 0 }, null, 2));
  const subareaPath = `./data/area/subareas/${areaId}.json`;
  await fs.writeFile(subareaPath, JSON.stringify({ subareas: [] }, null, 2));

  const areaInfo = {
    editors: [
      {
        id: account.personId,
        name: account.screenName,
        isOwner: true
      }
    ],
    listEditors: [],
    copiedFromAreas: [],
    name: areaName,
    creationDate: new Date().toISOString(),
    totalVisitors: 0,
    isZeroGravity: false,
    hasFloatingDust: false,
    isCopyable: false,
    isExcluded: false,
    renameCount: 0,
    copiedCount: 0,
    isFavorited: false
  };

  const areaLoad = {
    ok: true,
    areaId,
    areaName,
    areaKey,
    areaCreatorId: account.personId,
    isPrivate: false,
    isZeroGravity: false,
    hasFloatingDust: false,
    isCopyable: false,
    onlyOwnerSetsLocks: false,
    isExcluded: false,
    environmentChangersJSON: JSON.stringify({ environmentChangers: [] }),
    requestorIsEditor: true,
    requestorIsListEditor: true,
    requestorIsOwner: true,
    placements: [
      {
        Id: crypto.randomUUID().replace(/-/g, "").slice(0, 24),
        Tid: "000000000000000000000001",
        P: { x: 0, y: -0.3, z: 0 },
        R: { x: 0, y: 0, z: 0 }
      }
    ],
    serveTime: 17
  };

  const areaBundle = {
    thingDefinitions: [],
    serveTime: 3
  };

  await fs.mkdir(`./data/area/info`, { recursive: true });
  await fs.mkdir(`./data/area/load`, { recursive: true });
  await fs.mkdir(`./data/area/bundle`, { recursive: true });

  await fs.writeFile(`./data/area/info/${areaId}.json`, JSON.stringify(areaInfo, null, 2));
  await fs.writeFile(`./data/area/load/${areaId}.json`, JSON.stringify(areaLoad, null, 2));

  // Create bundle in subfolder with proper structure: bundle/{areaId}/{bundleKey}.json
  const createAreaBundleFolder = `./data/area/bundle/${areaId}`;
  await fs.mkdir(createAreaBundleFolder, { recursive: true });
  const createAreaBundlePath = `${createAreaBundleFolder}/${areaKey}.json`;
  await fs.writeFile(createAreaBundlePath, JSON.stringify(areaBundle, null, 2));

  await injectInitialAreaToList(areaId, areaName);

  // ✅ Update in-memory area index (so home area is accessible without server restart)
  const areaUrlName = areaName.replace(/[^-_a-z0-9]/gi, "").toLowerCase();
  areaIndex.push({
    name: areaName,
    description: "",
    id: areaId,
    playerCount: 0
  });
  areaByUrlName.set(areaUrlName, areaId);
  console.log(`[HOME AREA] ✅ Added home area ${areaId} to in-memory index`);

  console.log(`🌍 Created default home area for ${account.screenName}`);
}

async function setupClientProfile(profileName: string): Promise<Record<string, any>> {
  let accountData = await loadAccountData(profileName);
  if (!accountData) {
    accountData = await createProfileAccount(profileName);
  } else {
    await ensurePersonInfo(accountData);
    await ensureHomeArea(accountData);
  }
  return accountData;
}

async function ensureProfileAccount(profileName: string): Promise<void> {
  await fs.mkdir(ACCOUNTS_DIR, { recursive: true });
  try {
    await fs.access(getAccountPathForProfile(profileName));
  } catch {
    await createProfileAccount(profileName);
  }
}

type PendingClient = { id: string; resolve: (profile: string) => void; timestamp: Date };
const pendingClients: PendingClient[] = [];
let pendingClientCounter = 0;
const adminEventClients = new Set<{
  id: number;
  controller: ReadableStreamDefaultController<Uint8Array>;
  heartbeat?: ReturnType<typeof setInterval>;
}>();
let adminEventClientCounter = 0;

function removeAdminEventClient(client: {
  id: number;
  controller: ReadableStreamDefaultController<Uint8Array>;
  heartbeat?: ReturnType<typeof setInterval>;
}) {
  if (client.heartbeat) clearInterval(client.heartbeat);
  adminEventClients.delete(client);
}

function sendAdminEvent(event: string, payload: Record<string, any> = {}) {
  const message = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  const encoded = textEncoder.encode(message);
  for (const client of Array.from(adminEventClients)) {
    try {
      client.controller.enqueue(encoded);
    } catch {
      removeAdminEventClient(client);
    }
  }
}

function notifyPendingChange() {
  sendAdminEvent("pending", { pending: pendingClients.length });
}

function notifyProfileChange() {
  sendAdminEvent("profile", { profile: currentActiveProfile });
}

const areaIndex: { name: string, description?: string, id: string, playerCount: number }[] = [];
const areaByUrlName = new Map<string, string>()

console.log("building area index...")
const cacheFile = Bun.file("./cache/areaIndex.json");

if (await cacheFile.exists()) {
  console.log("Loading area index from cache...");
  try {
    const cachedIndex = await cacheFile.json();
    
    // Handle both array and object formats
    if (Array.isArray(cachedIndex)) {
      // Old array format
      for (const area of cachedIndex) {
        if (area && typeof area === 'object' && area.name && area.id) {
          const areaUrlName = area.name.replace(/[^-_a-z0-9]/g, "");
          areaByUrlName.set(areaUrlName, area.id);
          areaIndex.push(area);
        }
      }
      console.log("done (cached - array format)");
    } else if (cachedIndex && typeof cachedIndex === 'object') {
      // New object format - convert to array format
      for (const [areaId, areaData] of Object.entries(cachedIndex)) {
        if (areaData && typeof areaData === 'object' && areaData.title) {
          const area = {
            id: areaId,
            name: areaData.title,
            description: areaData.description || "",
            playerCount: 0
          };
          const areaUrlName = area.name.replace(/[^-_a-z0-9]/g, "");
          areaByUrlName.set(areaUrlName, area.id);
          areaIndex.push(area);
        }
      }
      console.log("done (cached - object format)");
    } else {
      console.log("Cache file corrupted, rebuilding...");
      throw new Error("Invalid cache format");
    }
  } catch (error) {
    console.log("Error loading cache, rebuilding...", error.message);
    // Fall through to rebuild
  }
}

if (areaIndex.length === 0) {
  console.log("building area index...");
  const files = await fs.readdir("./data/area/info");

  for (let i = 0; i < files.length; i++) {
    const filename = files[i];

    if (i % 1000 === 0) {
      console.log(`Indexed ${i} files...`);
    }

    const file = Bun.file(path.join("./data/area/info", filename));
    if (!await file.exists()) continue;

    try {
      const areaInfo = await file.json().then(AreaInfoSchema.parseAsync);
      if (!areaInfo.name) throw new Error("Missing name field");

      const areaId = path.parse(filename).name;
      const areaUrlName = areaInfo.name.replace(/[^-_a-z0-9]/g, "");

      areaByUrlName.set(areaUrlName, areaId);
      areaIndex.push({
        name: areaInfo.name,
        description: areaInfo.description,
        id: areaId,
        playerCount: 0,
      });
    } catch (err) {
      console.warn(`Skipping ${filename}: ${err.message}`);
      continue;
    }
  }

  console.log("done");
  await fs.mkdir("./cache", { recursive: true });
  await Bun.write("./cache/areaIndex.json", JSON.stringify(areaIndex));
}

const searchArea = (term: string) => {
  return areaIndex.filter(a => a.name.includes(term))
}
const findAreaByUrlName = (areaUrlName: string) => {
  return areaByUrlName.get(areaUrlName)
}

// ==================== THING SEARCH INDEX ====================
interface ThingIndexEntry {
  id: string;
  name: string;
  tags: string[];
}

const thingIndex: ThingIndexEntry[] = [];
const THING_INDEX_CACHE = "./cache/thingIndex.json";

console.log("Building thing search index...");
const thingCacheFile = Bun.file(THING_INDEX_CACHE);

if (await thingCacheFile.exists()) {
  console.log("Loading thing index from cache...");
  try {
    const cached = await thingCacheFile.json();
    if (Array.isArray(cached)) {
      thingIndex.push(...cached);
      console.log(`✓ Loaded ${thingIndex.length} things from cache`);
    } else {
      throw new Error("Invalid cache format");
    }
  } catch (error) {
    console.log("Thing cache invalid, rebuilding...");
  }
}

if (thingIndex.length === 0) {
  console.log("Scanning thing info files (this may take a while)...");
  const infoDir = "./data/thing/info";
  const tagsDir = "./data/thing/tags";
  
  try {
    const files = await fs.readdir(infoDir);
    const totalFiles = files.length;
    let indexed = 0;
    
    console.log(`Found ${totalFiles} thing files to process...`);
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Progress logging every 5000 files (like area index)
      if (i % 5000 === 0) {
        const percent = ((i / totalFiles) * 100).toFixed(1);
        console.log(`Indexed ${i}/${totalFiles} things (${percent}%)...`);
      }
      
      if (!file.endsWith(".json")) continue;
      
      const thingId = path.basename(file, ".json");
      
      try {
        const raw = await fs.readFile(path.join(infoDir, file), "utf-8");
        const info = JSON.parse(raw);
        
        // Only index things that are not unlisted (include all, even with placedCount=0)
        if (!info || typeof info !== "object") continue;
        if (info.isUnlisted === true) continue;
        
        // Use "thing" as default name if none provided
        const name = typeof info.name === "string" && info.name.trim() ? info.name.trim().toLowerCase() : "thing";
        
        // Try to get tags
        let tags: string[] = [];
        try {
          const tagsRaw = await fs.readFile(path.join(tagsDir, file), "utf-8");
          const tagData = JSON.parse(tagsRaw);
          if (Array.isArray(tagData.tags)) {
            tags = tagData.tags.map((t: string) => t.toLowerCase());
          }
        } catch {
          // No tags file
        }
        
        thingIndex.push({ id: thingId, name, tags });
        indexed++;
      } catch {
        // Skip invalid files
      }
    }
    
    console.log(`✓ Indexed ${indexed} searchable things out of ${totalFiles} total (100%)`);
    
    // Save to cache
    await fs.mkdir("./cache", { recursive: true });
    await Bun.write(THING_INDEX_CACHE, JSON.stringify(thingIndex));
    console.log("✓ Thing index saved to cache");
  } catch (err) {
    console.error("Failed to build thing index:", err);
  }
}

function searchThings(term: string, limit: number = 0): string[] {
  const searchTerm = term.toLowerCase();
  
  const matches = thingIndex.filter(thing => {
    if (searchTerm === "") return true;
    if (thing.name.includes(searchTerm)) return true;
    if (thing.tags.some(tag => tag.includes(searchTerm))) return true;
    return false;
  });
  
  // Return all results if limit is 0, otherwise limit the results
  return limit > 0 ? matches.slice(0, limit).map(t => t.id) : matches.map(t => t.id);
}

// ==================== END THING SEARCH INDEX ====================

// ✅ Inject default home area into arealist.json if not already present
try {
  const account = JSON.parse(await fs.readFile("./data/person/account.json", "utf-8"));
  const personId = account.personId;
  const personName = account.screenName;
  const defaultAreaId = account.homeAreaId;
  const defaultAreaName = `${personName}'s home`;

  const listPath = "./data/area/arealist.json";
  let alreadyExists = false;

  try {
    const areaList = await Bun.file(listPath).json();
    alreadyExists = areaList.created?.some((a: any) => a.id === defaultAreaId);
  } catch { }

  if (!alreadyExists) {
    await injectInitialAreaToList(defaultAreaId, defaultAreaName);
    console.log(`✅ Injected default area "${defaultAreaName}" into arealist.json`);
  }
} catch {
  // No legacy account yet – skip default area injection until a profile connects
}


const app = new Elysia()
  .onRequest(async ({ request }) => {
    console.info(JSON.stringify({
      ts: new Date().toISOString(),
      ip: request.headers.get('X-Real-Ip'),
      ua: request.headers.get("User-Agent"),
      method: request.method,
      url: request.url,
    }));
  })
  .onError(async ({ code, error, request }) => {
    console.info("error in middleware!", request.url, code);
    console.log(error);
  })
  .onTransform(({ request, path, body, params }) => {
    // Match Redux server's simple logging
    console.log(request.method, path, { body, params })
  })

  .get("/admin", async () => {
    const profiles = await listProfiles();
    const pendingHtml = pendingClients.length
      ? pendingClients.map((client) => `
        <div class="client-item">
          <div>
            <div><strong>Waiting Client</strong></div>
            <div class="meta">ID: ${client.id} · Since ${client.timestamp.toLocaleTimeString()}</div>
          </div>
          <form class="assign-form" action="/admin/assign" method="GET">
            <input type="hidden" name="clientId" value="${client.id}" />
            <select name="profile">
              <option value="">Select profile</option>
              ${profiles.map((p) => `<option value="${p}">${p}</option>`).join("")}
            </select>
            <span>or</span>
            <input type="text" name="newProfile" placeholder="New name" />
            <button type="submit">Assign</button>
          </form>
        </div>
      `).join("")
      : `<div class="empty">No clients waiting. Start a client to see it here.</div>`;

    const profileList = profiles.length
      ? profiles.map((p) => `<span class="profile-tag">${p}</span>`).join("")
      : `<div class="empty">No profiles yet.</div>`;

    const nextProfileHtml = nextClientProfile
      ? `<div style="margin: 12px 0; padding: 8px; background: rgba(34, 197, 94, 0.1); border: 1px solid #22c55e; border-radius: 6px;">
          <strong>Next Client Profile:</strong> ${nextClientProfile}
          <a href="/admin/clear-next-profile" style="color: #dc2626; margin-left: 12px; text-decoration: none;">[Clear]</a>
         </div>`
      : `<form class="inline" action="/admin/set-next-profile" method="GET" style="margin: 12px 0; padding: 12px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px;">
          <strong>Set next client profile:</strong>
          <select name="profile" style="margin: 0 8px;">
            <option value="">Select profile</option>
            ${profiles.map((p) => `<option value="${p}" ${nextClientProfile === p ? 'selected' : ''}>${p}</option>`).join("")}
          </select>
          <button type="submit">Set for Next Client</button>
         </form>`;

    const html = `<!DOCTYPE html>
<html>
<head>
  <title>Echoland Admin</title>
  <style>
    body { font-family: Arial, sans-serif; background: #0f141c; color: #e0e6f0; margin: 0; padding: 30px; }
    .container { max-width: 900px; margin: 0 auto; }
    h1 { margin-bottom: 20px; }
    .card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 20px; margin-bottom: 20px; }
    .client-item { display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 12px 0; border-bottom: 1px solid rgba(255,255,255,0.05); }
    .client-item:last-child { border-bottom: none; }
    .assign-form { display: flex; gap: 8px; align-items: center; }
    select, input[type="text"] { padding: 8px 10px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.3); color: #fff; }
    button { padding: 8px 16px; border: none; border-radius: 6px; background: #2f89ff; color: white; cursor: pointer; }
    button:hover { background: #1d6adf; }
    .profile-tag { display: inline-block; padding: 6px 12px; background: rgba(255,255,255,0.1); margin: 4px; border-radius: 12px; }
    .empty { color: #8a93a6; font-style: italic; }
    form.inline { display: flex; gap: 8px; margin-top: 12px; }
    .active-badge { display: inline-block; padding: 6px 14px; background: #22c55e; color: #000; font-weight: bold; border-radius: 20px; margin-left: 12px; }
    .header { display: flex; align-items: center; margin-bottom: 20px; }
    .header h1 { margin: 0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Echoland Admin</h1>
      <span id="active-profile" class="active-badge">${currentActiveProfile ? 'Active: ' + currentActiveProfile : 'No active profile'}</span>
    </div>
    <div class="card">
      <h2>Pending Clients (${pendingClients.length})</h2>
      ${pendingHtml}
    </div>
    <div class="card">
      <h2>Profiles (${profiles.length})</h2>
      <div>${profileList}</div>
      <form class="inline" action="/admin/create-profile" method="GET">
        <input type="text" name="name" placeholder="New profile name" required />
        <button type="submit">Create</button>
      </form>
      ${nextProfileHtml}
    </div>
  </div>
  <script>
    (() => {
      let eventSource = null;
      let reconnectTimer = null;
      
      function connect() {
        if (eventSource) {
          eventSource.close();
        }
        
        console.log('[Admin] Connecting to SSE...');
        eventSource = new EventSource('/admin/events');
        
        eventSource.onopen = () => {
          console.log('[Admin] SSE connected');
          if (reconnectTimer) {
            clearTimeout(reconnectTimer);
            reconnectTimer = null;
          }
        };
        
        eventSource.onerror = (e) => {
          console.log('[Admin] SSE error, will reconnect...');
          eventSource.close();
          if (!reconnectTimer) {
            reconnectTimer = setTimeout(connect, 2000);
          }
        };
        
        eventSource.addEventListener('pending', (e) => {
          console.log('[Admin] Pending change:', e.data);
          window.location.reload();
        });
        
        eventSource.addEventListener('profile', (e) => {
          console.log('[Admin] Profile change:', e.data);
          // Update active profile display without full reload
          try {
            const data = JSON.parse(e.data);
            const badge = document.getElementById('active-profile');
            if (badge && data.profile) {
              badge.textContent = 'Active: ' + data.profile;
            }
          } catch {}
        });
        
        eventSource.addEventListener('connected', (e) => {
          console.log('[Admin] SSE ready');
        });
      }
      
      connect();
    })();
  </script>
</body>
</html>`;
    return new Response(html, { headers: { "Content-Type": "text/html" } });
  })
  .get("/admin/assign", async ({ query }) => {
    const clientId = query.clientId;
    let profileName = (query.profile || query.newProfile || "").trim();
    if (!clientId || !profileName) {
      return Response.redirect("/admin", 302);
    }
    const idx = pendingClients.findIndex((c) => c.id === clientId);
    if (idx === -1) {
      return Response.redirect("/admin", 302);
    }
    await setupClientProfile(profileName);
    const client = pendingClients.splice(idx, 1)[0];
    client.resolve(profileName);
    notifyPendingChange();
    console.log(`[ADMIN] Assigned profile ${profileName} to ${clientId}`);
    return Response.redirect("/admin", 302);
  }, {
    query: t.Object({
      clientId: t.String(),
      profile: t.Optional(t.String()),
      newProfile: t.Optional(t.String())
    })
  })
  .get("/admin/create-profile", async ({ query }) => {
    const name = (query.name || "").trim();
    if (name) {
      await setupClientProfile(name);
      console.log(`[ADMIN] Created profile ${name}`);
    }
    return Response.redirect("/admin", 302);
  }, {
    query: t.Object({
      name: t.Optional(t.String())
    })
  })
  .get("/admin/set-next-profile", async ({ query }) => {
    const profileName = (query.profile || "").trim();
    if (profileName) {
      nextClientProfile = profileName;
      console.log(`[ADMIN] Set next client profile to: ${profileName}`);
    }
    return Response.redirect("/admin", 302);
  }, {
    query: t.Object({
      profile: t.Optional(t.String())
    })
  })
  .get("/admin/clear-next-profile", async () => {
    nextClientProfile = null;
    console.log(`[ADMIN] Cleared next client profile`);
    return Response.redirect("/admin", 302);
  })
  .get("/api/profiles", async () => {
    const profiles = await listProfiles();
    return new Response(JSON.stringify({ profiles }), {
      headers: { "Content-Type": "application/json" }
    });
  })
  .get("/admin/events", ({ set }) => {
    set.headers["Content-Type"] = "text/event-stream";
    set.headers["Cache-Control"] = "no-cache, no-transform";
    set.headers["Connection"] = "keep-alive";

    let clientRef: {
      id: number;
      controller: ReadableStreamDefaultController<Uint8Array>;
      heartbeat?: ReturnType<typeof setInterval>;
    } | null = null;

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        clientRef = {
          id: ++adminEventClientCounter,
          controller,
        };
        clientRef.heartbeat = setInterval(() => {
          try {
            controller.enqueue(textEncoder.encode(`event: ping\ndata: {}\n\n`));
          } catch {
            if (clientRef) {
              removeAdminEventClient(clientRef);
              clientRef = null;
            }
          }
        }, 15000);
        adminEventClients.add(clientRef);
        controller.enqueue(textEncoder.encode(`event: connected\ndata: {}\n\n`));
        controller.enqueue(
          textEncoder.encode(
            `event: pending\ndata: ${JSON.stringify({ pending: pendingClients.length })}\n\n`
          )
        );
      },
      cancel() {
        if (!clientRef) return;
        removeAdminEventClient(clientRef);
        clientRef = null;
      },
    });

    return stream;
  })


  .post(
    "/auth/start",
    async ({ cookie, request, body }) => {
      const { ast } = cookie;

      // Get profile from header, query param, or body
      let profileName =
        request.headers.get("X-Profile") ||
        (request.url ? new URL(request.url).searchParams.get("profile") : null) ||
        (body && typeof body === "object" && "profile" in body ? (body as any).profile : null) ||
        null;

      // If no profile specified, check if there's a pre-selected profile for next client
      if (!profileName) {
        if (nextClientProfile) {
          console.log(`[AUTH] Auto-assigning pre-selected profile: ${nextClientProfile}`);
          profileName = nextClientProfile;
          nextClientProfile = null; // Clear after use
        } else {
          // Wait for admin to assign one
          const clientId = `client-${++pendingClientCounter}`;
          console.log(`[AUTH] New client awaiting profile selection (client ${clientId})`);
          profileName = await new Promise<string>((resolve) => {
            pendingClients.push({ id: clientId, resolve, timestamp: new Date() });
            notifyPendingChange();
          });
        }
      }

      // If there was a previous active profile, save its data first
      if (currentActiveProfile && currentActiveProfile !== profileName) {
        console.log(`[AUTH] Switching from profile ${currentActiveProfile} to ${profileName}`);
        await syncLegacyToProfile(currentActiveProfile);
      }

      // Setup the new profile
      const account = await setupClientProfile(profileName);
      
      // Set this as the active profile
      currentActiveProfile = profileName;
      console.log(`[AUTH] ✅ Active profile set to: ${profileName}`);
      
      // Sync profile data to legacy file (for endpoints that read from it)
      await syncProfileToLegacy(profileName);
      
      // Notify admin panel of profile change
      notifyProfileChange();

      // Set session cookie
      const activeAstToken = `s:${generateObjectId()}`;
      ast.value = activeAstToken;
      ast.httpOnly = true;
      ast.path = "/";

      const attachmentsObj = typeof account.attachments === "string"
        ? JSON.parse(account.attachments || "{}")
        : (account.attachments ?? {});

      console.log("[AUTH] Current attachments:", Object.keys(attachmentsObj).map(k => `${k}: ${attachmentsObj[k] ? 'has data' : 'empty'}`).join(', '));

      const attachmentsString = typeof account.attachments === "string"
        ? account.attachments
        : JSON.stringify(account.attachments ?? {});

      const authResponse: any = {
        vMaj: 188,
        vMinSrv: 1,
        personId: account.personId,
        homeAreaId: account.homeAreaId,
        screenName: account.screenName,
        statusText: `exploring around (my id: ${account.personId})`,
        isFindable: true,
        age: account.age || 2226,
        ageSecs: account.ageSecs || 192371963,
        attachments: attachmentsString,
        isSoftBanned: false,
        showFlagWarning: false,
        flagTags: [],
        areaCount: account.ownedAreas?.length || 1,
        thingTagCount: 1,
        allThingsClonable: true,
        achievements: account.achievements || [
          30, 7, 19, 4, 20, 11, 10,
          5, 9, 17, 13, 12, 16, 37,
          34, 35, 44, 31, 15, 27, 28
        ],
        hasEditTools: true,
        hasEditToolsPermanently: true,
        editToolsExpiryDate: '2024-01-30T15:26:27.720Z',
        isInEditToolsTrial: false,
        wasEditToolsTrialEverActivated: true,
        customSearchWords: ''
      };

      if (account.handColor) {
        authResponse.handColor = account.handColor;
        console.log("[AUTH] Returning saved hand color:", account.handColor);
      }

      console.log(`[AUTH] Player connected as ${profileName}`);
      return authResponse;
    },
    {
      cookie: t.Object({
        ast: t.Optional(t.String()),
        profile: t.Optional(t.String()),
      }),
      body: t.Optional(t.Object({
        profile: t.Optional(t.String())
      }))
    }
  )
  .post("/person/updateattachment", async ({ body }) => {
    return await accountMutex.runExclusive(async () => {
      console.log("[ATTACHMENT] Received request:", JSON.stringify(body));
      const { id, data, attachments } = body as any;

      const accountPath = await getAccountPath();
      let accountData: Record<string, any> = {};
      
      // Read account data
      try {
        const fileContent = await fs.readFile(accountPath, "utf-8");
        accountData = JSON.parse(fileContent);
      } catch (e) {
        console.error("[ATTACHMENT] Failed to read account:", e);
        return new Response(JSON.stringify({ ok: false, error: "Account read failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Ensure attachments object exists in account
      let currentAttachments: Record<string, any> = {};
      if (typeof accountData.attachments === "string") {
        try { currentAttachments = JSON.parse(accountData.attachments) ?? {}; } catch { currentAttachments = {}; }
      } else if (accountData.attachments && typeof accountData.attachments === "object") {
        currentAttachments = accountData.attachments as Record<string, any>;
      }

      if (attachments !== undefined) {
        // Full replacement path
        let parsed: unknown = attachments;
        if (typeof attachments === "string") {
          try { parsed = JSON.parse(attachments); } catch {
            return new Response(JSON.stringify({ ok: false, error: "attachments must be JSON or JSON string" }), {
              status: 422,
              headers: { "Content-Type": "application/json" }
            });
          }
        }
        accountData.attachments = parsed;
        console.log("[ATTACHMENT] Updated full attachments");
      } else if (id !== undefined && data !== undefined) {
        // Incremental update path: single slot (including hands which are just numbered slots)
        const slotId = String(id);
        
        // Empty string means remove this attachment
        if (data === "" || data === null) {
          delete currentAttachments[slotId];
          accountData.attachments = currentAttachments;
          console.log(`[ATTACHMENT] Removed attachment from slot ${slotId}`);
        } else {
          // Parse and store the attachment data
        let parsedData: any = data;
        if (typeof data === "string") {
          try { parsedData = JSON.parse(data); } catch {
            return new Response(JSON.stringify({ ok: false, error: "data must be JSON string" }), {
              status: 422,
              headers: { "Content-Type": "application/json" }
            });
          }
        }
        
          // Wrist attachments (slots 6 and 7) are just regular attachments
          // The client handles "replaces hand when worn" logic by checking thing definitions
          if (slotId === "6" || slotId === "7") {
            console.log(`[WRIST] Storing wrist attachment in slot ${slotId}`);
          }
          
          // Store attachment in the numbered slot
          currentAttachments[slotId] = parsedData;
          accountData.attachments = currentAttachments;
          console.log(`[ATTACHMENT] Updated attachment slot ${slotId}:`, parsedData);
        }
      } else {
        return new Response(JSON.stringify({ ok: false, error: "Missing attachments or (id,data)" }), {
          status: 422,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Atomic write
      try {
        const tempPath = `${accountPath}.tmp`;
        await fs.writeFile(tempPath, JSON.stringify(accountData, null, 2));
        await fs.rename(tempPath, accountPath);
        
        // Also persist to profile file if there's an active profile
        if (currentActiveProfile) {
          await syncLegacyToProfile(currentActiveProfile);
        }
      } catch (e) {
        console.error("[ATTACHMENT] Failed to write account:", e);
        return new Response(JSON.stringify({ ok: false, error: "Account write failed" }), {
          status: 500,
          headers: { "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    });
  })
  // Set hand color for avatar
  .post("/person/sethandcolor", async ({ body }) => {
    console.log("[HAND COLOR] Received request:", body);

    const accountPath = await getAccountPath();
    let accountData: Record<string, any> = {};
    try {
      accountData = JSON.parse(await fs.readFile(accountPath, "utf-8"));
    } catch (e) {
      console.error("[HAND COLOR] Failed to read account:", e);
      return new Response(JSON.stringify({ ok: false, error: "Account not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Store the hand color data
    const { r, g, b } = body as any;
    if (r !== undefined && g !== undefined && b !== undefined) {
      // Convert to numbers to ensure proper data type
      accountData.handColor = { 
        r: parseFloat(r), 
        g: parseFloat(g), 
        b: parseFloat(b) 
      };
      console.log("[HAND COLOR] Saved hand color:", accountData.handColor);
    } else {
      console.warn("[HAND COLOR] Missing r, g, b values:", body);
    }

    await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));
    
    // Also persist to profile file if there's an active profile
    if (currentActiveProfile) {
      await syncLegacyToProfile(currentActiveProfile);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  })
  .post("/p", () => ({ "vMaj": 188, "vMinSrv": 1 }))
  .post(
    "/area/load",
    async ({ body: { areaId, areaUrlName } }) => {
      console.log(`[AREA LOAD] Request received - areaId: ${areaId}, areaUrlName: ${areaUrlName}`);
      
      if (areaId) {
        const filePath = path.resolve("./data/area/load/", areaId + ".json");
        const file = Bun.file(filePath);
        console.log(`[AREA LOAD] Checking file: ${filePath}`);

        if (await file.exists()) {
          try {
            const areaData = await file.json();
            console.log(`[AREA LOAD] ✅ Successfully loaded area ${areaId} (${areaData.areaName || 'unnamed'})`);

            // Also verify the bundle exists
            const bundlePath = path.resolve("./data/area/bundle/", areaId, (areaData.areaKey || '') + ".json");
            const bundleFile = Bun.file(bundlePath);
            const bundleExists = await bundleFile.exists();
            console.log(`[AREA LOAD] Bundle ${areaData.areaKey} exists: ${bundleExists}`);

            // Check if current user has edit permissions
            let hasEditPermission = false;
            let isOwner = false;

            try {
              // Load area info to check editors
              const areaInfoPath = path.resolve("./data/area/info/", areaId + ".json");
              const areaInfoFile = Bun.file(areaInfoPath);
              if (await areaInfoFile.exists()) {
                const areaInfo = await areaInfoFile.json();
                // Load current user account
                const accountPath = "./data/person/account.json";
                const account = JSON.parse(await fs.readFile(accountPath, "utf-8"));
                const currentUserId = account.personId;

                // Check if user is in editors list
                hasEditPermission = areaInfo.editors?.some((editor: any) => editor.id === currentUserId) || false;
                isOwner = areaInfo.editors?.some((editor: any) => editor.id === currentUserId && editor.isOwner) || false;

                console.log(`[AREA LOAD] User ${currentUserId} has edit permission: ${hasEditPermission}, is owner: ${isOwner}`);
              } else {
                console.warn(`[AREA LOAD] Area info file not found for ${areaId}, defaulting to no edit permission`);
              }
            } catch (err) {
              console.warn(`[AREA LOAD] Could not check edit permissions for area ${areaId}:`, err);
            }

            return {
              ...areaData,
              forceEditMode: hasEditPermission,
              requestorIsEditor: hasEditPermission,
              requestorIsListEditor: hasEditPermission,
              requestorIsOwner: isOwner,
              hasEditTools: hasEditPermission,
              hasEditToolsPermanently: hasEditPermission,
              editToolsExpiryDate: hasEditPermission ? null : undefined,
              isInEditToolsTrial: false,
              wasEditToolsTrialEverActivated: false
            };
          } catch (err) {
            console.error(`[AREA LOAD] ❌ Error parsing area ${areaId}:`, err);
            return Response.json({ "ok": false, "_reasonDenied": "Private", "serveTime": 13 }, { status: 200 });
          }
        } else {
          console.error(`[AREA LOAD] ❌ Area file not found on disk: ${areaId}`);
          return Response.json({ "ok": false, "_reasonDenied": "Private", "serveTime": 13 }, { status: 200 });
        }
      }
      else if (areaUrlName) {
        const foundAreaId = findAreaByUrlName(areaUrlName);
        console.log(`[AREA LOAD] Looking up by URL name: ${areaUrlName} -> ${foundAreaId || 'NOT FOUND'}`);

        if (foundAreaId) {
          const filePath = path.resolve("./data/area/load/" + foundAreaId + ".json");
          const file = Bun.file(filePath);
          
          if (await file.exists()) {
            console.log(`[AREA LOAD] ✅ Found and loading area by URL name: ${areaUrlName}`);
            return await file.json();
          } else {
            console.error(`[AREA LOAD] ❌ Area in index but file missing: ${foundAreaId}`);
            return Response.json({ "ok": false, "_reasonDenied": "Private", "serveTime": 13 }, { status: 200 });
          }
        }
        else {
          console.error(`[AREA LOAD] ❌ Area URL name not in index: ${areaUrlName}`);
          return Response.json({ "ok": false, "_reasonDenied": "Private", "serveTime": 13 }, { status: 200 });
        }
      }

      console.error("[AREA LOAD] ❌ Client asked for neither an areaId or an areaUrlName");
      return Response.json({ "ok": false, "_reasonDenied": "Private", "serveTime": 13 }, { status: 200 });
    },
    { body: t.Object({ areaId: t.Optional(t.String()), areaUrlName: t.Optional(t.String()), isPrivate: t.String() }) }
  )
  .post(
    "/area/info",
    async ({ body: { areaId } }) => {
      const filePath = path.resolve("./data/area/info/", areaId + ".json");
      const file = Bun.file(filePath);
      
      if (await file.exists()) {
        try {
          const data = await file.json();
          console.log(`[AREA INFO] Loaded info for area ${areaId}`);
          return data;
        } catch (err) {
          console.error(`[AREA INFO] Error parsing info for area ${areaId}:`, err);
          return { ok: false, error: "Failed to parse area info" };
        }
      } else {
        console.warn(`[AREA INFO] Area info file not found: ${areaId}`);
        return { ok: false, error: "Area not found" };
      }
    },
    { body: t.Object({ areaId: t.String() }) }
  )
  .get("/area/random", async () => {
    try {
      // Get all available areas from the index
      if (areaIndex.length === 0) {
        return new Response(JSON.stringify({
          ok: false,
          error: "No areas available"
        }), {
          status: 404,
          headers: { "Content-Type": "application/json" }
        });
      }

      // Pick a random area
      const randomIndex = Math.floor(Math.random() * areaIndex.length);
      const randomArea = areaIndex[randomIndex];

      console.log(`[AREA RANDOM] Selected area: ${randomArea.name} (${randomArea.id})`);

      // Return area info in the format expected by the client
      return {
        areaId: randomArea.id,
        areaName: randomArea.name,
        areaUrlName: randomArea.name.replace(/[^-_a-z0-9]/gi, "").toLowerCase(),
        ok: true
      };
    } catch (error) {
      console.error("[AREA RANDOM] Error:", error);
      return new Response(JSON.stringify({
        ok: false,
        error: "Failed to get random area"
      }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
  .post("/area/save",
    async ({ body }) => {
      const areaId = body.id || generateObjectId();
      const filePath = `./data/area/load/${areaId}.json`;

      await fs.mkdir("./data/area/load", { recursive: true });
      // Align creator identity with account.json (same as /area route)
      let creatorId = body.creatorId;
      try {
        const account = JSON.parse(await fs.readFile("./data/person/account.json", "utf-8"));
        if (account?.personId) creatorId = account.personId;
      } catch { }
      const sanitizedBody = {
        ...body,
        creatorId
      };

      await Bun.write(filePath, JSON.stringify(sanitizedBody));



      areaIndex.push({
        name: body.name,
        description: body.description || "",
        id: areaId,
        playerCount: 0
      });
      areaByUrlName.set(body.name.replace(/[^-_a-z0-9]/g, ""), areaId);
      await Bun.write("./cache/areaIndex.json", JSON.stringify(areaIndex));

      return { ok: true, id: areaId };
    },
    { body: t.Unknown() }
  )
  .post(
    "/area/getsubareas",
    async ({ body: { areaId } }) => {
      const file = Bun.file(path.resolve("./data/area/subareas/", areaId + ".json"))
      if (await file.exists()) {
        return await file.json()
      }
      else {
        return { subAreas: [] }
      }
    },
    { body: t.Object({ areaId: t.String() }) }
  )
  .post(
    "/area/search",
    async ({ body: { term, byCreatorId } }) => {
      if (byCreatorId) {
        const file = Bun.file(path.resolve("./data/person/areasearch/", byCreatorId + ".json"))

        if (await file.exists()) {
          return await file.json()
        }
        else {
          return { areas: [], ownPrivateAreas: [] }
        }
      }
      else {
        const matchingAreas = searchArea(term);

        return {
          areas: matchingAreas,
          ownPrivateAreas: []
        }
      }

    },
    { body: t.Object({ term: t.String(), byCreatorId: t.Optional(t.String()) }) }
  )
  .post("/user/setName", async ({ body }) => {
    const { newName } = body;

    if (!newName || typeof newName !== "string" || newName.length < 3) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid name" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const accountPath = await getAccountPath();
    let accountData: Record<string, any> = {};
    try {
      accountData = JSON.parse(await fs.readFile(accountPath, "utf-8"));
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Account not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    accountData.screenName = newName;
    await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));

    return new Response(JSON.stringify({ ok: true, screenName: newName }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({
      newName: t.String()
    })
  })
  .post("/area/lists", async () => {
    const dynamic = await getDynamicAreaList();

    // Get current profile's owned areas for filtering "created" list
    let ownedAreaIds: string[] = [];
    let homeAreaId: string | null = null;
    
    if (currentActiveProfile) {
      try {
        const accountPath = await getAccountPath();
        const accountData = JSON.parse(await fs.readFile(accountPath, "utf-8"));
        ownedAreaIds = accountData.ownedAreas || [];
        homeAreaId = accountData.homeAreaId;
        
        // Always include home area in owned list
        if (homeAreaId && !ownedAreaIds.includes(homeAreaId)) {
          ownedAreaIds.push(homeAreaId);
        }
      } catch (e) {
        console.warn("[AREA LIST] Could not load profile for area filtering:", e);
      }
    }

    // Combine all areas for "created" filtering
    const allCreated = [...canned_areaList.created, ...dynamic.created];
    
    // Filter "created" to only show areas owned by current profile
    const userCreated = ownedAreaIds.length > 0
      ? allCreated.filter((area: any) => ownedAreaIds.includes(area.id))
      : []; // Empty if no profile or no owned areas

    return {
      visited: [...canned_areaList.visited, ...dynamic.visited],
      created: userCreated,
      newest: [...canned_areaList.newest, ...dynamic.newest],
      popular: [...canned_areaList.popular, ...dynamic.popular],
      popular_rnd: [...canned_areaList.popular_rnd, ...dynamic.popular_rnd],
      popularNew: [...canned_areaList.popularNew, ...dynamic.popularNew],
      popularNew_rnd: [...canned_areaList.popularNew_rnd, ...dynamic.popularNew_rnd],
      lively: [...canned_areaList.lively, ...dynamic.lively],
      favorite: [...canned_areaList.favorite, ...dynamic.favorite],
      mostFavorited: [...canned_areaList.mostFavorited, ...dynamic.mostFavorited],
      totalOnline: canned_areaList.totalOnline + dynamic.totalOnline,
      totalAreas: canned_areaList.totalAreas + dynamic.totalAreas,
      totalPublicAreas: canned_areaList.totalPublicAreas + dynamic.totalPublicAreas,
      totalSearchablePublicAreas: canned_areaList.totalSearchablePublicAreas + dynamic.totalSearchablePublicAreas
    };
  })
  .get("/repair-home-area", async () => {
    const accountPath = "./data/person/account.json";
    const areaBase = "./data/area";

    try {
      const account = JSON.parse(await fs.readFile(accountPath, "utf-8"));
      const homeId = account.homeAreaId;
      if (!homeId) return new Response("No homeAreaId found", { status: 400 });

      const loadPath = `${areaBase}/load/${homeId}.json`;
      const bundlePath = `${areaBase}/bundle/${homeId}`;

      // ✅ Load area
      const loadFile = Bun.file(loadPath);
      if (!(await loadFile.exists())) {
        return new Response("Home area load file missing", { status: 404 });
      }

      const loadData = await loadFile.json();
      let areaKey = loadData.areaKey;

      // ✅ Check if bundle file exists
      const bundleFilePath = `${bundlePath}/${areaKey}.json`;
      const bundleFile = Bun.file(bundleFilePath);
      const bundleExists = await bundleFile.exists();

      // ✅ If bundle missing or key malformed, regenerate
      const isMalformed = !areaKey.startsWith("rr") || areaKey.length !== 26;
      if (!bundleExists || isMalformed) {
        const newKey = `rr${crypto.randomUUID().replace(/-/g, "").slice(0, 24)}`;
        const newBundlePath = `${bundlePath}/${newKey}.json`;

        await fs.mkdir(bundlePath, { recursive: true });
        await fs.writeFile(newBundlePath, JSON.stringify({
          thingDefinitions: [],
          serveTime: 0
        }, null, 2));

        loadData.areaKey = newKey;
        await fs.writeFile(loadPath, JSON.stringify(loadData, null, 2));

        return new Response(`✅ Repaired home area with new key: ${newKey}`, { status: 200 });
      }

      return new Response("✅ Home area is already valid", { status: 200 });
    } catch (err) {
      console.error("Repair failed:", err);
      return new Response("Server error during repair", { status: 500 });
    }
  })
  .post("/area", async ({ body }) => {
    const areaName = body?.name;
    if (!areaName || typeof areaName !== "string") {
      return new Response("Missing area name", { status: 400 });
    }

    // ✅ Load identity from account.json
    let personId: string;
    let personName: string;

    try {
      const account = JSON.parse(await fs.readFile("./data/person/account.json", "utf-8"));
      personId = account.personId;
      personName = account.screenName;

      if (!personId || !personName) {
        throw new Error("Missing personId or screenName in account.json");
      }
    } catch {
      return new Response("Could not load valid account identity", { status: 500 });
    }

    const generateId = () => crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    const areaId = generateId();
    const bundleKey = `rr${generateId()}`;
    const basePath = "./data/area";
    const timestamp = new Date().toISOString();

    await Promise.all([
      fs.mkdir(`${basePath}/info`, { recursive: true }),
      fs.mkdir(`${basePath}/bundle/${areaId}`, { recursive: true }),
      fs.mkdir(`${basePath}/load`, { recursive: true }),
      fs.mkdir(`${basePath}/subareas`, { recursive: true })
    ]);

    const groundPlacement = {
      Id: generateId(),
      Tid: "000000000000000000000001",
      P: { x: 0, y: -0.3, z: 0 },
      R: { x: 0, y: 0, z: 0 }
    };

    // ✅ Write info file
    await fs.writeFile(`${basePath}/info/${areaId}.json`, JSON.stringify({
      editors: [{ id: personId, name: personName, isOwner: true }],
      listEditors: [],
      copiedFromAreas: [],
      name: areaName,
      creationDate: timestamp,
      totalVisitors: 0,
      isZeroGravity: false,
      hasFloatingDust: false,
      isCopyable: false,
      onlyOwnerSetsLocks: false,
      isExcluded: false,
      renameCount: 0,
      copiedCount: 0,
      isFavorited: false
    }, null, 2));

    // ✅ Write bundle file
    await fs.writeFile(`${basePath}/bundle/${areaId}/${bundleKey}.json`, JSON.stringify({
      thingDefinitions: [],
      serveTime: 0
    }, null, 2));

    // ✅ Write load file with embedded settings
    await fs.writeFile(`${basePath}/load/${areaId}.json`, JSON.stringify({
      ok: true,
      areaId,
      areaName,
      areaKey: bundleKey,
      areaCreatorId: personId,
      isPrivate: false,
      isZeroGravity: false,
      hasFloatingDust: false,
      isCopyable: false,
      onlyOwnerSetsLocks: false,
      isExcluded: false,
      environmentChangersJSON: JSON.stringify({ environmentChangers: [] }),
      requestorIsEditor: true,
      requestorIsListEditor: true,
      requestorIsOwner: true,
      placements: [groundPlacement],
      serveTime: 0,
      sound: { enabled: true, volume: 1.0 },
      gravity: { enabled: true, strength: 9.8 },
      lighting: { enabled: true },
      interactions: { enabled: true },
      settings: {
        allowVisitors: true,
        allowEdits: true,
        allowCopying: false,
        allowLocking: true
      },
      environment: {
        skybox: "default",
        ambientLight: 1.0,
        fog: { enabled: false }
      },
      locks: {
        lockedObjects: [],
        lockRules: []
      }
    }, null, 2));

    // ✅ Write subareas file
    await fs.writeFile(`${basePath}/subareas/${areaId}.json`, JSON.stringify({ subAreas: [] }, null, 2));

    // ✅ Update areaindex.json
    const indexPath = "./cache/areaindex.json";
    let currentIndex: any[] = [];
    try {
      const indexFile = Bun.file(indexPath);
      if (await indexFile.exists()) {
        const parsed = await indexFile.json();
        if (Array.isArray(parsed)) currentIndex = parsed;
      }
    } catch {
      console.warn("Couldn't read areaindex.json from cache.");
    }

    currentIndex.push({
      id: areaId,
      name: areaName,
      creatorId: personId,
      createdAt: timestamp
    });

    await fs.writeFile(indexPath, JSON.stringify(currentIndex, null, 2));

    // ✅ Update arealist.json (prevent duplicates)
    const listPath = `${basePath}/arealist.json`;
    let areaList: any = {};
    try {
      const listFile = Bun.file(listPath);
      if (await listFile.exists()) {
        areaList = await listFile.json();
      }
    } catch {
      console.warn("Couldn't read arealist.json, starting fresh.");
    }

    const newEntry = { id: areaId, name: areaName, playerCount: 0 };

    const alreadyCreated = areaList.created?.some((a: any) => a.id === areaId);
    const alreadyVisited = areaList.visited?.some((a: any) => a.id === areaId);

    if (!alreadyCreated) {
      areaList.created = [...(areaList.created ?? []), newEntry];
    }
    if (!alreadyVisited) {
      areaList.visited = [...(areaList.visited ?? []), newEntry];
    }

    areaList.newest = [newEntry, ...(areaList.newest ?? [])].slice(0, 50);
    areaList.totalAreas = (areaList.totalAreas ?? 0) + 1;
    areaList.totalPublicAreas = (areaList.totalPublicAreas ?? 0) + 1;
    areaList.totalSearchablePublicAreas = (areaList.totalSearchablePublicAreas ?? 0) + 1;

    await fs.writeFile(listPath, JSON.stringify(areaList, null, 2));

    // ✅ Inject area into account.json under ownedAreas
    const accountPath = await getAccountPath();
    try {
      const accountFile = Bun.file(accountPath);
      let accountData = await accountFile.json();

      accountData.ownedAreas = [...new Set([...(accountData.ownedAreas ?? []), areaId])];

      await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));
      
      // Persist to profile file
      if (currentActiveProfile) {
        await syncLegacyToProfile(currentActiveProfile);
      }
    } catch {
      console.warn("⚠️ Could not update account.json with new owned area.");
    }

    // ✅ Update in-memory area index (so area is accessible without server restart)
    const areaUrlName = areaName.replace(/[^-_a-z0-9]/gi, "").toLowerCase();
    areaIndex.push({
      name: areaName,
      description: "",
      id: areaId,
      playerCount: 0
    });
    areaByUrlName.set(areaUrlName, areaId);
    console.log(`[AREA CREATE] ✅ Added area ${areaId} (${areaName}) to in-memory index`);

    return new Response(JSON.stringify({ id: areaId }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({ name: t.String() }),
    type: "form"
  })
	.post("/area/updatesettings", async ({ body }) => {
		const { 
			areaId, 
			environmentChanger, 
			environmentType,
			isZeroGravity,
			hasFloatingDust,
			isCopyable,
			onlyOwnerSetsLocks,
			isPrivate,
			isExcluded
		} = body as any;
		
		if (!areaId || typeof areaId !== "string") {
			return new Response("Missing areaId", { status: 400 });
		}
		
		const loadPath = `./data/area/load/${areaId}.json`;
		const infoPath = `./data/area/info/${areaId}.json`;
		
		try {
			const loadFile = Bun.file(loadPath);
			if (!await loadFile.exists()) {
				return new Response("Area not found", { status: 404 });
			}
			
			const areaData = await loadFile.json();
			let updated = false;
			
			// Update environmentChangersJSON if provided
			if (environmentChanger) {
				try {
					const newChanger = JSON.parse(environmentChanger);
					const currentChangers = JSON.parse(areaData.environmentChangersJSON || '{"environmentChangers":[]}');
					
					// Add or update the environment changer
					const existingIndex = currentChangers.environmentChangers.findIndex((c: any) => c.Name === newChanger.Name);
					if (existingIndex >= 0) {
						currentChangers.environmentChangers[existingIndex] = newChanger;
					} else {
						currentChangers.environmentChangers.push(newChanger);
					}
					
					areaData.environmentChangersJSON = JSON.stringify(currentChangers);
					updated = true;
					console.log(`[AREA SETTINGS] Updated environmentChanger for ${areaId}`);
				} catch (parseError) {
					console.error("Error parsing environmentChanger JSON:", parseError);
					return new Response("Invalid environmentChanger JSON", { status: 400 });
				}
			}
			
			// Update environment type (Snow, Rain, etc.)
			// Note: The field is _environmentType (with underscore) per the schema
			if (environmentType !== undefined) {
				areaData._environmentType = environmentType;
				updated = true;
				console.log(`[AREA SETTINGS] Updated _environmentType to ${environmentType} for ${areaId}`);
			}
			
			// Update boolean settings
			if (isZeroGravity !== undefined) {
				areaData.isZeroGravity = isZeroGravity === "True" || isZeroGravity === true;
				updated = true;
				console.log(`[AREA SETTINGS] Updated isZeroGravity to ${areaData.isZeroGravity} for ${areaId}`);
			}
			
			if (hasFloatingDust !== undefined) {
				areaData.hasFloatingDust = hasFloatingDust === "True" || hasFloatingDust === true;
				updated = true;
				console.log(`[AREA SETTINGS] Updated hasFloatingDust to ${areaData.hasFloatingDust} for ${areaId}`);
			}
			
			if (isCopyable !== undefined) {
				areaData.isCopyable = isCopyable === "True" || isCopyable === true;
				updated = true;
				console.log(`[AREA SETTINGS] Updated isCopyable to ${areaData.isCopyable} for ${areaId}`);
			}
			
			if (onlyOwnerSetsLocks !== undefined) {
				areaData.onlyOwnerSetsLocks = onlyOwnerSetsLocks === "True" || onlyOwnerSetsLocks === true;
				updated = true;
				console.log(`[AREA SETTINGS] Updated onlyOwnerSetsLocks to ${areaData.onlyOwnerSetsLocks} for ${areaId}`);
			}
			
			if (isPrivate !== undefined) {
				areaData.isPrivate = isPrivate === "True" || isPrivate === true;
				updated = true;
				console.log(`[AREA SETTINGS] Updated isPrivate to ${areaData.isPrivate} for ${areaId}`);
			}
			
			if (isExcluded !== undefined) {
				areaData.isExcluded = isExcluded === "True" || isExcluded === true;
				updated = true;
				console.log(`[AREA SETTINGS] Updated isExcluded to ${areaData.isExcluded} for ${areaId}`);
			}
			
			// Write updated data back to load file
			if (updated) {
				await Bun.write(loadPath, JSON.stringify(areaData, null, 2));
				
				// Also update info file if it exists
				try {
					const infoFile = Bun.file(infoPath);
					if (await infoFile.exists()) {
						const infoData = await infoFile.json();
						
						if (isZeroGravity !== undefined) infoData.isZeroGravity = areaData.isZeroGravity;
						if (hasFloatingDust !== undefined) infoData.hasFloatingDust = areaData.hasFloatingDust;
						if (isCopyable !== undefined) infoData.isCopyable = areaData.isCopyable;
						if (isExcluded !== undefined) infoData.isExcluded = areaData.isExcluded;
						
						await Bun.write(infoPath, JSON.stringify(infoData, null, 2));
					}
				} catch (infoError) {
					console.warn(`[AREA SETTINGS] Could not update info file for ${areaId}:`, infoError);
				}
				
				console.log(`[AREA SETTINGS] Saved settings for area ${areaId}`);
			}
			
			return new Response(JSON.stringify({ ok: true }), {
				status: 200,
				headers: { "Content-Type": "application/json" }
			});
		} catch (error) {
			console.error("Error updating area settings:", error);
			return new Response("Server error", { status: 500 });
		}
	}, {
		body: t.Object({
			areaId: t.String(),
			environmentChanger: t.Optional(t.String()),
			environmentType: t.Optional(t.String()),
			isZeroGravity: t.Optional(t.Union([t.String(), t.Boolean()])),
			hasFloatingDust: t.Optional(t.Union([t.String(), t.Boolean()])),
			isCopyable: t.Optional(t.Union([t.String(), t.Boolean()])),
			onlyOwnerSetsLocks: t.Optional(t.Union([t.String(), t.Boolean()])),
			isPrivate: t.Optional(t.Union([t.String(), t.Boolean()])),
			isExcluded: t.Optional(t.Union([t.String(), t.Boolean()]))
		}),
		type: "form"
	})	
  .post("/area/visit", async ({ body }) => {
    const { areaId, name } = body;
    if (!areaId || !name) return new Response("Missing data", { status: 400 });

    const listPath = "./data/area/arealist.json";
    const areaList = await getDynamicAreaList();
    const alreadyVisited = areaList.visited.some(a => a.id === areaId);

    if (!alreadyVisited) {
      areaList.visited.push({ id: areaId, name, playerCount: 0 });
      await fs.writeFile(listPath, JSON.stringify(areaList, null, 2));
    }

    return { ok: true };
  }, {
    body: t.Object({
      areaId: t.String(),
      name: t.String()
    })
  })
  .post('/placement/list', async ({ body: { areaId } }) =>
    app.routes.find(r => r.path === '/placement/info')!
      .handler({ body: { areaId, placementId: '' } } as any)
  )
  .post('/placement/metadata', async ({ body: { areaId, placementId } }) =>
    app.routes.find(r => r.path === '/placement/info')!
      .handler({ body: { areaId, placementId } } as any)
  )
  .post("/placement/new", async ({ body }) => {
    const { areaId, placement } = body;
    const parsed = JSON.parse(decodeURIComponent(placement));
    const placementId = parsed.Id;
    const placementPath = `./data/placement/info/${areaId}/${placementId}.json`;

    // Inject identity from account.json
    try {
      const account = JSON.parse(await fs.readFile("./data/person/account.json", "utf-8"));
      parsed.placerId = account.personId || "unknown";
      parsed.placerName = account.screenName || "anonymous";
    } catch {
      parsed.placerId = "unknown";
      parsed.placerName = "anonymous";
    }

    parsed.placedDaysAgo = 0;

    await fs.mkdir(`./data/placement/info/${areaId}`, { recursive: true });
    await Bun.write(placementPath, JSON.stringify(parsed, null, 2));

    const areaFilePath = `./data/area/load/${areaId}.json`;
    let areaData: Record<string, any> = {};
    try {
      areaData = JSON.parse(await fs.readFile(areaFilePath, "utf-8"));
    } catch {
      areaData = { areaId, placements: [] };
    }

    if (!Array.isArray(areaData.placements)) areaData.placements = [];

    areaData.placements = areaData.placements.filter(p => p.Id !== placementId);
    areaData.placements.push(parsed);

    await fs.writeFile(areaFilePath, JSON.stringify(areaData, null, 2));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({
      areaId: t.String(),
      placement: t.String()
    })
  })
  .post("/placement/info", async ({ body: { areaId, placementId } }) => {
    const filePath = `./data/placement/info/${areaId}/${placementId}.json`;

    try {
      const data = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(data);

      const metadata = {
        placerId: parsed.placerId || "unknown",
        placerName: parsed.placerName || "anonymous",
        placedDaysAgo: parsed.placedDaysAgo || 0
      };

      return new Response(JSON.stringify(metadata), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch {
      return new Response(JSON.stringify({ ok: false }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, {
    body: t.Object({
      areaId: t.String(),
      placementId: t.String()
    })
  })
  .get("person/friendsbystr",
    () => canned_friendsbystr
  )
  .post("/placement/save", async ({ body: { areaId, placementId, data } }) => {
    if (!areaId || !placementId || !data) {
      console.error("Missing required placement fields");
      return { ok: false, error: "Invalid placement data" };
    }

    try {
      const account = JSON.parse(await fs.readFile("./data/person/account.json", "utf-8"));
      data.placerId = account.personId || "unknown";
      data.placerName = account.screenName || "anonymous";
    } catch {
      data.placerId = "unknown";
      data.placerName = "anonymous";
    }

    const dirPath = path.resolve("./data/placement/info/", areaId);
    await fs.mkdir(dirPath, { recursive: true });

    const filePath = path.join(dirPath, placementId + ".json");
    await Bun.write(filePath, JSON.stringify(data));

    return { ok: true };
  }, {
    body: t.Object({
      areaId: t.String(),
      placementId: t.String(),
      data: t.Unknown()
    })
  })
  .post("/placement/delete", async ({ body: { areaId, placementId } }) => {
    const placementPath = `./data/placement/info/${areaId}/${placementId}.json`;

    // Remove the placement file
    try {
      await fs.rm(placementPath);
    } catch { }

    // Remove from area file's placements array
    const areaFilePath = `./data/area/load/${areaId}.json`;
    let areaData: Record<string, any> = {};
    try {
      areaData = JSON.parse(await fs.readFile(areaFilePath, "utf-8"));
    } catch {
      areaData = { areaId, placements: [] };
    }

    if (!Array.isArray(areaData.placements)) areaData.placements = [];

    // Remove the placement with this Id
    areaData.placements = areaData.placements.filter(
      (p: any) => p.Id !== placementId
    );

    await fs.writeFile(areaFilePath, JSON.stringify(areaData, null, 2));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({
      areaId: t.String(),
      placementId: t.String()
    })
  })
  .post("/placement/update", async ({ body }) => {
    const { areaId, placement } = body;
    const parsed = JSON.parse(decodeURIComponent(placement));
    const placementId = parsed.Id;
    const placementPath = `./data/placement/info/${areaId}/${placementId}.json`;

    try {
      const account = JSON.parse(await fs.readFile("./data/person/account.json", "utf-8"));
      parsed.placerId = account.personId || "unknown";
      parsed.placerName = account.screenName || "anonymous";
    } catch {
      parsed.placerId = "unknown";
      parsed.placerName = "anonymous";
    }

    await Bun.write(placementPath, JSON.stringify(parsed, null, 2));

    const areaFilePath = `./data/area/load/${areaId}.json`;
    let areaData: Record<string, any> = {};
    try {
      areaData = JSON.parse(await fs.readFile(areaFilePath, "utf-8"));
    } catch {
      areaData = { areaId, placements: [] };
    }

    if (!Array.isArray(areaData.placements)) areaData.placements = [];
    areaData.placements = areaData.placements.filter(p => p.Id !== placementId);
    areaData.placements.push(parsed);

    await fs.writeFile(areaFilePath, JSON.stringify(areaData, null, 2));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({
      areaId: t.String(),
      placement: t.String()
    })
  })
  .post("/placement/duplicate", async ({ body }) => {
    const { areaId, placements } = body;

    const areaFilePath = `./data/area/load/${areaId}.json`;
    let areaData: Record<string, any> = {};
    try {
      areaData = JSON.parse(await fs.readFile(areaFilePath, "utf-8"));
    } catch {
      areaData = { areaId, placements: [] };
    }

    if (!Array.isArray(areaData.placements)) areaData.placements = [];

    let personId = "unknown";
    let screenName = "anonymous";
    try {
      const account = JSON.parse(await fs.readFile("./data/person/account.json", "utf-8"));
      personId = account.personId || personId;
      screenName = account.screenName || screenName;
    } catch { }

    const newPlacements = placements.map((encoded: string) => {
      const parsed = JSON.parse(decodeURIComponent(encoded));
      return {
        Id: parsed.Id,
        Tid: parsed.Tid,
        P: parsed.P,
        R: parsed.R,
        S: parsed.S || { x: 1, y: 1, z: 1 },
        A: parsed.A || [],
        D: parsed.D || {},
        placerId: personId,
        placerName: screenName,
        placedDaysAgo: 0
      };
    });

    for (const placement of newPlacements) {
      const placementPath = `./data/placement/info/${areaId}/${placement.Id}.json`;
      await fs.mkdir(`./data/placement/info/${areaId}`, { recursive: true });
      await Bun.write(placementPath, JSON.stringify(placement, null, 2));
    }

    const existingIds = new Set(areaData.placements.map((p: any) => p.Id));
    for (const placement of newPlacements) {
      if (!existingIds.has(placement.Id)) {
        areaData.placements.push(placement);
      }
    }

    await fs.writeFile(areaFilePath, JSON.stringify(areaData, null, 2));

    return new Response(JSON.stringify({ ok: true, count: newPlacements.length }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({
      areaId: t.String(),
      placements: t.Array(t.String())
    })
  })
  .post("/placement/setattr", async ({ body }) => {
    const { areaId, placementId, attribute } = body;
    
    if (!areaId || !placementId || attribute === undefined) {
      return new Response(JSON.stringify({ ok: false, error: "Missing required fields" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const placementPath = `./data/placement/info/${areaId}/${placementId}.json`;
    const areaFilePath = `./data/area/load/${areaId}.json`;
    
    try {
      let placementData: any = null;
      
      // Try to read the individual placement file first
      try {
        placementData = JSON.parse(await fs.readFile(placementPath, "utf-8"));
        console.log("[SETATTR] Found placement file for", placementId);
      } catch (e) {
        // If placement file doesn't exist, try to get it from area load file
        console.log("[SETATTR] Placement file not found, reading from area load file");
        try {
          const areaData = JSON.parse(await fs.readFile(areaFilePath, "utf-8"));
          if (Array.isArray(areaData.placements)) {
            placementData = areaData.placements.find((p: any) => p.Id === placementId);
            if (!placementData) {
              throw new Error("Placement not found in area file");
            }
            console.log("[SETATTR] Found placement in area load file");
          }
        } catch (areaError) {
          console.error("[SETATTR] Failed to read from area file:", areaError);
          throw new Error("Placement not found");
        }
      }
      
      // Update the attributes array
      if (!Array.isArray(placementData.A)) {
        placementData.A = [];
      }
      
      // Parse attribute as integer
      const attrValue = parseInt(attribute);
      
      // Check if attribute already exists
      const attrIndex = placementData.A.indexOf(attrValue);
      
      if (attrIndex === -1) {
        // Add the attribute if it doesn't exist
        placementData.A.push(attrValue);
        console.log("[SETATTR] Added attribute", attrValue, "to placement", placementId);
      } else {
        // Remove the attribute if it exists (toggle behavior)
        placementData.A.splice(attrIndex, 1);
        console.log("[SETATTR] Removed attribute", attrValue, "from placement", placementId);
      }
      
      // Try to write the updated placement file
      try {
        // Ensure the directory exists
        const placementDir = `./data/placement/info/${areaId}`;
        await fs.mkdir(placementDir, { recursive: true });
        await fs.writeFile(placementPath, JSON.stringify(placementData, null, 2));
        console.log("[SETATTR] Updated placement file");
      } catch (e) {
        console.log("[SETATTR] Could not write placement file (may be read-only):", e);
      }
      
      // Always update the area load file
      try {
        const areaData = JSON.parse(await fs.readFile(areaFilePath, "utf-8"));
        
        if (Array.isArray(areaData.placements)) {
          const placementIndex = areaData.placements.findIndex((p: any) => p.Id === placementId);
          if (placementIndex !== -1) {
            areaData.placements[placementIndex].A = placementData.A;
            await fs.writeFile(areaFilePath, JSON.stringify(areaData, null, 2));
            console.log("[SETATTR] Updated area load file");
          }
        }
      } catch (e) {
        console.error("[SETATTR] Failed to update area file:", e);
        throw e;
      }
      
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (error) {
      console.error("[SETATTR] Error:", error);
      return new Response(JSON.stringify({ ok: false, error: "Failed to update placement" }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, {
    body: t.Object({
      areaId: t.String(),
      placementId: t.String(),
      attribute: t.String()
    })
  })
  .post("person/info",
    async ({ body: { areaId, userId } }) => {
      const file = Bun.file(path.resolve("./data/person/info/", userId + ".json"))

      if (await file.exists()) {
        return await file.json()
      }
      else {
        return { "isFriend": false, "isEditorHere": false, "isListEditorHere": false, "isOwnerHere": false, "isAreaLocked": false, "isOnline": false }
      }
    },
    { body: t.Object({ areaId: t.String(), userId: t.String() }) }
  )
  .post("/person/infobasic",
    async ({ body: { areaId, userId } }) => {
      return { "isEditorHere": false }
    },
    { body: t.Object({ areaId: t.String(), userId: t.String() }) }
  )
  .post("/person/updatesetting", async ({ body }) => {
    const { personId, screenName, statusText, isFindable } = body;

    if (!personId || typeof personId !== "string") {
      return new Response(JSON.stringify({ ok: false, error: "Missing or invalid personId" }), {
        status: 422,
        headers: { "Content-Type": "application/json" }
      });
    }

    const infoPath = `./data/person/info/${personId}.json`;
    let personData: Record<string, any> = {};
    try {
      personData = JSON.parse(await fs.readFile(infoPath, "utf-8"));
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Person not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    if (screenName) personData.screenName = screenName;
    if (statusText !== undefined) personData.statusText = statusText;
    if (isFindable !== undefined) personData.isFindable = isFindable;

    await fs.writeFile(infoPath, JSON.stringify(personData, null, 2));

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({
      personId: t.String(),
      screenName: t.Optional(t.String()),
      statusText: t.Optional(t.String()),
      isFindable: t.Optional(t.Boolean())
    })
  })
  .get("/inventory/:page", async ({ params }) => {
    const pageParam = params?.page;
    const page = Math.max(0, parseInt(String(pageParam), 10) || 0);

    const accountPath = await getAccountPath();
    let account: Record<string, any> = {};
    try {
      account = JSON.parse(await fs.readFile(accountPath, "utf-8"));
    } catch {}
    const personId = account.personId || "unknown";

    const invPath = `./data/person/inventory/${personId}.json`;
    let items: string[] = [];
    try {
      const file = Bun.file(invPath);
      if (await file.exists()) {
        const data = await file.json();
        if (Array.isArray(data?.ids)) items = data.ids;
      }
    } catch {}

    // Prefer inventory stored in account.json
    let usedPaged = false;
    try {
      const inv = account?.inventory;
      if (inv && inv.pages && typeof inv.pages === "object") {
        const pageItems = inv.pages[String(page)];
        if (Array.isArray(pageItems)) {
          items = pageItems;
          usedPaged = true;
        }
      }
    } catch {}

    // If using paged store, items already represent this page; otherwise paginate flat list
    const pageSize = 20;
    const start = page * pageSize;
    const slice = usedPaged ? items : items.slice(start, start + pageSize);

    console.log(`[INVENTORY] resolved page ${page} → count=${slice.length}`);

    return new Response(JSON.stringify({ inventoryItems: slice }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  })
  .post("/inventory/save", async ({ body }) => {
    // Accept one of:
    // - { ids: [...] }
    // - { id: "..." }
    // - { page: number|string, inventoryItem: string }  // from client logs
    const invUpdate = body as any;

    const accountPath = await getAccountPath();
    let accountData: Record<string, any> = {};
    try {
      accountData = JSON.parse(await fs.readFile(accountPath, "utf-8"));
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Account not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    let current: { ids?: string[]; pages?: Record<string, any[]> } = accountData.inventory || {};
    if (!current) current = {};

    if (Array.isArray(invUpdate?.ids)) {
      current.ids = invUpdate.ids.map(String);
    } else if (invUpdate?.id !== undefined) {
      const id = String(invUpdate.id);
      if (!current.ids) current.ids = [];
      if (!current.ids.includes(id)) current.ids.push(id);
    } else if (invUpdate?.page !== undefined && typeof invUpdate?.inventoryItem === "string") {
      const pageKey = String(invUpdate.page);
      if (!current.pages) current.pages = {};
      if (!Array.isArray(current.pages[pageKey])) current.pages[pageKey] = [];
      let parsedItem: any = invUpdate.inventoryItem;
      try { parsedItem = JSON.parse(invUpdate.inventoryItem); } catch {}
      current.pages[pageKey].push(parsedItem);
    } else {
      return new Response(JSON.stringify({ ok: false, error: "Missing ids, id or (page, inventoryItem)" }), {
        status: 422,
        headers: { "Content-Type": "application/json" }
      });
    }

    accountData.inventory = current;
    await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));

    // Also mirror to per-user inventory file for compatibility
    const invDir = `./data/person/inventory`;
    const personId = accountData.personId || "unknown";
    const invPath = `${invDir}/${personId}.json`;
    await fs.mkdir(invDir, { recursive: true });
    await fs.writeFile(invPath, JSON.stringify(current, null, 2));
    
    // Persist to profile file if there's an active profile
    if (currentActiveProfile) {
      await syncLegacyToProfile(currentActiveProfile);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Unknown(),
    type: "form"
  })
  .post("/inventory/delete", async ({ body }) => {
    // Delete item from inventory: { page: number|string, thingId: string }
    const { page, thingId } = body as any;

    if (page === undefined || thingId === undefined) {
      return new Response(JSON.stringify({ ok: false, error: "Missing page or thingId" }), {
        status: 422,
        headers: { "Content-Type": "application/json" }
      });
    }

    const accountPath = await getAccountPath();
    let accountData: Record<string, any> = {};
    try {
      accountData = JSON.parse(await fs.readFile(accountPath, "utf-8"));
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Account not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    let current: { ids?: string[]; pages?: Record<string, any[]> } = accountData.inventory || {};
    if (!current) current = {};

    const pageKey = String(page);
    if (current.pages && current.pages[pageKey] && Array.isArray(current.pages[pageKey])) {
      // Find and remove item by thingId
      const initialLength = current.pages[pageKey].length;
      current.pages[pageKey] = current.pages[pageKey].filter((item: any) => {
        if (typeof item === 'string') {
          try {
            const parsed = JSON.parse(item);
            return parsed.Tid !== thingId;
          } catch {
            return true; // Keep if can't parse
          }
        } else if (typeof item === 'object' && item !== null) {
          return item.Tid !== thingId;
        }
        return true; // Keep if not an object
      });
      
      const removedCount = initialLength - current.pages[pageKey].length;
      if (removedCount > 0) {
        console.log(`[INVENTORY] deleted ${removedCount} item(s) with thingId ${thingId} from page ${page}`);
      }
    }

    accountData.inventory = current;
    await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));
    
    // Persist to profile file if there's an active profile
    if (currentActiveProfile) {
      await syncLegacyToProfile(currentActiveProfile);
    }

    const personId = accountData.personId || "unknown";
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({
      page: t.Union([t.String(), t.Number()]),
      thingId: t.String()
    }),
    type: "form"
  })
  .post("/inventory/move", async ({ body }) => {
    // Move item within inventory: { fromPage: number|string, fromIndex: number, toPage: number|string, toIndex: number }
    const { fromPage, fromIndex, toPage, toIndex } = body as any;

    if (fromPage === undefined || fromIndex === undefined || toPage === undefined || toIndex === undefined) {
      return new Response(JSON.stringify({ ok: false, error: "Missing fromPage, fromIndex, toPage, or toIndex" }), {
        status: 422,
        headers: { "Content-Type": "application/json" }
      });
    }

    const accountPath = await getAccountPath();
    let accountData: Record<string, any> = {};
    try {
      accountData = JSON.parse(await fs.readFile(accountPath, "utf-8"));
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Account not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    let current: { ids?: string[]; pages?: Record<string, any[]> } = accountData.inventory || {};
    if (!current) current = {};
    if (!current.pages) current.pages = {};

    const fromPageKey = String(fromPage);
    const toPageKey = String(toPage);
    const fromIdx = parseInt(String(fromIndex), 10);
    const toIdx = parseInt(String(toIndex), 10);

    // Ensure both pages exist
    if (!Array.isArray(current.pages[fromPageKey])) current.pages[fromPageKey] = [];
    if (!Array.isArray(current.pages[toPageKey])) current.pages[toPageKey] = [];

    // Move item if valid indices
    if (fromIdx >= 0 && fromIdx < current.pages[fromPageKey].length) {
      const item = current.pages[fromPageKey].splice(fromIdx, 1)[0];
      if (toIdx >= 0 && toIdx <= current.pages[toPageKey].length) {
        current.pages[toPageKey].splice(toIdx, 0, item);
        console.log(`[INVENTORY] moved item from page ${fromPage}[${fromIdx}] to page ${toPage}[${toIdx}]`);
      }
    }

    accountData.inventory = current;
    await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));
    
    // Persist to profile file if there's an active profile
    if (currentActiveProfile) {
      await syncLegacyToProfile(currentActiveProfile);
    }

    const personId = accountData.personId || "unknown";
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({
      fromPage: t.Union([t.String(), t.Number()]),
      fromIndex: t.Number(),
      toPage: t.Union([t.String(), t.Number()]),
      toIndex: t.Number()
    }),
    type: "form"
  })
  .post("/inventory/update", async ({ body }) => {
    // Mirror /inventory/save behavior; some clients call update
    const invUpdate = body as any;

    const accountPath = await getAccountPath();
    let accountData: Record<string, any> = {};
    try {
      accountData = JSON.parse(await fs.readFile(accountPath, "utf-8"));
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Account not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    let current: { ids?: string[]; pages?: Record<string, string[]> } = accountData.inventory || {};
    if (!current) current = {};

    if (Array.isArray(invUpdate?.ids)) {
      current.ids = invUpdate.ids.map(String);
    } else if (invUpdate?.id !== undefined) {
      const id = String(invUpdate.id);
      if (!current.ids) current.ids = [];
      if (!current.ids.includes(id)) current.ids.push(id);
    } else if (invUpdate?.page !== undefined && typeof invUpdate?.inventoryItem === "string") {
      const pageKey = String(invUpdate.page);
      if (!current.pages) current.pages = {};
      if (!Array.isArray(current.pages[pageKey])) current.pages[pageKey] = [];
      
      let parsedItem: any = invUpdate.inventoryItem;
      try { parsedItem = JSON.parse(invUpdate.inventoryItem); } catch {}
      
      // Find and replace existing item with same Tid, or add if not found
      const thingId = parsedItem?.Tid;
      if (thingId) {
        let found = false;
        for (let i = 0; i < current.pages[pageKey].length; i++) {
          const existingItem = current.pages[pageKey][i];
          let existingTid = null;
          
          if (typeof existingItem === 'string') {
            try {
              const parsed = JSON.parse(existingItem);
              existingTid = parsed.Tid;
            } catch {}
          } else if (typeof existingItem === 'object' && existingItem !== null) {
            existingTid = existingItem.Tid;
          }
          
          if (existingTid === thingId) {
            current.pages[pageKey][i] = parsedItem;
            found = true;
            console.log(`[INVENTORY] updated item with thingId ${thingId} on page ${pageKey}`);
            break;
          }
        }
        
        if (!found) {
          current.pages[pageKey].push(parsedItem);
          console.log(`[INVENTORY] added new item with thingId ${thingId} to page ${pageKey}`);
        }
      } else {
        // Fallback: just add the item
        current.pages[pageKey].push(parsedItem);
      }
    } else {
      return new Response(JSON.stringify({ ok: false, error: "Missing ids, id or (page, inventoryItem)" }), {
        status: 422,
        headers: { "Content-Type": "application/json" }
      });
    }

    accountData.inventory = current;
    await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));

    const personId = accountData.personId || "unknown";
    const invDir = `./data/person/inventory`;
    const invPath = `${invDir}/${personId}.json`;
    await fs.mkdir(invDir, { recursive: true });
    await fs.writeFile(invPath, JSON.stringify(current, null, 2));
    
    // Persist to profile file if there's an active profile
    if (currentActiveProfile) {
      await syncLegacyToProfile(currentActiveProfile);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Unknown(),
    type: "form"
  })
  .post("/thing", async ({ body }) => {
    const thingId = generateObjectId();
    const infoPath = `./data/thing/info/${thingId}.json`;
    const defPath = `./data/thing/def/${thingId}.json`;
    const tagsPath = `./data/thing/tags/${thingId}.json`;

    // ✅ Parse the definition from the client
    let thingDef: Record<string, any> = {};
    let thingName = "";
    
    if (body.definition) {
      try {
        thingDef = typeof body.definition === "string" ? JSON.parse(body.definition) : body.definition;
        // Extract name from definition (stored as "n" in the definition)
        thingName = thingDef.n || thingDef.name || "";
        console.log(`📦 Parsed thing definition with name: "${thingName}"`);
      } catch (e) {
        console.warn("⚠️ Could not parse thing definition:", e);
      }
    }
    
    // Fall back to body.name if no name in definition
    if (!thingName && body.name) {
      thingName = body.name;
    }

    // ✅ Load identity from account.json
    let creatorId = "unknown";
    let creatorName = "anonymous";
    try {
      const account = JSON.parse(await fs.readFile("./data/person/account.json", "utf-8"));
      creatorId = account.personId || creatorId;
      creatorName = account.screenName || creatorName;
    } catch (e) {
      console.warn("⚠️ Could not load account.json for object metadata.", e);
    }

    // ✅ Build thinginfo object
    const thingInfo = {
      id: thingId,
      name: thingName,
      creatorId,
      creatorName,
      createdDaysAgo: 0,
      collectedCount: 0,
      placedCount: 1,
      allCreatorsThingsClonable: true,
      isUnlisted: false
    };

    // ✅ Build thingtags object
    const thingTags = {
      tags: []
    };

    // Create directories and save all three files
    await fs.mkdir(path.dirname(infoPath), { recursive: true });
    await fs.mkdir(path.dirname(defPath), { recursive: true });
    await fs.mkdir(path.dirname(tagsPath), { recursive: true });
    
    await fs.writeFile(infoPath, JSON.stringify(thingInfo, null, 2));
    await fs.writeFile(defPath, JSON.stringify(thingDef, null, 2));
    await fs.writeFile(tagsPath, JSON.stringify(thingTags, null, 2));

    console.log(`✅ Created thing ${thingId} (name: "${thingName}") with info, def, and tags files`);

    // Update topby list for the creator
    try {
      const topbyDir = "./data/person/topby";
      await fs.mkdir(topbyDir, { recursive: true });
      const topbyPath = `${topbyDir}/${creatorId}.json`;
      
      let topbyData: { ids: string[] } = { ids: [] };
      try {
        const existing = await fs.readFile(topbyPath, "utf-8");
        topbyData = JSON.parse(existing);
      } catch {
        // File doesn't exist yet, use default
      }
      
      // Add new thing to the front of the list
      topbyData.ids = [thingId, ...(topbyData.ids || []).filter((id: string) => id !== thingId)].slice(0, 20);
      await fs.writeFile(topbyPath, JSON.stringify(topbyData, null, 2));
    } catch (e) {
      console.warn("⚠️ Could not update topby list:", e);
    }

    // ✅ Update thing search index (so new things are immediately searchable)
    if (!thingInfo.isUnlisted) {
      thingIndex.push({
        id: thingId,
        name: thingName ? thingName.trim().toLowerCase() : "",
        tags: []
      });
      console.log(`[THING INDEX] ✅ Added thing ${thingId} (${thingName || "(unnamed)"}) to search index`);
    }

    return new Response(JSON.stringify({ id: thingId }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  })
  // ✅ HAND REPLACEMENT SUPPORT
  // Thing definitions can include attribute flag 22 to enable "replaces hand when worn"
  // Example: { "n": "My Hand", "a": [22], "p": [...geometry data...] }
  // When a thing with attribute 22 is attached to wrist slots (6 or 7),
  // the client automatically renders it as a hand replacement
  .post("/thing/updateDefinition", async ({ body }) => {
    const { thingId, id, definition, data } = body;
    const actualThingId = thingId || id;
    const actualDefinition = definition || data;

    if (!actualThingId || !actualDefinition) {
      return new Response(JSON.stringify({ ok: false, error: "Missing thingId or definition" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const defPath = `./data/thing/def/${actualThingId}.json`;
    const infoPath = `./data/thing/info/${actualThingId}.json`;
    
    try {
      // Parse the definition if it's a string
      const defData = typeof actualDefinition === "string" ? JSON.parse(actualDefinition) : actualDefinition;
      
      // Save the complete definition
      await fs.writeFile(defPath, JSON.stringify(defData, null, 2));
      
      console.log(`✅ Updated thing definition for ${actualThingId}${defData.a ? ` with attributes: ${JSON.stringify(defData.a)}` : ''}`);

      // ✅ Sync name from definition (n) to info file
      if (defData.n || defData.name) {
        const newName = defData.n || defData.name;
        try {
          const infoData = JSON.parse(await fs.readFile(infoPath, "utf-8"));
          const oldName = infoData.name;
          if (oldName !== newName) {
            infoData.name = newName;
            await fs.writeFile(infoPath, JSON.stringify(infoData, null, 2));
            console.log(`✅ Synced thing name from definition: "${oldName}" → "${newName}"`);

            // ✅ Update thing search index with new name
            const thingEntry = thingIndex.find(t => t.id === actualThingId);
            if (thingEntry) {
              thingEntry.name = newName.trim().toLowerCase();
              console.log(`[THING INDEX] ✅ Updated thing ${actualThingId} name to "${newName}"`);
            } else if (!infoData.isUnlisted) {
              thingIndex.push({
                id: actualThingId,
                name: newName.trim().toLowerCase(),
                tags: []
              });
              console.log(`[THING INDEX] ✅ Added thing ${actualThingId} (${newName}) to search index`);
            }
          }
        } catch (e) {
          console.log(`⚠️ Could not sync name to info file: ${e}`);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error(`❌ Failed to update thing definition for ${actualThingId}:`, e);
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, {
    body: t.Any() // Accept any shape since client may send different formats
  })
  // Alternative endpoint names for compatibility
  .post("/thing/saveDefinition", async ({ body }) => {
    // Redirect to updateDefinition
    const { thingId, id, definition, data } = body;
    const actualThingId = thingId || id;
    const actualDefinition = definition || data;

    if (!actualThingId || !actualDefinition) {
      return new Response(JSON.stringify({ ok: false, error: "Missing thingId or definition" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const defPath = `./data/thing/def/${actualThingId}.json`;
    const infoPath = `./data/thing/info/${actualThingId}.json`;
    
    try {
      const defData = typeof actualDefinition === "string" ? JSON.parse(actualDefinition) : actualDefinition;
      await fs.writeFile(defPath, JSON.stringify(defData, null, 2));
      console.log(`✅ Saved thing definition for ${actualThingId}${defData.a ? ` with attributes: ${JSON.stringify(defData.a)}` : ''}`);

      // ✅ Sync name from definition (n) to info file
      if (defData.n || defData.name) {
        const newName = defData.n || defData.name;
        try {
          const infoData = JSON.parse(await fs.readFile(infoPath, "utf-8"));
          const oldName = infoData.name;
          if (oldName !== newName) {
            infoData.name = newName;
            await fs.writeFile(infoPath, JSON.stringify(infoData, null, 2));
            console.log(`✅ Synced thing name from definition: "${oldName}" → "${newName}"`);

            // ✅ Update thing search index with new name
            const thingEntry = thingIndex.find(t => t.id === actualThingId);
            if (thingEntry) {
              thingEntry.name = newName.trim().toLowerCase();
              console.log(`[THING INDEX] ✅ Updated thing ${actualThingId} name to "${newName}"`);
            } else if (!infoData.isUnlisted) {
              thingIndex.push({
                id: actualThingId,
                name: newName.trim().toLowerCase(),
                tags: []
              });
              console.log(`[THING INDEX] ✅ Added thing ${actualThingId} (${newName}) to search index`);
            }
          }
        } catch (e) {
          console.log(`⚠️ Could not sync name to info file: ${e}`);
        }
      }

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error(`❌ Failed to save thing definition for ${actualThingId}:`, e);
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, {
    body: t.Any()
  })
  .put("/thing/:id", async ({ body, params }) => {
    // Alternative PUT endpoint
    const thingId = params.id;
    const actualDefinition = body.definition || body.data || body;

    if (!thingId || !actualDefinition) {
      return new Response(JSON.stringify({ ok: false, error: "Missing data" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    const defPath = `./data/thing/def/${thingId}.json`;
    
    try {
      const defData = typeof actualDefinition === "string" ? JSON.parse(actualDefinition) : actualDefinition;
      await fs.writeFile(defPath, JSON.stringify(defData, null, 2));
      console.log(`✅ PUT thing definition for ${thingId}${defData.a ? ` with attributes: ${JSON.stringify(defData.a)}` : ''}`);

      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch (e) {
      console.error(`❌ Failed to PUT thing definition for ${thingId}:`, e);
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 500,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, {
    body: t.Any()
  })
  .post("/thing/rename", async ({ body }) => {
    const { thingId, newName } = body;

    if (!thingId || typeof newName !== "string" || newName.length < 1) {
      return new Response(JSON.stringify({ ok: false, error: "Invalid input" }), {
        status: 400,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Update thing/info
    const infoPath = `./data/thing/info/${thingId}.json`;
    let infoData: Record<string, any> = {};
    try {
      infoData = JSON.parse(await fs.readFile(infoPath, "utf-8"));
      const oldName = infoData.name;
      infoData.name = newName;
      await fs.writeFile(infoPath, JSON.stringify(infoData, null, 2));

      // Update thing/def
      const defPath = `./data/thing/def/${thingId}.json`;
      try {
        const defData = JSON.parse(await fs.readFile(defPath, "utf-8"));
        defData.name = newName;
        await fs.writeFile(defPath, JSON.stringify(defData, null, 2));
      } catch { }

      // Update thing/tags
      const tagsPath = `./data/thing/tags/${thingId}.json`;
      try {
        const tagsData = JSON.parse(await fs.readFile(tagsPath, "utf-8"));
        if (Array.isArray(tagsData.tags)) {
          tagsData.tags = tagsData.tags.map(tag => tag === oldName ? newName : tag);
          await fs.writeFile(tagsPath, JSON.stringify(tagsData, null, 2));
        }
      } catch { }

      // Update placements
      const placementRoot = "./data/placement/info";
      const areaDirs = await fs.readdir(placementRoot);
      for (const areaId of areaDirs) {
        const placementDir = path.join(placementRoot, areaId);
        const files = await fs.readdir(placementDir);
        for (const file of files) {
          const placementPath = path.join(placementDir, file);
          try {
            const placement = JSON.parse(await fs.readFile(placementPath, "utf-8"));
            if (placement.Tid === thingId) {
              placement.name = newName;
              await fs.writeFile(placementPath, JSON.stringify(placement, null, 2));
            }
          } catch { }
        }
      }

      // ✅ Update thing search index with new name
      const thingEntry = thingIndex.find(t => t.id === thingId);
      if (thingEntry) {
        thingEntry.name = newName.trim().toLowerCase();
        console.log(`[THING INDEX] ✅ Updated thing ${thingId} name to "${newName}"`);
      } else if (!infoData.isUnlisted) {
        // Thing wasn't in the index (probably created with empty name), add it now
        thingIndex.push({
          id: thingId,
          name: newName.trim().toLowerCase(),
          tags: []
        });
        console.log(`[THING INDEX] ✅ Added thing ${thingId} (${newName}) to search index after rename`);
      }

      return new Response(JSON.stringify({ ok: true, name: newName }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });

    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Thing not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, {
    body: t.Object({
      thingId: t.String(),
      newName: t.String()
    })
  })
  // 🔍 Search for things by name or tag (uses pre-built index for speed)
  .post("/thing/search", async ({ body }) => {
    console.log("📥 /thing/search route triggered");

    // Client sends "term" field, not "query"
    const searchTerm = typeof body.term === "string" ? body.term.trim() : 
                       (typeof body.query === "string" ? body.query.trim() : "");
    const page = typeof body.page === "number" ? Math.max(0, body.page) : 0;

    console.log(`📥 Received query: "${searchTerm}", page: ${page}`);

    // Use cached index for fast search - return all matching results
    const results = searchThings(searchTerm);
    
    console.log(`🔎 Found ${results.length} results for "${searchTerm}"`);

    // Client expects "thingIds" not "ids"
    return new Response(JSON.stringify({ thingIds: results }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({
      term: t.Optional(t.String()),  // Client sends "term"
      query: t.Optional(t.String()), // Legacy/alternative field
      page: t.Optional(t.Number())
    })
  })

  // 📦 Serve thing metadata
  .get("/thing/info/:id", async ({ params }) => {
    const filePath = `./data/thing/info/${params.id}.json`;
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      console.log(`📤 /thing/info/${params.id} → served`);
      return new Response(raw, {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch {
      console.warn(`⚠️ /thing/info/${params.id} → not found`);
      return new Response("{}", { status: 404 });
    }
  })

  // 🧱 Serve thing definition
  .get("/thing/def/:id", async ({ params }) => {
    const filePath = `./data/thing/def/${params.id}.json`;
    try {
      const raw = await fs.readFile(filePath, "utf-8");
      console.log(`📤 /thing/def/${params.id} → served`);
      return new Response(raw, {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch {
      console.warn(`⚠️ /thing/def/${params.id} → not found`);
      return new Response("{}", { status: 404 });
    }
  })
  .post("/thing/fixmissinginfo", async () => {
    const defDir = "./data/thing/def";
    const infoDir = "./data/thing/info";
    const defFiles = await fs.readdir(defDir);
    let createdCount = 0;

    for (const file of defFiles) {
      const thingId = path.basename(file, ".json");
      const infoPath = path.join(infoDir, `${thingId}.json`);

      try {
        const exists = await fs.stat(infoPath).then(() => true).catch(() => false);
        if (exists) continue;

        const def = JSON.parse(await fs.readFile(path.join(defDir, file), "utf-8"));
        const displayName = def.name || def.n || "thing";

        const info = {
          name: displayName,
          creatorId: "system",
          creatorName: "system",
          isUnlisted: false
        };

        await fs.writeFile(infoPath, JSON.stringify(info, null, 2));
        createdCount++;
        console.log(`🆕 Created info for ${thingId}: "${displayName}"`);
      } catch (err) {
        console.error(`❌ Error processing ${file}:`, err);
      }
    }

    return new Response(JSON.stringify({ ok: true, created: createdCount }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  })
  .post("/thing/definition", async ({ body: { id } }) => {
    const filePath = `./data/thing/info/${id}.json`;

    try {
      const data = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(data);
      return new Response(JSON.stringify(parsed.definition), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch {
      return new Response(JSON.stringify({ ok: false }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, {
    body: t.Object({ id: t.String() })
  })
  .post("/thing/definitionAreaBundle", async ({ body: { id } }) => {
    const filePath = `./data/thing/info/${id}.json`;

    try {
      const data = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(data);
      return new Response(JSON.stringify(parsed.definition), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch {
      return new Response(JSON.stringify({ ok: false }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, {
    body: t.Object({ id: t.String() })
  })
  .post("/thing/flagStatus", async ({ body: { id } }) => {
    return new Response(JSON.stringify({ flagged: false }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({ id: t.String() })
  })
  .post("/thing/info", async ({ body: { id } }) => {
    const filePath = `./data/thing/info/${id}.json`;

    try {
      const data = await fs.readFile(filePath, "utf-8");
      const parsed = JSON.parse(data);

      // Return all thing info fields including name
      return new Response(JSON.stringify({
        id: parsed.id || id,
        name: parsed.name || "",
        creatorId: parsed.creatorId,
        creatorName: parsed.creatorName,
        createdDaysAgo: parsed.createdDaysAgo || 0,
        collectedCount: parsed.collectedCount || 0,
        placedCount: parsed.placedCount || 0,
        allCreatorsThingsClonable: parsed.allCreatorsThingsClonable ?? true,
        isUnlisted: parsed.isUnlisted || false,
        vertexCount: parsed.vertexCount,
        createdAt: parsed.createdAt
      }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } catch {
      return new Response(JSON.stringify({ ok: false }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, {
    body: t.Object({ id: t.String() })
  })
  .post("/thing/updateInfo", async ({ body }) => {
    const { thingId, updates } = body;

    const filePath = `./data/thing/info/${thingId}.json`;
    let thingData: Record<string, any> = {};
    try {
      thingData = JSON.parse(await fs.readFile(filePath, "utf-8"));
    } catch {
      return new Response(JSON.stringify({ ok: false, error: "Thing not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" }
      });
    }

    // Apply updates safely
    const allowedKeys = ["name", "isUnlisted", "allCreatorsThingsClonable"];
    for (const key of allowedKeys) {
      if (key in updates) {
        thingData[key] = updates[key];
      }
    }

    await fs.writeFile(filePath, JSON.stringify(thingData, null, 2));

    // ✅ Update thing search index
    const thingEntry = thingIndex.find(t => t.id === thingId);
    if (updates.isUnlisted === true && thingEntry) {
      // Remove from index if unlisted
      const idx = thingIndex.indexOf(thingEntry);
      if (idx !== -1) {
        thingIndex.splice(idx, 1);
        console.log(`[THING INDEX] ✅ Removed unlisted thing ${thingId} from search index`);
      }
    } else if (updates.name && thingEntry) {
      // Update name in index
      thingEntry.name = updates.name.trim().toLowerCase();
      console.log(`[THING INDEX] ✅ Updated thing ${thingId} name in search index`);
    } else if (!thingEntry && !thingData.isUnlisted) {
      // Add to index if not there and not unlisted
      thingIndex.push({
        id: thingId,
        name: (thingData.name || "").trim().toLowerCase(),
        tags: []
      });
      console.log(`[THING INDEX] ✅ Added thing ${thingId} to search index`);
    }

    return new Response(JSON.stringify({ ok: true, updated: thingData }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  }, {
    body: t.Object({
      thingId: t.String(),
      updates: t.Record(t.String(), t.Any())
    })
  })
  .post("/thing/topby", async () => {
    // Return top things created by the current user
    const account = JSON.parse(await fs.readFile("./data/person/account.json", "utf-8"));
    const personId = account.personId;
    const file = Bun.file(`./data/person/topby/${personId}.json`);

    if (await file.exists()) {
      const data = await file.json();
      return new Response(JSON.stringify({ ids: data.ids.slice(0, 4) }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ ids: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  })
  .post("/thing/topCreatedByPerson", async ({ body: { id } }) => {
    const file = Bun.file(`./data/person/topby/${id}.json`);

    if (await file.exists()) {
      const data = await file.json();
      return new Response(JSON.stringify({ ids: data.ids.slice(0, 4) }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    } else {
      return new Response(JSON.stringify({ ids: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }
  }, {
    body: t.Object({ id: t.String() })
  })
  //.get("/thing/info/:thingId",
  //({params: { thingId }}) => Bun.file(path.resolve("./data/thing/info/", thingId + ".json")).json(),
  //)
  .get("/thing/sl/tdef/:thingId",
    ({ params: { thingId } }) => Bun.file(path.resolve("./data/thing/def/", thingId + ".json")).json(),
  )
  .post(
    "/thing/gettags",
    ({ body: { thingId } }) => Bun.file(path.resolve("./data/thing/tags/", thingId + ".json")).json(),
    { body: t.Object({ thingId: t.String() }) }
  )
  .post(
    "/thing/getflag",
    ({ }) => ({ isFlagged: false }),
    { body: t.Object({ id: t.String() }) }
  )
  .post(
    "/gift/getreceived",
    ({ body: { userId } }) => Bun.file(path.resolve("./data/person/gift/", userId + ".json")),
    { body: t.Object({ userId: t.String() }) }
  )
  .post("/ach/reg", () => {
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });
  })
  .get("/forum/favorites",
    () => {
      return canned_forums_favorites
    }
  )
  .get("/forum/forum/:id", ({ params: { id } }) => Bun.file(path.resolve("./data/forum/forum/", id + ".json")).json())
  .get("/forum/thread/:id", ({ params: { id } }) => Bun.file(path.resolve("./data/forum/thread/", id + ".json")).json())
  .listen({
    hostname: HOST,
    port: PORT_API,
  })

// Watch for changes in area files and rebuild index
import { watch } from "fs";

const areaFolder = "./data/area/info/";
let debounceTimer;

watch(areaFolder, { recursive: true }, (eventType, filename) => {
  console.log(`[Area Watcher] Detected ${eventType} on ${filename}`);

  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    console.log("[Area Watcher] Rebuilding area index...");
    await rebuildAreaIndex(); // Make sure this function exists
  }, 1000); // Wait 1 second after last change
});

import { readdir, readFile } from "fs/promises";

async function rebuildAreaIndex() {
  const areaDir = path.resolve("./data/area/info/");
  const cachePath = path.resolve("./cache/areaIndex.json");

  const index = {};

  try {
    const files = await readdir(areaDir);

    for (const file of files) {
      if (!file.endsWith(".json")) continue;

      const filePath = path.join(areaDir, file);
      const content = await readFile(filePath, "utf-8");

      try {
        const areaData = JSON.parse(content);
        const areaId = path.basename(file, ".json");

        index[areaId] = {
          areaId,
          urlName: areaData.urlName || null,
          creatorId: areaData.creatorId || null,
          editors: areaData.editors || [],
          tags: areaData.tags || [],
          title: areaData.name || null
        };
      } catch (err) {
        console.warn(`Failed to parse area file ${file}:`, err);
      }
    }

    await fs.writeFile(cachePath, JSON.stringify(index, null, 2));
    console.log(`[Area Index] Rebuilt index with ${Object.keys(index).length} areas`);
  } catch (err) {
    console.error("[Area Index] Failed to rebuild index:", err);
  }
}

console.log(`🦊 API server is running at on port ${app.server?.port}...`)

const app_areaBundles = new Elysia()
  .onRequest(({ request }) => {
    console.info(JSON.stringify({
      server: "AREABUNDLES",
      ts: new Date().toISOString(),
      ip: request.headers.get('X-Real-Ip'),
      ua: request.headers.get("User-Agent"),
      method: request.method,
      url: request.url,
    }));
  })
  .onError(({ code, error }) => {
    console.info("error in middleware!", code, error.message);
  })
  .get(
    "/:areaId/:areaKey", // TODO: areaKeys all seem to start with "rr"
    async ({ params: { areaId, areaKey } }) => {
      const file = Bun.file(path.resolve("./data/area/bundle/", areaId, areaKey + ".json"));

      if (await file.exists()) {
        return await file.json()
      }
      else {
        return new Response("Area bundle not found", { status: 404 })
      }
    },
  )
  .listen({
    hostname: HOST,
    port: PORT_CDN_AREABUNDLES
  })
  ;
console.log(`🦊 AreaBundles server is running at on port ${app_areaBundles.server?.port}...`)


const app_thingDefs = new Elysia()
  .onRequest(({ request }) => {
    const url = new URL(request.url);
    console.log(`[THINGDEFS] 📥 Requested: ${url.pathname}`);
    console.info(JSON.stringify({
      server: "THINGDEFS",
      ts: new Date().toISOString(),
      ip: request.headers.get('X-Real-Ip'),
      ua: request.headers.get("User-Agent"),
      method: request.method,
      url: request.url,
    }));
  })
  .onError(({ code, error }) => {
    console.info("error in middleware!", code, error.message);
  })
  .get(
    "/:thingId",
    async ({ params: { thingId } }) => {
      console.log(`[THINGDEFS] 🔍 Looking for: ${thingId}`);
      const file = Bun.file(path.resolve("./data/thing/def/", thingId + ".json"));
      if (await file.exists()) {
        try {
          const def = await file.json();
          console.log(`[THINGDEFS] ✅ Served ${thingId} (has attributes: ${def.a || 'none'})`);
          return def;
        }
        catch (e) {
          console.error(`[THINGDEFS] ❌ JSON parse error for ${thingId}:`, e);
          return Response.json("", { status: 200 })
        }
      }
      else {
        console.error(`[THINGDEFS] ❌ NOT FOUND: ${thingId}`)
        //return new Response("Thingdef not found", { status: 404 })
        return Response.json("", { status: 200 })
      }

    }
  )
  .listen({
    hostname: HOST,
    port: PORT_CDN_THINGDEFS,
  })
  ;
console.log(`🦊 ThingDefs server is running at on port ${app_thingDefs.server?.port}...`)



const app_ugcImages = new Elysia()
  .onRequest(({ request }) => {
    console.info(JSON.stringify({
      server: "UGCIMAGES",
      ts: new Date().toISOString(),
      ip: request.headers.get('X-Real-Ip'),
      ua: request.headers.get("User-Agent"),
      method: request.method,
      url: request.url,
    }));
  })
  .onError(({ code, error }) => {
    console.info("error in middleware!", code, error.message);
  })
  .get(
    "/:part1/:part2/",
    async ({ params: { part1, part2 } }) => {
      const file = Bun.file(path.resolve("../archiver/images/", `${part1}_${part2}.png`));

      if (await file.exists()) {
        try {
          return await file.json();
        }
        catch (e) {
          return new Response("<html><head><title>404 Not Found</title></head><body><h1>Not Found</h1></body></html>", { status: 404 })
        }
      }
      else {
        console.error("client asked for an ugc image not on disk!!", part1, part2)
        return new Response("<html><head><title>404 Not Found</title></head><body><h1>Not Found</h1></body></html>", { status: 404 })
      }

    }
  )
  .listen({
    hostname: HOST,
    port: PORT_CDN_UGCIMAGES,
  })
  ;
console.log(`🦊 ugcImages server is running at on port ${app_ugcImages.server?.port}...`)










// canned data goes here

const canned_areaList = {
  "visited": [
    { "id": "58181d33160c0d921301ea5f", "name": "nightclub raves-parties-fun", "description": "rave, party, meet and chat with new people, play music, and have fun on stage as the dj!!!", "playerCount": 0 }, { "id": "5debf46f94e24b0625f09a21", "name": "mol4yn's home", "playerCount": 0 },
    { "id": "6345eb6dea96ba05dd2de915", "name": "bloodangelofwar's home", "playerCount": 0 },
    { "id": "5875bb2d64af5e8f13bd4c72", "name": "h4ck3r c3ntr4l", "playerCount": 0 },
    { "id": "577610d2bdee942c18292f22", "name": "bluecastle", "description": "a medieval castle in a nature setting, with bow game", "playerCount": 0 },
    { "id": "5e1050c8614b36062d5e0fa3", "name": "past competitions", "playerCount": 0 },
    { "id": "57f8540e026a89c21319cd6f", "name": "sparky inc", "playerCount": 0 },
    { "id": "583d8e2428ea7b72133ae5ee", "name": "974 ile de la reunion", "playerCount": 0 },
    { "id": "5c97927c0a4c314e0a6d8fcf", "name": "the best troller for ever's home", "playerCount": 0 },
    { "id": "59c864b6dae5a6941f9941a4", "name": "angrylittledeadgirl's home", "playerCount": 0 },
    { "id": "58d04f0507f8e21e105c70e3", "name": "the pet shop", "playerCount": 0 },
    { "id": "58b2fe6148625b9613320bb1", "name": "spiders apartment", "playerCount": 0 },
    { "id": "57e27359406966d70fc7c694", "name": "target range", "description": "play a game of target practice!", "playerCount": 0 },
    { "id": "5b763bfe3a1362760154f13e", "name": "vr vr board game", "playerCount": 0 },
    { "id": "5b815fe42f0ce47ae2901db8", "name": "coruscant", "playerCount": 0 },
    { "id": "5eaa2a0309f82b7b2456bbe0", "name": "haunted woods trails 4 - ravenswich", "description": "haunted, halloween, scary, dark, victorian, horror, frights, lovecraft", "playerCount": 0 },
    { "id": "57f8e735bc75113c12ba8c45", "name": "weapon collection", "description": "gallery one", "playerCount": 0 },
    { "id": "58a1ecd55c0ebbd513686d5a", "name": "hyrule adventure map", "description": "welcome to hyrule an adventure of fun and monster slaying", "playerCount": 0 },
    { "id": "57b1a5403a204055538212e3", "name": "central cinema", "description": "watch movies on a cinema screen, relax and chill", "playerCount": 0 }
  ],
  "created": [],
  "totalOnline": 0,
  "totalAreas": 44182,
  "totalPublicAreas": 32948,
  "totalSearchablePublicAreas": 32835,
  "popular": [
    { "name": "buildtown", "description": "welcome to this area to help with your first building tries and chat! a place to find friends, too.", "id": "57f67019817496af5268f719", "playerCount": 0 },
    { "name": "the future", "description": "space", "id": "58158ca9b5cfcb54137342db", "playerCount": 0 },
    { "name": "nightclub raves-parties-fun", "description": "rave, party, meet and chat with new people, play music, and have fun on stage as the dj!!!", "id": "58181d33160c0d921301ea5f", "playerCount": 0 },
    { "name": "bluecastle", "description": "a medieval castle in a nature setting, with bow game", "id": "577610d2bdee942c18292f22", "playerCount": 0 },
    { "name": "fazzi's home", "description": "fazzis apartment. alley, city, urban. shops. ", "id": "5871a13c6d204d1110ee0e07", "playerCount": 0 },
    { "name": "anywhere", "description": "a hub world to other worlds", "id": "57f850ae668fbacd13637778", "playerCount": 0 },
    { "name": "vault 112 - entrance", "description": "vault 112 entrance and wasteland!", "id": "589269cab37feaae13bf02f5", "playerCount": 0 },
    { "name": "body shop", "description": "free to use heads, bodies, arms. many accessories and clonables. fazzis.", "id": "58e36deffb5e0bb113a068bc", "playerCount": 0 },
    { "name": "central cinema", "description": "watch movies on a cinema screen, relax and chill", "id": "57b1a5403a204055538212e3", "playerCount": 0 },
    { "name": "haunted woods trails", "description": "a haunted trail of frights for halloween, with haunted house", "id": "5973d74703f844a4138903ae", "playerCount": 0 },
    { "name": "noobzone", "id": "57fb13b223bde029116f91ed", "playerCount": 0 },
    { "name": "the underground", "description": "labyrinth, caves, catacombs, dungeon, puzzle, adventure", "id": "58c5afab54ad76a01374fbd0", "playerCount": 0 }, { "name": "bar whirl", "description": "relax and chat! with video screen to play music, and a stage for entertainment and games", "id": "5778c9f454ed9032183cd348", "playerCount": 0 },
    { "name": "overworld", "description": "a world of worlds", "id": "5810f5b56af01ae90f753f8e", "playerCount": 0 },
    { "name": "mrleadfellow's home", "description": "houseparty", "id": "57fef2577f96509e1cc5342d", "playerCount": 0 },
    { "name": "lunopolis", "description": "adventure, rpg, equips, avatars, weapons, bosses, new player tutorials. fun, art!", "id": "5833c783806faf7213ebdcb4", "playerCount": 0 },
    { "name": "welcome-town", "id": "58037a75e0f5aa4e139143b3", "playerCount": 0 },
    { "name": "hypercub3", "description": "escape puzzle game...eventually", "id": "5987169874ed51eb494633f5", "playerCount": 0 },
    { "name": "dataspace", "id": "5c469ae6231fb132b7b1d25c", "playerCount": 0 },
    { "name": "vault 112 - interior", "description": "the interior of vault 112", "id": "5ab190cc82515d254e2c6050", "playerCount": 0 },
    { "name": "stretching room", "description": "spooky fun with the haunted mansion stetching room.", "id": "59b19637f45aa620104ef3de", "playerCount": 0 },
    { "name": "rustybot's home", "description": "a nature park at the heart of the rusty prime system", "id": "5bb6693c236557585f156459", "playerCount": 0 },
    { "name": "electronics", "description": "electrweather", "id": "57f6929bf6412bed1388c8b5", "playerCount": 0 },
    { "name": "a fox place", "description": "still work in progress.  -waranto the fox", "id": "5800d5b6c4a3ed6113da50d8", "playerCount": 0 },
    { "name": "sunbeach", "description": "relax and enjoy the sun! chat to the sound of waves and campfire", "id": "5773cf9fbdee942c18292f08", "playerCount": 0 },
    { "name": "fazzis island", "id": "587b448611054fae258933de", "playerCount": 0 },
    { "name": "heads n more", "description": "find heads and bodies, including desktop bodies", "id": "577d064d54ed9032183cd360", "playerCount": 0 },
    { "name": "jinx mansion", "description": "hangout house probably not haunted... much.", "id": "58291608f83d7a125f4aa898", "playerCount": 0 },
    { "name": "inside the tardis", "description": "its bigger on the inside", "id": "5805c37fc49961cf28d6aae2", "playerCount": 0 },
    { "name": "church of philipp", "description": "praise philipp!", "id": "589df93de1e50591133c2d0f", "playerCount": 0 }
  ],
  "popular_rnd": [
    { "name": "music hall", "id": "577678662da36d2d18b87125", "playerCount": 0 },
    { "name": "space tennis", "id": "5854ccb19a68103f1da79974", "playerCount": 0 },
    { "name": "mount salvation", "id": "5ad3bc37da19370ff4b68b36", "playerCount": 0 },
    { "name": "louis' workshop", "id": "5a99be436a694a0071ba0bf1", "playerCount": 0 },
    { "name": "experiments", "id": "58f97d73aea6392a104f650e", "playerCount": 0 },
    { "name": "stretching room", "description": "spooky fun with the haunted mansion stetching room.", "id": "59b19637f45aa620104ef3de", "playerCount": 0 },
    { "name": "desert tour", "description": "a simulation of a driving car.", "id": "5818b67374b6a3511336cf96", "playerCount": 0 },
    { "name": "redacted", "id": "587a4d3250243a5314e471fd", "playerCount": 0 },
    { "name": "venn diagrams", "id": "5898ea6434bdeb0e101ccbbe", "playerCount": 0 },
    { "name": "pvp arena", "id": "5844380f89f186eb1300a29e", "playerCount": 0 },
    { "name": "construction platform", "description": "a floating island to build on. delete your stuff before you leave.", "id": "5a874677c1023ed60f4117bd", "playerCount": 0 },
    { "name": "tower of infinity", "description": "death is coming for you", "id": "592784a02faaf6de139d7359", "playerCount": 0 },
    { "name": "fazzi's home", "description": "fazzis apartment. alley, city, urban. shops. ", "id": "5871a13c6d204d1110ee0e07", "playerCount": 0 },
    { "name": "the fortress", "description": "crimson's building tower above an ocean", "id": "5ccf7fa6a397673aa0965eea", "playerCount": 0 },
    { "name": "alterspace", "id": "597b15a1e5085fcd1342ef44", "playerCount": 0 },
    { "name": "mrleadfellow's home", "description": "houseparty", "id": "57fef2577f96509e1cc5342d", "playerCount": 0 },
    { "name": "space craft", "description": "work in progress", "id": "5c2f9e8c8436ee6f7daa6f4a", "playerCount": 0 },
    { "name": "newcomers", "id": "5b6f1758a28b7c74d11efc36", "playerCount": 0 },
    { "name": "the varga", "description": "the wildhunt dropship", "id": "589f9e1135aab8a413e9f4c0", "playerCount": 0 },
    { "name": "nightclub raves-parties-fun", "description": "rave, party, meet and chat with new people, play music, and have fun on stage as the dj!!!", "id": "58181d33160c0d921301ea5f", "playerCount": 0 },
    { "name": "fantasytest", "id": "588a867569b2d89713de6a2e", "playerCount": 0 },
    { "name": "wwe arena", "description": "work in progress", "id": "587278fddf57f4161805b985", "playerCount": 0 },
    { "name": "atticuskirk's home", "id": "592b919246d5c023103f16f8", "playerCount": 0 },
    { "name": "farm town", "id": "57fc3d1ed3cd9ce413772ccd", "playerCount": 0 },
    { "name": "claritys workshop", "id": "59e505c83ee0352e109335a0", "playerCount": 0 },
    { "name": "fazzis island", "id": "587b448611054fae258933de", "playerCount": 0 },
    { "name": "the bukkits home", "description": "the home of the bukkit", "id": "59ce8f892df64b1f2f1f38dd", "playerCount": 0 },
    { "name": "soda's spaceship", "id": "5cb143f1fb0ce72671539eb3", "playerCount": 0 },
    { "name": "gills broom closet", "id": "58d9a8cf5bb4e5fc2c0d4f0b", "playerCount": 0 },
    { "name": "black mesa", "id": "58a202e5b6b22189725e07e4", "playerCount": 0 },
    { "name": "alpine resort", "description": "relaxing hidaway", "id": "581bb08d07da8c6e5246caf3", "playerCount": 0 },
    { "name": "the abyss", "id": "59cebd14050b6ec61368135c", "playerCount": 0 },
    { "name": "nebulacn's home", "description": "nebula", "id": "57f8c8c34f6a7c6a15b3cbe7", "playerCount": 0 },
    { "name": "inside the tardis", "description": "its bigger on the inside", "id": "5805c37fc49961cf28d6aae2", "playerCount": 0 },
    { "name": "5 eme etage", "id": "58621f940156365c24f9bb3d", "playerCount": 0 }
  ],
  "newest": [
    { "name": "chill hour", "id": "658e368ceef71c05ae83a00d", "playerCount": 0 },
    { "name": "precipice of the doomed", "id": "6586520b97ab191580aedbaf", "playerCount": 0 },
    { "name": "delco & jinx warehouse", "description": "our inventory warehouse for the archive", "id": "65850611baa2b214c0065430", "playerCount": 0 },
    { "name": "pspace's home", "id": "657b08d535ac821583ea129d", "playerCount": 0 },
    { "name": "wix area", "id": "6578b85b5f4a7c05b2806677", "playerCount": 0 },
    { "name": "specworld", "id": "6574d048a5f43d14c216f63a", "playerCount": 0 },
    { "name": "vrvoyager's home", "id": "6572711406a08a158941619d", "playerCount": 0 },
    { "name": "toast's campsite", "id": "656cd727087f3205bdc5d7de", "playerCount": 0 },
    { "name": "the spectral room", "id": "6566bae6baa2b214c00653a7", "playerCount": 0 },
    { "name": "squiddles man's home", "id": "65635062212f9805c1e28354", "playerCount": 0 },
    { "name": "crestfallen", "id": "6562bcfaf728b5158137cef3", "playerCount": 0 },
    { "name": "chase shift's home", "id": "6548b27db68307529e02e0c5", "playerCount": 0 },
    { "name": "kittythebuilder's home", "id": "64e8ebfad1c51905d0df3296", "playerCount": 0 },
    { "name": "home 3446", "id": "64dd07d6f612c5266ca5ebd2", "playerCount": 0 },
    { "name": "sky's home", "id": "64dc4b06ad0a5926627a91df", "playerCount": 0 },
    { "name": "da king zone", "id": "64af99db3de4af05cdaa8636", "playerCount": 0 },
    { "name": "skineline9's home", "id": "64a5244f6dded147216a03a1", "playerCount": 0 },
    { "name": "road trip", "id": "649f8fdc3ae8af4720437665", "playerCount": 0 },
    { "name": "abel niga", "id": "64740a68ad0a5926627a8f73", "playerCount": 0 },
    { "name": "strglsses4's home", "id": "64583d2dad0a5926627a8f18", "playerCount": 0 },
    { "name": "andy's abode", "id": "6452399857775d05cbef9aaf", "playerCount": 0 },
    { "name": "vrmove561 23 1's home", "id": "644a5259e3b32576a3b7c3e3", "playerCount": 0 },
    { "name": "bloxland2", "id": "6439ae15de864005cac5cc02", "playerCount": 0 },
    { "name": "bloxland", "id": "64396a7e3cd4bf7e717ff3ec", "playerCount": 0 },
    { "name": "my castle 564", "id": "6438dab50cc2955eef0ddc02", "playerCount": 0 },
    { "name": "gordiy001's home", "id": "6429ddff583c177e70d25bbd", "playerCount": 0 },
    { "name": "raver's home", "id": "640b97c221481f05d9a914c9", "playerCount": 0 },
    { "name": "breon was here's home", "id": "63f9903c9c719a3d2f111a0a", "playerCount": 0 },
    { "name": "lucas's builds", "description": "all of my random builds", "id": "63e3bfd97a49dd5635df3582", "playerCount": 0 },
    { "name": "apelo's home", "id": "6394b14a63ab250464a536d5", "playerCount": 0 }
  ],
  "popularNew": [
    { "name": "chill hour", "id": "658e368ceef71c05ae83a00d", "playerCount": 0 }
  ],
  "popularNew_rnd": [
    { "name": "chill hour", "id": "658e368ceef71c05ae83a00d", "playerCount": 0 }
  ],
  "lively": [],
  "favorite": [],
  "mostFavorited": [
    { "name": "buildtown", "description": "welcome to this area to help with your first building tries and chat! a place to find friends, too.", "id": "57f67019817496af5268f719", "playerCount": 0 },
    { "name": "the future", "description": "space", "id": "58158ca9b5cfcb54137342db", "playerCount": 0 },
    { "name": "nightclub raves-parties-fun", "description": "rave, party, meet and chat with new people, play music, and have fun on stage as the dj!!!", "id": "58181d33160c0d921301ea5f", "playerCount": 0 },
    { "name": "fazzi's home", "description": "fazzis apartment. alley, city, urban. shops. ", "id": "5871a13c6d204d1110ee0e07", "playerCount": 0 },
    { "name": "vault 112 - entrance", "description": "vault 112 entrance and wasteland!", "id": "589269cab37feaae13bf02f5", "playerCount": 0 },
    { "name": "body shop", "description": "free to use heads, bodies, arms. many accessories and clonables. fazzis.", "id": "58e36deffb5e0bb113a068bc", "playerCount": 0 },
    { "name": "time keys", "description": "time machine transportation", "id": "5971bf1943c229ef3003f9fa", "playerCount": 0 },
    { "name": "any-land elevator", "id": "5a066f7f7319a6bc135d5ff4", "playerCount": 0 },
    { "name": "-ping me-", "description": "a place to ask your friends to ping you. (ping them and they'll ping you)", "id": "5add11ccec262303241d8883", "playerCount": 0 }
  ]
}

const canned_friendsbystr = {
  "online": {
    "friends": []
  },
  "offline": {
    "friends": [
      {
        "lastActivityOn": "2023-11-30T19:07:20.576Z",
        "screenName": "philipp",
        "statusText": "great meeting all of you! [board: philbox] ...",
        "id": "5773b5232da36d2d18b870fb",
        "isOnline": false,
        "strength": null
      }
    ]
  }
}

const canned_forums_favorites = {
  "forums": [
    {
      "name": "help",
      "description": "for all your anyland questions",
      "creatorId": "5773b5232da36d2d18b870fb",
      "creatorName": "philipp",
      "threadCount": 346,
      "latestCommentDate": "2023-12-21T09:35:12.880Z",
      "protectionLevel": 0,
      "creationDate": "2016-12-06T16:31:52.285Z",
      "dialogThingId": "58481eb85a0dc5b20d48e6f8",
      "dialogColor": "255,255,255",
      "latestCommentText": "this is epic!",
      "latestCommentUserId": "622d80e81ee78204797e0e4e",
      "latestCommentUserName": "Captain Crunch",
      "id": "5846f540e8593a971395c0aa"
    },
    {
      "name": "events",
      "description": "find and post dates for your events... parties, games, celebrations, anything!",
      "creatorId": "5773b5232da36d2d18b870fb",
      "creatorName": "philipp",
      "threadCount": 60,
      "latestCommentDate": "2023-10-08T20:42:08.929Z",
      "protectionLevel": 0,
      "creationDate": "2016-12-06T16:42:27.699Z",
      "dialogThingId": "5848394801371c5c136a9ea3",
      "dialogColor": "100,194,226",
      "latestCommentText": "penis fuck",
      "latestCommentUserId": "6003833e11e60605a2d7cb15",
      "latestCommentUserName": "Sheep",
      "id": "5846f54d5a84a62410ce2e66"
    },
    {
      "name": "updates",
      "description": "find out what's new with anylad. feature announcements and bug fix info. thanks all!",
      "creatorId": "5773b5232da36d2d18b870fb",
      "creatorName": "philipp",
      "threadCount": 426,
      "latestCommentDate": "2023-12-13T00:16:12.269Z",
      "protectionLevel": 1,
      "creationDate": "2016-12-06T15:17:21.186Z",
      "dialogThingId": "58483a3b5a0dc5b20d48e6fe",
      "dialogColor": "75,226,187",
      "latestCommentText": "im gonna miss it for sure",
      "latestCommentUserId": "57fa1a9a062bfb6013e320e9",
      "latestCommentUserName": "cet cherinyakov",
      "id": "5846f556b09fa5d709e5f6fe"
    },
    {
      "name": "showcase",
      "description": "",
      "creatorId": "5773b5232da36d2d18b870fb",
      "creatorName": "philipp",
      "threadCount": 217,
      "latestCommentDate": "2023-10-12T18:37:22.004Z",
      "protectionLevel": 0,
      "creationDate": "2016-12-06T15:17:21.186Z",
      "dialogThingId": "58483d2d6243c7d410fc910f",
      "dialogColor": "223,226,125",
      "latestCommentText": "i'm amaze!",
      "latestCommentUserId": "5eeeb2edcb300544abacc984",
      "latestCommentUserName": "johnny nu",
      "id": "5846f567b09fa5d709e5f6ff"
    },
    {
      "name": "suggestions",
      "description": "got a new feature idea for anyland, or anything that could be improved?",
      "creatorId": "5773b5232da36d2d18b870fb",
      "creatorName": "philipp",
      "threadCount": 347,
      "latestCommentDate": "2021-08-29T06:33:04.655Z",
      "protectionLevel": 0,
      "creationDate": "2016-12-06T16:42:28.538Z",
      "dialogThingId": "58483e01076bf93b0e75f839",
      "dialogColor": "198,163,88",
      "latestCommentText": "i wonder if the game can actually handle that many script lines.",
      "latestCommentUserId": "5d9690a7288c857ffcc8623e",
      "latestCommentUserName": "flarn2006",
      "id": "5846f571c966811d10993e1e"
    },
    {
      "name": "hangout",
      "description": "a board to relax and discuss all kinds of miscellaneous topics. welcome!",
      "creatorId": "5773b5232da36d2d18b870fb",
      "creatorName": "philipp",
      "threadCount": 48,
      "latestCommentDate": "2023-10-03T03:45:06.027Z",
      "protectionLevel": 0,
      "creationDate": "2016-12-06T16:42:27.699Z",
      "dialogThingId": "58483fff5a7d56f91469903f",
      "dialogColor": "198,143,132",
      "latestCommentText": "hewoo mr obama?",
      "latestCommentUserId": "5f911606fe99c863186d3030",
      "latestCommentUserName": "alizard",
      "id": "5846f5785a84a62410ce2e67"
    },
    {
      "name": "quests",
      "description": "a board to post your adventures and quests!",
      "creatorId": "5773b5232da36d2d18b870fb",
      "creatorName": "philipp ai",
      "threadCount": 30,
      "latestCommentDate": "2023-12-13T12:19:04.618Z",
      "protectionLevel": 0,
      "creationDate": "2019-01-19T15:46:36.529Z",
      "latestCommentText": "✓ achieved",
      "latestCommentUserId": "5af09cf138f35155f103bd92",
      "latestCommentUserName": "Yoofaloof",
      "dialogColor": "84,255,255",
      "dialogThingId": "5c45b3f2dbdb1d61cf7f18b9",
      "id": "5c43465c9e61d1567d9c69bd"
    }
  ]
}
