/* ============================================================
   BJ Win Logic — engine blackjack basic strategy (EXACT EV)
   Model: infinite deck, dealer S17/H17 configurable, BJ 3:2/6:5,
   double after split (DAS) configurable, six card charlie optional.
   Semua keputusan = argmax EV eksak via enumerasi + memoization.
   UMD: browser (window.BJEngine) & Node (module.exports).
   ============================================================ */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BJEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var ACT_NAME = { H: 'HIT', S: 'STAND', D: 'DOUBLE', P: 'SPLIT', BJ: 'BLACKJACK' };

  // nilai blackjack per rank 0..12 (A = 11)
  function v(r) { return r < 8 ? r + 2 : (r < 12 ? 10 : 11); }
  // kunci upcard bandar 1..10 (1 = As)
  function upv(r) { return r === 12 ? 1 : v(r); }
  function isBJPair(r1, r2) { return (r1 === 12 && v(r2) === 10) || (r2 === 12 && v(r1) === 10); }

  // tambah kartu rank r ke (total, soft)
  function addC(total, soft, r) {
    var val = v(r);
    if (val === 11) {
      if (total + 11 <= 21) return { total: total + 11, soft: true };
      return { total: total + 1, soft: soft };
    }
    total += val;
    if (total > 21 && soft) return { total: total - 10, soft: false };
    return { total: total, soft: soft };
  }

  function build(cfg) {
    cfg = cfg || {};
    var s17 = cfg.s17 !== false;
    var bjPays = cfg.bjPays || 1.5;
    var das = cfg.das !== false;
    var charlieN = cfg.charlie === undefined ? 0 : cfg.charlie; // 0 = mati, 6 = six card charlie

    /* ---------- dealer ---------- */
    function playDealer(total, soft, memo) {
      var key = total + '|' + (soft ? 1 : 0);
      if (memo[key]) return memo[key];
      var d = { bust: 0, '17': 0, '18': 0, '19': 0, '20': 0, '21': 0 };
      if (total > 21) { d.bust = 1; return (memo[key] = d); }
      if (total > 17 || (total === 17 && (s17 || !soft))) { d['' + total] = 1; return (memo[key] = d); }
      for (var r = 0; r < 13; r++) {
        var t = addC(total, soft, r), s = playDealer(t.total, t.soft, memo), w = 1 / 13;
        d.bust += s.bust * w; d['17'] += s['17'] * w; d['18'] += s['18'] * w;
        d['19'] += s['19'] * w; d['20'] += s['20'] * w; d['21'] += s['21'] * w;
      }
      return (memo[key] = d);
    }

    // distribusi akhir bandar utk upcard rank u; noBJ = hole card dikondisikan bukan-BJ (peek)
    function dealerDist(u, noBJ) {
      var memo = {}, d = { bust: 0, '17': 0, '18': 0, '19': 0, '20': 0, '21': 0 };
      var ut = addC(0, false, u), ranks = [];
      for (var r = 0; r < 13; r++) {
        if (noBJ) {
          if (u === 12 && r >= 8) continue;        // up As: hole bukan 10-value
          if (u >= 8 && u < 12 && r === 12) continue; // up 10: hole bukan As
        }
        ranks.push(r);
      }
      var w = 1 / ranks.length;
      ranks.forEach(function (r) {
        var t = addC(ut.total, ut.soft, r), s = playDealer(t.total, t.soft, memo);
        d.bust += s.bust * w; d['17'] += s['17'] * w; d['18'] += s['18'] * w;
        d['19'] += s['19'] * w; d['20'] += s['20'] * w; d['21'] += s['21'] * w;
      });
      return d;
    }

    var distCache = {};
    function dist(u) {
      var k = 'u' + upv(u);
      if (!distCache[k]) distCache[k] = dealerDist(u, upv(u) === 1 || upv(u) === 10);
      return distCache[k];
    }
    function pDealerBJ(u) { return upv(u) === 1 ? 4 / 13 : upv(u) === 10 ? 1 / 13 : 0; }

    // EV stand dgn total t vs upcard u (dist sudah dikondisikan no-BJ)
    function sev(t, u) {
      var d = dist(u), e = d.bust;
      [17, 18, 19, 20, 21].forEach(function (x) { e += d['' + x] * (t > x ? 1 : t < x ? -1 : 0); });
      return e;
    }

    /* ---------- pemain (rekursi + memo per upcard) ---------- */
    // nc = jumlah kartu di tangan (dibutuhkan utk aturan charlie)
    function makePlayer(u) {
      var memo = {};
      function best(total, soft, nc) { // tanpa double
        var key = total + '|' + (soft ? 1 : 0) + '|' + nc;
        if (memo[key]) return memo[key];
        var s = sev(total, u), h = 0;
        for (var r = 0; r < 13; r++) {
          var t = addC(total, soft, r);
          if (t.total > 21) h += -1 / 13;
          else if (charlieN && nc + 1 >= charlieN) h += 1 / 13; // charlie: kartu ke-N tanpa bust = menang otomatis
          else h += best(t.total, t.soft, nc + 1).ev / 13;
        }
        var res = h > s ? { ev: h, act: 'H' } : { ev: s, act: 'S' };
        return (memo[key] = res);
      }
      function bestD(total, soft, nc) { // boleh double (2 kartu pertama)
        var s = sev(total, u), h = 0, dd = 0;
        for (var r = 0; r < 13; r++) {
          var t = addC(total, soft, r);
          var hev = t.total > 21 ? -1 : (charlieN && nc + 1 >= charlieN ? 1 : best(t.total, t.soft, nc + 1).ev);
          h += hev / 13;
          dd += (t.total > 21 ? -1 : sev(t.total, u)) / 13;
        }
        dd *= 2;
        var res = { ev: s, act: 'S' };
        if (h > res.ev) res = { ev: h, act: 'H' };
        if (dd > res.ev) res = { ev: dd, act: 'D' };
        return res;
      }
      return { best: best, bestD: bestD };
    }
    var players = {};
    function P(u) { var k = upv(u); if (!players[k]) players[k] = makePlayer(u); return players[k]; }

    function splitEV(rank, u, p) {
      var e = 0, r;
      if (rank === 12) { // As: 1 kartu lalu stand
        for (r = 0; r < 13; r++) { var t = addC(11, true, r); e += sev(t.total, u) / 13; }
        return { ev: 2 * e, act: 'P' };
      }
      for (r = 0; r < 13; r++) {
        var t0 = addC(v(rank), false, r);
        var b = das ? p.bestD(t0.total, t0.soft, 2) : p.best(t0.total, t0.soft, 2);
        e += b.ev / 13;
      }
      return { ev: 2 * e, act: 'P' };
    }

    /* ---------- API ---------- */
    // playerRanks: array rank 0..12 ; dealerRank: rank 0..12
    function decide(playerRanks, dealerRank) {
      var u = dealerRank, p = P(u);
      var t = { total: 0, soft: false };
      playerRanks.forEach(function (r) { t = addC(t.total, t.soft, r); });
      var n = playerRanks.length;
      var pdb = pDealerBJ(u);

      if (n === 2 && isBJPair(playerRanks[0], playerRanks[1])) {
        return {
          action: 'BJ', ev: bjPays * (1 - pdb), total: 21, soft: false, up: upv(u),
          pair: false, alts: null, dealerBJ: pdb
        };
      }
      var pair = n === 2 && playerRanks[0] === playerRanks[1];
      var canD = n === 2;
      var base = canD ? p.bestD(t.total, t.soft, n) : p.best(t.total, t.soft, n);
      // EV tiap aksi utk ditampilkan
      var s = sev(t.total, u), h = 0, dd = null;
      for (var r = 0; r < 13; r++) {
        var t2 = addC(t.total, t.soft, r);
        h += (t2.total > 21 ? -1 : (charlieN && n + 1 >= charlieN ? 1 : p.best(t2.total, t2.soft, n + 1).ev)) / 13;
      }
      if (canD) {
        dd = 0;
        for (var r3 = 0; r3 < 13; r3++) {
          var t3 = addC(t.total, t.soft, r3);
          dd += (t3.total > 21 ? -1 : sev(t3.total, u)) / 13;
        }
        dd *= 2;
      }
      var alts = { H: h, S: s, D: dd, P: null };
      var res = { ev: base.ev, act: base.act };
      if (pair) {
        var sp = splitEV(playerRanks[0], u, p);
        alts.P = sp.ev;
        if (sp.ev > res.ev) res = sp;
      }
      return {
        action: res.act, ev: res.ev, total: t.total, soft: t.soft, up: upv(u),
        pair: pair, pairRank: pair ? playerRanks[0] : -1, alts: alts, dealerBJ: pdb, canDouble: canD
      };
    }

    // house edge konfigurasi ini (EV per 1 unit bet, strategi optimal)
    function gameEV() {
      var ev = 0;
      for (var r1 = 0; r1 < 13; r1++) for (var r2 = 0; r2 < 13; r2++) for (var u = 0; u < 13; u++) {
        var pdb = pDealerBJ(u), hev;
        if (isBJPair(r1, r2)) hev = bjPays * (1 - pdb);
        else {
          var d = decide([r1, r2], u);
          hev = pdb > 0 ? pdb * -1 + (1 - pdb) * d.ev : d.ev;
        }
        ev += hev / 2197;
      }
      return ev;
    }

    // tabel strategi utk tab Info & testing
    function tables() {
      var hard = {}, soft = {}, pair = {};
      var upRank = { 1: 12, 2: 0, 3: 1, 4: 2, 5: 3, 6: 4, 7: 5, 8: 6, 9: 7, 10: 8 };
      for (var u = 1; u <= 10; u++) {
        var ur = upRank[u], p = P(ur), t, s;
        for (t = 4; t <= 21; t++) hard[t + 'v' + u] = p.bestD(t, false, 2).act;
        for (s = 13; s <= 21; s++) soft[s + 'v' + u] = p.bestD(s, true, 2).act;
        [['A', 12], ['2', 0], ['3', 1], ['4', 2], ['5', 3], ['6', 4], ['7', 5], ['8', 6], ['9', 7], ['10', 8]]
          .forEach(function (pr) { pair[pr[0] + 'v' + u] = decide([pr[1], pr[1]], ur).action; });
      }
      return { hard: hard, soft: soft, pair: pair };
    }

    function dealerBust(u) { return dist(u).bust; }

    function handName(playerRanks) {
      var t = { total: 0, soft: false };
      playerRanks.forEach(function (r) { t = addC(t.total, t.soft, r); });
      if (playerRanks.length === 2 && playerRanks[0] === playerRanks[1])
        return 'Pair ' + RANKS[playerRanks[0]];
      return (t.soft ? 'Soft ' : 'Hard ') + t.total;
    }

    return {
      cfg: { s17: s17, bjPays: bjPays, das: das, charlie: charlieN },
      decide: decide, gameEV: gameEV, tables: tables, dealerBust: dealerBust,
      handName: handName, RANKS: RANKS, ACT_NAME: ACT_NAME, upv: upv, v: v
    };
  }

  return { build: build, RANKS: RANKS, ACT_NAME: ACT_NAME };
});
