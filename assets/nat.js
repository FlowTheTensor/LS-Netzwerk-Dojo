/* Netzwerktechnik-Dojo – IPv4 Station 7: NAT & Portweiterleitung */
'use strict';

(() => {
  const { $ } = UI;
  if (!$('#nat-sw')) return;

  const WAN = '203.0.113.7';
  const LAN_GW = '192.168.1.1';
  const FWD = { out: 8443, dev: 'K', port: 443 };
  const DEV = [
    { id: 'A', name: 'PC-A', ip: '192.168.1.10', x: 90, y: 62, icon: 'pc' },
    { id: 'B', name: 'PC-B', ip: '192.168.1.20', x: 90, y: 152, icon: 'pc' },
    { id: 'H', name: 'Handy', ip: '192.168.1.30', x: 90, y: 242, icon: 'phone' },
    { id: 'K', name: 'Kamera', ip: '192.168.1.50', x: 90, y: 332, icon: 'cam' },
    { id: 'R', name: 'Router', x: 320, y: 197, icon: 'router' },
    { id: 'W', name: 'Webserver', ip: '198.51.100.20', port: 443, x: 550, y: 62, icon: 'server' },
    { id: 'S', name: 'Spieleserver', ip: '198.51.100.80', port: 27015, x: 550, y: 197, icon: 'server' },
    { id: 'F', name: 'Fremder Rechner', ip: '198.51.100.66', x: 550, y: 332, icon: 'pc' },
  ];
  const ICON = {
    pc: '<rect class="tp-body" x="-19" y="-16" width="38" height="25" rx="3"/><rect class="tp-screen" x="-14" y="-11" width="28" height="15" rx="1.5"/><path class="tp-line" d="M0 9v6M-9 16h18"/>',
    phone: '<rect class="tp-body" x="-10" y="-18" width="20" height="34" rx="4"/><rect class="tp-screen" x="-6.5" y="-13" width="13" height="22" rx="1"/>',
    cam: '<rect class="tp-body" x="-18" y="-12" width="30" height="22" rx="4"/><circle class="tp-line" cx="-3" cy="-1" r="6"/><path class="tp-line" d="M12 -6l9 -5v20l-9 -5"/>',
    router: '<circle class="tp-body" r="21"/><path class="tp-line" d="M-11 -5h18M3 -9l4 4l-4 4M11 5h-18M-3 1l-4 4l4 4"/>',
    server: '<rect class="tp-body" x="-17" y="-20" width="34" height="38" rx="3"/><path class="tp-line" d="M-11 -9h22M-11 1h22M-11 11h22"/>',
  };
  const by = id => DEV.find(d => d.id === id);
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));

  let table = []; // [{ inner, outer, dest, kind, fresh }]
  let nextPort = 61001;
  let steps = [];
  let pos = -1;

  const pkt = (sip, sp, dip, dp, hi = []) => `<div class="arp-frame">${[
    ['Quell-IP', sip, 'sip'], ['Quell-Port', sp, 'sp'], ['Ziel-IP', dip, 'dip'], ['Ziel-Port', dp, 'dp'],
  ].map(([k, v, c]) => `<span class="arp-f${hi.includes(c) ? ' hi' : ''}"><small>${k}</small><code>${v}</code></span>`).join('')}</div>`;

  const fwdOn = () => $('#nat-fwd').checked;
  const fwdRow = () => ({ inner: `${by(FWD.dev).ip}:${FWD.port}`, outer: `${WAN}:${FWD.out}`, dest: 'beliebig', kind: 'statisch', fwd: true });
  const rows = () => (fwdOn() ? [fwdRow(), ...table] : table);

  // Verbindung aus dem Heimnetz ins Internet
  function planOut(devId, srvId) {
    const d = by(devId), s = by(srvId);
    const sp = rnd(49152, 65535);
    const op = nextPort++;
    const inner = `${d.ip}:${sp}`, outer = `${WAN}:${op}`;
    return [
      {
        text: `<b>Anfrage im Heimnetz:</b> ${d.name} schickt ein Paket an den ${s.name}. Absender ist die <b>private</b> Adresse ${d.ip}, den Quell-Port hat das Betriebssystem zufällig gewählt. Das Paket geht ans Standard-Gateway, den Router.`
          + pkt(d.ip, sp, s.ip, s.port),
        links: { [d.id]: 'src' }, nodes: { [d.id]: 'src' },
      },
      {
        text: `<b>Der Router übersetzt:</b> Mit ${d.ip} als Absender käme nie eine Antwort zurück – private Adressen werden im Internet nicht geroutet. Der Router ersetzt deshalb die Quell-IP durch seine <b>öffentliche WAN-Adresse</b> und den Quell-Port durch einen freien Port. Beides merkt er sich in der NAT-Tabelle.`
          + pkt(WAN, op, s.ip, s.port, ['sip', 'sp']),
        links: { [d.id]: 'src' }, nodes: { R: 'src' }, add: { inner, outer, dest: `${s.ip}:${s.port}`, kind: 'dynamisch' },
      },
      {
        text: `<b>Im Internet:</b> Der ${s.name} sieht nur <code>${outer}</code>. Vom Heimnetz und von ${d.name} weiß er nichts. Er antwortet genau an diese Adresse.`
          + pkt(s.ip, s.port, WAN, op),
        links: { [s.id]: 'src' }, nodes: { [s.id]: 'src' }, row: outer,
      },
      {
        text: `<b>Rückübersetzung:</b> Der Router sucht Port ${op} in seiner NAT-Tabelle und findet <code>${inner}</code>. Er setzt Ziel-IP und Ziel-Port zurück und schickt das Paket ins Heimnetz. ${d.name} merkt von der ganzen Übersetzung nichts.`
          + pkt(s.ip, s.port, d.ip, sp, ['dip', 'dp']),
        links: { [s.id]: 'src', [d.id]: 'hit' }, nodes: { [d.id]: 'hit' }, row: outer,
      },
    ];
  }

  // Unaufgeforderte Anfrage von außen
  function planIn() {
    const f = by('F'), k = by(FWD.dev);
    const sp = rnd(49152, 65535);
    const out = [{
      text: `<b>Anfrage von außen:</b> Ein fremder Rechner schickt ein Paket an <code>${WAN}:${FWD.out}</code> – zum Beispiel jemand, der das Internet nach erreichbaren Kameras absucht.`
        + pkt(f.ip, sp, WAN, FWD.out),
      links: { F: 'src' }, nodes: { F: 'src' },
    }];
    if (fwdOn()) {
      out.push({
        text: `<b>Portweiterleitung:</b> Für Port ${FWD.out} gibt es einen <b>festen Eintrag</b> in der NAT-Tabelle. Der Router übersetzt das Ziel auf <code>${k.ip}:${FWD.port}</code> und leitet das Paket an die Kamera weiter.`
          + pkt(f.ip, sp, k.ip, FWD.port, ['dip', 'dp'])
          + '<p class="arp-sub"><b>Achtung:</b> Jetzt kann <b>jeder</b> im Internet die Kamera erreichen – auch Angreifer. Ist ihr Passwort schwach oder die Firmware veraltet, steht das Gerät offen im Netz.</p>',
        links: { F: 'src', [k.id]: 'hit' }, nodes: { [k.id]: 'hit' }, row: `${WAN}:${FWD.out}`,
      });
    } else {
      out.push({
        text: `<b>Kein Eintrag – verworfen:</b> Port ${FWD.out} steht nicht in der NAT-Tabelle. Der Router weiß nicht, an welches Gerät das Paket gehen soll, und verwirft es. Deshalb sind Geräte im Heimnetz von außen nicht direkt erreichbar.`,
        links: { F: 'src' }, nodes: { F: 'src', R: 'drop' },
      });
    }
    return out;
  }

  function draw() {
    const st = steps[pos] || {};
    const links = st.links || {};
    const nodes = st.nodes || {};
    const R = by('R');
    let s = '<svg class="tp-svg m-sw nat-svg" viewBox="0 0 640 390" role="img" aria-label="Heimnetz mit Router und Servern im Internet">';
    s += `<rect class="nat-zone" x="4" y="4" width="${R.x - 60}" height="382" rx="10"/><text class="nat-zl" x="16" y="24">Heimnetz · privat</text>`;
    s += `<text class="nat-zl" x="626" y="24" text-anchor="end">Internet · öffentlich</text>`;
    DEV.filter(d => d.id !== 'R').forEach(d => {
      s += `<line class="m-link${links[d.id] ? ' ' + links[d.id] : ''}" x1="${R.x}" y1="${R.y}" x2="${d.x}" y2="${d.y}"/>`;
    });
    DEV.forEach(d => {
      const c = nodes[d.id] ? ' ' + nodes[d.id] : '';
      const right = d.x > R.x;
      const sub = d.id === 'R'
        ? `<text class="m-mac" y="38" text-anchor="middle">LAN ${LAN_GW}</text><text class="m-mac nat-wan" y="52" text-anchor="middle">WAN ${WAN}</text>`
        : `<text class="m-mac" y="${right ? 51 : 50}" text-anchor="middle">${d.ip}${d.port ? ':' + d.port : ''}</text>`;
      s += `<g class="m-pc ${d.id === 'R' ? 't-router' : 't-pc'}${c}" transform="translate(${d.x} ${d.y})">${ICON[d.icon]}
        <text class="tp-label" y="${d.id === 'R' ? -30 : 36}" text-anchor="middle">${d.name}</text>${sub}
        ${c === ' drop' ? '<text class="m-mark" x="22" y="-14">✕</text>' : c === ' hit' ? '<text class="m-mark ok" x="24" y="-12">✔</text>' : ''}</g>`;
    });
    $('#nat-sw').innerHTML = s + '</svg>';

    const r = rows();
    $('#nat-table').innerHTML = `<thead><tr><th>Innen (privat)</th><th>Außen (öffentlich)</th><th>Gegenstelle</th><th>Art</th></tr></thead><tbody>${r.length
      ? r.map(e => `<tr class="${e.fresh || st.row === e.outer ? 'm-new' : ''}${e.fwd ? ' nat-fwd-row' : ''}"><td><code>${e.inner}</code></td><td><code>${e.outer}</code></td><td>${e.dest === 'beliebig' ? 'beliebig' : `<code>${e.dest}</code>`}</td><td>${e.kind}</td></tr>`).join('')
      : '<tr><td colspan="4" class="muted">leer</td></tr>'}</tbody>`;

    $('#nat-log').innerHTML = pos < 0
      ? '<p class="muted">Wähle ein Gerät und ein Ziel und schicke eine Anfrage ins Internet. Oder probiere, was passiert, wenn jemand von außen anklopft.</p>'
      : `<ol>${steps.slice(0, pos + 1).map((x, i) => `<li class="${i === pos ? 'arp-now' : ''}">${x.text}</li>`).join('')}</ol>`
        + (pos === steps.length - 1 ? '<p class="muted">Fertig. Schick weitere Anfragen – auch von anderen Geräten – und beobachte die NAT-Tabelle.</p>' : '');
    $('#nat-next').disabled = pos < 0 || pos >= steps.length - 1;
  }

  function advance() {
    pos++;
    table.forEach(e => { e.fresh = false; });
    const add = steps[pos].add;
    if (add) table.push({ ...add, fresh: true });
    draw();
  }
  function start(plan) { steps = plan; pos = -1; advance(); }

  $('#nat-go').addEventListener('click', () => start(planOut($('#nat-from').value, $('#nat-to').value)));
  $('#nat-in').addEventListener('click', () => start(planIn()));
  $('#nat-next').addEventListener('click', advance);
  $('#nat-fwd').addEventListener('change', () => { steps = []; pos = -1; draw(); });
  $('#nat-clear').addEventListener('click', () => {
    table = []; steps = []; pos = -1;
    draw();
    $('#nat-log').innerHTML = '<p class="muted">Dynamische Einträge gelöscht – wie nach einem Neustart des Routers. Feste Einträge (Portweiterleitung) bleiben.</p>';
  });
  draw();
})();
