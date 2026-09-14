(() => {
  const STORAGE_KEY = 'moraleZero.visitor';
  const roles = window.MZ_ROLES || [];
  const directives = window.MZ_DIRECTIVES || [];

  function readVisitor() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.role ? parsed : null;
    } catch (_) { return null; }
  }

  function writeVisitor(visitor) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(visitor)); } catch (_) {}
  }

  function chooseRole(roleId) {
    const now = new Date().toISOString();
    const prior = readVisitor();
    const visitor = {
      role: roleId,
      firstSeenAt: prior?.firstSeenAt || now,
      lastSeenAt: now,
      lastDirectiveId: prior?.lastDirectiveId || null,
      seenDirectiveIds: prior?.seenDirectiveIds || []
    };
    writeVisitor(visitor);
    const gate = document.querySelector('[data-role-gate]');
    if (gate) gate.classList.remove('open');
    hydratePersonalized(visitor);
  }

  function roleById(id) { return roles.find(r => r.id === id) || roles[2] || null; }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function dayKey() {
    const d = new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
  }

  function scoreDirective(d, role, salt='') {
    const rootPos = role?.roots?.indexOf(d.root);
    const relevance = rootPos === -1 || rootPos == null ? 0 : (5 - rootPos) * 100000;
    const stable = hashString(`${dayKey()}|${role?.id || 'none'}|${salt}|${d.id}`) % 100000;
    return relevance + stable;
  }

  function todayDirective(role) {
    return [...directives].sort((a,b) => scoreDirective(b, role, 'today') - scoreDirective(a, role, 'today'))[0];
  }

  function relevant(role, excludeId, count=3) {
    return [...directives]
      .filter(d => d.id !== excludeId)
      .sort((a,b) => scoreDirective(b, role, 'relevant') - scoreDirective(a, role, 'relevant'))
      .slice(0,count);
  }

  function escapeHtml(s='') {
    return s.replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  function renderToday(d) {
    const target = document.querySelector('[data-today]');
    if (!target || !d) return;
    target.innerHTML = `
      <div class="today-meta">
        <div>
          <div class="root-label">TODAY / ${escapeHtml(d.root)}</div>
          <p class="tiny-copy">One choice. One laugh. One piece of evidence. Then get out of the way.</p>
        </div>
        <div class="directive-id">${escapeHtml(d.id)}</div>
      </div>
      <div class="today-body">
        <h3>${escapeHtml(d.title)}</h3>
        <div>${d.body.map(p => `<p>${escapeHtml(p)}</p>`).join('')}</div>
        <div class="today-actions">
          <a class="btn inverse" href="/directives/${encodeURIComponent(d.id)}.html">Unfortunately, the research…</a>
          <a class="text-link" href="/directives/">Browse all 40 →</a>
        </div>
      </div>`;
  }

  function renderRelevant(items) {
    const target = document.querySelector('[data-relevant]');
    if (!target) return;
    target.innerHTML = items.map(d => `
      <a class="card" href="/directives/${encodeURIComponent(d.id)}.html">
        <div>
          <div class="meta-row"><span>${escapeHtml(d.root)}</span><span>${escapeHtml(d.id)}</span></div>
          <h3>${escapeHtml(d.title)}</h3>
          <p class="mini-body">${escapeHtml(d.body[0])}</p>
        </div>
        <span class="text-link">Read directive →</span>
      </a>`).join('');
  }

  function hydratePersonalized(visitor) {
    const role = roleById(visitor?.role);
    const roleLabel = document.querySelector('[data-role-label]');
    if (roleLabel && role) roleLabel.textContent = role.label;
    const d = todayDirective(role);
    renderToday(d);
    renderRelevant(relevant(role, d?.id));
    if (d) {
      const v = readVisitor() || visitor || {};
      const seen = Array.from(new Set([...(v.seenDirectiveIds || []), d.id])).slice(-80);
      writeVisitor({...v, lastSeenAt:new Date().toISOString(), lastDirectiveId:d.id, seenDirectiveIds:seen});
    }
  }

  function initGate() {
    const gate = document.querySelector('[data-role-gate]');
    if (!gate) return;
    const visitor = readVisitor();
    if (!visitor) gate.classList.add('open');
    gate.querySelectorAll('[data-role]').forEach(btn => {
      btn.addEventListener('click', () => chooseRole(btn.dataset.role));
    });
  }

  function initRoleButtons() {
    document.querySelectorAll('[data-change-role]').forEach(btn => {
      btn.addEventListener('click', () => {
        const gate = document.querySelector('[data-role-gate]');
        if (gate) gate.classList.add('open');
      });
    });
  }

  function initForget() {
    document.querySelectorAll('[data-forget]').forEach(btn => btn.addEventListener('click', () => {
      try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
      location.href = '/';
    }));
  }

  function initNav() {
    const btn = document.querySelector('[data-nav-toggle]');
    const nav = document.querySelector('[data-nav]');
    if (!btn || !nav) return;
    btn.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  function initFilters() {
    const list = document.querySelector('[data-directive-list]');
    if (!list) return;
    document.querySelectorAll('[data-filter-root]').forEach(btn => btn.addEventListener('click', () => {
      const root = btn.dataset.filterRoot;
      document.querySelectorAll('[data-filter-root]').forEach(x => x.classList.toggle('active', x === btn));
      list.querySelectorAll('[data-root]').forEach(row => {
        row.hidden = root !== 'ALL' && row.dataset.root !== root;
      });
    }));
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    initGate();
    initRoleButtons();
    initForget();
    initFilters();
    const visitor = readVisitor();
    if (visitor) hydratePersonalized(visitor);
  });
})();
