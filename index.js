/**
 * YouTube Music — port Nuvio/lolplus del plugin Kino (JuanDEVYT / YTMusic_plugin)
 * API: getHome, search, getMeta, getStreams, getNews, getCatalogs
 */
var API = 'https://music.youtube.com/youtubei/v1/';
var ORIGIN = 'https://music.youtube.com';
var PLAYER_URL = 'https://www.youtube.com/youtubei/v1/player?prettyPrint=false';
var WEB_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:128.0) Gecko/20100101 Firefox/128.0';
var SEARCH_SONGS = 'EgWKAQIIAWoMEA4QChADEAQQCRAF';
var VERSION = '0.5.2-nuvio';

var CLIENTS = [
  {
    ua:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 15_7_3) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Safari/605.1.15',
    id: '101',
    client: {
      clientName: 'VISIONOS',
      clientVersion: '1.02',
      deviceMake: 'Apple',
      deviceModel: 'RealityDevice17,1',
      osName: 'visionOS',
      osVersion: '26.5.23O471',
    },
  },
  {
    ua: 'com.google.ios.youtube/20.10.4 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)',
    id: '5',
    hls: true,
    client: {
      clientName: 'IOS',
      clientVersion: '20.10.4',
      deviceMake: 'Apple',
      deviceModel: 'iPhone16,2',
      osName: 'iPhone',
      osVersion: '18.3.2.22D82',
    },
  },
  {
    ua:
      'com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip',
    id: '28',
    client: {
      clientName: 'ANDROID_VR',
      clientVersion: '1.65.10',
      deviceMake: 'Oculus',
      deviceModel: 'Quest 3',
      osName: 'Android',
      osVersion: '12L',
      androidSdkVersion: 32,
    },
  },
];

function cfg() {
  var c =
    (typeof globalThis !== 'undefined' &&
      globalThis.__nuvioConfig &&
      globalThis.__nuvioConfig.current) ||
    {};
  return c;
}

function joinCookie() {
  var c = cfg();
  var parts = [c.cookieA, c.cookieB, c.cookieC, c.cookieD]
    .map(function (v) {
      return (v || '').toString();
    })
    .join('')
    .replace(/[\r\n\t]+/g, '')
    .replace(/^\s*cookie:\s*/i, '');
  return parts;
}

function parseCookie(str) {
  var jar = {};
  String(str || '')
    .split(';')
    .forEach(function (part) {
      var i = part.indexOf('=');
      if (i > 0) jar[part.slice(0, i).trim()] = part.slice(i + 1).trim();
    });
  return jar;
}

function sha1Hex(s) {
  try {
    if (typeof CryptoJS !== 'undefined' && CryptoJS.SHA1) {
      return CryptoJS.SHA1(s).toString(CryptoJS.enc.Hex);
    }
  } catch (e) {}
  return '';
}

function authHeaders(cookie) {
  if (!cookie) return {};
  var h = { Cookie: cookie, 'X-Goog-AuthUser': '0' };
  var jar = parseCookie(cookie);
  var sid = jar.SAPISID || jar['__Secure-3PAPISID'];
  if (sid) {
    var ts = Math.floor(Date.now() / 1000);
    var hash = sha1Hex(ts + ' ' + sid + ' ' + ORIGIN);
    if (hash) h.Authorization = 'SAPISIDHASH ' + ts + '_' + hash;
  }
  return h;
}

function webClientVersion() {
  var d = new Date(Date.now() - 2 * 86400000);
  var p = function (n) {
    return String(n).padStart(2, '0');
  };
  return (
    '1.' +
    d.getUTCFullYear() +
    p(d.getUTCMonth() + 1) +
    p(d.getUTCDate()) +
    '.01.00'
  );
}

function locale() {
  return { hl: 'es', gl: 'MX' };
}

