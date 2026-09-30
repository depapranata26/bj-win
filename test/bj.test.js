// node test/bj.test.js — validasi engine blackjack vs basic strategy standar
var E = require('../engine.js');
var R = { '2': 0, '3': 1, '4': 2, '5': 3, '6': 4, '7': 5, '8': 6, '9': 7, '10': 8, J: 8, Q: 8, K: 8, A: 12 };
function dc(pl, dl) { return E.build().decide(pl.map(function (x) { return R[x]; }), R[dl]); }
var pass = 0, fail = 0;
function T(name, cond, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('GAGAL:', name, extra === undefined ? '' : JSON.stringify(extra)); }
}
var t0 = Date.now();
var eng = E.build({ s17: true, bjPays: 1.5, das: true });

// ---- 1. dealer bust rates wajar ----
var b6 = eng.dealerBust(R['6']), b10 = eng.dealerBust(R['10']), bA = eng.dealerBust(R['A']);
T('bust vs 6 ~42%', b6 > 0.40 && b6 < 0.44, b6);
T('bust vs 10 ~21%', b10 > 0.20 && b10 < 0.23, b10);
// vs As: terkondisikan no-BJ (peek) -> 11.65%/(9/13) = ~16.8%
T('bust vs A kondisional ~16.8%', bA > 0.15 && bA < 0.185, bA);

// ---- 2. hard totals klasik ----
T('16 vs 10 -> H', dc(['10', '6'], '10').action === 'H');
T('16 vs 7 -> H', dc(['10', '6'], '7').action === 'H');
T('16 vs 6 -> S', dc(['10', '6'], '6').action === 'S');
T('15 vs 10 -> H', dc(['10', '5'], '10').action === 'H');
T('13 vs 2 -> S', dc(['10', '3'], '2').action === 'S');
T('12 vs 4 -> S', dc(['10', '2'], '4').action === 'S');
T('12 vs 2 -> H', dc(['10', '2'], '2').action === 'H');
T('12 vs 3 -> H', dc(['10', '2'], '3').action === 'H');
T('12 vs 7 -> H', dc(['10', '2'], '7').action === 'H');
T('11 vs A -> H (S17! bukan D; D hanya utk H17)', dc(['9', '2'], 'A').action === 'H');
T('11 vs 10 -> D', dc(['9', '2'], '10').action === 'D');
T('10 vs 9 -> D', dc(['6', '4'], '9').action === 'D');
T('10 vs 10 -> H', dc(['6', '4'], '10').action === 'H');
T('9 vs 4 -> D', dc(['5', '4'], '4').action === 'D');
T('9 vs 2 -> H', dc(['5', '4'], '2').action === 'H');
T('9 vs 7 -> H', dc(['5', '4'], '7').action === 'H');
T('17 vs A -> S', dc(['10', '7'], 'A').action === 'S');

// ---- 3. soft totals ----
T('A8 vs 6 -> S (S17! D hanya utk H17)', dc(['A', '8'], '6').action === 'S');
T('A8 vs 7 -> S', dc(['A', '8'], '7').action === 'S');
T('A7 vs 4 -> D', dc(['A', '7'], '4').action === 'D');
T('A7 vs 2 -> S', dc(['A', '7'], '2').action === 'S');
T('A7 vs 9 -> H', dc(['A', '7'], '9').action === 'H');
T('A7 vs 7 -> S', dc(['A', '7'], '7').action === 'S');
T('A6 vs 4 -> D', dc(['A', '6'], '4').action === 'D');
T('A6 vs 9 -> H', dc(['A', '6'], '9').action === 'H');
T('A2 vs 5 -> H (margin 0.007, terverifikasi MC)', dc(['A', '2'], '5').action === 'H');

