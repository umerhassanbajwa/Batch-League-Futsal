(function (root) {
  "use strict";
  var STAGE = { qf: "Quarter-final", sf: "Semi-final", final: "Final" };

  function isPlayed(m) {
    return m.played === true && Number.isInteger(m.hg) && Number.isInteger(m.ag);
  }
  function cmpMatch(a, b) {
    return (a.matchday || 0) - (b.matchday || 0) ||
      String(a.match_date || "~").localeCompare(String(b.match_date || "~")) ||
      (a.sort_order || 0) - (b.sort_order || 0);
  }
  function ord(n) { return n === 1 ? "1st" : n === 2 ? "2nd" : n === 3 ? "3rd" : n + "th"; }

  function roundRobin(ids) {
    var a = ids.slice();
    if (a.length % 2) a.push(null);
    var n = a.length, rounds = [];
    for (var r = 0; r < n - 1; r++) {
      var pairs = [];
      for (var i = 0; i < n / 2; i++) {
        var x = a[i], y = a[n - 1 - i];
        if (x && y) pairs.push(r % 2 ? [y, x] : [x, y]);
      }
      rounds.push(pairs);
      a.splice(1, 0, a.pop());
    }
    return rounds;
  }

  function standings(g, teams, matches) {
    var row = {};
    teams.filter(function (t) { return t.grp === g; }).forEach(function (t) {
      row[t.id] = { id: t.id, name: t.name, p: 0, w: 0, d: 0, l: 0, gf: 0, ga: 0, pts: 0, form: [] };
    });
    matches.filter(function (m) { return m.stage === "group" && m.grp === g && isPlayed(m); })
      .sort(cmpMatch).forEach(function (m) {
        var h = row[m.home], a = row[m.away];
        if (!h || !a) return;
        h.p++; a.p++; h.gf += m.hg; h.ga += m.ag; a.gf += m.ag; a.ga += m.hg;
        if (m.hg > m.ag) { h.w++; a.l++; h.pts += 3; h.form.push("W"); a.form.push("L"); }
        else if (m.hg < m.ag) { a.w++; h.l++; a.pts += 3; a.form.push("W"); h.form.push("L"); }
        else { h.d++; a.d++; h.pts++; a.pts++; h.form.push("D"); a.form.push("D"); }
      });
    return Object.keys(row).map(function (k) { return row[k]; }).sort(function (x, y) {
      return y.pts - x.pts || (y.gf - y.ga) - (x.gf - x.ga) || y.gf - x.gf || x.name.localeCompare(y.name);
    });
  }

  function groupDone(g, matches) {
    var ms = matches.filter(function (m) { return m.stage === "group" && m.grp === g; });
    return ms.length > 0 && ms.every(isPlayed);
  }

  function winnerOf(m) {
    if (!isPlayed(m)) return null;
    var h = m.hg, a = m.ag;
    if (h === a && m.stage !== "group" && Number.isInteger(m.ph) && Number.isInteger(m.pa)) { h = m.ph; a = m.pa; }
    if (h > a) return "home";
    if (a > h) return "away";
    return null;
  }

  function resolve(slot, teams, matches) {
    if (!slot) return null;
    if (slot.indexOf("pos:") === 0) {
      var p = slot.split(":"), g = p[1], n = +p[2];
      if (!groupDone(g, matches)) return null;
      var r = standings(g, teams, matches)[n - 1];
      return r ? r.id : null;
    }
    if (slot.indexOf("win:") === 0) {
      var id = slot.slice(4);
      var m = matches.filter(function (x) { return x.id === id; })[0];
      if (!m) return null;
      var w = winnerOf(m);
      if (!w) return null;
      return resolve(w === "home" ? m.home : m.away, teams, matches);
    }
    return teams.some(function (t) { return t.id === slot; }) ? slot : null;
  }

  function matchLabel(m) {
    return m.stage === "final" ? "Final" : (STAGE[m.stage] || "Match") + " " + (m.slot_n || "");
  }

  function slotLabel(slot, matches) {
    if (slot && slot.indexOf("pos:") === 0) {
      var p = slot.split(":");
      return ord(+p[2]) + " Group " + p[1];
    }
    if (slot && slot.indexOf("win:") === 0) {
      var m = matches.filter(function (x) { return x.id === slot.slice(4); })[0];
      return "Winner " + (m ? matchLabel(m) : "TBD");
    }
    return "TBD";
  }

  function groupFixtureRows(teams) {
    var groups = {};
    teams.forEach(function (t) { (groups[t.grp] = groups[t.grp] || []).push(t); });
    var rows = [], order = 0;
    Object.keys(groups).sort().forEach(function (g) {
      var ids = groups[g].slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
        .map(function (t) { return t.id; });
      roundRobin(ids).forEach(function (pairs, r) {
        pairs.forEach(function (p) {
          rows.push({ stage: "group", grp: g, matchday: r + 1, sort_order: order++, home: p[0], away: p[1], played: false });
        });
      });
    });
    return rows;
  }

  function knockoutRows(groupNames) {
    var g = groupNames;
    var defs;
    if (g.length === 2) {
      defs = [
        ["ko-sf1", "sf", 1, "pos:" + g[0] + ":1", "pos:" + g[1] + ":2"],
        ["ko-sf2", "sf", 2, "pos:" + g[1] + ":1", "pos:" + g[0] + ":2"],
        ["ko-final", "final", 1, "win:ko-sf1", "win:ko-sf2"]
      ];
    } else if (g.length === 4) {
      defs = [
        ["ko-qf1", "qf", 1, "pos:" + g[0] + ":1", "pos:" + g[1] + ":2"],
        ["ko-qf2", "qf", 2, "pos:" + g[2] + ":1", "pos:" + g[3] + ":2"],
        ["ko-qf3", "qf", 3, "pos:" + g[1] + ":1", "pos:" + g[0] + ":2"],
        ["ko-qf4", "qf", 4, "pos:" + g[3] + ":1", "pos:" + g[2] + ":2"],
        ["ko-sf1", "sf", 1, "win:ko-qf1", "win:ko-qf2"],
        ["ko-sf2", "sf", 2, "win:ko-qf3", "win:ko-qf4"],
        ["ko-final", "final", 1, "win:ko-sf1", "win:ko-sf2"]
      ];
    } else {
      return null;
    }
    var stageRank = { qf: 101, sf: 102, final: 103 };
    return defs.map(function (d) {
      return { id: d[0], stage: d[1], slot_n: d[2], matchday: stageRank[d[1]], sort_order: d[2], home: d[3], away: d[4], played: false };
    });
  }

  var api = {
    STAGE: STAGE, isPlayed: isPlayed, cmpMatch: cmpMatch, ord: ord, roundRobin: roundRobin,
    standings: standings, groupDone: groupDone, winnerOf: winnerOf, resolve: resolve,
    matchLabel: matchLabel, slotLabel: slotLabel, groupFixtureRows: groupFixtureRows, knockoutRows: knockoutRows
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.League = api;
})(typeof window !== "undefined" ? window : globalThis);