async function httpJson(url, opts) {
  opts = opts || {};
  var headers = Object.assign(
    {
      'User-Agent': opts.ua || WEB_UA,
      'Content-Type': 'application/json',
      Accept: '*/*',
      Origin: ORIGIN,
      Referer: ORIGIN + '/',
    },
    opts.headers || {}
  );
  var res = await fetch(url, {
    method: opts.method || 'POST',
    headers: headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    var err = new Error('HTTP ' + res.status + ' ' + url);
    err.status = res.status;
    throw err;
  }
  return await res.json();
}

async function yt(endpoint, body, opts) {
  opts = opts || {};
  var cookie = opts.cookie !== undefined ? opts.cookie : joinCookie();
  var loc = locale();
  var ctx = {
    client: {
      clientName: 'WEB_REMIX',
      clientVersion: webClientVersion(),
      hl: loc.hl,
      gl: loc.gl,
    },
  };
  var payload = Object.assign({ context: ctx }, body || {});
  var url = API + endpoint + '?prettyPrint=false';
  return await httpJson(url, {
    body: payload,
    headers: Object.assign(
      {
        'X-YouTube-Client-Name': '67',
        'X-YouTube-Client-Version': ctx.client.clientVersion,
      },
      authHeaders(cookie)
    ),
  });
}

function findAll(root, key) {
  var out = [];
  var stack = [root];
  while (stack.length) {
    var n = stack.pop();
    if (!n || typeof n !== 'object') continue;
    if (Array.isArray(n)) {
      for (var i = n.length - 1; i >= 0; i--) stack.push(n[i]);
      continue;
    }
    var keys = Object.keys(n);
    for (var k = 0; k < keys.length; k++) {
      var kk = keys[k];
      if (kk === key) out.push(n[kk]);
      else stack.push(n[kk]);
    }
  }
  return out;
}

function textOf(runs) {
  if (!runs) return '';
  if (typeof runs === 'string') return runs;
  if (runs.simpleText) return runs.simpleText;
  if (Array.isArray(runs.runs)) {
    return runs.runs
      .map(function (r) {
        return r.text || '';
      })
      .join('');
  }
  if (Array.isArray(runs)) {
    return runs
      .map(function (r) {
        return r.text || '';
      })
      .join('');
  }
  return '';
}

function thumbOf(obj) {
  var thumbs =
    (obj && obj.thumbnail && obj.thumbnail.thumbnails) ||
    (obj && obj.thumbnailRenderer && obj.thumbnailRenderer.musicThumbnailRenderer &&
      obj.thumbnailRenderer.musicThumbnailRenderer.thumbnail &&
      obj.thumbnailRenderer.musicThumbnailRenderer.thumbnail.thumbnails) ||
    (obj && obj.thumbnails) ||
    [];
  if (!Array.isArray(thumbs) || !thumbs.length) return null;
  var best = thumbs[thumbs.length - 1];
  return best && best.url ? best.url : null;
}

function parseList(r) {
  if (!r) return null;
  var flex = r.flexColumns || [];
  var title = '';
  var sub = '';
  if (flex[0]) {
    title = textOf(
      flex[0].musicResponsiveListItemFlexColumnRenderer &&
        flex[0].musicResponsiveListItemFlexColumnRenderer.text
    );
  }
  if (flex[1]) {
    sub = textOf(
      flex[1].musicResponsiveListItemFlexColumnRenderer &&
        flex[1].musicResponsiveListItemFlexColumnRenderer.text
    );
  }
  var nav = r.playlistItemData || r.overlay || r;
  var videoId =
    (r.playlistItemData && r.playlistItemData.videoId) ||
    (r.overlay &&
      r.overlay.musicItemThumbnailOverlayRenderer &&
      r.overlay.musicItemThumbnailOverlayRenderer.content &&
      r.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer &&
      r.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer
        .playNavigationEndpoint &&
      r.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer
        .playNavigationEndpoint.watchEndpoint &&
      r.overlay.musicItemThumbnailOverlayRenderer.content.musicPlayButtonRenderer
        .playNavigationEndpoint.watchEndpoint.videoId) ||
    (r.navigationEndpoint &&
      r.navigationEndpoint.watchEndpoint &&
      r.navigationEndpoint.watchEndpoint.videoId);
  var thumb = thumbOf(r);
  if (!videoId && r.navigationEndpoint && r.navigationEndpoint.browseEndpoint) {
    var bid = r.navigationEndpoint.browseEndpoint.browseId;
    return {
      type: 'browse',
      id: bid,
      title: title || bid,
      artist: sub,
      poster: thumb,
    };
  }
  if (!videoId) return null;
  return {
    type: 'track',
    id: videoId,
    title: title || videoId,
    artist: sub,
    poster: thumb,
  };
}

function parseTwoRow(r) {
  if (!r) return null;
  var title = textOf(r.title);
  var sub = textOf(r.subtitle);
  var thumb = thumbOf(r);
  var nav = r.navigationEndpoint || {};
  if (nav.watchEndpoint && nav.watchEndpoint.videoId) {
    return {
      type: 'track',
      id: nav.watchEndpoint.videoId,
      title: title,
      artist: sub,
      poster: thumb,
    };
  }
  if (nav.browseEndpoint && nav.browseEndpoint.browseId) {
    return {
      type: 'browse',
      id: nav.browseEndpoint.browseId,
      title: title,
      artist: sub,
      poster: thumb,
    };
  }
  return null;
}

function collectItems(root) {
  var out = [];
  var seen = {};
  var stack = [root];
  while (stack.length) {
    var n = stack.pop();
    if (!n || typeof n !== 'object') continue;
    if (Array.isArray(n)) {
      for (var i = n.length - 1; i >= 0; i--) stack.push(n[i]);
      continue;
    }
    if (n.musicResponsiveListItemRenderer) {
      var a = parseList(n.musicResponsiveListItemRenderer);
      if (a && a.id && !seen[a.type + a.id]) {
        seen[a.type + a.id] = 1;
        out.push(a);
      }
    }
    if (n.musicTwoRowItemRenderer) {
      var b = parseTwoRow(n.musicTwoRowItemRenderer);
      if (b && b.id && !seen[b.type + b.id]) {
        seen[b.type + b.id] = 1;
        out.push(b);
      }
    }
    var keys = Object.keys(n);
    for (var k = keys.length - 1; k >= 0; k--) {
      var key = keys[k];
      if (
        key === 'musicResponsiveListItemRenderer' ||
        key === 'musicTwoRowItemRenderer'
      )
        continue;
      stack.push(n[key]);
    }
  }
  return out;
}

function toContentItem(x) {
  if (!x) return null;
  var id =
    x.type === 'track'
      ? 'ytm:t:' + x.id
      : x.type === 'browse'
        ? 'ytm:b:' + x.id
        : 'ytm:' + x.id;
  return {
    id: id,
    title: x.title || x.id,
    type: 'movie',
    poster: x.poster || null,
    backdrop: x.poster || null,
    overview: x.artist || '',
    extra: {
      source: 'ytmusic',
      ytmType: x.type,
      ytmId: x.id,
      artist: x.artist || '',
    },
  };
}

function shelfTitle(shelf) {
  try {
    var h =
      shelf.header &&
      (shelf.header.musicCarouselShelfBasicHeaderRenderer ||
        shelf.header.musicShelfHeaderRenderer);
    if (h) return textOf(h.title) || 'Música';
  } catch (e) {}
  return 'Música';
}

// ─── API pública Nuvio ───────────────────────────────────────────────────────

async function getHome() {
  var rows = [];
  try {
    var data = await yt('browse', { browseId: 'FEmusic_home' });
    var carousels = findAll(data, 'musicCarouselShelfRenderer');
    for (var i = 0; i < carousels.length && rows.length < 12; i++) {
      var shelf = carousels[i];
      var items = collectItems(shelf)
        .slice(0, 24)
        .map(toContentItem)
        .filter(Boolean);
      if (!items.length) continue;
      rows.push({
        id: 'ytm_row_' + i,
        type: 'row',
        title: shelfTitle(shelf),
        imageStyle: 'poster',
        items: items,
      });
    }
  } catch (e) {
    // fallback charts
  }
  if (!rows.length) {
    try {
      var charts = await yt('browse', { browseId: 'FEmusic_charts' });
      var items2 = collectItems(charts).slice(0, 30).map(toContentItem).filter(Boolean);
      if (items2.length) {
        rows.push({
          id: 'ytm_charts',
          type: 'row',
          title: 'Tendencias',
          imageStyle: 'poster',
          items: items2,
        });
      }
    } catch (e2) {}
  }
  return { rows: rows };
}

async function search(query) {
  var q = query;
  if (q && typeof q === 'object') q = q.query || q.q || '';
  q = String(q || '').trim();
  if (!q) return { items: [] };
  try {
    var data = await yt('search', { query: q, params: SEARCH_SONGS });
    var items = collectItems(data).slice(0, 40).map(toContentItem).filter(Boolean);
    if (!items.length) {
      data = await yt('search', { query: q });
      items = collectItems(data).slice(0, 40).map(toContentItem).filter(Boolean);
    }
    return { items: items };
  } catch (e) {
    return { items: [], error: String(e && e.message ? e.message : e) };
  }
}

async function getMeta(id) {
  id = String(id || '').trim();
  var m = /^ytm:(t|b):(.+)$/.exec(id) || /^ytm:(.+)$/.exec(id);
  var kind = 't';
  var vid = id;
  if (m) {
    if (m.length === 3) {
      kind = m[1];
      vid = m[2];
    } else {
      vid = m[1];
    }
  }
  if (kind === 'b' || /^MP/.test(vid) || /^VL/.test(vid)) {
    try {
      var data = await yt('browse', { browseId: vid.replace(/^VL/, '') });
      var items = collectItems(data).slice(0, 80).map(toContentItem).filter(Boolean);
      var title = vid;
      var hdr =
        findAll(data, 'musicResponsiveHeaderRenderer')[0] ||
        findAll(data, 'musicDetailHeaderRenderer')[0];
      if (hdr) title = textOf(hdr.title) || title;
      return {
        id: id,
        title: title,
        type: 'movie',
        overview: 'Lista / álbum YouTube Music',
        extra: { source: 'ytmusic', tracks: items },
        related: items,
      };
    } catch (e) {
      return { id: id, title: vid, type: 'movie', overview: String(e.message || e) };
    }
  }
  // track
  return {
    id: id.indexOf('ytm:') === 0 ? id : 'ytm:t:' + vid,
    title: vid,
    type: 'movie',
    overview: 'Canción de YouTube Music',
    extra: { source: 'ytmusic', ytmType: 'track', ytmId: vid },
  };
}

function orderFormats(formats, pref) {
  var audio = (formats || []).filter(function (f) {
    return f && f.url && /^audio\//.test(f.mimeType || '') && !f.isDrc;
  });
  var byRate = function (a, b) {
    return (b.bitrate || 0) - (a.bitrate || 0);
  };
  var aac = audio
    .filter(function (f) {
      return /^audio\/mp4/.test(f.mimeType);
    })
    .sort(byRate);
  var opus = audio
    .filter(function (f) {
      return !/^audio\/mp4/.test(f.mimeType);
    })
    .sort(byRate);
  return pref === 'opus' ? opus.concat(aac) : aac.concat(opus);
}

function describeFmt(f) {
  var codec = /mp4a/.test(f.mimeType || '')
    ? 'AAC'
    : /opus/.test(f.mimeType || '')
      ? 'Opus'
      : 'Audio';
  return (codec + ' ' + Math.round((f.bitrate || 0) / 1000) + ' kbps').slice(0, 48);
}

async function playerFor(videoId, clientDef) {
  var loc = locale();
  var body = {
    context: {
      client: Object.assign({}, clientDef.client, {
        hl: loc.hl,
        gl: loc.gl,
      }),
    },
    videoId: videoId,
    contentCheckOk: true,
    racyCheckOk: true,
  };
  return await httpJson(PLAYER_URL, {
    ua: clientDef.ua,
    body: body,
    headers: Object.assign(
      {
        'X-YouTube-Client-Name': clientDef.id,
        'X-YouTube-Client-Version': clientDef.client.clientVersion,
      },
      authHeaders(joinCookie())
    ),
  });
}

async function getStreams(id) {
  id = String(id || '').trim();
  var vid = id;
  var m = /^ytm:t:(.+)$/.exec(id) || /^ytm:(.+)$/.exec(id);
  if (m) vid = m[1];
  // bare video id
  if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) {
    var m2 = /([A-Za-z0-9_-]{11})/.exec(vid);
    if (m2) vid = m2[1];
  }
  if (!/^[A-Za-z0-9_-]{11}$/.test(vid)) {
    return { streams: [] };
  }

  var pref = (cfg().quality || 'aac').toString().toLowerCase();
  var streams = [];
  var lastErr = null;

  for (var i = 0; i < CLIENTS.length; i++) {
    var cl = CLIENTS[i];
    try {
      var data = await playerFor(vid, cl);
      var sd = data.streamingData || {};
      // HLS
      if (cl.hls && sd.hlsManifestUrl) {
        streams.push({
          url: sd.hlsManifestUrl,
          name: 'YouTube Music · HLS',
          quality: 'Auto',
          language: 'Audio',
          provider: 'ytmusic',
          isHls: true,
          audioOnly: true,
          headers: {
            'User-Agent': cl.ua,
            Referer: 'https://www.youtube.com/',
            Origin: 'https://www.youtube.com',
          },
        });
        break;
      }
      var formats = (sd.adaptiveFormats || []).concat(sd.formats || []);
      var ordered = orderFormats(formats, pref);
      for (var j = 0; j < ordered.length && j < 4; j++) {
        var f = ordered[j];
        streams.push({
          url: f.url,
          name: 'YouTube Music · ' + describeFmt(f),
          quality: Math.round((f.bitrate || 0) / 1000) + 'k',
          language: 'Audio',
          provider: 'ytmusic',
          isHls: false,
          audioOnly: true,
          headers: {
            'User-Agent': cl.ua,
            Referer: 'https://www.youtube.com/',
            Origin: 'https://www.youtube.com',
            Range: 'bytes=0-',
          },
        });
      }
      if (streams.length) break;
    } catch (e) {
      lastErr = e;
    }
  }

  if (!streams.length && lastErr) {
    return {
      streams: [],
      error: String(lastErr.message || lastErr),
    };
  }
  return { streams: streams };
}

