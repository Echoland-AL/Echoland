#!/usr/bin/env bun
/**
 * Profile Manager for Echoland Multiplayer Server
 * 
 * Usage:
 *   bun create-profile.ts                    - Create a new profile with random name
 *   bun create-profile.ts MyProfileName      - Create a new profile with custom name
 *   bun create-profile.ts --list             - List all existing profiles
 */

import * as fs from "node:fs/promises";

const ACCOUNTS_DIR = "./data/person/accounts";

// Generate a random username
function generateRandomUsername(): string {
  const adjectives = ["Swift", "Bright", "Shadow", "Mystic", "Cosmic", "Thunder", "Crystal", "Ember", "Frost", "Storm", "Golden", "Silver", "Azure", "Crimson", "Violet"];
  const nouns = ["Wolf", "Phoenix", "Dragon", "Hawk", "Tiger", "Serpent", "Raven", "Fox", "Bear", "Lion", "Eagle", "Falcon", "Panther", "Lynx", "Owl"];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  const num = Math.floor(Math.random() * 10000);
  return `${adj}${noun}${num}`;
}

// List all existing profiles
async function listProfiles(): Promise<string[]> {
  try {
    await fs.mkdir(ACCOUNTS_DIR, { recursive: true });
    const files = await fs.readdir(ACCOUNTS_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace('.json', ''));
  } catch {
    return [];
  }
}

// Create a new profile
async function createNewProfile(customName?: string): Promise<{ profileName: string; accountData: any }> {
  const profileName = customName || generateRandomUsername();
  
  // Check if profile already exists
  const existingProfiles = await listProfiles();
  if (existingProfiles.includes(profileName)) {
    console.log(`❌ Profile "${profileName}" already exists!`);
    console.log(`\n💡 To use this profile, connect with: X-Profile: ${profileName}`);
    process.exit(1);
  }
  
  const personId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  const homeAreaId = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
  
  const accountData = {
    personId,
    screenName: profileName,
    homeAreaId,
    attachments: {}
  };
  
  await fs.mkdir(ACCOUNTS_DIR, { recursive: true });
  const accountPath = `${ACCOUNTS_DIR}/${profileName}.json`;
  await fs.writeFile(accountPath, JSON.stringify(accountData, null, 2));
  
  console.log(`\n✨ Created new profile: ${profileName}`);
  console.log(`   Person ID: ${personId}`);
  console.log(`   Account file: ${accountPath}`);
  
  return { profileName, accountData };
}

// Main
async function main() {
  const args = process.argv.slice(2);
  
  console.log("\n🎭 Echoland Multiplayer Profile Manager\n");
  
  if (args.includes("--list") || args.includes("-l")) {
    const profiles = await listProfiles();
    if (profiles.length === 0) {
      console.log("No profiles found. Create one with: bun create-profile.ts [name]");
      console.log("Or just connect to the server - profiles are auto-created!");
    } else {
      console.log("📋 Existing profiles:");
      for (const profile of profiles) {
        console.log(`   • ${profile}`);
      }
      console.log(`\nTotal: ${profiles.length} profile(s)`);
    }
    return;
  }
  
  if (args.includes("--help") || args.includes("-h")) {
    console.log("Usage:");
    console.log("  bun create-profile.ts                    Create a new profile with random name");
    console.log("  bun create-profile.ts MyProfileName      Create a new profile with custom name");
    console.log("  bun create-profile.ts --list             List all existing profiles");
    console.log("  bun create-profile.ts --help             Show this help");
    console.log("");
    console.log("Note: Profiles can also be auto-created when clients connect to the server.");
    console.log("      Just connect with a new profile name in the X-Profile header.");
    return;
  }
  
  // Create profile
  const customName = args[0];
  const result = await createNewProfile(customName);
  
  console.log(`\n💡 How to use this profile:`);
  console.log(`   1. Start the server: bun game-server.ts`);
  console.log(`   2. Connect your client with header: X-Profile: ${result.profileName}`);
  console.log(`   3. Or use query param: ?profile=${result.profileName}`);
  
  // List all profiles
  const allProfiles = await listProfiles();
  if (allProfiles.length > 1) {
    console.log(`\n📋 All profiles (${allProfiles.length}):`);
    for (const profile of allProfiles) {
      console.log(`   • ${profile}`);
    }
  }
}

main().catch(console.error);
