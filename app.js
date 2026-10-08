(function () {
  "use strict";
  var L = window.League;
  var cfg = window.LEAGUE_CONFIG || {};
  var S = {
    status: "loading", tab: "table", teams: [], matches: [], isAdmin: false, email: "",
    editing: null, fGroup: "all", fTeam: "all", busy: false, notice: "", wipe: false,
    showLogin: false, err: ""
  };
  var sb = null;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(s) { return document.querySelector(s); }
  function teamById(id) {
    for (var i = 0; i < S.teams.length; i++) if (S.teams[i].id === id) return S.teams[i];
    return null;
  }
  function groupsList() {
    var s = {};
    S.teams.forEach(function (t) { s[t.grp] = 1; });
    return Object.keys(s).sort();
  }
  function fmtDate(s) {
    if (!s) return "Date TBC";
    var d = new Date(s + "T00:00:00");
    if (isNaN(d)) return s;
    return d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  }
  function slotName(slot) {
    var id = L.resolve(slot, S.teams, S.matches), t = id && teamById(id);
    return t ? { name: t.name, known: true } : { name: L.slotLabel(slot, S.matches), known: false };
  }
  function msg(e) {
    if (!e) return "Unknown error.";
    if (e.code === "42501" || e.code === "PGRST301") return "You are not signed in as an organiser.";
    if (e.code === "23505") return "That already exists.";
    return e.message || String(e);
  }

  /* ---------- views ---------- */
  function viewTable() {
    var gs = groupsList(), out = "";
    var pm = S.matches.filter(L.isPlayed), total = S.matches.length;
    if (pm.length) {
      var goals = pm.reduce(function (s, m) { return s + m.hg + m.ag; }, 0), big = null;
      pm.forEach(function (m) { if (!big || Math.abs(m.hg - m.ag) > Math.abs(big.hg - big.ag)) big = m; });
      out += '<ul class="facts"><li><b>' + pm.length + "/" + total + "</b><span>Matches played</span></li>" +
        "<li><b>" + goals + "</b><span>Goals</span></li>" +
        "<li><b>" + (goals / pm.length).toFixed(1) + "</b><span>Per match</span></li>" +
        (big && big.hg !== big.ag
          ? "<li><b>" + big.hg + "–" + big.ag + "</b><span>Biggest win · " + esc(slotName(big.home).name) + " v " + esc(slotName(big.away).name) + "</span></li>"
          : "") + "</ul>";
    }
    gs.forEach(function (g) {
      var rows = L.standings(g, S.teams, S.matches);
      out += "<section><h2>Group " + esc(g) + '</h2><div class="panel"><div class="scroll"><table class="tbl"><thead><tr>' +
        '<th class="pos">#</th><th class="team">Team</th><th>P</th><th>W</th><th>D</th><th>L</th>' +
        '<th class="hide-s">GF</th><th class="hide-s">GA</th><th>GD</th><th>Pts</th><th class="hide-s">Form</th></tr></thead><tbody>';
      rows.forEach(function (r, i) {
        var gd = r.gf - r.ga;
        out += '<tr><td class="pos"><span class="dot' + (i < 2 ? "" : " off") + '"></span>' + (i + 1) + "</td>" +
          '<td class="team">' + esc(r.name) + "</td><td>" + r.p + "</td><td>" + r.w + "</td><td>" + r.d + "</td><td>" + r.l + "</td>" +
          '<td class="hide-s">' + r.gf + '</td><td class="hide-s">' + r.ga + "</td><td>" + (gd > 0 ? "+" : "") + gd + "</td>" +
          '<td class="pts">' + r.pts + '</td><td class="hide-s"><span class="form">' +
          r.form.slice(-5).map(function (f) { return '<span class="chip ' + f + '">' + f + "</span>"; }).join("") + "</span></td></tr>";
      });
      out += '</tbody></table></div><div class="key"><span><span class="dot"></span>Top two go through to the knockout</span>' +
        "<span>Ranked by points, then goal difference, then goals scored</span></div></div></section>";
    });
    return out;
  }

  function editForm(m, h, a) {
    var ko = m.stage !== "group";
    function v(x) { return x == null ? "" : esc(x); }
    return '<form class="fix editing" data-form="score" data-id="' + esc(m.id) + '">' +
      '<div class="edit"><span class="who">' + esc(h.name) + "</span>" +
      '<input id="e-hg" type="number" min="0" max="99" inputmode="numeric" aria-label="' + esc(h.name) + ' goals" value="' + v(m.hg) + '"> <span>–</span> ' +
      '<input id="e-ag" type="number" min="0" max="99" inputmode="numeric" aria-label="' + esc(a.name) + ' goals" value="' + v(m.ag) + '">' +
      '<span class="who">' + esc(a.name) + "</span></div>" +
      '<div class="edit">' + (ko
        ? '<span class="tag">If level, penalties</span><input id="e-ph" type="number" min="0" max="99" inputmode="numeric" aria-label="Home penalties" value="' + v(m.ph) + '"> <span>–</span> ' +
          '<input id="e-pa" type="number" min="0" max="99" inputmode="numeric" aria-label="Away penalties" value="' + v(m.pa) + '">'
        : "") +
      '<input id="e-date" type="date" aria-label="Match date" value="' + v(m.match_date) + '"></div>' +
      '<div class="edit"><button class="btn" type="submit"' + (S.busy ? " disabled" : "") + ">Save result</button>" +
      '<button class="btn ghost" type="button" data-act="cancel">Cancel</button>' +
      (L.isPlayed(m) ? '<button class="btn ghost" type="button" data-act="clear" data-id="' + esc(m.id) + '">Clear result</button>' : "") +
      "</div></form>";
  }

  function matchRow(m) {
    var h = slotName(m.home), a = slotName(m.away), pl = L.isPlayed(m);
    if (S.editing === m.id && h.known && a.known) return editForm(m, h, a);
    var score = pl
      ? '<span class="score"><b>' + m.hg + "</b><i>–</i><b>" + m.ag + "</b></span>"
      : '<span class="score vs">vs</span>';
    var act = S.isAdmin
      ? '<button class="link" data-act="edit" data-id="' + esc(m.id) + '"' + (h.known && a.known ? "" : " disabled") + ">" + (pl ? "Edit" : "Enter score") + "</button>"
      : "";
    return '<div class="fix"><span class="date">' + esc(fmtDate(m.match_date)) + "</span>" +
      '<span class="home' + (h.known ? "" : " tbc") + '">' + esc(h.name) + "</span>" +
      '<span class="mid">' + score + "</span>" +
      '<span class="away' + (a.known ? "" : " tbc") + '">' + esc(a.name) + "</span>" +
      '<span class="act">' + act + "</span></div>";
  }

  function viewFixtures() {
    var gs = groupsList(), gm = S.matches.filter(function (m) { return m.stage === "group"; });
    var f = gm.filter(function (m) {
      if (S.fGroup !== "all" && m.grp !== S.fGroup) return false;
      if (S.fTeam !== "all" && m.home !== S.fTeam && m.away !== S.fTeam) return false;
      return true;
    }).sort(L.cmpMatch);
    var teamOpts = '<option value="all">All teams</option>' + S.teams.slice().sort(function (a, b) { return a.name.localeCompare(b.name); })
      .map(function (t) { return '<option value="' + esc(t.id) + '"' + (S.fTeam === t.id ? " selected" : "") + ">" + esc(t.name) + "</option>"; }).join("");
    var out = "<section><h2>Fixtures and results</h2>" +
      '<div class="filters"><label>Group<select id="f-group"><option value="all">All groups</option>' +
      gs.map(function (g) { return '<option value="' + esc(g) + '"' + (S.fGroup === g ? " selected" : "") + ">Group " + esc(g) + "</option>"; }).join("") +
      '</select></label><label>Team<select id="f-team">' + teamOpts + "</select></label></div>";
    if (!gm.length) {
      return out + '<div class="panel empty" style="margin-top:14px"><b>No fixtures yet</b>' +
        (S.isAdmin ? "Create the group fixtures from the Manage tab." : "The schedule will appear here once the organisers publish it.") + "</div></section>";
    }
    if (!f.length) return out + '<p class="note" style="margin-top:14px">No matches for that filter.</p></section>';
    var cur = null;
    f.forEach(function (m) {
      if (m.matchday !== cur) { cur = m.matchday; out += '<div class="md"><h3 style="margin:0">Matchday ' + esc(m.matchday) + "</h3></div>"; }
      out += matchRow(m);
    });
    return out + "</section>";
  }

  function viewKnockout() {
    var ko = S.matches.filter(function (m) { return m.stage !== "group"; });
    if (!ko.length) {
      return "<section><h2>Knockout</h2>" + '<div class="panel empty"><b>Bracket not drawn yet</b>' +
        (S.isAdmin ? "Once group fixtures exist, create the bracket from the Manage tab." : "It appears after the group stage is scheduled. The top two in each group go through.") + "</div></section>";
    }
    var stages = ["qf", "sf", "final"].filter(function (s) { return ko.some(function (m) { return m.stage === s; }); });
    var out = "<section><h2>Knockout</h2>";
    var fin = ko.filter(function (m) { return m.stage === "final"; })[0];
    if (fin) {
      var w = L.winnerOf(fin);
      if (w) {
        var id = L.resolve(w === "home" ? fin.home : fin.away, S.teams, S.matches), t = id && teamById(id);
        if (t) out += '<div class="champ"><span>Batch 2025 champions</span><b>' + esc(t.name) + "</b></div>";
      }
    }
    out += '<div class="bracket">';
    stages.forEach(function (s) {
      out += '<div class="round"><h3>' + (s === "final" ? "Final" : L.STAGE[s] + "s") + "</h3>";
      ko.filter(function (m) { return m.stage === s; }).sort(function (a, b) { return (a.slot_n || 0) - (b.slot_n || 0); }).forEach(function (m) {
        var h = slotName(m.home), a = slotName(m.away), pl = L.isPlayed(m), w2 = L.winnerOf(m);
        if (S.editing === m.id && h.known && a.known) { out += '<div class="tie">' + editForm(m, h, a) + "</div>"; return; }
        out += '<div class="tie"><div class="row' + (w2 === "away" ? " lost" : "") + '"><span class="nm' + (h.known ? "" : " pending") + '">' + esc(h.name) + '</span><span class="g">' + (pl ? m.hg : "") + "</span></div>" +
          '<div class="row' + (w2 === "home" ? " lost" : "") + '"><span class="nm' + (a.known ? "" : " pending") + '">' + esc(a.name) + '</span><span class="g">' + (pl ? m.ag : "") + "</span></div>" +
          '<div class="meta"><span class="tag">' + esc(L.matchLabel(m)) +
          (pl && m.hg === m.ag && Number.isInteger(m.ph) ? " · pens " + m.ph + "–" + m.pa : "") +
          (m.match_date ? " · " + esc(fmtDate(m.match_date)) : "") + "</span>" +
          (S.isAdmin ? '<button class="link" data-act="edit" data-id="' + esc(m.id) + '"' + (h.known && a.known ? "" : " disabled") + ">" + (pl ? "Edit" : "Enter score") + "</button>" : "") +
          "</div></div>";
      });
      out += "</div>";
    });
    return out + "</div></section>";
  }

  function viewManage(noTeams) {
    var out = '<section class="stack"><h2>Manage league</h2>';
    if (noTeams) out += '<p class="note">Start by adding teams to groups. Two groups of four works well: the top two in each go to the semi-finals.</p>';
    out += '<div class="panel stack"><h3 style="margin:0">Teams</h3>' +
      '<form class="addrow" data-form="team"><label>Team name<input id="t-name" type="text" maxlength="40" autocomplete="off" placeholder="e.g. Section C FC"></label>' +
      '<label>Group<select id="t-group">' + ["A", "B", "C", "D"].map(function (g) { return '<option value="' + g + '">Group ' + g + "</option>"; }).join("") + "</select></label>" +
      '<button class="btn" type="submit"' + (S.busy ? " disabled" : "") + ">Add team</button></form>";
    if (S.teams.length) {
      out += '<div class="cols">';
      groupsList().forEach(function (g) {
        out += "<div><h3>Group " + esc(g) + '</h3><ul class="tlist">' +
          S.teams.filter(function (t) { return t.grp === g; }).sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (t) {
            var used = S.matches.some(function (m) { return m.home === t.id || m.away === t.id; });
            return "<li><span>" + esc(t.name) + '</span><button class="link" data-act="rm-team" data-id="' + esc(t.id) + '"' +
              (used || S.busy ? ' disabled title="Erase the fixtures first"' : "") + ">Remove</button></li>";
          }).join("") + "</ul></div>";
      });
      out += "</div>";
    }
    out += "</div>";
    var hasG = S.matches.some(function (m) { return m.stage === "group"; });
    var hasK = S.matches.some(function (m) { return m.stage !== "group"; });
    var gl = groupsList();
    var okG = gl.length > 0 && gl.every(function (g) { return S.teams.filter(function (t) { return t.grp === g; }).length >= 2; });
    out += '<div class="panel stack"><h3 style="margin:0">Fixtures</h3>' +
      '<p class="note">Group fixtures are single round-robin: every team plays the others in its group once. Set dates and enter scores from the Fixtures tab.</p>' +
      '<div class="actions"><button class="btn" data-act="gen-groups"' + (hasG || !okG || S.busy ? " disabled" : "") + ">Create group fixtures</button>" +
      '<button class="btn" data-act="gen-ko"' + (hasK || !hasG || S.busy ? " disabled" : "") + ">Create knockout bracket</button></div>" +
      (hasG ? '<p class="note">' + S.matches.filter(function (m) { return m.stage === "group"; }).length + " group matches" +
        (hasK ? " and " + S.matches.filter(function (m) { return m.stage !== "group"; }).length + " knockout matches" : "") + " exist.</p>" : "") + "</div>";
    out += '<div class="panel stack"><h3 style="margin:0">Data</h3><div class="actions">' +
      (S.wipe
        ? '<button class="btn danger" data-act="wipe-yes"' + (S.busy ? " disabled" : "") + ">Yes, erase all teams and matches</button>" +
          '<button class="btn ghost" data-act="wipe-no">Keep them</button>'
        : '<button class="btn ghost" data-act="wipe"' + (S.teams.length || S.matches.length ? "" : " disabled") + ">Erase everything</button>") +
      "</div></div></section>";
    return out;
  }

  function viewLogin() {
    return '<section class="panel stack"><h3 style="margin:0">Organiser sign in</h3>' +
      '<form class="login" data-form="login"><label>Email<input id="l-email" type="email" autocomplete="username" required></label>' +
      '<label>Password<input id="l-pass" type="password" autocomplete="current-password" required></label>' +
      '<button class="btn" type="submit"' + (S.busy ? " disabled" : "") + '>Sign in</button>' +
      '<button class="btn ghost" type="button" data-act="login-close">Cancel</button></form>' +
      '<p class="note">Only organisers can enter scores. Everyone else sees the league without signing in.</p></section>';
  }

  /* ---------- render ---------- */
  function render() {
    var app = $("#app"), tabs = $("#tabs"), foot = $("#foot");
    var ae = document.activeElement, focusId = ae && ae.id ? ae.id : null, selS = null, selE = null;
    try { if (ae && ae.selectionStart != null) { selS = ae.selectionStart; selE = ae.selectionEnd; } } catch (e) {}
    var html = "", tabHtml = "";
    if (S.status === "setup") {
      html = '<div class="panel empty"><b>Setup needed</b>Add your Supabase project URL and key to config.js, then reload. The README has the steps.</div>';
    } else if (S.status === "loading") {
      html = '<div class="skel"></div>';
    } else if (S.status === "error") {
      html = '<div class="panel empty"><b>Could not load the league</b>' + esc(S.err) + '<br><button class="btn" style="margin-top:12px" data-act="retry">Try again</button></div>';
    } else {
      var noTeams = S.teams.length === 0;
      var list = [["table", "Table"], ["fixtures", "Fixtures"], ["knockout", "Knockout"]];
      if (S.isAdmin) list.push(["manage", "Manage"]);
      var tab = S.tab;
      if (tab === "manage" && !S.isAdmin) tab = "table";
      if (noTeams && S.isAdmin) { S.tab = "manage"; tab = "manage"; }
      tabHtml = list.map(function (t) {
        return '<button class="tab" role="tab" data-act="tab" data-tab="' + t[0] + '" aria-selected="' + (tab === t[0]) + '">' + t[1] + "</button>";
      }).join("");
      if (S.notice) html += '<div class="toast" role="status">' + esc(S.notice) + "</div>";
      if (S.showLogin && !S.isAdmin) html += viewLogin();
      if (noTeams && !S.isAdmin) html += '<div class="panel empty"><b>Teams are not in yet</b>The organisers are still setting the league up. Check back soon.</div>';
      else if (tab === "table") html += viewTable();
      else if (tab === "fixtures") html += viewFixtures();
      else if (tab === "knockout") html += viewKnockout();
      else html += viewManage(noTeams);
    }
    tabs.innerHTML = tabHtml;
    app.innerHTML = html;
    foot.innerHTML = '<span>Updates appear automatically.</span><button class="link" data-act="theme">Switch light / dark</button>' +
      (S.status === "ready" ? (S.isAdmin
        ? '<span>Signed in as ' + esc(S.email) + '</span><button class="link" data-act="signout">Sign out</button>'
        : '<button class="link" data-act="login-open">Organiser sign in</button>') : "");
    if (focusId) {
      var f = document.getElementById(focusId);
      if (f) { f.focus(); try { if (selS != null) f.setSelectionRange(selS, selE); } catch (e) {} }
    }
  }

  /* ---------- data ---------- */
  async function load() {
    var r = await Promise.all([sb.from("teams").select("*"), sb.from("matches").select("*")]);
    if (r[0].error) throw r[0].error;
    if (r[1].error) throw r[1].error;
    S.teams = r[0].data || [];
    S.matches = r[1].data || [];
    S.status = "ready";
    S.err = "";
  }
  async function refresh() {
    try { await load(); } catch (e) { if (S.status !== "ready") S.status = "error"; S.err = msg(e); }
    if (!S.editing) render();
  }
  async function checkAdmin() {
    var s = await sb.auth.getSession(), sess = s.data && s.data.session;
    if (!sess) { S.isAdmin = false; S.email = ""; return; }
    S.email = sess.user.email || "";
    var r = await sb.rpc("is_admin");
    S.isAdmin = r.data === true;
  }

  async function write(fn, okMsg) {
    S.busy = true; S.notice = ""; render();
    try {
      var r = await fn();
      if (r && r.error) throw r.error;
      if (okMsg) S.notice = typeof okMsg === "function" ? okMsg(r) : okMsg;
      await load();
    } catch (e) { S.notice = "That did not save: " + msg(e); }
    S.busy = false; render();
  }

  async function addTeam(name, grp) {
    name = name.trim();
    if (!name) { S.notice = "Enter a team name."; render(); return; }
    await write(function () { return sb.from("teams").insert({ name: name, grp: grp }); });
  }
  async function genGroups() {
    var made = 0;
    await write(async function () {
      var c = await sb.from("matches").select("id", { count: "exact", head: true }).eq("stage", "group");
      if (c.error) return c;
      if (c.count > 0) throw new Error("Group fixtures already exist.");
      var rows = L.groupFixtureRows(S.teams);
      made = rows.length;
      var r = await sb.from("matches").insert(rows);
      if (!r.error) S.tab = "fixtures";
      return r;
    }, function () { return "Group fixtures created (" + made + " matches). Enter scores and dates from here."; });
  }
  async function genKnockout() {
    var rows = L.knockoutRows(groupsList());
    if (!rows) { S.notice = "The bracket needs two or four groups. You have " + groupsList().length + "."; render(); return; }
    await write(async function () {
      var r = await sb.from("matches").upsert(rows, { onConflict: "id" });
      if (!r.error) S.tab = "knockout";
      return r;
    }, "Knockout bracket created. It fills in as the group stage finishes.");
  }
  async function saveScore(id) {
    var m = S.matches.filter(function (x) { return x.id === id; })[0];
    if (!m) return;
    function num(i) {
      var el = document.getElementById(i);
      if (!el || el.value === "") return null;
      var n = Number(el.value);
      return Number.isInteger(n) && n >= 0 && n <= 99 ? n : NaN;
    }
    var hg = num("e-hg"), ag = num("e-ag");
    if (hg === null || ag === null || isNaN(hg) || isNaN(ag)) { S.notice = "Enter whole-number goals for both teams."; render(); return; }
    var dEl = document.getElementById("e-date");
    var upd = { hg: hg, ag: ag, played: true, match_date: dEl && dEl.value ? dEl.value : null };
    if (m.stage !== "group") {
      var ph = num("e-ph"), pa = num("e-pa");
      if (hg === ag) {
        if (ph === null || pa === null || isNaN(ph) || isNaN(pa) || ph === pa) { S.notice = "A drawn knockout match needs a penalty result with a winner."; render(); return; }
        upd.ph = ph; upd.pa = pa;
      } else { upd.ph = null; upd.pa = null; }
    }
    S.editing = null;
    await write(function () { return sb.from("matches").update(upd).eq("id", id); });
  }
  async function clearScore(id) {
    S.editing = null;
    await write(function () { return sb.from("matches").update({ hg: null, ag: null, ph: null, pa: null, played: false }).eq("id", id); });
  }
  async function wipeAll() {
    S.wipe = false;
    await write(async function () {
      var a = await sb.from("matches").delete().neq("id", "");
      if (a.error) return a;
      return sb.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }, "Everything erased.");
  }
  async function signIn(email, pass) {
    S.busy = true; S.notice = ""; render();
    var r = await sb.auth.signInWithPassword({ email: email, password: pass });
    if (r.error) { S.notice = "Could not sign in: " + r.error.message; }
    else {
      await checkAdmin();
      S.showLogin = false;
      S.notice = S.isAdmin ? "" : "Signed in, but this email is not on the organiser list.";
    }
    S.busy = false; render();
  }
  async function signOut() {
    await sb.auth.signOut();
    S.isAdmin = false; S.email = ""; S.editing = null;
    if (S.tab === "manage") S.tab = "table";
    render();
  }

  /* ---------- events ---------- */
  document.addEventListener("click", function (e) {
    var el = e.target.closest("[data-act]");
    if (!el) return;
    var act = el.getAttribute("data-act"), id = el.getAttribute("data-id");
    if (act === "tab") {
      S.tab = el.getAttribute("data-tab"); S.editing = null; S.notice = "";
      try { localStorage.setItem("league-tab", S.tab); } catch (x) {}
      render();
    } else if (act === "edit") { S.editing = id; S.notice = ""; render(); }
    else if (act === "cancel") { S.editing = null; render(); }
    else if (act === "clear") clearScore(id);
    else if (act === "rm-team") write(function () { return sb.from("teams").delete().eq("id", id); });
    else if (act === "gen-groups") genGroups();
    else if (act === "gen-ko") genKnockout();
    else if (act === "wipe") { S.wipe = true; render(); }
    else if (act === "wipe-no") { S.wipe = false; render(); }
    else if (act === "wipe-yes") wipeAll();
    else if (act === "login-open") { S.showLogin = true; S.notice = ""; render(); }
    else if (act === "login-close") { S.showLogin = false; render(); }
    else if (act === "signout") signOut();
    else if (act === "retry") { S.status = "loading"; render(); refresh(); }
    else if (act === "theme") {
      var root = document.documentElement;
      var dark = root.getAttribute("data-theme") ? root.getAttribute("data-theme") === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
      var next = dark ? "light" : "dark";
      root.setAttribute("data-theme", next);
      try { localStorage.setItem("league-theme", next); } catch (x) {}
    }
  });
  document.addEventListener("change", function (e) {
    var el = e.target;
    if (el.id === "f-group") { S.fGroup = el.value; render(); }
    else if (el.id === "f-team") { S.fTeam = el.value; render(); }
  });
  document.addEventListener("submit", function (e) {
    var f = e.target.closest("form[data-form]");
    if (!f) return;
    e.preventDefault();
    var kind = f.getAttribute("data-form");
    if (kind === "team") addTeam(document.getElementById("t-name").value, document.getElementById("t-group").value);
    else if (kind === "score") saveScore(f.getAttribute("data-id"));
    else if (kind === "login") signIn(document.getElementById("l-email").value.trim(), document.getElementById("l-pass").value);
  });

  /* ---------- boot ---------- */
  async function init() {
    try { var th = localStorage.getItem("league-theme"); if (th === "light" || th === "dark") document.documentElement.setAttribute("data-theme", th); } catch (e) {}
    try { var t = localStorage.getItem("league-tab"); if (t === "table" || t === "fixtures" || t === "knockout") S.tab = t; } catch (e) {}
    var ok = window.supabase && cfg.SUPABASE_URL && /^https:\/\//.test(cfg.SUPABASE_URL) && cfg.SUPABASE_ANON_KEY && cfg.SUPABASE_ANON_KEY.length > 30;
    if (!ok) { S.status = "setup"; render(); return; }
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
    render();
    await refresh();
    try { await checkAdmin(); } catch (e) {}
    render();
    sb.auth.onAuthStateChange(function () { setTimeout(function () { checkAdmin().then(render); }, 0); });
    var timer = null;
    function schedule() { clearTimeout(timer); timer = setTimeout(refresh, 300); }
    sb.channel("league-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "teams" }, schedule)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, schedule)
      .subscribe();
    setInterval(function () { if (!document.hidden) refresh(); }, 60000);
  }
  init();
})();
