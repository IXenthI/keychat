# KeyChat

A Twitch **and Kick** chat overlay / OBS chat dock with 7TV, BTTV, and FrankerFaceZ emote support — including **merged multi-channel chat** (co-streams, simulcasts) in one view. Fully static — no server, no API keys, no build step. Open `index.html` from disk or any static host and it just works.

KeyChat is a maintained fork of [jChat](https://github.com/giambaJ/jChat) by giambaJ (GPL-3.0), modernized after several Twitch/7TV API shutdowns broke the original, and inspired by [ChatIS](https://chatis.is2511.com/) by IS2511.

## Why this fork exists

- **Original jChat broke**: it relied on Twitch's retired Kraken (v5) API, the retired `badges.twitch.tv` service, and 7TV's retired v2 API.
- **KeyChat needs zero credentials**: the channel ID comes from Twitch IRC's own `ROOMSTATE` tag, emotes come from the public 7TV v3 / BTTV / FFZ APIs, and Twitch badges come from the public [IVR API](https://api.ivr.fi/) — no client ID, no OAuth, nothing to configure.
- **Dock mode**: a `bg=` parameter gives the page a solid background, so it works as an OBS custom browser dock without blinding you (transparent overlays render on white in docks).

## Usage

**Easy way:** open `setup.html` (or the bare hosted URL — it redirects there). Pick your options, watch the live preview, hit Copy. No URL crafting needed.

**Manual way:** point a browser source (overlay) or custom browser dock (chat panel) at:

```
index.html?channel=YOURTWITCHNAME
```

As a local file that looks like:

```
file:///C:/path/to/keychat/index.html?channel=yourtwitchname&bg=dark&size=2&font=1&animate=true&bots=true
```

### URL parameters

| Parameter | Values | Default | Notes |
|---|---|---|---|
| `channel` | Twitch login name(s), comma separated | — | Whose chat to show; `a,b` merges channels with source chips |
| `kick` | Kick channel name(s) | — | Kick chat, merged alongside Twitch (either param alone works too) |
| `theme` | `twitch`, `bubbles`, `compact`, `right` | default | Message style preset (`twitch` = near-native Twitch chat look) |
| `avatars` | `true`/`false` | `false` | Twitch profile pictures next to names |
| `dock` | `true`/`false` | `false` | Scrollable top-down chat like the real Twitch panel (auto-on with `mod`) |
| `bg` | `dark`, `gray`, `light`, or hex like `18181b` | transparent | Solid background; use for OBS docks (`black` still works as an alias) |
| `text` | `white`, `dark`, or hex | auto | Text color; auto switches to dark text on light backgrounds |
| `size` | 1–3 or 8–72 | 3 | 1/2/3 = small/medium/large presets; larger numbers = exact font size in px (emotes/badges scale along) |
| `alarms` | `true`/`false` | `false` | Animated alarm icons on highlighted rows (🚨 mention, 🆕 first-timer, 💜 channel points) |
| `alternate` | `true`/`false` | `false` | Alternating row shading |
| `font` | 0–11 | 0 | 0 BalooTammudu, 1 SegoeUI, 2 Roboto, 3 Lato, 4 NotoSans, 5 SourceCodePro, 6 Impact, 7 Comfortaa, 8 DancingScript, 9 IndieFlower, 10 PressStart2P, 11 Wallpoet |
| `custom_font` | any installed font name | — | Overrides `font` with a font from the viewer's PC |
| `emote_scale` | 0.5–3 | 1 | Multiplies emote size |
| `stroke` | 1–4 | off | Text outline (for overlay readability) |
| `shadow` | 1–3 | off | Text shadow |
| `animate` | `true`/`false` | `false` | Slide-in animation for new messages |
| `bots` | `true`/`false` | `false` | Show known bot messages (StreamElements, Nightbot, …) |
| `hide_commands` | `true`/`false` | `false` | Hide `!command` messages |
| `hide_badges` | `true`/`false` | `false` | Hide all badges |
| `fade` | seconds | off | Remove messages after N seconds |
| `small_caps` | `true`/`false` | `false` | Small caps text |
| `caps` | `true`/`false` | `false` | ALL CAPS messages |
| `nl` | `true`/`false` | `false` | Line break after the username |
| `hide_usernames` | `true`/`false` | `false` | Message text only |
| `block` | comma-separated names | — | Hide specific users |
| `demo` | `true`/`false` | `false` | Preview mode: canned messages, no IRC (used by setup.html) |

### OBS setup

- **Chat dock** (reading chat while streaming): Docks → Custom Browser Docks → add the URL with `&bg=dark`.
- **On-screen overlay**: Add a Browser source with the URL *without* `bg` (stays transparent), and `stroke`/`shadow` to taste.

Moderators or the broadcaster can type `!refreshoverlay` in chat to reload emotes after adding new ones.

## What works, what doesn't

| Feature | Status |
|---|---|
| 7TV / BTTV / FFZ emotes (global + channel), zero-width stacking | ✅ |
| Kick chat (emotes, badges, deletions/bans) merged with Twitch | ✅ |
| Multi-channel Twitch merge with per-message source chips | ✅ |
| Twitch Shared Chat: per-channel color-coding (colored pill + stripe) so communities are distinguishable | ✅ |
| Chat-mode notices (slow / emote-only / sub-only / followers-only toggles) | ✅ |
| Channel-point redemptions with reward name + cost (broadcaster only, via EventSub) | ✅ |
| Theme presets (bubbles, compact, right-aligned) | ✅ |
| Live emote updates & 7TV name paints/badges (7TV EventAPI) | ✅ |
| Twitch native emotes and badges (sub, mod, VIP, …) | ✅ (badges via IVR, degrade gracefully) |
| FFZ custom mod/VIP badges, FFZ:AP / BTTV / Chatterino user badges | ✅ |
| Sub / resub / gift / raid / announcement event lines | ✅ |
| First-time chatter, channel-point highlight & @mention row tinting | ✅ |
| Timestamps, clickable links, word filter, pronouns | ✅ (opt-in) |
| Emoji (Twemoji) | ✅ |
| Message deletion / bans reflected live | ✅ |
| Emote hover tooltip (name + provider + channel + enlarged preview) | ✅ |
| Reply threads ("Replying to @user: …") | ✅ |
| Channel-points redeemed-message notice | ✅ (generic — reward name/cost need the broadcaster's token) |
| Cheermote images | ❌ shows as text (needed retired Kraken API) |
| Message-less channel-point redemptions ("X redeemed Y") | ❌ not in IRC (needs broadcaster EventSub) |

## Mod tools & chat box (optional)

Add `mod=true` to a **docked** KeyChat URL and a "Log in with Twitch" button appears. After logging in (OAuth happens entirely in your browser — no server, the token never leaves your machine):

- Hover any Twitch message for 🗑 delete, ⏱ 10-minute timeout, 🔨 ban (timeout/ban need a second click within 3s to confirm)
- A chat box appears at the bottom so you can talk in your primary channel from the dock
- **Slash commands work** — `/ban`, `/unban`, `/timeout`, `/untimeout`, `/clear`, `/slow`, `/followers`, `/subscribers`, `/emoteonly`, `/uniquechat` (+ their `off` variants), `/vip`, `/unvip`, `/mod`, `/unmod`, `/announce`. Twitch removed commands from IRC in 2023, so KeyChat routes them through the Helix API. `/logout` re-signs-in (needed once to grant the mode/VIP/announce permissions).
- Actions work only in channels where your account actually has mod powers — Twitch enforces this server-side

Requires the hosted (https) version — OAuth can't redirect to `file://` pages. Self-hosting a fork? Register your own free app at [dev.twitch.tv/console/apps](https://dev.twitch.tv/console/apps) (Client Type: **Public**, redirect URL = your hosted `index.html`) and put its Client ID in `settings.js`.

## Hosting for friends

It's a static folder — host it anywhere:

- **GitHub Pages**: fork/push this folder, enable Pages, share `https://you.github.io/keychat/?channel=…`
- **Local**: send the folder; they use a `file:///` URL as above.

## License

GPL-3.0, same as jChat. See [LICENSE](LICENSE). Original work © giambaJ and jChat contributors; modernization changes © 2026 KeyChat contributors.
