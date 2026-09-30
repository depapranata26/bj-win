/* BJ Win Logic — app.js */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var RANKS = BJEngine.RANKS;
  var ACT_ID = { H: 'HIT', S: 'STAND', D: 'DOUBLE', P: 'SPLIT', BJ: 'BLACKJACK' };

  function rp(n) {
    var r = Math.round(n);
    return 'Rp ' + r.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  function load(k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }

  /* ---------- engine ---------- */
  var cfg = load('bj_cfg', { s17: true, bjPays: 1.5, charlie: true });
  var eng = null, edge = null;
  function rebuild() {
    eng = BJEngine.build({ s17: cfg.s17, bjPays: cfg.bjPays, das: true, charlie: cfg.charlie ? 6 : 0 });
    edge = eng.gameEV();
  }
  rebuild();

  function bet() { return Math.max(0, parseInt($('bet').value, 10) || 0); }

  /* ---------- tabs ---------- */
  var tabBtns = document.querySelectorAll('.tabs button');
  tabBtns.forEach(function (b) {
    b.addEventListener('click', function () {
      tabBtns.forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      ['main', 'misi', 'info'].forEach(function (t) { $('t-' + t).style.display = t === b.dataset.t ? '' : 'none'; });
      if (b.dataset.t === 'info') renderInfo();
      if (b.dataset.t === 'misi') renderMisi();
    });
  });

  /* ---------- config chips ---------- */
  function chipGroup(id, key, vals) {
    var el = $(id);
    el.querySelectorAll('.chip').forEach(function (c) {
      var on = String(cfg[key]) === c.dataset.v ||
        (key === 's17' && ((cfg.s17 && c.dataset.v === 's17') || (!cfg.s17 && c.dataset.v === 'h17'))) ||
        (key === 'charlie' && ((cfg.charlie && c.dataset.v === 'on') || (!cfg.charlie && c.dataset.v === 'off')));
      c.classList.toggle('on', on);
      c.addEventListener('click', function () {
        el.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
        c.classList.add('on');
        if (key === 's17') cfg.s17 = c.dataset.v === 's17';
        if (key === 'bjPays') cfg.bjPays = c.dataset.v === '32' ? 1.5 : 1.2;
        if (key === 'charlie') cfg.charlie = c.dataset.v === 'on';
        save('bj_cfg', cfg); rebuild(); analyze(); renderInfo();
      });
    });
  }
  chipGroup('s17chips', 's17');
  chipGroup('bjchips', 'bjPays');
  chipGroup('charliechips', 'charlie');
  $('nomchips').querySelectorAll('.chip').forEach(function (c) {
    c.addEventListener('click', function () { $('bet').value = c.dataset.v; save('bj_cfg', cfg); analyze(); });
  });
  $('bet').addEventListener('input', analyze);

  /* ---------- kartu ---------- */
  var player = [], dealer = [], target = 'p';
  var pad = $('rankpad');
  RANKS.forEach(function (rk, i) {
    var b = document.createElement('button');
    b.textContent = rk;
    b.addEventListener('click', function () {
      if (target === 'p') { if (player.length < 8) player.push(i); }
      else { dealer = [i]; }
      renderHands(); analyze();
    });
    pad.appendChild(b);
  });
  $('targetseg').querySelectorAll('button').forEach(function (b) {
    b.addEventListener('click', function () {
      $('targetseg').querySelectorAll('button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on'); target = b.dataset.v;
    });
  });
  $('bUndo').addEventListener('click', function () {
    if (target === 'p') player.pop(); else dealer.pop();
    renderHands(); analyze();
  });
  $('bClear').addEventListener('click', function () { player = []; dealer = []; renderHands(); analyze(); });

  function handTotal(ranks) {
    var t = 0, aces = 0;
    ranks.forEach(function (r) { if (r === 12) { aces++; t += 11; } else t += eng.v(r); });
    while (t > 21 && aces > 0) { t -= 10; aces--; }
    return { total: t, soft: aces > 0 };
  }
  function renderHands() {
    function draw(el, ranks, isD) {
      el.innerHTML = '';
      ranks.forEach(function (r) {
        var d = document.createElement('div');
        d.className = 'mcard' + (isD ? ' dealer' : '');
        d.textContent = RANKS[r];
        el.appendChild(d);
      });
    }
    draw($('phand'), player, false); draw($('dhand'), dealer, true);
    if (player.length) { var t = handTotal(player); $('ptotal').textContent = (t.soft ? 'Soft ' : '') + t.total; }
    else $('ptotal').textContent = '';
    if (dealer.length) $('dtotal').textContent = RANKS[dealer[0]] + ' (' + eng.upv(dealer[0]) + ')';
    else $('dtotal').textContent = '';
  }

  /* ---------- analisis ---------- */
  var WHY = {
    H: 'Tanganmu masih bisa membaik dan risiko bust terkendali. Ambil satu kartu.',
    S: 'Tanganmu sudah cukup kuat lawan kartu bandar ini. Ambil kartu = risiko bust terlalu besar.',
    D: 'Posisimu unggul lawan kartu bandar ini — gandakan bet untuk memaksimalkan ekspektasi.',
    P: 'Pair ini jauh lebih menguntungkan dimainkan sebagai dua tangan terpisah.',
    BJ: 'Blackjack! Nikmati bayarannya.'
  };
  function analyze() {
    var rc = $('rescard');
    if (player.length < 2 || dealer.length < 1) { rc.style.display = 'none'; return; }
    var t = handTotal(player);
    if (t.total > 21) {
      rc.style.display = ''; $('reshand').textContent = 'Bust (' + t.total + ')';
      $('resact').textContent = 'BUST'; $('resact').style.color = '#e74c3c';
      $('ressub').textContent = 'tanganmu lewat 21'; $('resev').textContent = rp(-bet());
      $('reswhy').textContent = 'Bust = kalah. Lain kali ikut engine ya, Bos.';
      $('resalts').innerHTML = ''; $('resnote').textContent = '';
      return;
    }
    var d = eng.decide(player, dealer[0]);
    var b = bet();
    rc.style.display = '';
    $('reshand').textContent = eng.handName(player) + '  vs  Bandar ' + RANKS[dealer[0]];
    $('resact').textContent = ACT_ID[d.action];
    $('resact').style.color = d.action === 'S' ? '#7bff9e' : d.action === 'H' ? '#7aa2ff' : '#c9a227';
    $('ressub').textContent = d.action === 'D' ? 'tambah bet 1× lagi, terima 1 kartu' :
      d.action === 'P' ? 'pisah jadi 2 tangan, bet jadi 2×' :
      d.action === 'BJ' ? 'bayar ' + (cfg.bjPays === 1.5 ? '3:2' : '6:5') : '';
    $('resev').textContent = (d.ev >= 0 ? '+' : '') + rp(d.ev * b);
    $('reswhy').textContent = WHY[d.action] || '';
    var html = '';
    if (d.alts) {
      [['H', 'Hit'], ['S', 'Stand'], ['D', 'Double'], ['P', 'Split']].forEach(function (a) {
        if (d.alts[a[0]] === null || d.alts[a[0]] === undefined) return;
        var v = d.alts[a[0]] * b;
        html += '<div class="alt' + (a[0] === d.action ? ' best' : '') + '"><span>' + a[1] + '</span><b>' +
          (v >= 0 ? '+' : '') + rp(v) + '</b></div>';
      });
    }
    $('resalts').innerHTML = html;
    var note = '';
    if ((d.up === 1 || d.up === 10) && d.action !== 'BJ')
      note = 'Bandar punya ' + RANKS[dealer[0]] + ' — dia cek blackjack dulu. Kalau bandar BJ & kamu tidak, kamu kalah.';
    if (d.action === 'D') note += (note ? ' ' : '') + 'Pastikan saldo cukup untuk tambah bet.';
    $('resnote').textContent = note;
  }

  /* ---------- misi ---------- */
  var misi = load('bj_misi', null);
  function mState() {
    if (!misi) misi = { bank: parseInt($('mBank').value, 10) || 10000, target: parseInt($('mTarget').value, 10) || 50000, rounds: 0, w: 0, l: 0, log: [] };
    return misi;
  }
  function mBet() { var m = mState(); return Math.min(m.bank, m.target - m.bank); }
  function renderMisi() {
    var m = mState();
    $('mBank').value = m.bank; $('mTarget').value = m.target;
    var b = mBet();
    $('mBet').textContent = rp(Math.max(0, b));
    var pct = Math.min(100, m.bank / m.target * 100);
    $('mProg').style.width = pct + '%';
    $('mRounds').textContent = m.rounds; $('mWins').textContent = m.w; $('mLoss').textContent = m.l;
    var done = m.bank >= m.target, dead = m.bank < 1000;
    $('mBet').textContent = done ? '🎉 TARGET TERCAPAI!' : dead ? '💀 MODAL HABIS' : rp(b);
    var html = '';
    m.log.slice().reverse().slice(0, 30).forEach(function (e) {
      html += '<div class="logrow"><span>' + e.t + ' — bet ' + rp(e.bet) + '</span><b class="' +
        (e.r === 'W' ? 'w' : e.r === 'L' ? 'l' : 'p') + '">' +
        (e.r === 'W' ? '+' + rp(e.chg) : e.r === 'L' ? '−' + rp(e.chg) : e.r === 'B' ? '+' + rp(e.chg) + ' 🂡' : 'push') + '</b></div>';
    });
    $('mLog').innerHTML = html || '<p class="note">Belum ada putaran. Semangat, Bos!</p>';
    ['mW', 'mL', 'mP', 'mBJ'].forEach(function (id) { $(id).disabled = done || dead; });
  }
  function mDo(kind) {
    var m = mState(), b = mBet();
    if (m.bank >= m.target || m.bank < 1000 || b <= 0) return;
    var chg = 0;
    if (kind === 'W') { chg = b; m.bank += b; m.w++; }
    else if (kind === 'L') { chg = b; m.bank -= b; m.l++; }
    else if (kind === 'B') { chg = Math.round(b * 1.5); m.bank += chg; m.w++; }
    m.rounds++;
    var now = new Date();
    m.log.push({ t: ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2), bet: b, r: kind, chg: chg });
    save('bj_misi', m); renderMisi();
  }
  $('mW').addEventListener('click', function () { mDo('W'); });
  $('mL').addEventListener('click', function () { mDo('L'); });
  $('mP').addEventListener('click', function () { mDo('P'); });
  $('mBJ').addEventListener('click', function () { mDo('B'); });
  $('mReset').addEventListener('click', function () { misi = null; save('bj_misi', null); renderMisi(); });
  $('mBank').addEventListener('change', function () { mState().bank = parseInt($('mBank').value, 10) || 0; save('bj_misi', misi); renderMisi(); });
  $('mTarget').addEventListener('change', function () { mState().target = parseInt($('mTarget').value, 10) || 50000; save('bj_misi', misi); renderMisi(); });

  /* ---------- info ---------- */
  function renderInfo() {
    $('cfgline').textContent = 'Bandar ' + (cfg.s17 ? 'stop di semua 17 (S17)' : 'hit soft 17 (H17)') +
      ', blackjack bayar ' + (cfg.bjPays === 1.5 ? '3:2' : '6:5') + ', double after split diizinkan' +
      (cfg.charlie ? ', six card charlie AKTIF (6 kartu tanpa bust = menang otomatis).' : ', tanpa six card charlie.') +
      (cfg.charlie ? ' Dengan Charlie aktif, tangan 5 kartu (mis. hard 14 vs 6) lebih sering disuruh HIT.' : '');
    $('edgeline').textContent = (-edge * 100).toFixed(2) + '%';
    var tb = eng.tables(), html = '';
    function tbl(title, rows, keys) {
      var h = '<p style="font-size:11px;margin:8px 0 2px"><b>' + title + '</b></p><table class="strat"><tr><th></th>';
      for (var u = 1; u <= 10; u++) h += '<th>' + (u === 1 ? 'A' : u) + '</th>';
      h += '</tr>';
      rows.forEach(function (r) {
        h += '<tr><th>' + r + '</th>';
        for (var u2 = 1; u2 <= 10; u2++) {
          var a = tb[keys][r + 'v' + u2];
          h += '<td class="a' + a + '">' + a + '</td>';
        }
        h += '</tr>';
      });
      return h + '</table>';
    }
    var hardRows = []; for (var t = 9; t <= 16; t++) hardRows.push('' + t);
    var softRows = []; for (var s = 13; s <= 19; s++) softRows.push('' + s);
    html += tbl('Hard (8 ke bawah selalu Hit, 17 ke atas selalu Stand)', hardRows, 'hard');
    html += tbl('Soft (A,_) — 20+ selalu Stand', softRows, 'soft');
    html += tbl('Pair', ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10'], 'pair');
    $('strattables').innerHTML = html;
  }

  renderHands(); analyze(); renderMisi();
  var t0 = Date.now();
  $('ms').textContent = 'engine siap';
})();
