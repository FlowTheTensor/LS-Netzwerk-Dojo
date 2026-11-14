/* Netzwerktechnik-Dojo – Spielfigur im Kopfbereich: steigt pro Gürtel ein Level auf, Klick öffnet das Inventar */
'use strict';

(() => {
  const { $, esc, store, THEMES, toast } = UI;
  const btn = $('#ninja');
  const dlg = $('#inv');
  if (!btn || !dlg) return;

  // Alle Dojos in der Reihenfolge der Themen, mit ihrem aktuellen Fortschritt
  function state() {
    const groups = Dojo.registry.map(d => {
      const page = document.getElementById(d.pageId);
      const theme = page?.dataset.theme;
      const got = store.get(d.storeKey, {}) || {};
      return { ...d, theme, name: THEMES[theme]?.name || d.pageId, got };
    });
    const order = Object.keys(THEMES);
    groups.sort((a, b) => order.indexOf(a.theme) - order.indexOf(b.theme));
    const total = groups.reduce((n, g) => n + g.belts.length, 0);
    const earned = groups.reduce((n, g) => n + g.belts.filter(b => g.got[b.id]).length, 0);
    return { groups, total, earned, level: earned + 1 };
  }

  let shown = null; // zuletzt angezeigtes Level, um Aufstiege zu erkennen
  let ready = false; // erst wenn sich alle Dojos angemeldet haben

  function renderHero() {
    const st = state();
    $('#ninja-lvl').textContent = `Level ${st.level}`;
    btn.setAttribute('aria-label', `Spielfigur, Level ${st.level}, ${st.earned} von ${st.total} Gürteln – Inventar öffnen`);
    if (shown != null && st.level > shown) {
      btn.classList.remove('up');
      void btn.offsetWidth; // Animation neu starten
      btn.classList.add('up');
      toast(`⬆ Level-Aufstieg! Dein Ninja ist jetzt <b>Level ${st.level}</b>.`);
    }
    shown = st.level;
    if (dlg.open) renderInv(st);
  }

  function renderInv(st = state()) {
    const pct = st.total ? Math.round(st.earned / st.total * 100) : 0;
    dlg.innerHTML = `
      <div class="inv-head">
        <img class="inv-ninja" src="assets/images/el-ninja.webp" alt="">
        <div>
          <p class="eyebrow">Inventar</p>
          <h2 id="inv-title">Level ${st.level}</h2>
          <p class="inv-sum">${st.earned} von ${st.total} Gürteln gesammelt</p>
          <div class="inv-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${st.total}" aria-valuenow="${st.earned}"><i style="width:${pct}%"></i></div>
        </div>
        <button type="button" class="inv-close" aria-label="Inventar schließen">✕</button>
      </div>
      <div class="inv-body">
        ${st.groups.map(g => {
          const n = g.belts.filter(b => g.got[b.id]).length;
          return `<section class="inv-group">
            <h3><span>${esc(g.name)}</span><small>${n}/${g.belts.length}</small><a href="#${g.pageId}" class="inv-go">zum Dojo →</a></h3>
            <div class="inv-grid">${g.belts.map(b => {
              const ok = !!g.got[b.id];
              return `<div class="inv-item${ok ? ' got' : ''}" title="${esc(b.name)} · ${esc(b.topic)}${ok ? '' : ' (noch offen)'}">
                <img src="${Dojo.beltImg(b)}" alt="" width="58" height="40">
                <b>${esc(b.name)}</b><small>${esc(b.topic)}</small>
                <span class="inv-st" aria-label="${ok ? 'gesammelt' : 'offen'}">${ok ? '✔' : '?'}</span>
              </div>`;
            }).join('')}</div>
          </section>`;
        }).join('')}
      </div>`;
  }

  btn.addEventListener('click', () => {
    renderInv();
    dlg.showModal();
    dlg.querySelector('.inv-close').focus({ preventScroll: true });
  });
  dlg.addEventListener('click', e => {
    // Klick auf den abgedunkelten Hintergrund, das ✕ oder einen Dojo-Link schließt das Inventar
    if (e.target === dlg || e.target.closest('.inv-close, .inv-go')) dlg.close();
  });

  // Beim Laden melden sich die Dojos nacheinander an – das ist noch kein Aufstieg
  document.addEventListener('beltchange', () => { if (ready) renderHero(); });
  document.addEventListener('DOMContentLoaded', () => { ready = true; renderHero(); });
})();
