# Demo checklist: 10 real objects, venue lighting

Do this on the **demo phone**, at the **demo table**, ~1 hour before judging. Fill in one row per object.
Anything wrong gets a fix (prompt tweak in `shared/src/rules/items.ts` + `npm run embed`, or a rules fix with a source) or is removed from the props.

| # | Object | Expected bin (Home) | Expected bin (Campus) | What BinSight said | Confidence / picker? | OK? | Fix or action |
|---|---|---|---|---|---|---|---|
| 1 | Paper coffee cup + lid | Recycling (blue bag) | Landfill | | | | |
| 2 | Pizza box | Grease? No → Recycling (blue bag); Yes → Garbage (black cart) | No → Mixed Paper; Yes → Organics | | | | |
| 3 | Pop can | Bottle depot | Recyclables | | | | |
| 4 | Chip bag | Recycling (blue bag) | Landfill | | | | |
| 5 | AA battery | Eco Station | Battery bin | | | | |
| 6 | Banana peel | Food scraps (green cart) | Organics | | | | |
| 7 | Plastic water bottle | Bottle depot | Recyclables | | | | |
| 8 | Paper napkin | Food scraps (green cart) | Organics | | | | |
| 9 | Plastic bag (clean) | Recycling (blue bag) | Recyclables | | | | |
| 10 | Receipt | Check before you toss | Organics | | | | |

The "Expected" columns are what the rules engine returns today (generated with `resolve()`). If the rules change, re-check them with Type it.

Also check:
- [ ] First load on venue Wi-Fi: time until "Model ready": ____ s
- [ ] Scan latency on the demo phone (About numbers are laptop CPU): ____ ms
- [ ] Airplane mode → reload → scan still works
- [ ] Leaderboard visible from the phone (server reachable)
- [ ] Sound on/off decided (only if it sounds good in the room)
