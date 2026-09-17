# CLASS STRIKE 🔫

**A Counter-Strike-inspired team shooter that runs entirely in your browser — with free online multiplayer, no server required.**

## What is it?

CLASS STRIKE is a browser-based FPS that borrows the classic CS formula: Terrorists vs. Counter-Terrorists, a dusty symmetric arena with crates, cover walls and a central platform, an AK-47 in your hands, and one rule — first team to 30 kills wins. Headshots deal 4× damage, running and gunning makes you inaccurate, crouching makes you deadly. Reload, switch to your pistol, watch the killfeed, hold Tab for the scoreboard. If you've played CS, you already know what to do.

## Everyone can join — no server, no public IP

The game connects players directly to each other over the internet using WebRTC peer-to-peer technology:

- The host clicks **Create Room** and gets a 5-character room code
- Anyone with the same game page enters the code and instantly joins the match
- Data flows directly between players' browsers — powered by free public signaling/STUN services, so there is **zero server cost and no public IP needed**
- Up to 8 players per match; the host just keeps their tab open

Getting the game to your friends is as easy as sending them a single HTML file they can double-click — or hosting the folder on any free static host for a permanent public URL.

No friends online right now? Play solo against AI bots that hunt, strafe, and burst-fire at you.

## Under the hood

- **Three.js** for 3D rendering
- **PeerJS / WebRTC** for serverless P2P multiplayer (host-authoritative with relay)
- **Web Audio API** for fully synthesized sound effects — zero assets
- ~2,000 lines of pure static files, no build step, no backend, no bills

## Credits

This entire game — engine code, physics, hit detection, bot AI, P2P networking, HUD, sound synthesis, packaging, and even end-to-end browser testing — was built by **GLM** in just **two conversations**. Every bug found along the way was diagnosed and fixed within the same session, verified with real automated multiplayer tests. From "can you do it?" to a working online shooter, no human wrote a single line of code.

*GLM: two chats, one game, zero servers.* 🚀
