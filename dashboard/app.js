// Token Radar's dashboard. It reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, the live-token view, and a per-protocol
// detail view with the model's own breakdown and the protocol's farm plan.
// No network: every byte it shows is in data.js. State lives in location.hash
// so any view has an address: #tab, #q, #category, #p=<slug>, #sort.
(function () {
  'use strict';

  var DATA = window.RADAR;
  var root = document.getElementById('board');
  if (!DATA || !root) return;
  root.setAttribute('aria-busy', 'false');

  var state = { tab: 'board', q: '', category: 'all', sort: 'implied-desc', selected: null };

  var money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return money.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    return 'x' + n.toFixed(2);
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  // ------------------------------------------------------------ hash state

  function readHash() {
    var hash = location.hash.replace(/^#/, '');
    var next = { tab: 'board', q: '', category: 'all', sort: 'implied-desc', selected: null };
    if (!hash) return next;
    hash.split('&').forEach(function (pair) {
      var eq = pair.indexOf('=');
      var key = eq >= 0 ? pair.slice(0, eq) : pair;
      var val = eq >= 0 ? decodeURIComponent(pair.slice(eq + 1)) : '';
      if (key === 'tab' && (val === 'board' || val === 'live')) next.tab = val;
      else if (key === 'q') next.q = val;
      else if (key === 'category') next.category = val;
      else if (key === 'sort') next.sort = val;
      else if (key === 'p') next.selected = val;
    });
    if (next.tab === 'live' && next.sort === 'implied-desc') next.sort = 'mcap-desc';
    return next;
  }

  function writeHash() {
    var parts = [];
    if (state.tab !== 'board') parts.push('tab=' + state.tab);
    if (state.q) parts.push('q=' + encodeURIComponent(state.q));
    if (state.category !== 'all') parts.push('category=' + encodeURIComponent(state.category));
    if (state.selected) parts.push('p=' + encodeURIComponent(state.selected));
    var defSort = state.tab === 'live' ? 'mcap-desc' : 'implied-desc';
    if (state.sort !== defSort) parts.push('sort=' + state.sort);
    var next = parts.length ? '#' + parts.join('&') : '#';
    if (location.hash !== next) history.replaceState(null, '', next);
  }

  // ------------------------------------------------------------ filtering

  function boardRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    return sortRows(rows, state.sort, false);
  }

  function liveRows() {
    var q = state.q.trim().toLowerCase();
    var rows = DATA.live.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    return sortRows(rows, state.sort, true);
  }

  function num(v) { return v === null || v === undefined ? -Infinity : v; }

  function sortRows(rows, sort, live) {
    var parts = sort.split('-');
    var key = parts[0];
    var dir = parts[1] === 'asc' ? 1 : -1;
    var get = function (r) {
      if (key === 'rank') return r.rank || 0;
      if (key === 'name') return (r.name || '').toLowerCase();
      if (key === 'category') return (r.category || 'Uncategorised').toLowerCase();
      if (key === 'tvl') return num(r.tvl_usd);
      if (key === 'change') return num(r.change_7d);
      if (key === 'age') return num(r.age_days);
      if (key === 'mcap') return num(r.mcap_usd);
      return num(r.implied_value_usd);
    };
    return rows.slice().sort(function (a, b) {
      var va = get(a);
      var vb = get(b);
      if (va < vb) return -1 * dir;
      if (va > vb) return 1 * dir;
      return (a.rank || 0) - (b.rank || 0) || (a.slug < b.slug ? -1 : 1);
    });
  }

  function categories() {
    var seen = {};
    DATA.rows.forEach(function (r) { seen[r.category || 'Uncategorised'] = true; });
    return Object.keys(seen).sort();
  }

  // ------------------------------------------------------------ rendering

  function statCard(value, label) {
    return el('div', { class: 'stat' }, el('b', { text: value }), el('span', { text: label }));
  }

  function header() {
    var m = DATA.model;
    var modelText = 'radar-2: implied value = TVL at 0.25x up to $1B, then 0.125x above it, ' +
      'times a growth multiplier (7d change clamped to ' + m.growth_floor + '%..' + m.growth_cap +
      '%, weight ' + m.growth_weight + '), times maturity (0.6 + up to 0.4 over ' +
      m.maturity_days + ' days), times chains (1 + 0.03 per extra chain, up to 5), ' +
      'times a category multiplier. A protocol with no listing date counts as 365 days old.';
    return el('header', null,
      el('p', { class: 'eyebrow', text: 'Token launch radar · ' + DATA.model_version }),
      el('h1', { text: 'Which pre-token protocol launches the biggest token?' }),
      el('p', { class: 'lede', text: 'Every pre-token protocol in the snapshot, ranked by what its token would be worth if the protocol launched one today — plus a farm plan for each, and the tokens that already trade, shown at the market\u2019s own values.' }),
      el('div', { class: 'stats' },
        statCard(String(DATA.board_size), 'protocols ranked'),
        statCard(String(DATA.watchlist_size), 'on the $50M watchlist'),
        statCard(String(DATA.early_size), 'early rows below the floor'),
        statCard(String(DATA.live_size), 'live tokens tracked')),
      el('p', { class: 'model' }, el('b', { text: 'The model — ' }), modelText),
      el('p', { class: 'source', text: 'Snapshot ' + DATA.as_of + ' · ' + DATA.source + ' · Implied values are this entry\u2019s own claim, not a prediction of whether or when a token launches.' }));
  }

  function tabBar() {
    return el('div', { class: 'tabs', role: 'tablist' },
      el('button', {
        class: 'tab', role: 'tab', 'aria-selected': state.tab === 'board' ? 'true' : 'false',
        onclick: function () { state.tab = 'board'; state.selected = null; state.sort = 'implied-desc'; writeHash(); render(); },
      }, 'Pre-token board (' + DATA.board_size + ')'),
      el('button', {
        class: 'tab', role: 'tab', 'aria-selected': state.tab === 'live' ? 'true' : 'false',
        onclick: function () { state.tab = 'live'; state.selected = null; state.sort = 'mcap-desc'; writeHash(); render(); },
      }, 'Live tokens (' + DATA.live_size + ')'));
  }

  function controlBar(countText) {
    var search = el('input', {
      type: 'search', placeholder: 'Search by name or slug…', value: state.q,
      'aria-label': 'Search protocols',
      oninput: function (e) { state.q = e.target.value; writeHash(); renderTable(); },
    });
    var select = el('select', {
      'aria-label': 'Filter by category',
      onchange: function (e) { state.category = e.target.value; writeHash(); renderTable(); },
    });
    select.appendChild(el('option', { value: 'all' }, 'All categories'));
    categories().forEach(function (c) {
      var opt = el('option', { value: c }, c);
      if (c === state.category) opt.selected = true;
      select.appendChild(opt);
    });
    return el('div', { class: 'controls' }, search, select, el('span', { class: 'count', text: countText }));
  }

  function sortButton(label, key, live) {
    var active = state.sort.split('-')[0] === key;
    var dir = state.sort.split('-')[1];
    var arrow = active ? (dir === 'desc' ? ' ↓' : ' ↑') : '';
    return el('button', {
      onclick: function () {
        if (active) state.sort = key + '-' + (dir === 'desc' ? 'asc' : 'desc');
        else state.sort = key + '-' + (key === 'name' || key === 'category' ? 'asc' : 'desc');
        writeHash(); renderTable();
      },
    }, label + arrow);
  }

  function boardTable() {
    var rows = boardRows();
    var table = el('table', null,
      el('thead', null, el('tr', null,
        el('th', { class: 'num' }, sortButton('Rank', 'rank')),
        el('th', null, sortButton('Protocol', 'name')),
        el('th', null, sortButton('Category', 'category')),
        el('th', { class: 'num' }, sortButton('TVL', 'tvl')),
        el('th', { class: 'num' }, sortButton('7d', 'change')),
        el('th', { class: 'num' }, sortButton('Age', 'age')),
        el('th', { class: 'num' }, sortButton('Implied', 'implied')))),
      el('tbody', null));
    var body = table.querySelector('tbody');
    if (rows.length === 0) {
      body.appendChild(el('tr', null, el('td', { colspan: '7', class: 'empty' }, 'No protocols match this filter.')));
    }
    rows.forEach(function (r) {
      var change = el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) });
      var nameCell = el('td', { class: 'name-cell' },
        el('b', null, r.name, r.watchlist ? el('span', { class: 'badge watch', text: 'Watchlist' }) : null),
        el('span', { text: r.slug + ' · ' + r.chains.join(', ') }));
      var row = el('tr', {
        class: state.selected === r.slug ? 'selected' : '',
        onclick: function () { state.selected = r.slug; writeHash(); render(); },
      },
        el('td', { class: 'num', text: String(r.rank) }),
        nameCell,
        el('td', { text: r.category || 'Uncategorised' }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        change,
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', { class: 'num' }, el('b', { text: fmtUsd(r.implied_value_usd) })));
      body.appendChild(row);
    });
    return el('div', { class: 'table-wrap' }, table);
  }

  function liveTable() {
    var rows = liveRows();
    var table = el('table', null,
      el('thead', null, el('tr', null,
        el('th', null, sortButton('Protocol', 'name')),
        el('th', null, sortButton('Category', 'category')),
        el('th', { class: 'num' }, sortButton('TVL', 'tvl')),
        el('th', { class: 'num' }, sortButton('7d', 'change')),
        el('th', { class: 'num' }, sortButton('Market cap', 'mcap')))),
      el('tbody', null));
    var body = table.querySelector('tbody');
    if (rows.length === 0) {
      body.appendChild(el('tr', null, el('td', { colspan: '5', class: 'empty' }, 'No live tokens match this filter.')));
    }
    rows.forEach(function (r) {
      var change = el('td', { class: 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) });
      var nameCell = el('td', { class: 'name-cell' },
        el('b', null, r.name, el('span', { class: 'badge live', text: 'Live' })),
        el('span', { text: r.slug + ' · ' + r.chains.join(', ') }));
      body.appendChild(el('tr', {
        class: state.selected === r.slug ? 'selected' : '',
        onclick: function () { state.selected = r.slug; writeHash(); render(); },
      },
        nameCell,
        el('td', { text: r.category || 'Uncategorised' }),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        change,
        el('td', { class: 'num' }, el('b', { text: fmtUsd(r.mcap_usd) }))));
    });
    return el('div', { class: 'table-wrap' }, table);
  }

  function kv(value, label) {
    return el('div', null, el('b', { text: value }), el('span', { text: label }));
  }

  function detailView() {
    var slug = state.selected;
    var row = null;
    var isLive = false;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) DATA.live.forEach(function (r) { if (r.slug === slug) { row = r; isLive = true; } });
    if (!row) return el('p', { class: 'empty', text: 'No protocol with that slug in this snapshot.' });

    var back = el('a', {
      class: 'back', href: '#',
      onclick: function (e) { e.preventDefault(); state.selected = null; writeHash(); render(); },
    }, '← Back to the ' + (state.tab === 'live' ? 'live tokens' : 'board'));

    var head = el('div', { class: 'detail' },
      el('h2', null, row.name,
        isLive ? el('span', { class: 'badge live', text: 'Live' }) :
        row.watchlist ? el('span', { class: 'badge watch', text: 'Watchlist' }) : null),
      el('p', { class: 'sub', text: row.slug + ' · ' + (row.category || 'Uncategorised') + ' · ' + row.chains.join(', ') }),
      el('div', { class: 'kv' },
        kv(fmtUsd(row.tvl_usd), 'Total value locked'),
        kv(fmtPct(row.change_7d), 'TVL change, 7 days'),
        kv(fmtAge(row.age_days), 'Age (first tracked)'),
        isLive ? kv(fmtUsd(row.mcap_usd), 'Market cap') : kv(fmtUsd(row.implied_value_usd), 'Implied value (radar-2)')),
      isLive ? el('p', { class: 'note', text: 'This token already trades, so the board shows the market\u2019s own value for it instead of a modelled one.' }) : null);

    if (!isLive) {
      var m = DATA.model;
      var base = row.base_usd;
      var implied = Math.max(1, Math.round(base * row.growth_multiplier * row.maturity_multiplier * row.chain_multiplier * row.category_multiplier));
      var breakdown = el('table', { class: 'breakdown' }, el('tbody', null,
        el('tr', null, el('td', { text: 'Base — TVL at 0.25x to $1B, 0.125x above' }), el('td', { text: fmtUsd(base) })),
        el('tr', null, el('td', { text: 'Growth — 7d change ' + fmtPct(row.change_7d) + ' (clamped ' + m.growth_floor + '%..' + m.growth_cap + '%)' }), el('td', { text: fmtMult(row.growth_multiplier) })),
        el('tr', null, el('td', { text: 'Maturity — ' + fmtAge(row.age_days) + ' old (unknown counts as 365d)' }), el('td', { text: fmtMult(row.maturity_multiplier) })),
        el('tr', null, el('td', { text: 'Chains — ' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ' (+0.03 each, up to 5)' }), el('td', { text: fmtMult(row.chain_multiplier) })),
        el('tr', null, el('td', { text: 'Category — ' + (row.category || 'Uncategorised') }), el('td', { text: fmtMult(row.category_multiplier) })),
        el('tr', { class: 'total' }, el('td', { text: 'Implied value' }), el('td', { text: fmtUsd(implied) }))));
      var steps = el('ol', { class: 'steps' });
      row.farm_steps.forEach(function (s) { steps.appendChild(el('li', { text: s })); });
      head.appendChild(el('h3', { text: 'How the model scores it' }));
      head.appendChild(breakdown);
      head.appendChild(el('h3', { text: 'Farm plan — before a token launches' }));
      head.appendChild(steps);
      head.appendChild(el('p', { class: 'note', text: 'A farm plan is a routine, not a promise: a protocol may never issue a token, and a token may be worth nothing. Never pay a fee to claim, and only trust links the protocol itself publishes.' }));
    }
    return el('div', null, back, head);
  }

  var tableHost = null;

  function renderTable() {
    if (!tableHost) return;
    tableHost.innerHTML = '';
    if (state.tab === 'live') {
      tableHost.appendChild(controlBar(liveRows().length + ' of ' + DATA.live_size + ' live tokens'));
      tableHost.appendChild(liveTable());
    } else {
      tableHost.appendChild(controlBar(boardRows().length + ' of ' + DATA.board_size + ' ranked protocols'));
      tableHost.appendChild(boardTable());
    }
  }

  function render() {
    root.innerHTML = '';
    var wrap = el('div', { class: 'wrap' });
    wrap.appendChild(header());
    wrap.appendChild(tabBar());
    if (state.selected) {
      wrap.appendChild(detailView());
    } else {
      tableHost = el('div', null);
      wrap.appendChild(tableHost);
      renderTable();
    }
    wrap.appendChild(el('footer', { text: 'Token Radar · radar-2 · snapshot ' + DATA.as_of + ' · Built for make.fun\u2019s token-radar-01 bounty.' }));
    root.appendChild(wrap);
  }

  window.addEventListener('hashchange', function () {
    state = readHash();
    render();
  });

  state = readHash();
  render();
})();
