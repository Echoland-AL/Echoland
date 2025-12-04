
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

### 1. Install Docker

Get started here: [https://www.docker.com/get-started](https://www.docker.com/get-started)

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

Steps:

1. Run Docker  
2. Run `start-server.bat` directly  
3. Choose **Start Server (1)** and wait for both areas and things indexing  
4. Choose **6** to see the server logs  
5. Wait for indexing to finish  
6. Open `Echoland-Admin.html` or visit [http://localhost:8000/admin](http://localhost:8000/admin)  
7. Create names and profiles here  
8. Start the game, then refresh the admin page to show the pending client and assign it to the corresponding profile  
9. You’re playing the game—enjoy!

**Tip:** Create a shortcut to the `.bat` file for quick access.  
The first launch may take time while the area index/things loads. After that, it will cache and start instantly next time.

---
