window.HOME_CATALOG = {
  "apps": [
    {
      "id": "il.co.partnertv",
      "title": "Partner TV+",
      "icon": "icons/il.co.partnertv.svg",
      "color": "#7d83a5",
      "params": {}
    },
    {
      "id": "org.jellyfin.webos",
      "title": "Jellyfin",
      "icon": "icons/org.jellyfin.webos.svg",
      "color": "#655bdf",
      "params": {}
    },
    {
      "id": "com.applicaster.il.ch1",
      "title": "כאן BOX",
      "icon": "icons/com.applicaster.il.ch1.svg",
      "color": "#7d83a5",
      "params": {}
    },
    {
      "id": "io.strem.tv",
      "title": "Stremio",
      "icon": "icons/io.strem.tv.svg",
      "color": "#7357ec",
      "params": {}
    },
    {
      "id": "netflix",
      "title": "Netflix",
      "icon": "icons/netflix.svg",
      "color": "#e50914",
      "params": {}
    },
    {
      "id": "com.apple.appletv",
      "title": "Apple TV",
      "icon": "icons/com.apple.appletv.svg",
      "color": "#cacbd1",
      "params": {}
    },
    {
      "id": "spotify-beehive",
      "title": "Spotify",
      "icon": "icons/spotify-beehive.svg",
      "color": "#1db954",
      "params": {}
    },
    {
      "id": "youtube.leanback.v4",
      "title": "YouTube",
      "icon": "icons/youtube.leanback.v4.svg",
      "color": "#ff3030",
      "params": {}
    },
    {
      "id": "com.crunchyroll.webapp",
      "title": "Crunchyroll",
      "icon": "icons/com.crunchyroll.webapp.svg",
      "color": "#f47521",
      "params": {}
    },
    {
      "id": "makotv",
      "title": "12+",
      "icon": "icons/makotv.svg",
      "color": "#7d83a5",
      "params": {}
    },
    {
      "id": "com.disney.disneyplus-prod",
      "title": "Disney+",
      "icon": "icons/com.disney.disneyplus-prod.svg",
      "color": "#007b9c",
      "params": {}
    }
  ],
  "inputs": [
    {
      "key": "hdmi1",
      "id": "com.webos.app.hdmi1",
      "title": "HDMI 1",
      "subtitle": "Input 1",
      "glyph": "hdmi"
    },
    {
      "key": "hdmi2",
      "id": "com.webos.app.hdmi2",
      "title": "HDMI 2",
      "subtitle": "Input 2",
      "glyph": "hdmi"
    },
    {
      "key": "hdmi3",
      "id": "com.webos.app.hdmi3",
      "title": "HDMI 3",
      "subtitle": "Input 3",
      "glyph": "hdmi"
    },
    {
      "key": "hdmi4",
      "id": "com.webos.app.hdmi4",
      "title": "HDMI 4",
      "subtitle": "Input 4",
      "glyph": "hdmi"
    }
  ]
};
window.HOME_CATALOG.apps.forEach(function (app) { app.key = app.id; });