async function getNews() {
  try {
    var data = await yt('browse', { browseId: 'FEmusic_charts' });
    var items = collectItems(data)
      .slice(0, 12)
      .map(function (x) {
        return {
          title: x.title || 'Track',
          message: x.artist || 'YouTube Music',
          poster: x.poster,
          banner: x.poster,
          id: 'ytm:t:' + x.id,
          imageStyle: 'banner',
        };
      });
    return { items: items };
  } catch (e) {
    return { items: [] };
  }
}

async function getCatalogs() {
  return {
    catalogs: [
      { id: 'ytm_home', title: 'Inicio YT Music' },
      { id: 'ytm_charts', title: 'Tendencias' },
    ],
  };
}

async function getCatalog(catalogId) {
  if (String(catalogId).indexOf('chart') >= 0) {
    var data = await yt('browse', { browseId: 'FEmusic_charts' });
    return {
      items: collectItems(data).slice(0, 40).map(toContentItem).filter(Boolean),
      hasMore: false,
    };
  }
  var home = await getHome();
  var all = [];
  (home.rows || []).forEach(function (r) {
    (r.items || []).forEach(function (it) {
      all.push(it);
    });
  });
  return { items: all.slice(0, 40), hasMore: false };
}

if (typeof module !== 'undefined') {
  module.exports = {
    getHome: getHome,
    search: search,
    getMeta: getMeta,
    getStreams: getStreams,
    getNews: getNews,
    getCatalogs: getCatalogs,
    getCatalog: getCatalog,
  };
}
