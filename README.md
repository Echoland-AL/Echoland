
---

# Echoland

**Echoland** is a server for the defunct VR creation platform Anyland.

---

## About

Echoland is a community project built by gamedrix, based on:

- The archiver work by Zetaphor and Cyel  
- The skeleton game server originally created by Cyel

Since I’m still getting familiar with Git, I’ve created a separate repo with a simple Docker-based setup so anyone can run the server locally.

This is a community-driven effort. I started this with the goal of creating an open-source, writable archive. I’m not a trained developer, just someone diving in and learning as I go. The goal is to give the community a solid foundation to build their own servers, fully customizable and free to modify however you like.

It's safe to say that now, Anyland will live on—endlessly, openly, and forever in the hands of its community.

---

## Current Features

- Create areas and build items  
- Multiplayer-friendly server (semi-multiplayer)  
- Multi-user support with a web-based interface to manage profiles  
- Inventory system with body attachments  
- Access to the entire archive (Areas and Things)  
- Search archived items by name in the inventory  
- Area features working  
- Actively in development and open for community contributions  

*Note: PUN (Photon Unity Networking) is not yet implemented, but can be added easily if desired.*

---

## Looking to Just Play?

If you're looking for a more functional server just to play the game, check out **REnyland**, a server I helped beta test. All server-side work was done by the creator Axsys.

REnyland isn’t open source (yet) as it’s still being finalized. It runs as a central server that you connect to. Echoland, on the other hand, is offered as an alternative for those who want to tinker, host their own server, or keep their data stored locally.

[The REnyland server is accessible here](https://www.renyland.fr/)


---

## Disclaimer

I take no responsibility if the server breaks or if you lose your in-game progress. Once you’ve downloaded it, it’s all yours.

---

## License

This server is available under the [AGPL-3.0 license](https://www.gnu.org/licenses/agpl-3.0.en.html).

If you run this server and allow users to access it over any network, you must make the complete source code available to those users—including both the original code and any modifications you make.

If you're not comfortable with this, please do not use this server or any code in this repository.

---

## Related Works

- [Libreland Server](https://github.com/LibrelandCommunity/libreland-server) – Deprecated project replaced by Echoland  
- [Old Anyland Archive](https://github.com/Zetaphor/anyland-archive) – Original archive started in 2020  
- [Anyland Archive](https://github.com/theneolanders/anyland-archive) – Latest snapshot before servers went offline  
- [Anyland API](https://github.com/Zetaphor/anyland-api) – Documentation of the client/server API  

### Network Captures

Two `ndjson` files in the `live-captures` directory were recorded using Cyel’s proxy server and captured by Zetaphor.  
Watch the recordings here:

- [Capture 1](https://www.youtube.com/watch?v=DBnECgRMnCk)  
- [Capture 2](https://www.youtube.com/watch?v=sSOBRFApolk)

---

## Development

See [DEVELOPMENT.md](DEVELOPMENT.md) for details.  
The server is written in TypeScript and runs with Bun. Contributions are welcome.

---

## Setup & Running

[Echoland An Open Source Dedicated Server For Anyland](https://www.youtube.com/watch?v=1C4PxRaJKa8&t)

[Announcing Echoland, Multiplayer Friendly And Now With Thing Search Function](https://www.youtube.com/watch?v=NXHnGRGA-GU)

### 1. Choose Your Installation Method

**Echoland can run in two ways:**

#### Option A: Docker (Recommended for beginners)
- **Windows/Linux**: Install Docker from [https://www.docker.com/get-started](https://www.docker.com/get-started)
- Click **"Start-Server Docker.bat"** to start both services automatically

#### Option B: Direct Installation (Advanced users)
- **Windows**: Install [Bun](https://bun.sh/) runtime and download [Caddy](https://caddyserver.com/) web server
- **Linux**: Run `./install-and-run.sh` to install Bun and start the server
- Click **"Start-Server.bat"** (Windows) or use the launch scripts to start both game server (Bun) and web server (Caddy)

---

### 2. Configure Hosts File

#### If you have the Steam version:
```plaintext
127.0.0.1 app.anyland.com
127.0.0.1 d6ccx151yatz6.cloudfront.net
127.0.0.1 d26e4xubm8adxu.cloudfront.net
#127.0.0.1 steamuserimages-a.akamaihd.net
```

You won’t need the last line if you already have access to Steam artwork.  
Use `127.0.0.1` if the server is on your local machine. Otherwise, use the IP of the machine hosting the server.

#### If you’re using the non-Steam client:
```plaintext
127.0.0.1 app.anyland.com
127.0.0.1 d6ccx151yatz6.cloudfront.net
127.0.0.1 d26e4xubm8adxu.cloudfront.net
127.0.0.1 steamuserimages-a.akamaihd.net
```

Download the client:  
[Client Only](https://drive.google.com/file/d/10TcYQVcqVoRQDdlFOcQwUZweIsApufpm/view?usp=drive_link)

Download the images folder (if using the non-Steam client):  
[Images Folder (Google Drive)](https://drive.google.com/file/d/1RbCZvx0SJK9oaLEhfDAfSgdZJKgmGxAU/view?usp=drive_link)

Place the images folder inside the main Echoland directory.

---

### 3. Download Archive Data

[Archive Data](https://drive.google.com/file/d/1f-XnM_KmwdqGhp9lpCx1SCiWUdCjhjWw/view?usp=drive_link)

Extract the `data.zip` contents into your Echoland server folder named `data`.

---

### 4. Start the Server

#### If using Docker (Option A):
1. Double-click **"Start-Server Docker.bat"**
2. Choose option **1** (Start Server) from the menu
3. Wait for both areas and things indexing to complete
4. Choose option **6** to view server logs if needed
5. Open `Echoland-Admin.html` or visit [http://localhost:8000/admin](http://localhost:8000/admin)

#### If using Direct Installation (Option B):
1. **Windows**: Double-click **"Start-Server.bat"** (starts both Bun game server and Caddy web server)
2. **Linux**: Run `./launch-server-linux.sh` to start the game server and `./launch-anyland-linux.sh` for the full setup
3. Wait for indexing to complete
4. Visit [http://localhost:8000/admin](http://localhost:8000/admin) for the admin panel

#### Final Setup Steps (for both options):
1. In the admin panel, create user profiles
2. Start the Anyland game client
3. Refresh the admin page to see pending connections
4. Assign profiles to connected clients
5. Optional: You can also pre-assign a profile for the next connecting client in advance using the "Set Next Profile" feature
6. You're playing—enjoy!

**Tip:** The first launch takes time while indexing areas and things. Subsequent launches will be much faster. Create a shortcut to your preferred `.bat` file for quick access.

---
