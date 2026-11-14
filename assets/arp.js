/* Netzwerktechnik-Dojo – IPv4 Station 6: ARP – von der IP-Adresse zur MAC-Adresse */
'use strict';

(() => {
  const { $ } = UI;
  if (!$('#arp-sw')) return;

  const MASK = '255.255.255.0';
  const BCAST = 'FF:FF:FF:FF:FF:FF';
  const DEV = [
    { id: 'A', name: 'PC-A', ip: '192.168.1.10', mac: '00:1A:2B:00:00:0A', x: 110, y: 70, port: 1 },
    { id: 'B', name: 'PC-B', ip: '192.168.1.20', mac: '00:1A:2B:00:00:0B', x: 530, y: 70, port: 2 },
    { id: 'C', name: 'PC-C', ip: '192.168.1.30', mac: '00:1A:2B:00:00:0C', x: 110, y: 290, port: 3 },
    { id: 'R', name: 'Router', ip: '192.168.1.1', mac: '00:1A:2B:00:00:01', x: 530, y: 290, port: 4, router: true, nom: 'Der Router', mid: 'der Router', gen: 'des Routers' },
  ];
  const TARGETS = {
    B: { ip: '192.168.1.20', name: 'PC-B', dat: 'PC-B' },
    C: { ip: '192.168.1.30', name: 'PC-C', dat: 'PC-C' },
    R: { ip: '192.168.1.1', name: 'den Router', dat: 'dem Router' },
    WEB: { ip: '203.0.113.5', name: 'den Webserver im Internet', dat: 'dem Webserver' },
  };
  const SW = { x: 320, y: 180 };
  const me = DEV[0];
  const devBy = id => DEV.find(d => d.id === id);
  const nom = d => d.nom || d.name;
  const mid = d => d.mid || d.name;
  const gen = d => d.gen || 'von ' + d.name;
  const devByIp = ip => DEV.find(d => d.ip === ip);
  const netOf = ip => IPv4.format((IPv4.parse(ip) & IPv4.parse(MASK)) >>> 0);

  let cache = []; // [{ ip, mac, fresh }]
  let steps = [];
  let pos = -1;

  const frame = (rows, cls = '') => `<div class="arp-frame ${cls}">${rows.map(([k, v, c]) =>
    `<span class="arp-f${c ? ' ' + c : ''}"><small>${k}</small><code>${v}</code></span>`).join('')}</div>`;

  // Ablauf für einen Ping von PC-A an das gewählte Ziel
  function plan(key) {
    const t = TARGETS[key];
    const local = netOf(t.ip) === netOf(me.ip);
    const hop = local ? devByIp(t.ip) : devBy('R');
    const out = [];
    out.push({
      text: local
        ? `<b>Gleiches Netz?</b> PC-A rechnet: ${me.ip} UND ${MASK} = <b>${netOf(me.ip)}</b>, ${t.ip} UND ${MASK} = <b>${netOf(t.ip)}</b>. Gleiches Netz – PC-A stellt <b>direkt</b> zu und braucht die MAC-Adresse ${gen(hop)}.`
        : `<b>Gleiches Netz?</b> PC-A rechnet: ${me.ip} UND ${MASK} = <b>${netOf(me.ip)}</b>, ${t.ip} UND ${MASK} = <b>${netOf(t.ip)}</b>. Anderes Netz – das Paket muss zum <b>Standard-Gateway ${hop.ip}</b>. Gesucht wird also die MAC des <b>Routers</b>, nicht die des Webservers!`,
      nodes: { A: 'src' },
    });
    const hit = cache.find(e => e.ip === hop.ip);
    if (hit) {
      out.push({ text: `<b>ARP-Cache:</b> ${hop.ip} steht schon drin → <code>${hit.mac}</code>. Keine ARP-Anfrage nötig.`, nodes: { A: 'src' }, row: hop.ip });
    } else {
      out.push({ text: `<b>ARP-Cache:</b> ${hop.ip} steht noch nicht drin. PC-A muss fragen.`, nodes: { A: 'src' } });
      const others = DEV.filter(d => d !== me);
      out.push({
        text: `<b>ARP-Anfrage als Broadcast:</b> „Wer hat ${hop.ip}? Sag es ${me.ip}.“ Weil die Ziel-MAC FF:FF:FF:FF:FF:FF ist, flutet der Switch den Frame an alle Ports.`
          + frame([['Ziel-MAC', BCAST, 'hi'], ['Quell-MAC', me.mac], ['Typ', 'ARP · Anfrage (1)'], ['Sender-IP', me.ip], ['Gesuchte IP', hop.ip, 'hi'], ['Gesuchte MAC', '00:00:00:00:00:00']]),
        links: Object.fromEntries([['A', 'src'], ...others.map(d => [d.id, 'flood'])]),
        nodes: { A: 'src' },
      });
      out.push({
        text: `<b>Alle lesen mit:</b> ${others.filter(d => d !== hop).map(mid).join(' und ')} ${others.length - 1 > 1 ? 'haben' : 'hat'} eine andere IP und ${others.length - 1 > 1 ? 'verwerfen' : 'verwirft'} die Anfrage. ${nom(hop)} erkennt die eigene IP – und trägt nebenbei gleich PC-A in den eigenen ARP-Cache ein.`,
        nodes: Object.fromEntries([['A', 'src'], ...others.map(d => [d.id, d === hop ? 'hit' : 'drop'])]),
      });
      out.push({
        text: `<b>ARP-Antwort als Unicast:</b> „${hop.ip} hat ${hop.mac}.“ ${nom(hop)} kennt PC-A jetzt und antwortet nur ihm. Der Switch kennt PC-A aus der Anfrage und leitet gezielt weiter.`
          + frame([['Ziel-MAC', me.mac], ['Quell-MAC', hop.mac], ['Typ', 'ARP · Antwort (2)'], ['Sender-IP', hop.ip], ['Sender-MAC', hop.mac, 'hi'], ['Ziel-IP', me.ip]]),
        links: { [hop.id]: 'src', A: 'hit' },
        nodes: { [hop.id]: 'src', A: 'hit' },
      });
      out.push({ text: `<b>Merken:</b> PC-A trägt <code>${hop.ip} → ${hop.mac}</code> in seinen ARP-Cache ein. Beim nächsten Paket entfällt die Frage.`, nodes: { A: 'src' }, add: { ip: hop.ip, mac: hop.mac } });
    }
    out.push({
      text: `<b>Jetzt geht der Ping los:</b> Der Ethernet-Frame trägt die MAC-Adresse ${gen(hop)}, das IP-Paket darin die IP-Adresse von ${t.dat}.`
        + frame([['Ziel-MAC', hop.mac, 'hi'], ['Quell-MAC', me.mac], ['Ziel-IP', t.ip, 'hi'], ['Quell-IP', me.ip], ['Inhalt', 'ICMP Echo (ping)']])
        + (local ? '' : '<p class="arp-sub">Der Router packt das Paket in einen <b>neuen Frame</b> und schickt es Richtung Internet. Die IP-Adressen bleiben auf dem ganzen Weg gleich, die MAC-Adressen wechseln auf jeder Teilstrecke.</p>'),
      links: { A: 'src', [hop.id]: 'hit' },
      nodes: { A: 'src', [hop.id]: 'hit' },
      net: !local,
    });
    return out;
  }

  function draw() {
    const st = steps[pos] || {};
    const links = st.links || {};
    const nodes = st.nodes || {};
    let s = '<svg class="tp-svg m-sw" viewBox="0 0 640 360" role="img" aria-label="Switch mit drei PCs und einem Router">';
    DEV.forEach(d => {
      s += `<line class="m-link${links[d.id] ? ' ' + links[d.id] : ''}" x1="${SW.x}" y1="${SW.y}" x2="${d.x}" y2="${d.y}"/>`;
    });
    const R = devBy('R');
    s += `<line class="m-link${st.net ? ' hit' : ''}" x1="${R.x + 20}" y1="${R.y}" x2="632" y2="${R.y}" stroke-dasharray="3 5"/><text class="m-port" x="632" y="${R.y - 10}" text-anchor="end">Internet</text>`;
    s += `<g transform="translate(${SW.x} ${SW.y})" class="t-switch"><rect class="tp-body" x="-42" y="-17" width="84" height="34" rx="5"/><path class="tp-line" d="M-24 -5h40M10 -10l6 5l-6 5M24 5h-40M-10 0l-6 5l6 5"/><text class="tp-label" y="38" text-anchor="middle">Switch</text></g>`;
    DEV.forEach(d => {
      const c = nodes[d.id] ? ' ' + nodes[d.id] : '';
      const icon = d.router
        ? '<circle class="tp-body" r="19"/><path class="tp-line" d="M-10 -5h16M2 -9l4 4l-4 4M10 5h-16M-2 1l-4 4l4 4"/>'
        : '<rect class="tp-body" x="-19" y="-16" width="38" height="25" rx="3"/><rect class="tp-screen" x="-14" y="-11" width="28" height="15" rx="1.5"/><path class="tp-line" d="M0 9v6M-9 16h18"/>';
      s += `<g class="m-pc ${d.router ? 't-router' : 't-pc'}${c}" transform="translate(${d.x} ${d.y})">${icon}
        <text class="tp-label" y="36" text-anchor="middle">${d.name}</text><text class="m-mac" y="51" text-anchor="middle">${d.ip}</text><text class="m-mac" y="65" text-anchor="middle">${d.mac}</text>
        ${c === ' drop' ? '<text class="m-mark" x="24" y="-12">✕</text>' : c === ' hit' ? '<text class="m-mark ok" x="24" y="-12">✔</text>' : ''}</g>`;
    });
    $('#arp-sw').innerHTML = s + '</svg>';

    $('#arp-cache').innerHTML = `<thead><tr><th>IP-Adresse</th><th>MAC-Adresse</th></tr></thead><tbody>${cache.length
      ? cache.map(e => `<tr class="${e.fresh || st.row === e.ip ? 'm-new' : ''}"><td><code>${e.ip}</code></td><td><code>${e.mac}</code></td></tr>`).join('')
      : '<tr><td colspan="2" class="muted">leer</td></tr>'}</tbody>`;

    $('#arp-log').innerHTML = pos < 0
      ? '<p class="muted">Wähle ein Ziel und starte den Ping. PC-A kennt am Anfang nur IP-Adressen – sein ARP-Cache ist leer.</p>'
      : `<ol>${steps.slice(0, pos + 1).map((x, i) => `<li class="${i === pos ? 'arp-now' : ''}">${x.text}</li>`).join('')}</ol>`
        + (pos === steps.length - 1 ? '<p class="muted">Fertig. Schick noch einen Ping an dasselbe Ziel – jetzt geht es ohne Frage.</p>' : '');
    $('#arp-next').disabled = pos < 0 || pos >= steps.length - 1;
  }

  function advance() {
    pos++;
    cache.forEach(e => { e.fresh = false; });
    const add = steps[pos].add;
    if (add && !cache.some(e => e.ip === add.ip)) cache.push({ ...add, fresh: true });
    draw();
  }

  $('#arp-go').addEventListener('click', () => {
    steps = plan($('#arp-to').value);
    pos = -1;
    advance();
  });
  $('#arp-next').addEventListener('click', advance);
  $('#arp-clear').addEventListener('click', () => {
    cache = []; steps = []; pos = -1;
    draw();
    $('#arp-log').innerHTML = '<p class="muted">ARP-Cache geleert – wie nach <code>arp -d *</code> oder einem Neustart.</p>';
  });
  draw();
})();
