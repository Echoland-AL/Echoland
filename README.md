# Echoland — Open-Source, Self-Hostable Anyland Server

> **An open-source replacement server for [Anyland](https://store.steampowered.com/app/555555/Anyland/), created by [Gamedrix](https://github.com/Gamedrix). Self-host your own Anyland experience after the official servers shut down.**

[Anyland](https://store.steampowered.com/app/555555/Anyland/) is an online pure sandbox VR social game released on Steam on October 6th, 2016. It's an amazing game where you can create everything with your own hands — from your world to your avatar to any objects you want. The game's client was fully dependent on a central server for all data, profiles, and creations.

Since the game was niche and never got the attention it deserved, it didn't receive the financial support needed to keep the server running. In **February 2024**, the official server shut down — and since the game needed that server to run at all, we lost access to the game entirely.

Thankfully, community members like **Zetaphor**, **Cyel**, and others captured data from the game before it closed, publishing the [Anyland Archive Redux](https://github.com/theneolanders/anyland-archive-redux) — a read-only server. The heavy lifting was done, and since the repo was open source, someone just had to make it writable again.

**That's where Echoland comes in.**

Echoland makes the server fully writable and functional, just like the original. You can play the game again, create, build, and enjoy it all — with your own private copy of the server.

### Features

- **Fully self-hostable** — Run it locally or remotely
- **Open source** — AGPL-3.0 licensed, free to modify
- **Independent** — No centralized infrastructure required
- **Multiplayer** — Supports PUN-based multiplayer (BepInEx mod coming soon for local setups)
- **Web admin panel** — Manage profiles, assign clients, and monitor sessions
- **Based on the community archive** — Built on top of the Anyland Archive Redux by Zetaphor and Cyel

---

## Looking to Just Play?

If you just want to play without setting up a server, check out **[REnyland](https://www.renyland.fr/)** — a server I helped beta test, created by **Axsys**.

REnyland is a separate project focused on bringing players together with an easy-to-use launcher. It's not open source and is fully controlled by Axsys. Your profile is preserved on the Steam version, but non-Steam (Goldberg) clients won't have portable profiles.

Echoland, on the other hand, is for those who want to **tinker, self-host, or keep their data locally**.

---

## License

This project is licensed under **[AGPL-3.0](https://www.gnu.org/licenses/agpl-3.0.en.html)**.

> If you run this server and allow users to access it over any network, you **must** make the complete source code available to those users — including any modifications you make. If you're not comfortable with this, please do not use this server or any code in this repository.

---

## Disclaimer

I take no responsibility if the server breaks or if you lose your in-game progress. Once downloaded, it's all yours.

---

## Setup & Running

📺 [Watch the setup video](https://www.youtube.com/watch?v=se97PN2JKhc)

### 1. Choose Your Installation Method

#### Option A: Docker (Recommended for beginners)

- Install Docker from [docker.com/get-started](https://www.docker.com/get-started)
- Run **`Start-Server Docker.bat`** to start all services automatically

#### Option B: Direct Installation (Advanced)

| Platform | Instructions |
|----------|-------------|
| **Windows** | Install [Bun](https://bun.sh/) via `powershell -c "irm bun.sh/install.ps1 | iex"`, then run **`Start-Server.bat`** |
| **Linux** | Run `./install-and-run.sh` to install Bun and start the server |

### 2. Configure Hosts File

> **Deprecated** — Use the included **EchoSwitch** software instead.

Add these lines to `C:\Windows\System32\drivers\etc\hosts`:

```
127.0.0.1 app.anyland.com
127.0.0.1 d6ccx151yatz6.cloudfront.net
127.0.0.1 d26e4xubm8adxu.cloudfront.net
127.0.0.1 steamuserimages-a.akamaihd.net
```

### 3. Download Required Files

| File | Link |
|------|------|
| **Anyland Client** | [Google Drive](https://drive.google.com/file/d/10TcYQVcqVoRQDdlFOcQwUZweIsApufpm/view?usp=drive_link) |
| **Patch** | [Patch.rar](https://drive.google.com/file/d/1_ZxluhZNU-BK5tbyWPHHNd16LZu0t7QH/view?usp=sharing) |
| **Images Folder** (optional) | [Google Drive](https://drive.google.com/file/d/1RbCZvx0SJK9oaLEhfDAfSgdZJKgmGxAU/view?usp=drive_link) |
| **Archive Data** (required) | [data.zip](https://drive.google.com/file/d/1f-XnM_KmwdqGhp9lpCx1SCiWUdCjhjWw/view?usp=drive_link) |

Extract the `data.zip` contents into your Echoland server folder as `data/`.

### 4. Start the Server

#### Docker (Option A):
1. Double-click **`Start-Server Docker.bat`**
2. Choose option **1** (Start Server)
3. Wait for area and thing indexing to complete
4. Choose option **6** to view logs if needed
5. Open `Echoland-Admin.html` or visit [http://localhost:8000/admin](http://localhost:8000/admin)

#### Direct Installation (Option B):
1. **Windows**: Double-click **`Start-Server.bat`**
2. **Linux**: Run `./launch-server-linux.sh` (game server) and `./launch-anyland-linux.sh` (full setup)
3. Wait for indexing to complete
4. Visit [http://localhost:8000/admin](http://localhost:8000/admin)

#### Final Steps:
1. In the admin panel, **create user profiles**
2. **Start the Anyland game client**
3. Refresh the admin page to see pending connections
4. **Assign profiles** to connected clients
5. *(Optional)* Pre-assign a profile for the next client using "Set Next Profile"
6. **You're playing — enjoy!**

> **Tip:** The first launch takes time while indexing areas and things. Subsequent launches will be much faster.

---

## API Endpoints

### Main Server (port 8000)

#### 🔧 Admin (GET)

| Endpoint | Description |
|----------|-------------|
| `/admin` | Admin panel HTML |
| `/admin/assign` | Assign profile to waiting client |
| `/admin/create-profile` | Create a new profile |
| `/admin/set-next-profile` | Set pre-selected profile for next client |
| `/admin/clear-next-profile` | Clear pre-selected profile |
| `/admin/delete-profile` | Delete a profile |
| `/api/admin/active` | Active players/sessions snapshot (JSON) |
| `/api/profiles` | List all profiles (JSON) |
| `/admin/events` | SSE stream for admin panel updates |

#### Auth (POST)

| Endpoint | Description |
|----------|-------------|
| `/auth/start` | Authenticate and create session |

#### Person (POST)

| Endpoint | Description |
|----------|-------------|
| `/person/updateattachment` | Update player attachments |
| `/person/sethandcolor` | Set avatar hand color |
| `/person/registerusagemode` | Register usage mode |
| `/person/addfriend` | Add friend |
| `/person/removefriend` | Remove friend |
| `/person/getflag` | Get person flag |
| `/person/ping` | Ping another player |
| `/person/incfriendstrength` | Increment friend strength |
| `/person/updatesetting` | Update person setting (screen name, status, findable) |
| `/person/info` | Get person info (area-specific) |
| `/person/infobasic` | Get basic person info (area-specific) |

#### Person (GET)

| Endpoint | Description |
|----------|-------------|
| `person/friendsbystr` | Get friends by strength *(note: missing leading slash in code)* |

#### Presence (POST)

| Endpoint | Description |
|----------|-------------|
| `/p` | Update player presence/position |

#### Area (POST)

| Endpoint | Description |
|----------|-------------|
| `/area/load` | Load an area by ID or URL name |
| `/area/info` | Get area info |
| `/area/getflag` | Get area flag status |
| `/area/setfavorite` | Toggle favorite on an area |
| `/area/save` | Save area data |
| `/area/getsubareas` | Get sub-areas of an area |
| `/area/setparentarea` | Set parent area/subareas |
| `/area/search` | Search areas |
| `/area/lists` | Get area lists (visited, created, favorites, etc.) |
| `/area/sethome` | Set home area |
| `/area` | Create area |
| `/area/updatesettings` | Update area settings |
| `/area/rename` | Rename an area |
| `/area/seteditor` | Set editor permissions |
| `/area/setlisteditor` | Set list editor permissions |
| `/area/visit` | Record area visit |
| `/area/random` | Get random area (also available as GET) |

#### Area (GET)

| Endpoint | Description |
|----------|-------------|
| `/area/random` | Get random area (also available as POST) |
| `/repair-home-area` | Repair home area *(legacy, for testing only)* |

#### User (POST)

| Endpoint | Description |
|----------|-------------|
| `/user/setName` | Change username |

#### Placement (POST)

| Endpoint | Description |
|----------|-------------|
| `/placement/list` | List placements in area |
| `/placement/metadata` | Get placement metadata |
| `/placement/new` | Create new placement |
| `/placement/info` | Get placement info |
| `/placement/save` | Save placement |
| `/placement/copyall` | Copy all placements |
| `/placement/delete` | Delete a placement |
| `/placement/deleteall` | Delete all placements in area |
| `/placement/replacething` | Replace thing in all matching placements |
| `/placement/update` | Update placement |
| `/placement/duplicate` | Duplicate placement |
| `/placement/setattr` | Set placement attribute |

#### Thing (POST)

| Endpoint | Description |
|----------|-------------|
| `/thing` | Create thing |
| `/thing/updateDefinition` | Update thing definition |
| `/thing/saveDefinition` | Save thing definition |
| `/thing/rename` | Rename thing |
| `/thing/search` | Search things |
| `/thing/fixmissinginfo` | Fix missing info files |
| `/thing/definition` | Get thing definition |
| `/thing/definitionAreaBundle` | Get thing definition area bundle |
| `/thing/flagStatus` | Get thing flag status |
| `/thing/info` | Get thing info by ID in body |
| `/thing/updateInfo` | Update thing info |
| `/thing/topby` | Get top things by creator *(shows most recent things created)* |
| `/thing/gettags` | Get thing tags |
| `/thing/getflag` | Get thing flag |

#### Thing (PUT)

| Endpoint | Description |
|----------|-------------|
| `/thing/:id` | Update thing by ID |

#### Thing (GET)

| Endpoint | Description |
|----------|-------------|
| `/thing/info/:id` | Get thing info |
| `/thing/def/:id` | Get thing definition |
| `/thing/sl/tdef/:thingId` | Get thing def via sl route |

#### Inventory (GET)

| Endpoint | Description |
|----------|-------------|
| `/inventory/:page` | Get inventory page |

#### Inventory (POST)

| Endpoint | Description |
|----------|-------------|
| `/inventory/save` | Save inventory item |
| `/inventory/delete` | Delete inventory item |
| `/inventory/move` | Move inventory item |
| `/inventory/update` | Update inventory item |

#### Gift / Achievement (POST) — *Not Implemented*

| Endpoint | Description |
|----------|-------------|
| `/gift/getreceived` | Get received gifts |
| `/ach/reg` | Register achievement |

#### 💬 Forum (GET) — *Not Implemented*

| Endpoint | Description |
|----------|-------------|
| `/forum/favorites` | Get favorite forums |
| `/forum/forum/:id` | Get forum by ID |
| `/forum/thread/:id` | Get thread by ID |

### Sub-Servers

| Port | Service | Endpoint | Description |
|------|---------|----------|-------------|
| **8001** | ThingDefs | `GET /:thingId` | Serve thing definition |
| **8002** | AreaBundles | `GET /:areaId/:areaKey` | Serve area bundle |
| **8003** | UGCImages | `GET /:part1/:part2/` | Serve UGC image |

---

## Related Works

- [Libreland Server](https://github.com/LibrelandCommunity/libreland-server) — Deprecated project replaced by Echoland
- [Old Anyland Archive](https://github.com/Zetaphor/anyland-archive) — Original archive started in 2020
- [Anyland Archive](https://github.com/theneolanders/anyland-archive) — Latest snapshot before servers went offline
- [Anyland API](https://github.com/Zetaphor/anyland-api) — Documentation of the client/server API

### Network Captures

Two `ndjson` files in the `live-captures` directory were recorded using Cyel's proxy server and captured by Zetaphor.

- [Capture 1](https://www.youtube.com/watch?v=DBnECgRMnCk)
- [Capture 2](https://www.youtube.com/watch?v=sSOBRFApolk)

---

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for details.

The server is written in **TypeScript** and runs with **[Bun](https://bun.sh/)**. Contributions are welcome!

---

> **Anyland will live on — endlessly, openly, and forever in the hands of its community.** 🎮
