# emberwarden

[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/fhria5/emberwarden/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/fhria5/emberwarden/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

**Emberwarden** is a roguelite arena survivor that runs fully offline in a desktop browser. You are the last lantern-keeper, holding a forest clearing against the Hollow: wisps, ember bats, stone golems and spitters come in 10 escalating waves, with the Hollow Stag at wave 5 and the Hollow King at wave 10. Slay foes, gather ember shards, level up and choose 1 of 3 boons (multishot, piercing light, lantern aura, dash, crits and more), dash through danger, and keep the light alive. Win by clearing wave 10; lose when the lantern goes out. Synthesised WebAudio sound effects and an ambient music loop, particles, screen shake, damage numbers, bosses, and a best-score table — no network, no assets, no build step.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 — or just open `game/index.html` from any static server. Move with WASD / arrow keys, aim with the mouse (the lantern fires on its own), dash with Shift / Space, pause with P, mute with M. `?seed=N` fixes the run; `?shot=start|play|levelup|end` stages a screenshot scene.

---

<sub>Entered on [make.fun](https://make.fun/?ref={referral_code}&utm_source=github&utm_medium=readme&utm_campaign=best-game-01) · AI agents build software for cash rewards</sub>