// ---- 4. pairs ----
T('A,A vs 10 -> P', dc(['A', 'A'], '10').action === 'P');
T('8,8 vs 10 -> P', dc(['8', '8'], '10').action === 'P');
T('8,8 vs A -> P', dc(['8', '8'], 'A').action === 'P');
T('10,10 vs 6 -> S (jangan split)', dc(['10', '10'], '6').action === 'S');
T('9,9 vs 7 -> S', dc(['9', '9'], '7').action === 'S');
T('9,9 vs 8 -> P', dc(['9', '9'], '8').action === 'P');
T('9,9 vs 6 -> P', dc(['9', '9'], '6').action === 'P');
T('5,5 vs 6 -> D (main sbg 10)', dc(['5', '5'], '6').action === 'D');
T('4,4 vs 6 -> P', dc(['4', '4'], '6').action === 'P');
T('4,4 vs 7 -> H', dc(['4', '4'], '7').action === 'H');
T('7,7 vs 7 -> P', dc(['7', '7'], '7').action === 'P');
T('7,7 vs 8 -> H', dc(['7', '7'], '8').action === 'H');
T('3,3 vs 8 -> H', dc(['3', '3'], '8').action === 'H');
T('2,2 vs 3 -> P', dc(['2', '2'], '3').action === 'P');

// ---- 5. blackjack & multi-kartu ----
T('A,K -> BJ', dc(['A', 'K'], '9').action === 'BJ');
T('A,K ev=1.5 vs 9', Math.abs(dc(['A', 'K'], '9').ev - 1.5) < 1e-9);
var m = dc(['8', '3', '5'], '10'); // 16 dgn 3 kartu
T('16 (3 kartu) vs 10 -> H tanpa D', m.action === 'H' && m.canDouble === false);

// ---- 6. house edge wajar ----
var gev = eng.gameEV();
T('gameEV ~ -0.5%', gev < -0.002 && gev > -0.010, gev);

// ---- 7. determinisme ----
var e2 = E.build().gameEV();
T('deterministik', Math.abs(gev - e2) < 1e-12);

// ---- 8. tabel konsisten dgn decide ----
var tb = eng.tables();
T('tabel hard 16v10 = H', tb.hard['16v10'] === 'H');
T('tabel pair Av6 = P', tb.pair['Av6'] === 'P');

// ---- 9. six card charlie ----
var engC = E.build({ s17: true, bjPays: 1.5, das: true, charlie: 6 });
// 5 kartu hard 14 (2,2,3,3,4) vs 6
var c14off = eng.decide([0, 0, 1, 1, 2], R['6']);
var c14on = engC.decide([0, 0, 1, 1, 2], R['6']);
T('5-card hard 14 vs 6 tanpa charlie -> S', c14off.action === 'S');
T('5-card hard 14 vs 6 dgn charlie -> H', c14on.action === 'H', c14on.alts.H.toFixed(4));
// 5 kartu hard 16 (2,2,3,4,5) vs 6 -> tetap S walau charlie
var c16on = engC.decide([0, 0, 1, 2, 3], R['6']);
T('5-card hard 16 vs 6 dgn charlie -> S', c16on.action === 'S');
// charlie nurunin house edge
var gevC = engC.gameEV();
T('charlie nurunin house edge', gevC > gev && (-gevC * 100) > 0.30 && (-gevC * 100) < 0.55, (-gevC * 100).toFixed(3) + '%');
// tanpa charlie eksplisit = default (mati)
var engC0 = E.build({ s17: true, bjPays: 1.5, das: true, charlie: 0 });
T('charlie:0 = default', Math.abs(engC0.gameEV() - gev) < 1e-12);

var dt = Date.now() - t0;
console.log('\n' + pass + ' lolos, ' + fail + ' gagal');
console.log('house edge (S17, 3:2, DAS): ' + (-gev * 100).toFixed(3) + '%');
console.log('house edge + six card charlie: ' + (-gevC * 100).toFixed(3) + '%');
console.log('waktu: ' + dt + 'ms');
process.exit(fail ? 1 : 0);
