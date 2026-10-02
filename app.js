(async () => {
  const $ = id => document.getElementById(id);
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const mono = n => n.split(' ').filter(w => /^[A-Z]/.test(w)).map(w => w[0]).join('').slice(0, 3);
  const LEVELS = ["Bachelor's", "Master's", "PhD", "PG Diploma"];

  // Fixes corrupted programme names (stray page numbers, digits spliced into words).
  const cleanName = s => {
    let t = String(s || '');
    if (/[A-Za-z]\d+[A-Za-z)]/.test(t)) t = t.replace(/\d/g, '');
    return t.replace(/\s+\d{1,3}$/, '').replace(/[\s,;]+$/, '').replace(/\s{2,}/g, ' ').trim();
  };

  // Adds a full stop to a sentence that doesn't end in punctuation.
  const sentence = s => String(s || '').trim().replace(/([^.!?\s])$/, '$1.');

  // Shown on every university page. Per-university details in data/extras.json are added below it.
  const FUNDING_NOTE =
    '<div><b>How fees work</b><br>Public university fees depend on your funding band under the government\'s New Funding Model, ' +
    'not only on the university. Needy students can receive a tuition scholarship plus a HELB loan, and pay a smaller household contribution. ' +
    'Private universities are eligible for HELB loans only.</div>' +
    '<div><b>How to apply</b><br>Apply through KUCCPS at ' +
    '<a href="https://students.kuccps.ac.ke" target="_blank" rel="noopener">students.kuccps.ac.ke</a>. ' +
    'Application dates change every year, so check the portal for the current window. ' +
    '<a href="#/apply">Read the step-by-step guide</a>.</div>';

  // ---------- Load data ----------
  let D, X = {};
  try {
    const r = await fetch('data/data.json');
    if (!r.ok) throw new Error('data.json returned status ' + r.status);
    D = await r.json();
  } catch (err) {
    $('count').innerHTML = '<b>Could not load data/data.json.</b> Check that the file exists inside the data folder and is not empty. (' + esc(err.message) + ')';
    return;
  }
  try {
    const r = await fetch('data/extras.json');
    if (r.ok) X = await r.json();
  } catch (err) { /* extras are optional */ }

  try {
    const r = await fetch('data/private.json');
    if (r.ok) (await r.json()).forEach(i => { if (!D.i.some(x => x.slug === i.slug)) D.i.push(i); });
  } catch (err) { /* private universities are optional */ }

  D.p.forEach(p => { p[2] = cleanName(p[2]); });

  // ---------- Indexes ----------
  const progsBy = {};
  D.p.forEach(p => (progsBy[p[0]] = progsBy[p[0]] || []).push(p));
  const countyCount = {};
  D.i.forEach(i => { countyCount[i.county] = (countyCount[i.county] || 0) + 1; });

  // ---------- State ----------
  const S = { county: '', area: 0, q: '', u: '' };
  let level = -1, filter = '', slug = '';
  const openAreas = new Set();

  // ---------- Home screen ----------
  function drawCounties() {
    $('county').innerHTML = '<option value="">All counties</option>' +
      D.c.filter(n => countyCount[n]).map(n => `<option value="${esc(n)}"${n === S.county ? ' selected' : ''}>${esc(n)} (${countyCount[n] || 0})</option>`).join('');
  }

  function matching(inst) {
    const q = S.q.trim().toLowerCase();
    return (progsBy[inst.id] || []).filter(p => (!S.area || p[1] === S.area) && (!q || p[2].toLowerCase().includes(q)));
  }

  function drawHome() {
    $('areas').innerHTML = [{ id: 0, name: 'Any course' }, ...D.a]
      .map(a => `<button class="chip" data-area="${a.id}" aria-pressed="${S.area === a.id}">${esc(a.name)}</button>`).join('');

    const q = S.q.trim();
    const searching = S.area || q;
    const u = S.u.trim().toLowerCase();
    const list = D.i.filter(i => (!S.county || i.county === S.county) && (!u || i.name.toLowerCase().includes(u)) && (!searching || matching(i).length));

    $('count').innerHTML = `<b>${list.length} institution${list.length === 1 ? '' : 's'}</b>` +
      (S.county ? ' in ' + esc(S.county) : ' in Kenya') +
      (S.area ? ' offering ' + esc(D.a.find(a => a.id === S.area).name) : '') +
      (q ? ' matching "' + esc(q) + '"' : '') +
      (u ? ' named "' + esc(S.u.trim()) + '"' : '');

    $('results').innerHTML = list.length ? list.map(i => {
      const n = searching ? matching(i).length : (progsBy[i.id] || []).length;
      const line = n ? n + (searching ? ' matching programme' + (n === 1 ? '' : 's') : ' approved programmes') : 'Programmes not yet listed';
      return `<button class="row" data-slug="${esc(i.slug)}"><span class="mono">${esc(mono(i.name))}</span><span class="rb"><h3>${esc(i.name)}</h3>` +
        `<p>${esc(i.town || i.county || '')}${i.county && i.town !== i.county ? ', ' + esc(i.county) : ''}</p><p><span class="badge">${esc(i.type)}</span>${line}</p></span></button>`;
    }).join('') : '<div class="empty">No institutions match. Try a different county, choose "Any course", or shorten your search.</div>';
  }

  // ---------- University screen ----------
  function feesBox(i) {
    const x = X[i.slug] || {};
    const parts = [FUNDING_NOTE];
    if (x.fees) parts.push('<div><b>Tuition and fees at this university</b><br>' + esc(x.fees) + '</div>');
    if (x.deadline) parts.push('<div><b>Application deadline</b><br>' + esc(x.deadline) + '</div>');
    if (x.apply) parts.push('<div><a href="' + esc(x.apply) + '" target="_blank" rel="noopener">Official application page</a></div>');
    if (!x.fees && i.web) parts.push('<div>For this university\'s fee schedule, see <a href="' + esc(i.web) + '" target="_blank" rel="noopener">its official website</a>.</div>');
    if (x.updated) parts.push('<small>Last checked: ' + esc(x.updated) + '</small>');
    return parts.join('');
  }

  function drawProgrammes(i) {
    const all = progsBy[i.id] || [];
    const shown = all.filter(p => (level < 0 || p[3] === level) && (!filter || p[2].toLowerCase().includes(filter)));
    const groups = D.a.map(a => ({ a, rows: shown.filter(p => p[1] === a.id) })).filter(g => g.rows.length);
    $('plist').innerHTML = groups.length ? groups.map(g => {
      const open = openAreas.has(g.a.id) || filter || (S.area && S.area === g.a.id);
      return `<details data-area="${g.a.id}"${open ? ' open' : ''}><summary>${esc(g.a.name)}<span>${g.rows.length} programme${g.rows.length === 1 ? '' : 's'}</span></summary>` +
        g.rows.map(p => `<div class="prog"><span>${esc(p[2])}</span><span class="lv">${LEVELS[p[3]] || ''}${p[4] ? '<br>' + p[4] : ''}</span></div>`).join('') + '</details>';
    }).join('') : `<div class="empty">${all.length ? 'No programmes match these filters.' : 'Programmes for this institution are not in the CUE list yet.'}</div>`;
    document.querySelectorAll('#lvls .chip').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.level === level)));
  }

  function drawProfile(i) {
    const all = progsBy[i.id] || [];
    const contact = [];
    if (i.web) contact.push('Website: <a href="' + esc(i.web) + '" target="_blank" rel="noopener">' + esc(i.web.replace(/^https?:\/\//, '')) + '</a>');
    if (i.email) contact.push('Email: ' + esc(i.email));
    if (i.phone) contact.push('Phone: ' + esc(i.phone));

    $('prof').innerHTML =
      `<div class="banner"><button class="back" id="back">← Results</button><span class="mono">${esc(mono(i.name))}</span><h1>${esc(i.name)}</h1></div>` +
      `<div class="stats"><div class="stat"><b>${esc(i.type)}</b><span>Type</span></div>` +
      `<div class="stat"><b>${i.yc || 'n/a'}</b><span>Year chartered</span></div>` +
      `<div class="stat"><b>${all.length || 'n/a'}</b><span>Programmes</span></div></div>` +
      `<p class="about">${i.bg ? esc(sentence(i.bg)) + ' ' : ''}Located in ${esc(i.town || i.county || 'Kenya')}${i.county ? ', ' + esc(i.county) + ' County' : ''}.</p>` +
      `<div class="sec">Fees and how to apply</div><div class="feebox">${feesBox(i)}</div>` +
      `<div class="sec">Programmes you can study</div>` +
      `<div class="tools"><div class="chips" id="lvls">${['All', ...LEVELS].map((n, k) => `<button class="chip" data-level="${k - 1}" aria-pressed="false">${esc(n)}</button>`).join('')}</div>` +
      `<input id="pq" type="search" placeholder="Filter programmes" aria-label="Filter programmes" value="${esc(filter)}"></div>` +
      `<div id="plist"></div>` +
      `<div class="sec">Compare</div><select id="cmpPick" aria-label="Compare with another institution"><option value="">Compare with another institution...</option>${D.i.filter(x => x.slug !== i.slug).map(x => `<option value="${esc(x.slug)}">${esc(x.name)}</option>`).join('')}</select>` +
      `<div class="sec">Contact</div><div class="contact">${contact.length ? contact.join('<br>') : 'Contact details not yet available.'}` +
      `<br><small>Contact details are unverified. Check the university's official site.</small></div>`;
    drawProgrammes(i);
  }

  // ---------- Extra screens: compare and apply guide ----------
  const css = document.createElement('style');
  css.textContent = '.pg{padding:16px;max-width:760px;margin:0 auto}.pg li{margin:0 0 12px}.cw{overflow-x:auto}.cw table{width:100%;border-collapse:collapse}' +
    '.cw th,.cw td{padding:10px;text-align:left;vertical-align:top;border-bottom:1px solid rgba(128,128,128,.3)}#cmpPick{max-width:100%;padding:10px}';
  document.head.appendChild(css);
  ['cmp', 'guide'].forEach(id => { const d = document.createElement('div'); d.id = id; d.className = 'hide'; $('prof').after(d); });
  const show = name => ['home', 'prof', 'cmp', 'guide'].forEach(id => $(id).classList.toggle('hide', id !== name));

  const guideLink = document.createElement('p');
  guideLink.innerHTML = '<a href="#/apply">How to apply through KUCCPS: step-by-step guide</a>';
  $('count').before(guideLink);

  function drawGuide() {
    $('guide').innerHTML = '<div class="pg"><button class="back" id="back">← Back</button><h1>How to apply through KUCCPS</h1>' +
      '<p>KUCCPS places students into public universities and also lists many private ones. These steps follow the KUCCPS website. Details can change, so confirm on the portal.</p><ol>' +
      '<li><b>Check the minimum grade.</b> For the 2026 cycle the minimum was C+ for a degree, C- for a diploma and D+ for a certificate.</li>' +
      '<li><b>Log in.</b> Go to <a href="https://students.kuccps.ac.ke" target="_blank" rel="noopener">students.kuccps.ac.ke</a>. Use your KCSE index number, your exam year and your password. First-time users may be asked for their birth certificate number.</li>' +
      '<li><b>Confirm your phone number and email.</b> KUCCPS uses them to send placement updates.</li>' +
      '<li><b>Choose programmes you qualify for.</b> Compare your cluster weight with the previous cut-off points. You can only apply for programmes whose minimum subject requirements you meet.</li>' +
      '<li><b>Note each programme code.</b> Open the Application tab, click Apply Now, enter the codes in order of preference and click Submit.</li>' +
      '<li><b>Pay the application fee.</b> KUCCPS lists the fee as Ksh 1,500, paid through the payment options (eCitizen) shown on the portal. Pay only through the portal.</li>' +
      '<li><b>Revise if needed.</b> KUCCPS allows changes to your choices before the deadline and opens revision windows after results.</li>' +
      '<li><b>Wait for placement,</b> then report to your institution on the dates in your placement letter, with your documents.</li></ol>' +
      '<p><b>Dates.</b> The 2026/2027 window ran from 7 April to 6 May 2026 and has closed. Dates change every year, so check <a href="https://www.kuccps.ac.ke" target="_blank" rel="noopener">kuccps.ac.ke</a>.</p>' +
      '<p><b>Funding.</b> Apply to HELB separately for a loan. Public university fees depend on your funding band.</p></div>';
  }

  function drawCompare(a, b) {
    const n = (i, k) => (progsBy[i.id] || []).filter(p => k < 0 || p[3] === k).length;
    const top = i => D.a.map(x => [x.name, (progsBy[i.id] || []).filter(p => p[1] === x.id).length]).filter(x => x[1])
      .sort((x, y) => y[1] - x[1]).slice(0, 3).map(x => esc(x[0]) + ' (' + x[1] + ')').join('<br>') || 'n/a';
    const link = i => i.web ? '<a href="' + esc(i.web) + '" target="_blank" rel="noopener">' + esc(i.web.replace(/^https?:\/\//, '')) + '</a>' : 'n/a';
    const rows = [
      ['Type', i => esc(i.type)], ['County', i => esc(i.county || 'n/a')], ['Year chartered', i => esc(i.yc || 'n/a')],
      ['All programmes', i => n(i, -1) || 'Not yet listed'],
      ...LEVELS.map((l, k) => [l, i => n(i, k) || '-']),
      ['Biggest course areas', top], ['Website', link]
    ];
    $('cmp').innerHTML = '<div class="pg"><button class="back" id="back">← Back</button><h1>Compare</h1><div class="cw"><table><tr><th></th>' +
      [a, b].map(i => '<th><a href="#/u/' + esc(i.slug) + '">' + esc(i.name) + '</a></th>').join('') + '</tr>' +
      rows.map(r => '<tr><th>' + r[0] + '</th><td>' + r[1](a) + '</td><td>' + r[1](b) + '</td></tr>').join('') +
      '</table></div><p><small>Programme counts come from the CUE list. Private universities are not yet in that list.</small></p></div>';
  }

  // ---------- Routing ----------
  function route() {
    const h = location.hash;
    let m;
    if (h === '#/apply') {
      slug = ''; drawGuide(); show('guide'); window.scrollTo(0, 0);
      document.title = 'How to apply through KUCCPS | Elimu Kenya';
    } else if ((m = h.match(/^#\/compare\/([^/]+)\/([^/]+)$/))) {
      const a = D.i.find(x => x.slug === m[1]), b = D.i.find(x => x.slug === m[2]);
      if (!a || !b) { location.hash = ''; return; }
      slug = ''; drawCompare(a, b); show('cmp'); window.scrollTo(0, 0);
      document.title = 'Compare | Elimu Kenya';
    } else if ((m = h.match(/^#\/u\/(.+)$/))) {
      const i = D.i.find(x => x.slug === m[1]);
      if (!i) { location.hash = ''; return; }
      if (slug !== m[1]) { level = -1; filter = ''; openAreas.clear(); slug = m[1]; }
      show('prof');
      drawProfile(i);
      window.scrollTo(0, 0);
      document.title = i.name + ' | Elimu Kenya';
    } else {
      slug = '';
      show('home');
      document.title = 'Elimu Kenya: Find a public university';
      drawHome();
    }
  }

  // ---------- Events ----------
  document.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'back') { location.hash = ''; }
    else if (b.dataset.slug) { location.hash = '#/u/' + b.dataset.slug; }
    else if (b.dataset.level !== undefined) { level = +b.dataset.level; drawProgrammes(D.i.find(x => x.slug === slug)); }
    else if (b.dataset.area !== undefined && !b.closest('#prof')) { S.area = +b.dataset.area; drawHome(); }
  });

  document.addEventListener('toggle', e => {
    const d = e.target;
    if (d.tagName === 'DETAILS' && d.dataset.area) {
      const id = +d.dataset.area;
      d.open ? openAreas.add(id) : openAreas.delete(id);
    }
  }, true);

  $('county').addEventListener('change', e => { S.county = e.target.value; drawHome(); });
  $('q').addEventListener('input', e => { S.q = e.target.value; drawHome(); });
  $('u').addEventListener('input', e => { S.u = e.target.value; drawHome(); });
  document.addEventListener('input', e => {
    if (e.target.id === 'pq') {
      filter = e.target.value.trim().toLowerCase();
      drawProgrammes(D.i.find(x => x.slug === slug));
    }
  });
  document.addEventListener('change', e => {
    if (e.target.id === 'cmpPick' && e.target.value) location.hash = '#/compare/' + slug + '/' + e.target.value;
  });
  window.addEventListener('hashchange', route);

  // ---------- Start ----------
  drawCounties();
  route();
  if ('serviceWorker' in navigator) {
    addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
