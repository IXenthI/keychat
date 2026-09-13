(function($) { // Thanks to BrunoLM (https://stackoverflow.com/a/3855394)
    $.QueryString = (function(paramsArray) {
        let params = {};

        for (let i = 0; i < paramsArray.length; ++i) {
            let param = paramsArray[i]
                .split('=', 2);

            if (param.length !== 2)
                continue;

            params[param[0]] = decodeURIComponent(param[1].replace(/\+/g, " "));
        }

        return params;
    })(window.location.search.substr(1).split('&'))
})(jQuery);

Chat = {
    info: {
        channel: null,          // primary Twitch channel (first in the list), or null for Kick-only
        channels: [],           // all joined Twitch channels
        kickChannels: [],       // all joined Kick channels
        channelIDs: {},         // twitch login -> numeric room id (from ROOMSTATE)
        roomNames: {},          // twitch room id -> login (for Shared Chat labels)
        sharedActive: false,    // a Shared Chat session is in progress
        sharedColors: {},       // room id -> a consistent accent color per channel
        roomStates: {},         // twitch login -> last seen mode flags
        multiSource: false,     // more than one chat source -> show per-message source chips
        mentionName: null,
        channelID: null,        // primary channel's id (kept for back-compat)
        theme: ('theme' in $.QueryString ? $.QueryString.theme.toLowerCase() : false),
        avatars: ('avatars' in $.QueryString ? ($.QueryString.avatars.toLowerCase() === 'true') : false),
        alternate: ('alternate' in $.QueryString ? ($.QueryString.alternate.toLowerCase() === 'true') : false),
        alarms: ('alarms' in $.QueryString ? ($.QueryString.alarms.toLowerCase() === 'true') : false),
        modMode: ('mod' in $.QueryString ? ($.QueryString.mod.toLowerCase() === 'true') : false),
        // Dock mode: top-down scrollable chat like the real Twitch panel (mod tools imply it)
        dock: ('dock' in $.QueryString ? ($.QueryString.dock.toLowerCase() === 'true') : false) || ('mod' in $.QueryString && $.QueryString.mod.toLowerCase() === 'true'),
        userAvatars: {},
        animate: ('animate' in $.QueryString ? ($.QueryString.animate.toLowerCase() === 'true') : false),
        showBots: ('bots' in $.QueryString ? ($.QueryString.bots.toLowerCase() === 'true') : false),
        hideCommands: ('hide_commands' in $.QueryString ? ($.QueryString.hide_commands.toLowerCase() === 'true') : false),
        hideBadges: ('hide_badges' in $.QueryString ? ($.QueryString.hide_badges.toLowerCase() === 'true') : false),
        // Per-provider badge toggles (default on; emit *_badges=false to hide)
        twitchBadges: ('twitch_badges' in $.QueryString ? ($.QueryString.twitch_badges.toLowerCase() !== 'false') : true),
        bttvBadgesOn: ('bttv_badges' in $.QueryString ? ($.QueryString.bttv_badges.toLowerCase() !== 'false') : true),
        ffzBadgesOn: ('ffz_badges' in $.QueryString ? ($.QueryString.ffz_badges.toLowerCase() !== 'false') : true),
        chatterinoBadgesOn: ('chatterino_badges' in $.QueryString ? ($.QueryString.chatterino_badges.toLowerCase() !== 'false') : true),
        fade: ('fade' in $.QueryString ? parseInt($.QueryString.fade) : false),
        size: ('size' in $.QueryString ? parseInt($.QueryString.size) : 3),
        font: ('font' in $.QueryString ? parseInt($.QueryString.font) : 0),
        stroke: ('stroke' in $.QueryString ? parseInt($.QueryString.stroke) : false),
        shadow: ('shadow' in $.QueryString ? parseInt($.QueryString.shadow) : false),
        smallCaps: ('small_caps' in $.QueryString ? ($.QueryString.small_caps.toLowerCase() === 'true') : false),
        background: ('bg' in $.QueryString ? $.QueryString.bg : false),
        textColor: ('text' in $.QueryString ? $.QueryString.text : false),
        lightMode: false,
        customFont: ('custom_font' in $.QueryString ? $.QueryString.custom_font : false),
        emoteScale: ('emote_scale' in $.QueryString ? parseFloat($.QueryString.emote_scale) : false),
        caps: ('caps' in $.QueryString ? ($.QueryString.caps.toLowerCase() === 'true') : false),
        nlAfterName: ('nl' in $.QueryString ? ($.QueryString.nl.toLowerCase() === 'true') : false),
        hideUsernames: ('hide_usernames' in $.QueryString ? ($.QueryString.hide_usernames.toLowerCase() === 'true') : false),
        demo: ('demo' in $.QueryString ? ($.QueryString.demo.toLowerCase() === 'true') : false),
        events: ('events' in $.QueryString ? ($.QueryString.events.toLowerCase() === 'true') : true),
        highlights: ('highlights' in $.QueryString ? ($.QueryString.highlights.toLowerCase() === 'true') : true),
        mention: ('mention' in $.QueryString ? ($.QueryString.mention.toLowerCase() === 'true') : true),
        timestamps: ('timestamps' in $.QueryString ? ($.QueryString.timestamps.toLowerCase() === 'true') : false),
        links: ('links' in $.QueryString ? ($.QueryString.links.toLowerCase() === 'true') : false),
        pronouns: ('pronouns' in $.QueryString ? ($.QueryString.pronouns.toLowerCase() === 'true') : false),
        paints: ('paints' in $.QueryString ? ($.QueryString.paints.toLowerCase() === 'true') : true),
        filter: ('filter' in $.QueryString ? $.QueryString.filter.toLowerCase().split(',').filter(function(w) { return w.trim().length > 0; }) : false),
        seventvEmoteSetID: null,
        seventvEmoteSetIDs: {}, // twitch login -> 7TV emote set id
        seventvPaints: {},
        seventvBadgeDefs: {},
        seventvUserCosmetics: {},
        pronounsMap: null,
        userPronouns: {},
        emotes: {},
        badges: {},
        channelBadges: {},      // twitch login -> {set:version -> url}
        userBadges: {},
        ffzapBadges: null,
        bttvBadges: null,
        seventvBadges: null,
        chatterinoBadges: null,
        cheers: {},
        lines: [],
        blockedUsers: ('block' in $.QueryString ? $.QueryString.block.toLowerCase().split(',') : false),
        bots: ['streamelements', 'streamlabs', 'nightbot', 'moobot', 'fossabot']
    },

    // Global BTTV/FFZ/7TV sets — loaded once; channel sets merge in additively
    loadGlobalEmotes: function() {
        $.getJSON('https://api.betterttv.net/3/cached/frankerfacez/emotes/global').done(function(res) {
            res.forEach(function(e) { Chat.addFFZEmote(e, 'Global'); });
        });
        $.getJSON('https://api.betterttv.net/3/cached/emotes/global').done(function(res) {
            res.forEach(function(e) { Chat.addBTTVEmote(e, 'Global'); });
        });
        // 7TV v3 API (v2 was shut down)
        $.getJSON('https://7tv.io/v3/emote-sets/global').done(function(res) {
            (res.emotes || []).forEach(function(e) { Chat.addSevenTVEmote(e, 'Global'); });
        });
    },

    loadChannelEmotes: function(channelID, login) {
        $.getJSON('https://api.betterttv.net/3/cached/frankerfacez/users/twitch/' + encodeURIComponent(channelID)).done(function(res) {
            res.forEach(function(e) { Chat.addFFZEmote(e, login); });
        });
        $.getJSON('https://api.betterttv.net/3/cached/users/twitch/' + encodeURIComponent(channelID)).done(function(res) {
            if (!Array.isArray(res)) {
                res = res.channelEmotes.concat(res.sharedEmotes);
            }
            res.forEach(function(e) { Chat.addBTTVEmote(e, login); });
        });
        $.getJSON('https://7tv.io/v3/users/twitch/' + encodeURIComponent(channelID))
            .done(function(res) {
                if (res.emote_set) {
                    Chat.info.seventvEmoteSetIDs[login] = res.emote_set.id;
                    if (login === Chat.info.channel) Chat.info.seventvEmoteSetID = res.emote_set.id;
                    (res.emote_set.emotes || []).forEach(function(e) { Chat.addSevenTVEmote(e, login); });
                }
                Chat.startSevenTV();
                Chat.ensureSevenTVSubscriptions();
            })
            .fail(function() {
                Chat.startSevenTV();
            });
    },

    // Reload everything (mods' !refreshoverlay)
    refreshEmotes: function() {
        Chat.info.emotes = {};
        Chat.loadGlobalEmotes();
        Object.entries(Chat.info.channelIDs).forEach(function(pair) {
            Chat.loadChannelEmotes(pair[1], pair[0]);
        });
    },

    addFFZEmote: function(emote, origin) {
        if (emote.images['4x']) {
            var imageUrl = emote.images['4x'];
            var upscale = false;
        } else {
            var imageUrl = emote.images['2x'] || emote.images['1x'];
            var upscale = true;
        }
        Chat.info.emotes[emote.code] = {
            id: emote.id,
            image: imageUrl,
            upscale: upscale,
            provider: 'FFZ',
            origin: origin || 'Global'
        };
    },

    addBTTVEmote: function(emote, origin) {
        Chat.info.emotes[emote.code] = {
            id: emote.id,
            image: 'https://cdn.betterttv.net/emote/' + emote.id + '/3x',
            zeroWidth: ["5e76d338d6581c3724c0f0b2", "5e76d399d6581c3724c0f0b8", "567b5b520e984428652809b6", "5849c9a4f52be01a7ee5f79d", "567b5c080e984428652809ba", "567b5dc00e984428652809bd", "58487cc6f52be01a7ee5f205", "5849c9c8f52be01a7ee5f79e"].includes(emote.id), // cvHazmat, cvMask, SoSnowy, IceCold, CandyCane, ReinDeer, SantaHat, TopHat
            provider: 'BTTV',
            origin: origin || 'Global'
        };
    },

    addSevenTVEmote: function(emote, origin) {
        var host = emote.data && emote.data.host;
        if (!host || !host.url || typeof emote.name !== 'string') return;
        var base = host.url.indexOf('//') === 0 ? 'https:' + host.url : host.url;
        var files = (host.files || []).filter(function(f) { return f.format === 'WEBP' && typeof f.name === 'string'; });
        if (files.length === 0) return;
        var image = base + '/' + files[files.length - 1].name;
        // EventAPI payloads are untrusted network data: only clean https URLs become <img src>
        if (!/^https:\/\//.test(image) || /["'<>\s\\]/.test(image)) return;
        Chat.info.emotes[emote.name] = {
            id: emote.id,
            image: image,
            zeroWidth: !!((emote.flags & 1) || (emote.data.flags & 256)),
            provider: '7TV',
            origin: origin || Chat.info.channel || 'Channel'
        };
    },

    // 7TV EventAPI: live emote updates, name paints and 7TV badges (all joined channels)
    startSevenTV: function() {
        if (Chat.sevenTVStarted || Chat.info.demo) return;
        Chat.sevenTVStarted = true;
        Chat.sevenTVSubscribedSets = [];
        Chat.sevenTVSubscribedRooms = [];
        var connect = function() {
            var ws;
            try { ws = new WebSocket('wss://events.7tv.io/v3'); } catch (e) { return; }
            Chat.sevenTVSocket = ws;
            ws.onopen = function() {
                Chat.sevenTVSubscribedSets = [];
                Chat.sevenTVSubscribedRooms = [];
                Chat.ensureSevenTVSubscriptions();
            };
            ws.onmessage = function(e) {
                var msg;
                try { msg = JSON.parse(e.data); } catch (err) { return; }
                if (msg.op !== 0 || !msg.d || !msg.d.body) return;
                Chat.handleSevenTVEvent(msg.d.type, msg.d.body);
            };
            ws.onclose = function() { setTimeout(connect, 5000); };
        };
        connect();
    },

    // Subscribe any emote sets / channel rooms we know about but haven't subscribed yet.
    // Called on socket open, whenever a set id is (re)learned, and per new ROOMSTATE.
    ensureSevenTVSubscriptions: function() {
        var ws = Chat.sevenTVSocket;
        if (!ws || ws.readyState !== 1) return;
        var sub = function(type, condition) { ws.send(JSON.stringify({ op: 35, d: { type: type, condition: condition } })); };
        // Unsubscribe sets no longer active (streamer swapped sets + !refreshoverlay),
        // so edits to the abandoned set stop mutating our emote map
        var desired = Object.values(Chat.info.seventvEmoteSetIDs);
        Chat.sevenTVSubscribedSets.slice().forEach(function(setId) {
            if (desired.indexOf(setId) > -1) return;
            ws.send(JSON.stringify({ op: 36, d: { type: 'emote_set.update', condition: { object_id: setId } } }));
            Chat.sevenTVSubscribedSets.splice(Chat.sevenTVSubscribedSets.indexOf(setId), 1);
        });
        desired.forEach(function(setId) {
            if (Chat.sevenTVSubscribedSets.indexOf(setId) > -1) return;
            sub('emote_set.update', { object_id: setId });
            Chat.sevenTVSubscribedSets.push(setId);
        });
        if (Chat.info.paints) {
            Object.values(Chat.info.channelIDs).forEach(function(roomId) {
                if (Chat.sevenTVSubscribedRooms.indexOf(roomId) > -1) return;
                var cond = { ctx: 'channel', platform: 'TWITCH', id: String(roomId) };
                sub('cosmetic.create', cond);
                sub('entitlement.create', cond);
                Chat.sevenTVSubscribedRooms.push(roomId);
            });
        }
    },

    handleSevenTVEvent: function(type, body) {
        try {
            if (type === 'emote_set.update') {
                (body.pushed || []).forEach(function(c) {
                    if (c.key === 'emotes' && c.value) Chat.addSevenTVEmote(c.value);
                });
                (body.pulled || []).forEach(function(c) {
                    if (c.key === 'emotes' && c.old_value && c.old_value.name) delete Chat.info.emotes[c.old_value.name];
                });
                (body.updated || []).forEach(function(c) {
                    if (c.key !== 'emotes') return;
                    if (c.old_value && c.old_value.name) delete Chat.info.emotes[c.old_value.name];
                    if (c.value) Chat.addSevenTVEmote(c.value);
                });
                console.log('KeyChat: 7TV emotes updated live');
            } else if (type === 'cosmetic.create' && body.object) {
                var obj = body.object;
                if (obj.kind === 'PAINT' && obj.data) Chat.storeSevenTVPaint(obj.data.id || obj.id, obj.data);
                if (obj.kind === 'BADGE' && obj.data) {
                    var host = obj.data.host;
                    var burl = host && host.url ? (host.url.indexOf('//') === 0 ? 'https:' + host.url : host.url) + '/3x' : null;
                    if (burl) Chat.info.seventvBadgeDefs[obj.data.id || obj.id] = { tooltip: obj.data.tooltip || obj.data.name, url: burl };
                }
            } else if (type === 'entitlement.create' && body.object) {
                var ent = body.object;
                if (!ent.user || !ent.ref_id || (ent.kind !== 'PAINT' && ent.kind !== 'BADGE')) return;
                var conn = (ent.user.connections || []).filter(function(c) { return c.platform === 'TWITCH'; })[0];
                if (!conn) return;
                [String(conn.username || '').toLowerCase(), String(conn.id || '')].forEach(function(key) {
                    if (!key) return;
                    Chat.info.seventvUserCosmetics[key] = Chat.info.seventvUserCosmetics[key] || {};
                    Chat.info.seventvUserCosmetics[key][ent.kind] = ent.ref_id;
                });
            }
        } catch (e) { /* malformed event payloads must never kill the chat */ }
    },

    storeSevenTVPaint: function(id, p) {
        try {
            var toColor = function(c) {
                if (typeof c !== 'number' || !isFinite(c)) return null;
                c = c >>> 0;
                return 'rgba(' + ((c >>> 24) & 255) + ',' + ((c >>> 16) & 255) + ',' + ((c >>> 8) & 255) + ',' + (Math.round((c & 255) / 255 * 100) / 100) + ')';
            };
            var css = {};
            // Every stop must be fully valid — a single bad value would make the whole
            // gradient invalid CSS and leave the username transparent (invisible)
            var stopList = (p.stops || []).map(function(s) {
                var col = toColor(s && s.color);
                var at = Number(s && s.at);
                return (col !== null && isFinite(at)) ? col + ' ' + Math.round(at * 100) + '%' : null;
            });
            var stops = (stopList.length && stopList.indexOf(null) === -1) ? stopList.join(', ') : '';
            var angle = Number(p.angle);
            if (!isFinite(angle)) angle = 90;
            if (p.function === 'LINEAR_GRADIENT' && stops) css.image = (p.repeat ? 'repeating-' : '') + 'linear-gradient(' + angle + 'deg, ' + stops + ')';
            else if (p.function === 'RADIAL_GRADIENT' && stops) css.image = (p.repeat ? 'repeating-' : '') + 'radial-gradient(circle, ' + stops + ')';
            else if (p.function === 'URL' && typeof p.image_url === 'string' && /^https:\/\//.test(p.image_url) && !/["'<>\s\\)]/.test(p.image_url)) css.image = 'url("' + p.image_url + '")';
            else if (p.color !== null && p.color !== undefined) css.color = toColor(p.color);
            if (p.shadows && p.shadows.length) {
                var shadowList = p.shadows.map(function(s) {
                    var col = toColor(s && s.color);
                    var x = Number(s && s.x_offset), y = Number(s && s.y_offset), r = Number(s && s.radius);
                    return (col !== null && isFinite(x) && isFinite(y) && isFinite(r))
                        ? 'drop-shadow(' + x + 'px ' + y + 'px ' + r + 'px ' + col + ')' : null;
                });
                if (shadowList.length && shadowList.indexOf(null) === -1) css.filter = shadowList.join(' ');
            }
            if (css.image || css.color) Chat.info.seventvPaints[id] = css;
        } catch (e) { /* skip unparseable paints */ }
    },

    loadUserPronouns: function(nick) {
        Chat.info.userPronouns[nick] = true; // pending
        $.getJSON('https://api.pronouns.alejo.io/v1/users/' + encodeURIComponent(nick))
            .done(function(res) {
                var p = res && Chat.info.pronounsMap && Chat.info.pronounsMap[res.pronoun_id];
                var display = p ? (p.singular ? p.subject : p.subject + '/' + p.object) : false;
                Chat.info.userPronouns[nick] = display;
                // The fetch races the user's first message — patch already-rendered lines
                if (typeof display === 'string') {
                    $('.chat_line[data-nick="' + String(nick).replace(/["\\]/g, '') + '"] .user_info').each(function() {
                        if ($(this).find('.pronoun').length) return;
                        var $anchor = $(this).children('.badge').first();
                        if (!$anchor.length) $anchor = $(this).find('.nick');
                        $anchor.before($('<span></span>').addClass('pronoun').text(display));
                    });
                }
            })
            .fail(function() { Chat.info.userPronouns[nick] = false; });
    },

    // Everything that needs a channel's numeric ID, resolved from its IRC ROOMSTATE tag
    loadChannelData: function(channelID, login) {
        Chat.loadChannelEmotes(channelID, login);
        Chat.ensureSevenTVSubscriptions();

        // FFZ custom mod/VIP badge art: primary channel only (one badge slot each)
        if (login === Chat.info.channel) {
            $.getJSON('https://api.frankerfacez.com/v1/_room/id/' + encodeURIComponent(channelID)).done(function(res) {
                if (res.room.moderator_badge) {
                    Chat.info.badges['moderator:1'] = 'https://cdn.frankerfacez.com/room-badge/mod/' + Chat.info.channel + '/4/rounded';
                }
                if (res.room.vip_badge) {
                    Chat.info.badges['vip:1'] = 'https://cdn.frankerfacez.com/room-badge/vip/' + Chat.info.channel + '/4';
                }
            });
        }

        // Channel-point redemptions only reach us via EventSub, and Twitch only lets the
        // BROADCASTER read them (not mods). So start it when the logged-in user owns this channel.
        if (Chat.auth && Chat.info.events && String(channelID) === String(Chat.auth.userId)) {
            Chat.startEventSub(channelID);
        }
    },

    // EventSub over WebSocket (fully client-side) for channel-point redemptions
    startEventSub: function(broadcasterId) {
        if (Chat.eventSubStarted || !Chat.auth) return;
        Chat.eventSubStarted = true;
        var connect = function(url) {
            var ws;
            try { ws = new WebSocket(url || 'wss://eventsub.wss.twitch.tv/ws'); } catch (e) { return; }
            Chat.eventSubSocket = ws;
            ws.onmessage = function(e) {
                var msg;
                try { msg = JSON.parse(e.data); } catch (err) { return; }
                var meta = msg.metadata || {};
                if (meta.message_type === 'session_welcome') {
                    var sessionId = msg.payload.session.id;
                    Chat.helix('POST', 'eventsub/subscriptions', {
                        type: 'channel.channel_points_custom_reward_redemption.add',
                        version: '1',
                        condition: { broadcaster_user_id: String(broadcasterId) },
                        transport: { method: 'websocket', session_id: sessionId }
                    }).done(function() {
                        console.log('kChat: redemptions connected');
                    }).fail(function(xhr) {
                        if (xhr.status === 401 || xhr.status === 403) {
                            Chat.writeEvent('⚠️', 'Redemptions need a new permission — type /logout and sign in again', 'mode');
                        }
                    });
                } else if (meta.message_type === 'session_reconnect') {
                    connect(msg.payload.session.reconnect_url); // Twitch closes the old socket
                } else if (meta.message_type === 'notification' && meta.subscription_type === 'channel.channel_points_custom_reward_redemption.add') {
                    try { Chat.handleRedemption(msg.payload.event); } catch (err) {}
                }
            };
            ws.onclose = function() { if (Chat.eventSubSocket === ws) setTimeout(function() { connect(); }, 5000); };
        };
        connect();
    },

    handleRedemption: function(ev) {
        if (!ev || !ev.reward || !Chat.info.events) return;
        var cost = typeof ev.reward.cost === 'number' ? ev.reward.cost.toLocaleString() : ev.reward.cost;
        var text = (ev.user_name || ev.user_login || 'Someone') + ' redeemed ' + ev.reward.title + ' (' + cost + ')';
        if (ev.user_input) text += ': ' + ev.user_input;
        Chat.writeEvent('🔮', text, 'redeem');
    },

    loadUserAvatar: function(nick) {
        Chat.info.userAvatars[nick] = true; // pending
        $.getJSON('https://api.ivr.fi/v2/twitch/user?login=' + encodeURIComponent(nick))
            .done(function(res) {
                var logo = res && res[0] && res[0].logo;
                Chat.info.userAvatars[nick] = (typeof logo === 'string' && /^https:\/\//.test(logo) && !/["'<>\s\\]/.test(logo)) ? logo : false;
            })
            .fail(function() { Chat.info.userAvatars[nick] = false; });
    },

    load: function(callback) {
        // Background: ?bg=dark | ?bg=181818 (hex, no #). Default stays transparent for overlay use.
        var resolveColor = function(value, names) {
            if (!value) return null;
            value = value.toLowerCase();
            if (names[value]) return names[value];
            var hex = value.replace(/[^0-9a-f]/g, '');
            return (hex.length === 3 || hex.length === 6) ? '#' + hex : null;
        };
        var resolvedBg = resolveColor(Chat.info.background, { dark: '#18181b', twitch: '#18181b', black: '#000000', gray: '#2f2f35', grey: '#2f2f35', light: '#efeff1' });
        if (resolvedBg) {
            document.body.style.background = resolvedBg;
            Chat.info.lightMode = tinycolor(resolvedBg).isLight();
        }
        // Text color: ?text=dark | ?text=ffffff. Auto: dark text on light backgrounds.
        var resolvedText = resolveColor(Chat.info.textColor, { white: '#efeff1', black: '#0e0e10', dark: '#0e0e10', gray: '#adadb8', grey: '#adadb8' });
        if (!resolvedText && Chat.info.lightMode) resolvedText = '#0e0e10';

        if (Chat.info.dock) document.body.classList.add('dock');

        // Load CSS. Sizes 1-3 are the classic presets; 4+ is a custom pixel size,
        // scaled with the same ratios the presets use (line 1.55x, emotes 1.25x, badges 0.82x)
        var customSizeCSS = '';
        if (Chat.info.size >= 4) {
            var px = Math.min(Math.max(Math.round(Chat.info.size), 8), 72);
            var r = function(f) { return Math.round(px * f); };
            customSizeCSS =
                '#chat_container { font-size: ' + px + 'px; }\n' +
                '.chat_line { line-height: ' + r(1.55) + 'px; }\n' +
                '.badge { width: ' + r(0.82) + 'px; height: ' + r(0.82) + 'px; margin-right: 2px; margin-bottom: 3px; }\n' +
                '.badge:last-of-type { margin-right: ' + Math.max(r(0.15), 3) + 'px; }\n' +
                '.colon { margin-right: ' + r(0.4) + 'px; }\n' +
                '.cheer_bits { font-weight: 600; margin-left: 2px; margin-right: 4px; }\n' +
                '.cheer_emote { max-height: ' + r(1.25) + 'px; margin-bottom: -' + r(0.3) + 'px; }\n' +
                '.emote { max-width: ' + r(3.75) + 'px; max-height: ' + r(1.25) + 'px; margin-right: -2px; }\n' +
                '.upscale { height: ' + r(1.25) + 'px; }\n' +
                '.emoji { height: ' + r(1.1) + 'px; }\n';
        } else {
            appendCSS('size', sizes[Chat.info.size - 1] || 'large');
        }
        let font = fonts[Chat.info.font];
        appendCSS('font', font);

        if (Chat.info.stroke && Chat.info.stroke > 0) {
            let stroke = strokes[Chat.info.stroke - 1];
            appendCSS('stroke', stroke);
        }
        if (Chat.info.shadow && Chat.info.shadow > 0) {
            let shadow = shadows[Chat.info.shadow - 1];
            appendCSS('shadow', shadow);
        }
        if (Chat.info.smallCaps) {
            appendCSS('variant', 'SmallCaps');
        }

        var extraCSS = customSizeCSS;
        if (resolvedText) {
            extraCSS += '#chat_container { color: ' + resolvedText + '; }\n';
        }
        if (Chat.info.lightMode) {
            // The default accent styles assume a dark backdrop — flip them
            extraCSS += '.timestamp { color: rgba(0,0,0,.5); }\n' +
                '.pronoun { color: rgba(0,0,0,.7); background: rgba(0,0,0,.1); }\n' +
                '.chat_line.event_line .event_text { color: rgba(0,0,0,.75); }\n' +
                '.chat_line.event_line { background: rgba(0,0,0,.07); }\n' +
                '.source_shared { background: rgba(0,0,0,.12); color: rgba(0,0,0,.65); }\n' +
                '.source_twitch { background: rgba(145,71,255,.2); color: #6427c9; }\n' +
                '.source_kick { background: rgba(83,252,24,.25); color: #2e7d0f; }\n' +
                '.chat_line a { color: #4353c9; }\n';
        }
        if (Chat.info.customFont) {
            extraCSS += '.chat_line { font-family: "' + Chat.info.customFont.replace(/["<>]/g, '') + '", sans-serif !important; }\n';
        }
        if (Chat.info.emoteScale && Chat.info.emoteScale > 0) {
            extraCSS += 'img.emote, img.emoji, img.cheer_emote { zoom: ' + Chat.info.emoteScale + '; }\n';
        }
        if (Chat.info.caps) {
            extraCSS += '.message { text-transform: uppercase; }\n';
        }
        if (Chat.info.nlAfterName) {
            extraCSS += '.message { display: block; }\n';
        }
        if (Chat.info.hideUsernames) {
            extraCSS += '.nick, .colon { display: none; }\n';
        }
        var themes = {
            bubbles: '.chat_line { background: rgba(255,255,255,.08); border-radius: 14px; padding: 5px 12px; margin: 4px 0; width: fit-content; max-width: 95%; }\n',
            compact: '#chat_container { padding: 3px; }\n' +
                '.chat_line { margin: 0 !important; line-height: 1.15 !important; font-size: 0.72em; }\n' +
                'img.emote, img.emoji, img.cheer_emote { zoom: 0.6; }\n' +
                '.badge { width: 0.7em !important; height: 0.7em !important; margin-bottom: 1px !important; }\n' +
                '.avatar { height: 0.9em; width: 0.9em; }\n' +
                '.colon { margin-right: 0.3em !important; }\n' +
                '.chat_line.first_msg, .chat_line.highlighted, .chat_line.mentioned, .chat_line.event_line { padding: 0 4px; margin: 1px 0 !important; }\n',
            right: '.chat_line { text-align: right; } .chat_line.event_line { box-shadow: inset -3px 0 0 #b8b8be; }\n',
            // Near-native Twitch chat: Inter font, normal weight, bold names, tight
            // spacing, subtle row hover — but keeps all KeyChat features (7TV emotes etc.)
            twitch: '#chat_container { font-weight: 400; font-family: "Inter", "Segoe UI", Roboto, sans-serif; }\n' +
                '.chat_line { line-height: 1.4; padding: 5px 20px 5px 10px; }\n' +
                '.nick { font-weight: 700; }\n' +
                '.message, .event_text { font-weight: 400; }\n' +
                '.colon { margin-right: 0.15em !important; }\n' +
                'body.dock .chat_line:hover { background: rgba(255,255,255,0.055); }\n'
        };
        if (Chat.info.theme && themes[Chat.info.theme]) {
            extraCSS += themes[Chat.info.theme];
            if (Chat.info.theme === 'right') extraCSS += '.chat_line { margin-left: auto; }\n';
            if (Chat.info.theme === 'bubbles' && Chat.info.lightMode) extraCSS += '.chat_line { background: rgba(0,0,0,.07); }\n';
        }
        if (Chat.info.alternate) {
            var stripe = Chat.info.background === 'light' ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.06)';
            extraCSS += '.chat_line:nth-child(even):not(.first_msg):not(.highlighted):not(.mentioned):not(.event_line) { background: ' + stripe + '; border-radius: 4px; }\n';
        }
        if (extraCSS) {
            $('<style></style>').text(extraCSS).appendTo('head');
        }

        // Twitch badges via IVR (badges.twitch.tv and Kraken are gone; Helix needs auth).
        // Channel badges load after global so they override. Chat works fine if IVR is down.
        if (Chat.info.channels.length) {
            $.getJSON('https://api.ivr.fi/v2/twitch/badges/global')
                .done(function(global) {
                    global.forEach(set => {
                        set.versions.forEach(v => {
                            Chat.info.badges[set.set_id + ':' + v.id] = v.image_url_4x;
                        });
                    });
                    // Channel badge art (sub tiers, bits) differs per channel — keep separate maps
                    Chat.info.channels.forEach(function(login) {
                        $.getJSON('https://api.ivr.fi/v2/twitch/badges/channel?login=' + encodeURIComponent(login)).done(function(channel) {
                            Chat.info.channelBadges[login] = {};
                            channel.forEach(set => {
                                set.versions.forEach(v => {
                                    Chat.info.channelBadges[login][set.set_id + ':' + v.id] = v.image_url_4x;
                                });
                            });
                        });
                    });
                });
        }

        if (!Chat.info.hideBadges) {
            $.getJSON('https://api.ffzap.com/v1/supporters')
                .done(function(res) {
                    Chat.info.ffzapBadges = res;
                })
                .fail(function() {
                    Chat.info.ffzapBadges = [];
                });
            $.getJSON('https://api.betterttv.net/3/cached/badges')
                .done(function(res) {
                    Chat.info.bttvBadges = res;
                })
                .fail(function() {
                    Chat.info.bttvBadges = [];
                });

            // 7TV badges/paints moved to their EventAPI; REST endpoint is gone. TODO: EventAPI support.
            Chat.info.seventvBadges = [];

            $.getJSON('https://api.chatterino.com/badges')
                .done(function(res) {
                    Chat.info.chatterinoBadges = res.badges;
                })
                .fail(function() {
                    Chat.info.chatterinoBadges = [];
                });
        }

        // Cheermotes needed the Kraken API; without auth there is no public source, so
        // bits messages simply render as text. Chat.info.cheers stays empty.

        if (Chat.info.pronouns) {
            $.getJSON('https://api.pronouns.alejo.io/v1/pronouns')
                .done(function(res) { Chat.info.pronounsMap = res; })
                .fail(function() { Chat.info.pronounsMap = {}; });
        }

        callback(true);
    },

    update: setInterval(function() {
        if (Chat.info.lines.length > 0) {
            var lines = Chat.info.lines.join('');
            var container = document.getElementById('chat_container');

            if (Chat.info.dock) {
                // Dock: normal top-down flow, scrollable. Only auto-scroll to the newest
                // message if the viewer was already at the bottom — otherwise leave them
                // where they scrolled so they can read history (exactly like Twitch chat).
                var atBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 40;
                $(container).append(lines);
                Chat.info.lines = [];
                if (atBottom) {
                    // Pruning from the top only while pinned to the bottom — trimming
                    // above the viewport would jump the view while reading history
                    var over = $('.chat_line').length - 300;
                    while (over > 0) { $('.chat_line').eq(0).remove(); over--; }
                    container.scrollTop = container.scrollHeight;
                } else {
                    // Scrolled up: hold pruning, but cap runaway growth
                    var hardOver = $('.chat_line').length - 1000;
                    while (hardOver > 0) { $('.chat_line').eq(0).remove(); hardOver--; }
                }
            } else if (Chat.info.animate) {
                var $auxDiv = $('<div></div>', { class: "hidden" }).appendTo("#chat_container");
                $auxDiv.append(lines);
                var auxHeight = $auxDiv.height();
                $auxDiv.remove();

                var $animDiv = $('<div></div>');
                $('#chat_container').append($animDiv);
                $animDiv.animate({ "height": auxHeight }, 150, function() {
                    $(this).remove();
                    $('#chat_container').append(lines);
                });
                Chat.info.lines = [];
                var linesToDelete = $('.chat_line').length - 100;
                while (linesToDelete > 0) { $('.chat_line').eq(0).remove(); linesToDelete--; }
            } else {
                $('#chat_container').append(lines);
                Chat.info.lines = [];
                var toDel = $('.chat_line').length - 100;
                while (toDel > 0) { $('.chat_line').eq(0).remove(); toDel--; }
            }
        } else if (Chat.info.fade && !Chat.info.dock) {
            var messageTime = $('.chat_line').eq(0).data('time');
            if ((Date.now() - messageTime) / 1000 >= Chat.info.fade) {
                $('.chat_line').eq(0).fadeOut(function() {
                    $(this).remove();
                });
            }
        }
    }, 200),

    loadUserBadges: function(nick, userId) {
        Chat.info.userBadges[nick] = [];
        $.getJSON('https://api.frankerfacez.com/v1/user/' + nick).always(function(res) {
            if (res.badges) {
                Object.entries(res.badges).forEach(badge => {
                    var userBadge = {
                        description: badge[1].title,
                        url: 'https:' + badge[1].urls['4'],
                        color: badge[1].color,
                        provider: 'FFZ'
                    };
                    if (!Chat.info.userBadges[nick].includes(userBadge)) Chat.info.userBadges[nick].push(userBadge);
                });
            }
            Chat.info.ffzapBadges.forEach(user => {
                if (user.id.toString() === userId) {
                    var color = '#755000';
                    if (user.tier == 2) color = (user.badge_color || '#755000');
                    else if (user.tier == 3) {
                        if (user.badge_is_colored == 0) color = (user.badge_color || '#755000');
                        else color = false;
                    }
                    var userBadge = {
                        description: 'FFZ:AP Badge',
                        url: 'https://api.ffzap.com/v1/user/badge/' + userId + '/3',
                        color: color,
                        provider: 'FFZ'
                    };
                    if (!Chat.info.userBadges[nick].includes(userBadge)) Chat.info.userBadges[nick].push(userBadge);
                }
            });
            Chat.info.bttvBadges.forEach(user => {
                if (user.name === nick) {
                    var userBadge = {
                        description: user.badge.description,
                        url: user.badge.svg,
                        provider: 'BTTV'
                    };
                    if (!Chat.info.userBadges[nick].includes(userBadge)) Chat.info.userBadges[nick].push(userBadge);
                }
            });
            Chat.info.seventvBadges.forEach(badge => {
                badge.users.forEach(user => {
                    if (user === nick) {
                        var userBadge = {
                            description: badge.tooltip,
                            url: badge.urls[2][1]
                        };
                        if (!Chat.info.userBadges[nick].includes(userBadge)) Chat.info.userBadges[nick].push(userBadge);
                    }
                });
            });
            Chat.info.chatterinoBadges.forEach(badge => {
                badge.users.forEach(user => {
                    if (user === userId) {
                        var userBadge = {
                            description: badge.tooltip,
                            url: badge.image3 || badge.image2 || badge.image1,
                            provider: 'Chatterino'
                        };
                        if (!Chat.info.userBadges[nick].includes(userBadge)) Chat.info.userBadges[nick].push(userBadge);
                    }
                });
            });
        });
    },

    write: function(nick, info, message, source) {
        if (info) {
            source = source || { platform: 'twitch', channel: Chat.info.channel };
            var isKick = source.platform === 'kick';
            var $chatLine = $('<div></div>');
            $chatLine.addClass('chat_line');
            $chatLine.attr('data-nick', nick);
            $chatLine.attr('data-time', Date.now());
            $chatLine.attr('data-id', info.id);
            $chatLine.attr('data-source', (isKick ? 'kick:' : 'twitch:') + (source.channel || ''));
            if (Chat.info.highlights) {
                if (info['first-msg'] === '1') $chatLine.addClass('first_msg');
                if (info['msg-id'] === 'highlighted-message') $chatLine.addClass('highlighted');
            }
            if (Chat.info.mention && Chat.info.mentionName && message.toLowerCase().indexOf('@' + Chat.info.mentionName) > -1) {
                $chatLine.addClass('mentioned');
            }
            if (Chat.info.alarms) {
                var alarmIcon = $chatLine.hasClass('mentioned') ? '🚨' : ($chatLine.hasClass('first_msg') ? '🆕' : ($chatLine.hasClass('highlighted') ? '💜' : null));
                if (alarmIcon) $chatLine.append($('<span></span>').addClass('alarm').text(alarmIcon));
            }
            // Channel-points redemptions that carry a message arrive via IRC with a
            // custom-reward-id tag (or msg-id=highlighted-message for "Highlight My Message").
            // The reward name/cost need the broadcaster's own token, so we show a generic tag.
            if (!isKick) {
                if (typeof info['custom-reward-id'] === 'string' && info['custom-reward-id']) {
                    $chatLine.addClass('redeemed');
                    Chat.info.lines.push($('<div></div>').addClass('chat_line redeem_line')
                        .attr('data-time', Date.now())
                        .append($('<span></span>').addClass('redeem_icon').text('🎁'))
                        .append($('<span></span>').addClass('redeem_text').text(' Redeemed a channel-points reward'))
                        .wrap('<div>').parent().html());
                } else if (info['msg-id'] === 'highlighted-message') {
                    Chat.info.lines.push($('<div></div>').addClass('chat_line redeem_line')
                        .attr('data-time', Date.now())
                        .append($('<span></span>').addClass('redeem_icon').text('✨'))
                        .append($('<span></span>').addClass('redeem_text').text(' Redeemed Highlight My Message'))
                        .wrap('<div>').parent().html());
                }
            }
            // Reply threads: Twitch delivers the parent message in IRC tags. Show a
            // greyed "Replying to @user: preview" line above, like the Twitch client.
            if (!isKick && typeof info['reply-parent-user-login'] === 'string' && info['reply-parent-user-login']) {
                var parentName = (typeof info['reply-parent-display-name'] === 'string' && info['reply-parent-display-name']) || info['reply-parent-user-login'];
                var parentBody = typeof info['reply-parent-msg-body'] === 'string' ? info['reply-parent-msg-body'] : '';
                if (parentBody.length > 60) parentBody = parentBody.slice(0, 60) + '…';
                $chatLine.append($('<div></div>').addClass('reply_context')
                    .append($('<span></span>').addClass('reply_icon').text('💬 '))
                    .append($('<span></span>').addClass('reply_to').text('Replying to @' + parentName + ': '))
                    .append($('<span></span>').addClass('reply_body').text(parentBody)));
            }
            var $userInfo = $('<span></span>');
            $userInfo.addClass('user_info');
            if (Chat.info.timestamps) {
                var now = new Date();
                $userInfo.append($('<span></span>').addClass('timestamp')
                    .text(('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2)));
            }
            // Mod action icons go right after the timestamp, always visible, like Twitch's
            // mod view. Ban / Timeout / Delete order. Only for logged-in mods on Twitch lines.
            // Twitch forbids moderating the broadcaster or a fellow mod (only the broadcaster
            // can action their own mods) — so don't offer buttons that can only 404/400.
            if (Chat.info.modMode && Chat.auth && !isKick) {
                var tBadges = typeof info.badges === 'string' ? info.badges : '';
                var targetIsBroadcaster = /(^|,)broadcaster\//.test(tBadges) || nick === source.channel;
                var targetIsMod = /(^|,)moderator\//.test(tBadges);
                var iAmBroadcaster = Chat.info.channelIDs[source.channel] === Chat.auth.userId;
                var iAmThem = info['user-id'] === Chat.auth.userId;
                var canModerate = !iAmThem && !targetIsBroadcaster && (!targetIsMod || iAmBroadcaster);
                if (canModerate) {
                    $chatLine.attr('data-userid', info['user-id'] || '');
                    var $tools = $('<span></span>').addClass('mod_tools');
                    [['ban', '🔨', 'Ban (click twice)'], ['timeout', '⏱', 'Timeout 10m (click twice)'], ['delete', '🗑', 'Delete message']].forEach(function(b) {
                        $tools.append($('<button></button>').attr('data-act', b[0]).attr('title', b[2]).text(b[1]));
                    });
                    $userInfo.append($tools);
                }
            }
            if (Chat.info.multiSource) {
                $userInfo.append($('<span></span>')
                    .addClass('source_tag ' + (isKick ? 'source_kick' : 'source_twitch'))
                    .text(source.channel || (isKick ? 'kick' : 'twitch')));
            }
            // Shared Chat (Twitch collab): only mark messages relayed IN from ANOTHER
            // channel — a colored pill naming that channel + matching left stripe, one
            // consistent color per channel. Your own channel's messages stay normal, so
            // the incoming ones stand out instead of your own name repeating on every line.
            if (!isKick) {
                var localRoom = Chat.info.channelIDs[source.channel];
                var srcRoom = info['source-room-id'];
                if (typeof srcRoom === 'string' && srcRoom && localRoom && srcRoom !== localRoom) {
                    var col = Chat.sharedColor(srcRoom);
                    $chatLine.addClass('shared_msg').css('box-shadow', 'inset 4px 0 0 ' + col);
                    $userInfo.append($('<span></span>').addClass('source_tag source_shared')
                        .attr('data-room', String(srcRoom).replace(/[^0-9]/g, ''))
                        .css({ 'background': col, 'color': '#0e0e10' }).text(Chat.info.roomNames[srcRoom] || '…'));
                    if (Chat.info.roomNames[srcRoom] === undefined) Chat.resolveRoomName(srcRoom);
                }
            }
            if (Chat.info.avatars && (!isKick || Chat.info.demo)) {
                var avatar = Chat.info.userAvatars[nick];
                if (typeof avatar === 'string') $userInfo.append($('<img/>').addClass('avatar').attr('src', avatar));
            }
            if (Chat.info.pronouns && !isKick) {
                var pronoun = Chat.info.userPronouns[nick];
                if (typeof pronoun === 'string') $userInfo.append($('<span></span>').addClass('pronoun').text(pronoun));
            }
            // Kick badges arrive as typed labels, not image URLs — render as colored chips
            if (isKick && !Chat.info.hideBadges && Array.isArray(info.kickBadges)) {
                var kickBadgeStyles = { broadcaster: ['B', '#e9113c'], moderator: ['M', '#00c7ac'], vip: ['V', '#ff9d00'], og: ['OG', '#ffc700'], founder: ['F', '#ff5c00'], verified: ['✓', '#1e90ff'], subscriber: ['S', '#9147ff'], sub_gifter: ['G', '#53fc18'], staff: ['ST', '#53fc18'] };
                info.kickBadges.forEach(function(b) {
                    var style = b && kickBadgeStyles[b.type];
                    if (!style) return;
                    $userInfo.append($('<span></span>').addClass('kick_badge').css('background-color', style[1])
                        .attr('title', b.text || b.type).text(style[0]));
                });
            }

            // Writing badges (badges/emotes tags are often present but empty — '' must skip).
            // Channel-specific art (sub tiers, bits) comes from the message's source channel.
            var badgeUrl = function(key) {
                var perChannel = Chat.info.channelBadges[source.channel];
                return (perChannel && perChannel[key]) || Chat.info.badges[key];
            };
            // Per-provider gating. hide_badges (master) hides all third-party user
            // badges but keeps Twitch native ones — the original behavior; the
            // per-provider flags refine it further.
            var showUserBadge = function(b) {
                if (Chat.info.hideBadges) return false;
                if (b.provider === 'FFZ') return Chat.info.ffzBadgesOn;
                if (b.provider === 'BTTV') return Chat.info.bttvBadgesOn;
                if (b.provider === 'Chatterino') return Chat.info.chatterinoBadgesOn;
                return true;
            };
            var badges = [];
            const priorityBadges = ['predictions', 'admin', 'global_mod', 'staff', 'twitchbot', 'broadcaster', 'moderator', 'vip'];
            if (!isKick && Chat.info.twitchBadges && typeof(info.badges) === 'string' && info.badges) {
                info.badges.split(',').forEach(badge => {
                    badge = badge.split('/');
                    var priority = (priorityBadges.includes(badge[0]) ? true : false);
                    badges.push({
                        description: badge[0],
                        url: badgeUrl(badge[0] + ':' + badge[1]),
                        priority: priority
                    });
                });
            }
            var $modBadge;
            badges.forEach(badge => {
                if (badge.priority) {
                    var $badge = $('<img/>');
                    $badge.addClass('badge');
                    $badge.attr('src', badge.url);
                    if (badge.description === 'moderator') $modBadge = $badge;
                    $userInfo.append($badge);
                }
            });
            if (Chat.info.userBadges[nick]) {
                Chat.info.userBadges[nick].forEach(badge => {
                    if (!showUserBadge(badge)) return;
                    var $badge = $('<img/>');
                    $badge.addClass('badge');
                    if (badge.color) $badge.css('background-color', badge.color);
                    if (badge.description === 'Bot' && info.mod === '1') {
                        $badge.css('background-color', 'rgb(0, 173, 3)');
                        if ($modBadge) $modBadge.remove();
                    }
                    $badge.attr('src', badge.url);
                    $userInfo.append($badge);
                });
            }
            badges.forEach(badge => {
                if (!badge.priority) {
                    var $badge = $('<img/>');
                    $badge.addClass('badge');
                    $badge.attr('src', badge.url);
                    $userInfo.append($badge);
                }
            });

            // Writing username
            var $username = $('<span></span>');
            $username.addClass('nick');
            if (typeof(info.color) === 'string') {
                // Nudge unreadable name colors toward the visible range for the backdrop
                if (Chat.info.lightMode) {
                    if (tinycolor(info.color).getBrightness() >= 175) var color = tinycolor(info.color).darken(30);
                    else var color = info.color;
                } else if (tinycolor(info.color).getBrightness() <= 50) {
                    var color = tinycolor(info.color).lighten(30);
                } else var color = info.color;
            } else {
                const twitchColors = ["#FF0000", "#0000FF", "#008000", "#B22222", "#FF7F50", "#9ACD32", "#FF4500", "#2E8B57", "#DAA520", "#D2691E", "#5F9EA0", "#1E90FF", "#FF69B4", "#8A2BE2", "#00FF7F"];
                var color = twitchColors[nick.charCodeAt(0) % 15];
            }
            $username.css('color', color);
            $username.text(typeof info['display-name'] === 'string' && info['display-name'] ? info['display-name'] : nick);

            // 7TV cosmetics (paint + badge) from the EventAPI, keyed by login or user id
            if (Chat.info.paints && !isKick) {
                var cosmetics = Chat.info.seventvUserCosmetics[nick] || Chat.info.seventvUserCosmetics[info['user-id']];
                if (cosmetics) {
                    var paint = cosmetics.PAINT && Chat.info.seventvPaints[cosmetics.PAINT];
                    if (paint) {
                        if (paint.image) {
                            $username.css('background-image', paint.image);
                            // Only hide the base color once the browser accepted the
                            // gradient — otherwise the name would turn invisible
                            if ($username[0].style.backgroundImage) {
                                $username.css({ 'background-size': 'cover', '-webkit-background-clip': 'text', 'background-clip': 'text', 'color': 'transparent' });
                            }
                        } else if (paint.color) $username.css('color', paint.color);
                        if (paint.filter) $username.css('filter', paint.filter);
                    }
                    var stvBadge = cosmetics.BADGE && Chat.info.seventvBadgeDefs[cosmetics.BADGE];
                    if (stvBadge && !Chat.info.hideBadges) {
                        $userInfo.append($('<img/>').addClass('badge').attr('src', stvBadge.url).attr('title', stvBadge.tooltip || ''));
                    }
                }
            }
            $userInfo.append($username);

            // Writing message
            var $message = $('<span></span>');
            $message.addClass('message');
            if (/^\x01ACTION.*\x01$/.test(message)) {
                $message.css('color', color);
                message = message.replace(/^\x01ACTION/, '').replace(/\x01$/, '').trim();
                $userInfo.append('<span>&nbsp;</span>');
            } else {
                $userInfo.append('<span class="colon">:</span>');
            }
            $chatLine.append($userInfo);

            // Replacing emotes and cheers
            var replacements = {};
            if (typeof(info.emotes) === 'string' && info.emotes) {
                info.emotes.split('/').forEach(emoteData => {
                    var twitchEmote = emoteData.split(':');
                    var indexes = twitchEmote[1].split(',')[0].split('-');
                    var emojis = new RegExp('[က-￿]+', 'g');
                    var aux = message.replace(emojis, ' ');
                    var emoteCode = aux.substr(indexes[0], indexes[1] - indexes[0] + 1);
                    replacements[emoteCode] = '<img class="emote" data-name="' + escapeAttr(emoteCode) + '" data-prov="Twitch" src="https://static-cdn.jtvnw.net/emoticons/v2/' + escapeAttr(twitchEmote[0]) + '/default/dark/3.0" />';
                });
            }

            Object.entries(Chat.info.emotes).forEach(emote => {
                if (message.search(escapeRegExp(emote[0])) > -1) {
                    // data-* attributes drive the hover tooltip (name / provider / origin)
                    var tip = ' data-name="' + escapeAttr(emote[0]) + '" data-prov="' + escapeAttr(emote[1].provider || '') + '" data-origin="' + escapeAttr(emote[1].origin || '') + '"';
                    if (emote[1].upscale) replacements[emote[0]] = '<img class="emote upscale"' + tip + ' src="' + escapeAttr(emote[1].image) + '" />';
                    else if (emote[1].zeroWidth) replacements[emote[0]] = '<img class="emote" data-zw="true"' + tip + ' src="' + escapeAttr(emote[1].image) + '" />';
                    else replacements[emote[0]] = '<img class="emote"' + tip + ' src="' + escapeAttr(emote[1].image) + '" />';
                }
            });

            message = escapeHtml(message);

            if (Chat.info.links) {
                // Non-ASCII excluded: twemoji later string-replaces emoji even inside
                // attribute values, which would corrupt an href containing one
                message = message.replace(/(https?:\/\/[^\s<>"'\u0080-\uFFFF]+)/gi, function(url) {
                    return '<a href="' + url + '" target="_blank" rel="noopener noreferrer">' + url + '</a>';
                });
            }

            // Kick emotes arrive inline as [emote:id:name] tokens (id digits only -> safe in src).
            // Must run AFTER linkify, which would otherwise wrap the injected src URL in an anchor.
            if (isKick) {
                message = message.replace(/\[emote:(\d+):([^\]]*)\]/g, function(m, emoteId, emoteName) {
                    return '<img class="emote" data-name="' + escapeAttr(emoteName) + '" data-prov="Kick" data-origin="' + escapeAttr(source.channel || '') + '" src="https://files.kick.com/emotes/' + emoteId + '/fullsize" />';
                });
            }

            if (info.bits && parseInt(info.bits) > 0) {
                var bits = parseInt(info.bits);
                var parsed = false;
                for (cheerType of Object.entries(Chat.info.cheers)) {
                    var regex = new RegExp(cheerType[0] + "\\d+\\s*", 'ig');
                    if (message.search(regex) > -1) {
                        message = message.replace(regex, '');

                        if (!parsed) {
                            var closest = 1;
                            for (cheerTier of Object.keys(cheerType[1]).map(Number).sort((a, b) => a - b)) {
                                if (bits >= cheerTier) closest = cheerTier;
                                else break;
                            }
                            message = '<img class="cheer_emote" src="' + escapeAttr(cheerType[1][closest].image) + '" /><span class="cheer_bits" style="color: ' + escapeAttr(cheerType[1][closest].color) + ';">' + bits + '</span> ' + message;
                            parsed = true;
                        }
                    }
                }
            }

            var replacementKeys = Object.keys(replacements);
            replacementKeys.sort(function(a, b) {
                return b.length - a.length;
            });

            replacementKeys.forEach(replacementKey => {
                var regex = new RegExp("(?<!\\S)(" + escapeRegExp(replacementKey) + ")(?!\\S)", 'g');
                message = message.replace(regex, replacements[replacementKey]);
            });

            message = twemoji.parse(message);
            $message.html(message);

            // Writing zero-width emotes
            messageNodes = $message.children();
            messageNodes.each(function(i) {
                if (i != 0 && $(this).data('zw') && ($(messageNodes[i - 1]).hasClass('emote') || $(messageNodes[i - 1]).hasClass('emoji')) && !$(messageNodes[i - 1]).data('zw')) {
                    var $container = $('<span></span>');
                    $container.addClass('zero-width_container');
                    $(this).addClass('zero-width');
                    $(this).before($container);
                    $container.append(messageNodes[i - 1], this);
                }
            });
            $message.html($message.html().trim());
            $chatLine.append($message);

            Chat.info.lines.push($chatLine.wrap('<div>').parent().html());
        }
    },

    // Moderation gates shared by PRIVMSG and USERNOTICE shared messages
    passesFilters: function(nick, text) {
        if (Chat.info.hideCommands && /^!.+/.test(text)) return false;
        if (!Chat.info.showBots && Chat.info.bots.includes(nick)) return false;
        if (Chat.info.blockedUsers && Chat.info.blockedUsers.includes(nick)) return false;
        if (Chat.info.filter) {
            var lower = text.toLowerCase();
            if (Chat.info.filter.some(function(w) { return lower.indexOf(w.trim()) > -1; })) return false;
        }
        return true;
    },

    // Styled inline line for subs, raids, announcements, etc.
    writeEvent: function(icon, text, kind) {
        if (!text) return;
        var $line = $('<div></div>').addClass('chat_line event_line event_' + kind).attr('data-time', Date.now());
        var $icon = $('<span></span>').addClass('event_icon').text(icon);
        // The redemption crystal ball floats/pulses when animated icons (alarms) are on
        if (kind === 'redeem' && Chat.info.alarms) $icon.addClass('orb_anim');
        $line.append($icon);
        $line.append($('<span></span>').addClass('event_text').text(' ' + text));
        Chat.info.lines.push($line.wrap('<div>').parent().html());
    },

    // Remove a user's lines, scoped to one channel/platform so a timeout in channel A
    // doesn't erase the same user's (or a same-named Kick user's) messages elsewhere
    clearChat: function(nick, sourceKey) {
        setTimeout(function() {
            var sel = '.chat_line[data-nick="' + String(nick).replace(/["\\]/g, '') + '"]';
            if (sourceKey) sel += '[data-source="' + String(sourceKey).replace(/["\\]/g, '') + '"]';
            $(sel).remove();
        }, 200);
    },

    clearMessage: function(id) {
        setTimeout(function() {
            $('.chat_line[data-id=' + id + ']').remove();
        }, 200);
    },

    // Preview mode for the setup page: no IRC, canned messages using real global emotes
    demo: function() {
        $(document).prop('title', 'KeyChat • preview');
        Chat.info.channel = 'demo';
        Chat.info.channels = ['demo'];
        Chat.info.mentionName = 'demo';
        // Show source chips in the preview when the configured setup is multi-source
        Chat.info.multiSource = ('kick' in $.QueryString && $.QueryString.kick.length > 0) || ($.QueryString.channel || '').indexOf(',') > -1;
        // Fake room ids so the preview can demonstrate Shared Chat color-coding
        Chat.info.channelIDs['demo'] = '1';
        Chat.info.roomNames = { '1': 'demo', '2': 'AllyStreamer', '3': 'CoStreamer' };
        Chat.load(function() {
            Chat.loadGlobalEmotes();
            Chat.setupEmoteTooltips();
            var users = [
                ['PixelPal', '#FF69B4'],
                ['StreamFan42', '#1E90FF'],
                ['ModestMod', '#2E8B57', 'moderator/1'],
                ['EmoteEnjoyer', '#DAA520'],
                ['LurkerLarry', '#8A2BE2']
            ];
            // Demo accounts are fake, so real per-user data (pronouns, avatars, third-party
            // badges, 7TV cosmetics) can't be fetched — fake it all so the preview actually
            // demonstrates every toggle and responds to it.
            var demoPronouns = { pixelpal: 'She/Her', streamfan42: 'He/Him', modestmod: 'They/Them', emoteenjoyer: 'It/Its', lurkerlarry: 'Any' };
            var svgAsset = function(inner, size) {
                return 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '">' + inner + '</svg>');
            };
            var makeAvatar = function(letter, color) {
                return svgAsset('<circle cx="16" cy="16" r="16" fill="' + color + '"/><text x="16" y="22" font-size="17" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">' + letter + '</text>', 32);
            };
            var makeBadge = function(letter, color) {
                return svgAsset('<rect width="18" height="18" rx="4" fill="' + color + '"/><text x="9" y="13.5" font-size="11" font-family="sans-serif" font-weight="bold" fill="#fff" text-anchor="middle">' + letter + '</text>', 18);
            };
            // Provider brand colors: BTTV red, FFZ slate, Chatterino teal, 7TV neutral
            var demoBadges = {
                pixelpal: [{ description: 'BTTV Pro', url: makeBadge('B', '#d50014'), provider: 'BTTV' }],
                streamfan42: [{ description: 'FFZ Supporter', url: makeBadge('F', '#5b6d7d'), provider: 'FFZ' }],
                modestmod: [{ description: 'Chatterino', url: makeBadge('C', '#1db3ba'), provider: 'Chatterino' }],
                emoteenjoyer: [{ description: 'BTTV', url: makeBadge('B', '#d50014'), provider: 'BTTV' }, { description: 'FFZ', url: makeBadge('F', '#5b6d7d'), provider: 'FFZ' }],
                lurkerlarry: [{ description: 'Chatterino', url: makeBadge('C', '#1db3ba'), provider: 'Chatterino' }]
            };
            users.forEach(function(u) {
                var key = u[0].toLowerCase();
                Chat.info.userPronouns[key] = demoPronouns[key] || false;
                Chat.info.userAvatars[key] = makeAvatar(u[0].charAt(0), u[1]);
                Chat.info.userBadges[key] = demoBadges[key] || [];
            });
            // A fake 7TV name paint and 7TV badge for the "7TV paints & badges" toggle
            Chat.info.seventvUserCosmetics['pixelpal'] = { PAINT: 'demopaint' };
            Chat.info.seventvPaints['demopaint'] = { image: 'linear-gradient(92deg, #ff6ac1 0%, #ffd86b 100%)' };
            Chat.info.seventvUserCosmetics['streamfan42'] = { BADGE: 'demo7tv' };
            Chat.info.seventvBadgeDefs['demo7tv'] = { tooltip: '7TV Subscriber', url: makeBadge('7', '#2c2c34') };
            var lines = [
                'welcome to the KeyChat preview {e}',
                'this is what your chat will look like {e} {e}',
                'these are global emotes — your channel 7TV/BTTV/FFZ emotes load on the real page too',
                'GG {e}',
                'nice {e} 🎉'
            ];
            var i = 0;
            setTimeout(function tick() {
                var u = users[i % users.length];
                var msg = lines[i % lines.length].replace(/\{e\}/g, function() {
                    var keys = Object.keys(Chat.info.emotes);
                    return keys.length ? keys[Math.floor(Math.random() * keys.length)] : '👍';
                });
                var tags = { id: 'demo-' + i, color: u[1], 'display-name': u[0], badges: u[2] };
                if (i % lines.length === 3) tags['first-msg'] = '1';
                if (i % lines.length === 4) msg = '@demo ' + msg;
                Chat.write(u[0].toLowerCase(), tags, msg);
                if (i === 2) Chat.writeEvent('⭐', 'StreamFan42 subscribed at Tier 1. They\'ve subscribed for 3 months!', 'resub');
                if (i === 4) Chat.writeEvent('🎉', '12 raiders from PixelPal have joined!', 'raid');
                if (i === 6) Chat.writeEvent('🐌', 'Slow mode: 10s', 'mode');
                if (i === 8) Chat.writeEvent('🔮', 'Dessieed redeemed Hero Request (5,000)', 'redeem');
                // Shared Chat demo: messages relayed from two other channels, color-coded
                if (i === 9) Chat.write('allyfan', { id: 'demo-s1', color: '#00c8af', 'display-name': 'AllyFan', 'source-room-id': '2' }, 'hi from the other stream! {e}'.replace('{e}', (Object.keys(Chat.info.emotes)[0] || '👋')), { platform: 'twitch', channel: 'demo' });
                if (i === 10) Chat.write('cofan22', { id: 'demo-s2', color: '#ff6ac1', 'display-name': 'CoFan22', 'source-room-id': '3' }, 'shared chat gang', { platform: 'twitch', channel: 'demo' });
                if (i === 5) Chat.write('replyfan', { id: 'demo-r' + i, color: '#FF4500', 'display-name': 'ReplyFan', 'reply-parent-display-name': 'PixelPal', 'reply-parent-user-login': 'pixelpal', 'reply-parent-msg-body': 'welcome to the keychat preview' }, '@PixelPal thanks!');
                if (i === 7) Chat.write('vipviewer', { id: 'demo-rd' + i, color: '#1E90FF', 'display-name': 'VIPViewer', 'custom-reward-id': 'demo' }, 'redeemed a reward to say this');
                if (i === 3 && Chat.info.multiSource) {
                    Chat.write('kicker', { id: 'demo-k' + i, color: '#53fc18', 'display-name': 'KickChatter', kickBadges: [{ type: 'og', text: 'OG' }] }, 'hi from the green side', { platform: 'kick', channel: 'demo' });
                }
                i++;
                setTimeout(tick, i < 5 ? 600 : 2500);
            }, 1200);
        });
    },

    // ---- Twitch login (OAuth implicit flow — fully client-side, no server) ----
    auth: null,

    initAuth: function(callback) {
        // Returning from Twitch: token arrives in the URL fragment, original query in state
        if (window.location.hash.indexOf('access_token=') > -1) {
            var frag = new URLSearchParams(window.location.hash.slice(1));
            var token = frag.get('access_token');
            if (token) {
                try { localStorage.setItem('keychat_token', token); } catch (e) {}
                var qs = '';
                try { qs = atob(frag.get('state') || ''); } catch (e) {}
                window.location.replace(window.location.pathname + (qs ? '?' + qs : ''));
                return;
            }
        }
        var stored = null;
        try { stored = localStorage.getItem('keychat_token'); } catch (e) {}
        if (!stored) { callback(); return; }
        $.ajax({ url: 'https://id.twitch.tv/oauth2/validate', headers: { 'Authorization': 'OAuth ' + stored } })
            .done(function(res) {
                Chat.auth = { token: stored, login: res.login, userId: res.user_id, scopes: res.scopes || [] };
                console.log('KeyChat: logged in as ' + res.login);
            })
            .fail(function() {
                try { localStorage.removeItem('keychat_token'); } catch (e) {}
            })
            .always(function() { callback(); });
    },

    loginURL: function() {
        var state = '';
        try { state = btoa(window.location.search.slice(1)); } catch (e) {}
        return 'https://id.twitch.tv/oauth2/authorize' +
            '?client_id=' + encodeURIComponent(KEYCHAT_CLIENT_ID) +
            '&redirect_uri=' + encodeURIComponent(window.location.origin + window.location.pathname) +
            '&response_type=token' +
            '&scope=' + encodeURIComponent('chat:read chat:edit moderator:manage:banned_users moderator:manage:chat_messages moderator:manage:chat_settings moderator:manage:announcements channel:manage:vips channel:manage:moderators channel:read:redemptions') +
            '&state=' + encodeURIComponent(state);
    },

    helix: function(method, path, body) {
        return $.ajax({
            url: 'https://api.twitch.tv/helix/' + path,
            // jQuery 1.8.2 reads `type`, not `method` (added in 1.9.0) — without this the
            // POST/DELETE mod calls silently went out as GET and hit a route-miss 404
            type: method,
            method: method,
            headers: { 'Authorization': 'Bearer ' + Chat.auth.token, 'Client-Id': KEYCHAT_CLIENT_ID },
            contentType: 'application/json',
            data: body ? JSON.stringify(body) : undefined
        });
    },

    // Hover mod buttons: delete / 10m timeout / ban. Ban and timeout arm on first
    // click (⚠) and fire on the second within 3s, so a stray click can't ban anyone.
    setupModTools: function() {
        $(document).on('click', '.mod_tools button', function() {
            var $btn = $(this);
            var $line = $btn.closest('.chat_line');
            var sourceParts = String($line.attr('data-source') || '').split(':');
            if (sourceParts[0] !== 'twitch') return;
            var broadcasterId = Chat.info.channelIDs[sourceParts[1]];
            var userId = $line.attr('data-userid');
            var msgId = $line.attr('data-id');
            if (!broadcasterId || !Chat.auth || !Chat.auth.userId) return;
            var action = $btn.attr('data-act');
            if (action !== 'delete' && !userId) return; // ban/timeout need a target user id

            if (action !== 'delete') {
                if (!$btn.hasClass('armed')) {
                    $btn.addClass('armed');
                    setTimeout(function() { $btn.removeClass('armed'); }, 3000);
                    return;
                }
                $btn.removeClass('armed');
            }

            var call;
            var modQuery = 'broadcaster_id=' + encodeURIComponent(broadcasterId) + '&moderator_id=' + encodeURIComponent(Chat.auth.userId);
            if (action === 'delete') call = Chat.helix('DELETE', 'moderation/chat?' + modQuery + '&message_id=' + encodeURIComponent(msgId));
            else if (action === 'timeout') call = Chat.helix('POST', 'moderation/bans?' + modQuery, { data: { user_id: userId, duration: 600 } });
            else if (action === 'ban') call = Chat.helix('POST', 'moderation/bans?' + modQuery, { data: { user_id: userId } });
            else return;

            call.done(function() {
                $line.css('opacity', '0.35');
            }).fail(function(xhr) {
                // Surface Twitch's actual error message, not just the status code
                var why = '';
                if (xhr.responseJSON && xhr.responseJSON.message) why = xhr.responseJSON.message;
                else if (xhr.responseText) {
                    try { why = JSON.parse(xhr.responseText).message || xhr.responseText; }
                    catch (e) { why = xhr.responseText; }
                }
                if (!why) {
                    if (xhr.status === 404) why = "the request didn't reach a valid Twitch route (wrong endpoint/verb)";
                    else if (xhr.status === 401) why = 'not authorized — log in again, or you may not be a mod in this channel';
                    else if (xhr.status === 403) why = "you don't have permission to moderate this channel";
                    else if (xhr.status === 400) why = "can't perform this action on this user (broadcaster/mod, or already banned)";
                    else why = 'HTTP ' + xhr.status;
                }
                Chat.writeEvent('⚠️', 'Mod action failed: ' + why, 'mode');
            });
        });
    },

    // Slash commands: Twitch removed these from IRC in 2023, so route them to Helix.
    // Works in the primary channel where you're broadcaster/mod.
    runChatCommand: function(text) {
        var parts = text.slice(1).trim().split(/\s+/);
        var cmd = parts[0].toLowerCase();
        var arg = parts[1];
        var broadcasterId = Chat.info.channelIDs[Chat.info.channel];
        if (!broadcasterId || !Chat.auth || !Chat.auth.userId) {
            Chat.writeEvent('⚠️', 'Not connected or not logged in', 'mode');
            return;
        }
        var mod = 'broadcaster_id=' + encodeURIComponent(broadcasterId) + '&moderator_id=' + encodeURIComponent(Chat.auth.userId);
        var bcOnly = 'broadcaster_id=' + encodeURIComponent(broadcasterId);
        var ok = function(msg) { return function() { Chat.writeEvent('✅', msg, 'mode'); }; };
        var fail = function() {
            return function(xhr) {
                var why = (xhr.responseJSON && xhr.responseJSON.message) || '';
                if (!why && xhr.responseText) { try { why = JSON.parse(xhr.responseText).message || ''; } catch (e) {} }
                if (!why) {
                    if (xhr.status === 401) why = 'missing permission — log out and back in to grant it';
                    else if (xhr.status === 403) why = "you don't have permission for this in this channel";
                    else if (xhr.status === 400) why = 'invalid target or already in that state';
                    else why = 'HTTP ' + xhr.status;
                }
                Chat.writeEvent('⚠️', '/' + cmd + ' failed: ' + why, 'mode');
            };
        };
        // Resolve a login to a numeric user id (public endpoint, no scope needed)
        var withUser = function(login, fn) {
            if (!login) { Chat.writeEvent('⚠️', 'Usage: /' + cmd + ' <user>', 'mode'); return; }
            Chat.helix('GET', 'users?login=' + encodeURIComponent(login.replace(/^@/, '').toLowerCase()))
                .done(function(res) {
                    var id = res && res.data && res.data[0] && res.data[0].id;
                    if (!id) { Chat.writeEvent('⚠️', 'No such user: ' + login, 'mode'); return; }
                    fn(id);
                }).fail(fail());
        };
        var setChat = function(body, label) { Chat.helix('PATCH', 'chat/settings?' + mod, body).done(ok(label)).fail(fail()); };
        var parseDur = function(s) { var m = /^(\d+)([smhd]?)$/.exec(s || ''); if (!m) return 600; return (+m[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[m[2] || 's']); };

        switch (cmd) {
            case 'ban':
                withUser(arg, function(id) { Chat.helix('POST', 'moderation/bans?' + mod, { data: { user_id: id, reason: parts.slice(2).join(' ') } }).done(ok('Banned ' + arg)).fail(fail()); });
                break;
            case 'unban': case 'untimeout':
                withUser(arg, function(id) { Chat.helix('DELETE', 'moderation/bans?' + mod + '&user_id=' + id).done(ok((cmd === 'unban' ? 'Unbanned ' : 'Removed timeout on ') + arg)).fail(fail()); });
                break;
            case 'timeout':
                withUser(arg, function(id) { Chat.helix('POST', 'moderation/bans?' + mod, { data: { user_id: id, duration: parseDur(parts[2]), reason: parts.slice(3).join(' ') } }).done(ok('Timed out ' + arg)).fail(fail()); });
                break;
            case 'clear':
                Chat.helix('DELETE', 'moderation/chat?' + mod).done(ok('Chat cleared')).fail(fail());
                break;
            case 'slow': setChat({ slow_mode: true, slow_mode_wait_time: parseInt(arg) || 30 }, 'Slow mode on'); break;
            case 'slowoff': setChat({ slow_mode: false }, 'Slow mode off'); break;
            case 'followers': setChat({ follower_mode: true, follower_mode_duration: parseInt(arg) || 0 }, 'Followers-only on'); break;
            case 'followersoff': setChat({ follower_mode: false }, 'Followers-only off'); break;
            case 'subscribers': setChat({ subscriber_mode: true }, 'Subscribers-only on'); break;
            case 'subscribersoff': setChat({ subscriber_mode: false }, 'Subscribers-only off'); break;
            case 'emoteonly': setChat({ emote_mode: true }, 'Emote-only on'); break;
            case 'emoteonlyoff': setChat({ emote_mode: false }, 'Emote-only off'); break;
            case 'uniquechat': case 'r9kbeta': setChat({ unique_chat_mode: true }, 'Unique-chat on'); break;
            case 'uniquechatoff': case 'r9kbetaoff': setChat({ unique_chat_mode: false }, 'Unique-chat off'); break;
            case 'vip': withUser(arg, function(id) { Chat.helix('POST', 'channels/vips?' + bcOnly + '&user_id=' + id).done(ok('VIP added: ' + arg)).fail(fail()); }); break;
            case 'unvip': withUser(arg, function(id) { Chat.helix('DELETE', 'channels/vips?' + bcOnly + '&user_id=' + id).done(ok('VIP removed: ' + arg)).fail(fail()); }); break;
            case 'mod': withUser(arg, function(id) { Chat.helix('POST', 'moderation/moderators?' + bcOnly + '&user_id=' + id).done(ok('Modded ' + arg)).fail(fail()); }); break;
            case 'unmod': withUser(arg, function(id) { Chat.helix('DELETE', 'moderation/moderators?' + bcOnly + '&user_id=' + id).done(ok('Unmodded ' + arg)).fail(fail()); }); break;
            case 'announce':
                var msg = text.slice(text.indexOf(' ') + 1);
                if (!msg || msg === text) { Chat.writeEvent('⚠️', 'Usage: /announce <message>', 'mode'); break; }
                Chat.helix('POST', 'chat/announcements?' + mod, { message: msg }).done(ok('Announced')).fail(fail());
                break;
            case 'logout':
                try { localStorage.removeItem('keychat_token'); } catch (e) {}
                Chat.writeEvent('✅', 'Logged out — reloading to sign in again', 'mode');
                setTimeout(function() { location.reload(); }, 600);
                break;
            default:
                Chat.writeEvent('⚠️', 'Unsupported command: /' + cmd + ' (KeyChat routes mod commands via the Twitch API)', 'mode');
        }
    },

    // Bottom chat box: talk in the primary channel straight from the dock
    setupChatBox: function() {
        var $bar = $('<div id="chat_input_bar"></div>');
        var $input = $('<input id="chat_input" maxlength="500" autocomplete="off">')
            .attr('placeholder', 'Chat as ' + Chat.auth.login + ' in #' + Chat.info.channel);
        var $send = $('<button id="chat_send">➤</button>');
        $bar.append($input).append($send).appendTo('body');
        document.body.classList.add('has-input');
        if (!Chat.info.dock) $('<style></style>').text('#chat_container { bottom: 46px; }').appendTo('head');
        var send = function() {
            var text = $input.val().trim();
            if (!text) return;
            $input.val('');
            // Slash commands (except /me) go through Helix, not IRC — Twitch dropped
            // IRC commands in 2023, so sending them as messages does nothing.
            var cmd = text.charAt(0) === '/' ? text.slice(1).split(/\s+/)[0].toLowerCase() : '';
            if (cmd && cmd !== 'me') { Chat.runChatCommand(text); return; }
            if (!Chat.ircSocket || Chat.ircSocket.readyState !== 1) return;
            Chat.ircSocket.send('PRIVMSG #' + Chat.info.channel + ' :' + text + '\r\n');
            // Twitch doesn't echo your own messages back on this connection
            Chat.write(Chat.auth.login, { id: 'own-' + Date.now(), color: '#9147ff', 'display-name': Chat.auth.login }, text, { platform: 'twitch', channel: Chat.info.channel });
        };
        $send.on('click', send);
        $input.on('keydown', function(e) { if (e.key === 'Enter') send(); });
    },

    // Hover tooltip for emotes: enlarged preview + name + provider/origin, like the
    // native Twitch/7TV clients. Works on any emote img carrying data-name.
    setupEmoteTooltips: function() {
        if (Chat.emoteTipReady) return;
        Chat.emoteTipReady = true;
        var $tip = $('<div id="emote_tooltip"></div>').appendTo('body');
        var reposition = function(el) {
            var r = el.getBoundingClientRect();
            var tw = $tip.outerWidth(), th = $tip.outerHeight();
            var left = r.left + r.width / 2 - tw / 2;
            left = Math.max(4, Math.min(left, window.innerWidth - tw - 4));
            var top = r.top - th - 6;
            if (top < 4) top = r.bottom + 6; // flip below if no room above
            $tip.css({ left: left + 'px', top: top + 'px' });
        };
        $(document).on('mouseenter', 'img.emote[data-name]', function() {
            var $img = $(this);
            var name = $img.attr('data-name');
            if (!name) return;
            var prov = $img.attr('data-prov') || '';
            var origin = $img.attr('data-origin') || '';
            var sub = prov;
            if (origin && origin !== 'Global' && origin !== 'Channel') sub += (sub ? ' · ' : '') + origin;
            else if (origin === 'Global') sub += ' · Global';
            $tip.empty();
            $tip.append($('<img>').attr('src', $img.attr('src')));
            $tip.append($('<div class="tip_name"></div>').text('Emote: ' + name));
            if (sub) $tip.append($('<div class="tip_sub"></div>').text(sub));
            $tip.css('display', 'block');
            reposition(this);
        });
        $(document).on('mouseleave', 'img.emote[data-name]', function() {
            $tip.css('display', 'none');
        });
    },

    setupLoginButton: function() {
        var $btn = $('<button id="twitch_login">Log in with Twitch</button>').appendTo('body');
        $btn.on('click', function() {
            if (!KEYCHAT_CLIENT_ID) {
                Chat.writeEvent('⚠️', 'No Twitch Client ID configured — see README (mod tools section)', 'mode');
                return;
            }
            window.location.href = Chat.loginURL();
        });
    },

    // Shared Chat labels: resolve an unknown room id to its login via IVR
    resolveRoomName: function(roomId) {
        Chat.info.roomNames[roomId] = null; // pending
        $.getJSON('https://api.ivr.fi/v2/twitch/user?id=' + encodeURIComponent(roomId))
            .done(function(res) {
                var name = (res && res[0] && res[0].login) || 'shared';
                Chat.info.roomNames[roomId] = name;
                // Patch chips already rendered while the lookup was pending
                $('.source_shared[data-room="' + String(roomId).replace(/[^0-9]/g, '') + '"]').text(name);
            })
            .fail(function() { Chat.info.roomNames[roomId] = 'shared'; });
    },

    // A consistent, distinct accent color per participating channel in a Shared Chat
    sharedColor: function(roomId) {
        if (!Chat.info.sharedColors[roomId]) {
            var palette = ['#9147ff', '#00c8af', '#ff6ac1', '#ffb31a', '#2e9df7', '#53fc18', '#ff5a5a', '#c98bff'];
            Chat.info.sharedColors[roomId] = palette[Object.keys(Chat.info.sharedColors).length % palette.length];
        }
        return Chat.info.sharedColors[roomId];
    },

    // Chat-mode notices (emote-only, sub-only, followers-only, slow, unique) from ROOMSTATE diffs
    handleRoomstateModes: function(login, tags) {
        // Twitch sends PARTIAL ROOMSTATEs on changes — merge into the stored baseline
        // rather than replacing it, or a later full ROOMSTATE (reconnect) re-announces
        var prev = Chat.info.roomStates[login];
        var state = prev ? Object.assign({}, prev) : {};
        ['emote-only', 'subs-only', 'followers-only', 'slow', 'r9k'].forEach(function(key) {
            if (tags[key] !== undefined) state[key] = tags[key];
        });
        Chat.info.roomStates[login] = state;
        if (!prev || !Chat.info.events) return; // first ROOMSTATE is the baseline, not a change
        var prefix = Chat.info.multiSource ? login + ': ' : '';
        if (state['emote-only'] !== prev['emote-only'] && state['emote-only'] !== undefined)
            Chat.writeEvent('🔒', prefix + 'Emote-only chat ' + (state['emote-only'] === '1' ? 'enabled' : 'disabled'), 'mode');
        if (state['subs-only'] !== prev['subs-only'] && state['subs-only'] !== undefined)
            Chat.writeEvent('🔒', prefix + 'Subscribers-only chat ' + (state['subs-only'] === '1' ? 'enabled' : 'disabled'), 'mode');
        if (state['followers-only'] !== prev['followers-only'] && state['followers-only'] !== undefined)
            Chat.writeEvent('🔒', prefix + (state['followers-only'] === '-1' ? 'Followers-only chat disabled' : 'Followers-only chat enabled' + (state['followers-only'] !== '0' ? ' (' + state['followers-only'] + 'm)' : '')), 'mode');
        if (state['slow'] !== prev['slow'] && state['slow'] !== undefined)
            Chat.writeEvent('🐌', prefix + (state['slow'] === '0' ? 'Slow mode disabled' : 'Slow mode: ' + state['slow'] + 's'), 'mode');
        if (state['r9k'] !== prev['r9k'] && state['r9k'] !== undefined)
            Chat.writeEvent('🔒', prefix + 'Unique-messages mode ' + (state['r9k'] === '1' ? 'enabled' : 'disabled'), 'mode');
    },

    connectIRC: function() {
        console.log('KeyChat: Connecting to IRC server...');
        var socket = new ReconnectingWebSocket('wss://irc-ws.chat.twitch.tv', 'irc', { reconnectInterval: 2000 });
        Chat.ircSocket = socket;

        socket.onopen = function() {
            console.log('KeyChat: Connected');
            if (Chat.auth && Chat.auth.scopes.indexOf('chat:read') > -1) {
                socket.send('PASS oauth:' + Chat.auth.token + '\r\n');
                socket.send('NICK ' + Chat.auth.login + '\r\n');
            } else {
                socket.send('PASS blah\r\n');
                socket.send('NICK justinfan' + Math.floor(Math.random() * 99999) + '\r\n');
            }
            socket.send('CAP REQ :twitch.tv/commands twitch.tv/tags\r\n');
            Chat.info.channels.forEach(function(c) { socket.send('JOIN #' + c + '\r\n'); });
        };

        socket.onclose = function() {
            console.log('KeyChat: Disconnected');
        };

        socket.onmessage = function(data) {
            data.data.split('\r\n').forEach(line => {
                if (!line) return;
                var message = window.parseIRC(line);
                if (!message || !message.command) return;
                var chan = message.params[0] && message.params[0].charAt(0) === '#' ? message.params[0].slice(1) : null;

                switch (message.command) {
                    case "PING":
                        socket.send('PONG ' + message.params[0]);
                        return;
                    case "JOIN":
                        console.log('KeyChat: Joined channel ' + message.params[0]);
                        return;
                    case "ROOMSTATE":
                        // The room-id tag replaces the retired Kraken user lookup
                        if (!message.tags || !chan || Chat.info.channels.indexOf(chan) === -1) return;
                        if (typeof message.tags['room-id'] === 'string' && !Chat.info.channelIDs[chan]) {
                            Chat.info.channelIDs[chan] = message.tags['room-id'];
                            Chat.info.roomNames[message.tags['room-id']] = chan;
                            if (chan === Chat.info.channel) Chat.info.channelID = message.tags['room-id'];
                            console.log('KeyChat: Channel ID for ' + chan + ' is ' + message.tags['room-id']);
                            Chat.loadChannelData(message.tags['room-id'], chan);
                        }
                        Chat.handleRoomstateModes(chan, message.tags);
                        return;
                    case "USERNOTICE":
                        if (!Chat.info.events || !message.tags || !chan || Chat.info.channels.indexOf(chan) === -1) return;
                        var eventIcons = { sub: '⭐', resub: '⭐', subgift: '🎁', submysterygift: '🎁', giftpaidupgrade: '⭐', primepaidupgrade: '⭐', anongiftpaidupgrade: '⭐', raid: '🎉', announcement: '📣' };
                        var eventId = message.tags['msg-id'];
                        if (!(eventId in eventIcons)) return;
                        var sysMsg = typeof message.tags['system-msg'] === 'string' ? message.tags['system-msg'] : '';
                        if (eventId === 'announcement' && !sysMsg) {
                            var announcer = (typeof message.tags['display-name'] === 'string' && message.tags['display-name']) || (typeof message.tags.login === 'string' ? message.tags.login : '');
                            sysMsg = announcer + ' made an announcement';
                        }
                        if (Chat.info.multiSource && sysMsg) sysMsg = chan + ': ' + sysMsg;
                        Chat.writeEvent(eventIcons[eventId], sysMsg, eventId);
                        if (message.params[1] && typeof message.tags.login === 'string' && Chat.passesFilters(message.tags.login, message.params[1])) {
                            Chat.write(message.tags.login, message.tags, message.params[1], { platform: 'twitch', channel: chan });
                        }
                        return;
                    case "CLEARMSG":
                        if (message.tags) Chat.clearMessage(message.tags['target-msg-id']);
                        return;
                    case "CLEARCHAT":
                        if (message.params[1] && chan && Chat.info.channels.indexOf(chan) > -1) Chat.clearChat(message.params[1], 'twitch:' + chan);
                        return;
                    case "PRIVMSG":
                        if (!chan || Chat.info.channels.indexOf(chan) === -1 || !message.params[1]) return;

                        // Shared Chat between two channels we've BOTH joined delivers every
                        // message twice; drop the relayed copy (the native room renders it)
                        var srcRoom = message.tags && message.tags['source-room-id'];
                        if (typeof srcRoom === 'string' && srcRoom && Chat.info.channelIDs[chan] && srcRoom !== Chat.info.channelIDs[chan]) {
                            var srcLogin = Chat.info.roomNames[srcRoom];
                            if (srcLogin && Chat.info.channels.indexOf(srcLogin) > -1) return;
                        }

                        var nick = message.prefix.split('@')[0].split('!')[0];

                        if (message.params[1].toLowerCase() === "!refreshoverlay" && typeof(message.tags.badges) === 'string') {
                            var flag = false;
                            message.tags.badges.split(',').forEach(badge => {
                                badge = badge.split('/');
                                if (badge[0] === "moderator" || badge[0] === "broadcaster") {
                                    flag = true;
                                    return;
                                }
                            });
                            // Only the primary channel's mods, max once a minute — in a
                            // multi-channel dock a joined channel's mods shouldn't wipe
                            // everyone's emote map (or hammer the APIs by spamming it)
                            if (flag && chan === Chat.info.channel && (!Chat.lastEmoteRefresh || Date.now() - Chat.lastEmoteRefresh > 60000)) {
                                Chat.lastEmoteRefresh = Date.now();
                                Chat.refreshEmotes();
                                console.log('KeyChat: Refreshing emotes...');
                                return;
                            }
                        }

                        if (!Chat.passesFilters(nick, message.params[1])) return;

                        if (Chat.info.pronouns && !(nick in Chat.info.userPronouns)) {
                            Chat.loadUserPronouns(nick);
                        }
                        if (Chat.info.avatars && !(nick in Chat.info.userAvatars)) {
                            Chat.loadUserAvatar(nick);
                        }

                        if (!Chat.info.hideBadges) {
                            if (Chat.info.bttvBadges && Chat.info.seventvBadges && Chat.info.chatterinoBadges && Chat.info.ffzapBadges && !Chat.info.userBadges[nick]) Chat.loadUserBadges(nick, message.tags['user-id']);
                        }

                        Chat.write(nick, message.tags, message.params[1], { platform: 'twitch', channel: chan });
                        return;
                }
            });
        };
    },

    // Kick chat rides a public Pusher websocket; one socket serves all Kick channels
    connectKick: function() {
        var slugToChatroom = {};
        var chatroomToSlug = {};
        var socket = null;
        var pingTimer = null;

        var subscribeAll = function() {
            if (!socket || socket.readyState !== 1) return;
            Object.entries(slugToChatroom).forEach(function(pair) {
                socket.send(JSON.stringify({ event: 'pusher:subscribe', data: { auth: '', channel: 'chatrooms.' + pair[1] + '.v2' } }));
            });
        };

        var connect = function() {
            try { socket = new WebSocket('wss://ws-us2.pusher.com/app/32cbd69e4b950bf97679?protocol=7&client=js&version=8.4.0&flash=false'); } catch (e) { return; }
            socket.onmessage = function(e) {
                var frame;
                try { frame = JSON.parse(e.data); } catch (err) { return; }
                if (frame.event === 'pusher:connection_established') {
                    console.log('KeyChat: Kick connected');
                    subscribeAll();
                    return;
                }
                if (frame.event === 'pusher:ping') {
                    socket.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
                    return;
                }
                var slug = null;
                if (typeof frame.channel === 'string') {
                    var m = frame.channel.match(/^chatrooms\.(\d+)\.v2$/);
                    if (m) slug = chatroomToSlug[m[1]];
                }
                if (!slug) return;
                var payload;
                try { payload = JSON.parse(frame.data); } catch (err) { return; }
                try {
                    if (frame.event === 'App\\Events\\ChatMessageEvent') Chat.writeKick(payload, slug);
                    else if (frame.event === 'App\\Events\\MessageDeletedEvent' && payload.message) Chat.clearMessage(payload.message.id);
                    else if (frame.event === 'App\\Events\\UserBannedEvent' && payload.user && typeof payload.user.username === 'string') Chat.clearChat(payload.user.username.toLowerCase(), 'kick:' + slug);
                } catch (err) { /* malformed Kick payloads must never kill the chat */ }
            };
            socket.onclose = function() { setTimeout(connect, 5000); };
            // Pusher expects activity; ping if the connection has been quiet.
            // One timer for the lifetime of connectKick — reconnects must not stack them.
            if (!pingTimer) {
                pingTimer = setInterval(function() {
                    if (socket && socket.readyState === 1) socket.send(JSON.stringify({ event: 'pusher:ping', data: {} }));
                }, 60000);
            }
        };

        // Transient failures (network not up yet at OBS launch, 5xx) retry with backoff;
        // only a 404 means the channel genuinely doesn't exist
        var resolveSlug = function(slug, attempt) {
            $.getJSON('https://kick.com/api/v2/channels/' + encodeURIComponent(slug))
                .done(function(res) {
                    if (!res || !res.chatroom || !res.chatroom.id) {
                        console.log('KeyChat: no chatroom found for Kick channel ' + slug);
                        return;
                    }
                    slugToChatroom[slug] = res.chatroom.id;
                    chatroomToSlug[res.chatroom.id] = slug;
                    console.log('KeyChat: Kick chatroom for ' + slug + ' is ' + res.chatroom.id);
                    if (!socket) connect();
                    else subscribeAll();
                })
                .fail(function(xhr) {
                    if (xhr && xhr.status === 404) {
                        console.log('KeyChat: Kick channel ' + slug + ' does not exist');
                        return;
                    }
                    if (attempt >= 6) {
                        console.log('KeyChat: giving up resolving Kick channel ' + slug);
                        return;
                    }
                    setTimeout(function() { resolveSlug(slug, attempt + 1); }, Math.min(5000 * Math.pow(2, attempt), 60000));
                });
        };
        Chat.info.kickChannels.forEach(function(slug) { resolveSlug(slug, 0); });
    },

    writeKick: function(data, slug) {
        if (!data || !data.sender || typeof data.content !== 'string') return;
        var nick = String(data.sender.username || '').toLowerCase();
        if (!nick || !Chat.passesFilters(nick, data.content)) return;
        var identity = data.sender.identity || {};
        Chat.write(nick, {
            id: data.id,
            color: typeof identity.color === 'string' ? identity.color : undefined,
            'display-name': data.sender.username,
            kickBadges: identity.badges
        }, data.content, { platform: 'kick', channel: slug });
    },

    start: function(twitchChannels, kickChannels) {
        Chat.info.channels = twitchChannels;
        Chat.info.kickChannels = kickChannels;
        Chat.info.channel = twitchChannels[0] || null;
        Chat.info.mentionName = twitchChannels[0] || kickChannels[0] || null;
        Chat.info.multiSource = (twitchChannels.length + kickChannels.length) > 1;
        var title = $(document).prop('title');
        $(document).prop('title', title + twitchChannels.concat(kickChannels).join(', '));

        Chat.load(function() {
            Chat.loadGlobalEmotes();
            Chat.setupEmoteTooltips();
            if (Chat.info.channels.length) Chat.connectIRC();
            if (Chat.info.kickChannels.length) Chat.connectKick();
            if (Chat.info.modMode) {
                if (Chat.auth) {
                    Chat.setupModTools();
                    if (Chat.info.channels.length) Chat.setupChatBox();
                } else {
                    Chat.setupLoginButton();
                }
            }
        });
    }
};

$(document).ready(function() {
    if (Chat.info.demo) {
        Chat.demo();
        return;
    }
    var splitList = function(v) {
        return (v || '').toLowerCase().split(',').map(function(s) { return s.trim().replace(/^[@#]/, ''); }).filter(Boolean);
    };
    var twitchChannels = splitList($.QueryString.channel);
    var kickChannels = splitList($.QueryString.kick);
    if (!twitchChannels.length && !kickChannels.length && window.location.hash.indexOf('access_token=') === -1) {
        window.location.replace('setup.html');
        return;
    }
    if (Chat.info.modMode || window.location.hash.indexOf('access_token=') > -1) {
        Chat.initAuth(function() { Chat.start(twitchChannels, kickChannels); });
    } else {
        Chat.start(twitchChannels, kickChannels);
    }
});
