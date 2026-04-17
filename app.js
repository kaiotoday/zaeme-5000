// app.js — Zäme 5000
document.addEventListener('DOMContentLoaded', () => {

  // ============================================================
  // 1. SUPABASE INIT
  // ============================================================
  const SUPABASE_URL = 'https://oaybbyhlitmeftjtxwcn.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9heWJieWhsaXRtZWZ0anR4d2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzc3OTMsImV4cCI6MjA5MTkxMzc5M30.CxMa2fLNWMfc8_RlEKDWy1Be4lYzByqJe3_DGeOfH0s';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // ============================================================
  // 2. GLOBAL STATE
  // ============================================================
  let activeUser = null;
  let selectedLoginName = '';
  let loginSecret = { 1: null, 2: null, 3: null };
  let signupSecret = { 1: null, 2: null, 3: null };
  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;

  // ============================================================
  // 3. HELPER FUNCTIONS (all defined up here so they're available)
  // ============================================================

  function resetSecret(btnsCollection, stateObj) {
    if (stateObj) Object.assign(stateObj, { 1: null, 2: null, 3: null });
    btnsCollection.forEach(b => delete b.dataset.active);
  }

  async function setupAdminPanel(usr) {
    const adminPanel = document.getElementById('admin-panel');
    const pendingList = document.getElementById('admin-pending-list');
    if (!adminPanel || !pendingList) return;
    if (!usr || (usr.role !== 'admin' && usr.role !== 'organizer')) {
      adminPanel.classList.add('hidden');
      return;
    }

    adminPanel.classList.remove('hidden');

    const { data: pends } = await supabase.from('users').select('*').eq('is_approved', false);
    if (!pends || pends.length === 0) {
      pendingList.innerHTML = '<div class="text-white/40 text-center text-xs font-sans mt-2 italic">Keine offenen Anträge.</div>';
      return;
    }

    pendingList.innerHTML = '';
    pends.forEach(p => {
      pendingList.innerHTML += `
        <div class="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/10 mb-2">
          <span class="text-white font-bold font-sans">${p.name}</span>
          <button class="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider approve-btn" data-id="${p.id}">✓ Zulassen</button>
        </div>
      `;
    });

    document.querySelectorAll('.approve-btn').forEach(b => {
      b.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        e.target.textContent = '...';
        await supabase.from('users').update({ is_approved: true }).eq('id', id);
        setupAdminPanel(usr);
      });
    });
  }

  // ============================================================
  // HELPER: All approved users (cached for autocomplete)
  // ============================================================
  let allUsers = [];

  async function loadAllUsers() {
    const { data } = await supabase.from('users').select('name').eq('is_approved', true);
    allUsers = data || [];
  }

  // ============================================================
  // AUTOCOMPLETE LOGIN SEARCH
  // ============================================================
  function setupLoginAutocomplete() {
    const searchInput = document.getElementById('login-search');
    const autocompleteBox = document.getElementById('login-autocomplete');
    const hint = document.getElementById('login-hint');
    if (!searchInput || !autocompleteBox) return;

    searchInput.addEventListener('input', () => {
      const q = searchInput.value.trim().toLowerCase();
      if (q.length < 1) { autocompleteBox.classList.add('hidden'); return; }

      const matches = allUsers.filter(u => u.name.toLowerCase().startsWith(q));
      if (matches.length === 0) {
        autocompleteBox.innerHTML = `<div class="px-4 py-3 text-white/40 text-sm font-sans">Kein Account gefunden</div>`;
        autocompleteBox.classList.remove('hidden');
        return;
      }

      autocompleteBox.innerHTML = matches.map(u => `
        <button class="ac-item w-full text-left px-4 py-3 font-marker text-lg text-white hover:bg-white/10 transition-colors border-b border-white/5 last:border-0" data-name="${u.name}">
          ${u.name}
        </button>
      `).join('');
      autocompleteBox.classList.remove('hidden');

      autocompleteBox.querySelectorAll('.ac-item').forEach(btn => {
        btn.addEventListener('click', () => {
          selectedLoginName = btn.getAttribute('data-name');
          searchInput.value = selectedLoginName;
          autocompleteBox.classList.add('hidden');
          if (hint) hint.textContent = `${selectedLoginName} ausgewählt — wähl deinen Code!`;

          // Open pin modal
          const pinWelcomeMsg = document.getElementById('pin-welcome-msg');
          const pinModal = document.getElementById('pin-modal');
          const secretBtns = document.querySelectorAll('.secret-btn');
          if (pinWelcomeMsg) pinWelcomeMsg.textContent = `Hallo ${selectedLoginName} 👋`;
          if (pinModal) {
            pinModal.classList.remove('hidden');
            resetSecret(secretBtns, loginSecret);
            setTimeout(() => pinModal.classList.remove('opacity-0'), 50);
          }
        });
      });
    });

    // Hide on outside click
    document.addEventListener('click', (e) => {
      if (!searchInput.contains(e.target) && !autocompleteBox.contains(e.target)) {
        autocompleteBox.classList.add('hidden');
      }
    });
  }

  async function checkAuth() {
    const savedName = localStorage.getItem('profile-name');
    const viewLogin = document.getElementById('view-login');
    const appContainer = document.getElementById('app-container');
    const navFelt = document.querySelector('.nav-felt');
    const profileNameDisplay = document.getElementById('profile-name-display');

    if (savedName) {
      if (profileNameDisplay) profileNameDisplay.textContent = savedName;
      if (viewLogin) viewLogin.classList.add('hidden');
      if (appContainer) appContainer.classList.remove('hidden');
      if (navFelt) navFelt.classList.remove('hidden');

      const { data: userRow } = await supabase.from('users').select('*').eq('name', savedName).single();
      if (userRow) {
        activeUser = userRow;
        setupAdminPanel(activeUser);

        // Role badge
        const roleBadge = document.getElementById('profile-role-badge');
        if (roleBadge) roleBadge.textContent = userRow.role === 'admin' ? '⚡ Admin' : userRow.role === 'organizer' ? '🎯 Organizer' : 'Member';

        // Stats placeholders
        const statOrganized = document.getElementById('stat-organized');
        if (statOrganized) statOrganized.textContent = userRow.organized_count || 0;

        const profileAvatar = document.getElementById('profile-avatar');
        if (userRow.avatar_url && profileAvatar) profileAvatar.style.backgroundImage = `url('${userRow.avatar_url}')`;
        const profileLangSelect = document.getElementById('profile-lang');
        if (userRow.ping_lang && profileLangSelect) profileLangSelect.value = userRow.ping_lang;
      }

      // Load home greeting
      const greeting = document.getElementById('home-greeting');
      if (greeting) greeting.textContent = `Hey ${savedName}! 👋`;

      // Load event homepage data
      loadHomeEvents();

    } else {
      if (viewLogin) viewLogin.classList.remove('hidden');
      if (appContainer) appContainer.classList.add('hidden');
      if (navFelt) navFelt.classList.add('hidden');
      await loadAllUsers();
      setupLoginAutocomplete();
    }
  }

  // ============================================================
  // HOME: LOAD EVENTS
  // ============================================================
  async function loadHomeEvents() {
    const eventsList = document.getElementById('events-list');
    const heroTitle = document.getElementById('hero-title');
    const heroDate = document.getElementById('hero-date');
    const heroLocation = document.getElementById('hero-location');
    const heroOrgas = document.getElementById('hero-orgas');
    const heroCost = document.getElementById('hero-cost');
    const heroCountdown = document.getElementById('hero-countdown');
    const heroDeadline = document.getElementById('hero-deadline');

    // Try fetching from DB first
    const { data: events } = await supabase.from('events').select('*').eq('is_published', true).order('event_date', { ascending: true });

    const now = new Date();
    // Find next upcoming event
    const upcoming = events?.filter(e => e.event_date && new Date(e.event_date) >= now) || [];
    const past = events?.filter(e => e.event_date && new Date(e.event_date) < now) || [];

    // If no DB events yet, show a hardcoded placeholder for the Beerpong event
    const nextEvent = upcoming[0] || {
      id: 'placeholder',
      title: 'Beerpong Bash',
      event_date: '2026-05-08',
      location: "Lulla's Wintergarten",
      organizer_1: 'Lulla',
      organizer_2: 'Sergito',
      cost_per_person: 15,
      rsvp_deadline: '2026-05-05T23:59:00+02:00',
      is_published: true
    };

    // Fill Hero
    if (heroTitle) heroTitle.textContent = nextEvent.title;
    if (heroDate && nextEvent.event_date) {
      const d = new Date(nextEvent.event_date);
      heroDate.textContent = `📅 ${d.toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`;
    }
    if (heroLocation) heroLocation.textContent = `📍 ${nextEvent.location || '—'}`;
    if (heroOrgas) heroOrgas.textContent = `👥 ${nextEvent.organizer_1 || '?'} & ${nextEvent.organizer_2 || '?'}`;
    if (heroCost) heroCost.textContent = `💰 ${nextEvent.cost_per_person ? nextEvent.cost_per_person + ' CHF' : '—'}`;

    // Countdown
    if (heroCountdown && nextEvent.event_date) {
      const eventDate = new Date(nextEvent.event_date);
      const daysLeft = Math.ceil((eventDate - now) / (1000 * 60 * 60 * 24));
      heroCountdown.textContent = daysLeft > 0 ? `noch ${daysLeft} Tage` : 'Heute! 🎉';
    }

    // RSVP Deadline
    if (heroDeadline && nextEvent.rsvp_deadline) {
      const deadline = new Date(nextEvent.rsvp_deadline);
      const daysToDeadline = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      heroDeadline.textContent = daysToDeadline > 0 ? `⏳ Noch ${daysToDeadline} Tage zum Abstimmen` : 'Abstimmung geschlossen';
    }

    // Hero detail button
    const heroBtn = document.getElementById('hero-rsvp-btn');
    if (heroBtn) heroBtn.onclick = () => openEventModal(nextEvent);


    // Events list
    if (eventsList) {
      let html = '';

      // Upcoming events
      upcoming.forEach(ev => {
        const d = new Date(ev.event_date);
        const dateStr = d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short', year: 'numeric' });
        html += `
          <div class="glass-card rounded-xl p-4 cursor-pointer hover:scale-[1.01] transition-transform event-card" data-event-id="${ev.id}">
            <div class="flex justify-between items-start mb-2">
              <h3 class="font-marker text-lg text-white">${ev.title}</h3>
              <span class="text-[10px] font-sans font-bold uppercase px-2 py-0.5 rounded-full text-white" style="background: var(--accent);">Bald</span>
            </div>
            <p class="font-sans text-xs text-white/60 mb-1">📅 ${dateStr}</p>
            <p class="font-sans text-xs text-white/60 mb-1">📍 ${ev.location || '—'}</p>
            <p class="font-sans text-xs text-white/60">👥 ${ev.organizer_1 || '?'} & ${ev.organizer_2 || '?'} · 💰 ${ev.cost_per_person || '?'} CHF</p>
          </div>`;
      });

      // Placeholder future months
      const months = ['Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
      months.forEach(m => {
        html += `
          <div class="rounded-xl p-4 border-2 border-dashed opacity-40" style="border-color: var(--border);">
            <div class="flex justify-between items-center">
              <div>
                <h3 class="font-marker text-lg text-white/50">${m} 2026</h3>
                <p class="font-sans text-xs text-white/30">Organisatoren: TBD</p>
              </div>
              <span class="text-2xl">🕐</span>
            </div>
          </div>`;
      });

      // Past events
      past.forEach(ev => {
        const d = new Date(ev.event_date);
        const dateStr = d.toLocaleDateString('de-CH', { day: 'numeric', month: 'short', year: 'numeric' });
        html += `
          <div class="glass-card rounded-xl p-4 opacity-60">
            <div class="flex justify-between items-start mb-1">
              <h3 class="font-marker text-base text-white/70">${ev.title}</h3>
              <span class="text-[10px] font-sans text-white/40">✓ Abgeschlossen</span>
            </div>
            <p class="font-sans text-xs text-white/40">📅 ${dateStr}</p>
          </div>`;
      });

      if (!html) html = '<div class="glass-card rounded-xl p-5 text-center text-white/40 font-sans text-sm">Noch keine Events erfasst.<br>SQL-Script ausführen!</div>';
      eventsList.innerHTML = html;

      // Attach click listeners to event cards
      document.querySelectorAll('.event-card').forEach(card => {
        card.addEventListener('click', () => {
          const id = card.getAttribute('data-event-id');
          const ev = events?.find(e => e.id === id);
          if (ev) openEventModal(ev);
        });
      });
    }
  }

  function openEventModal(ev) {
    const modal = document.getElementById('event-modal');
    const content = document.getElementById('event-modal-content');
    if (!modal || !content) return;

    const d = ev.event_date ? new Date(ev.event_date).toLocaleDateString('de-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '—';
    const isOrganizer = activeUser && (activeUser.is_admin || activeUser.role === 'admin' ||
      activeUser.name === ev.organizer_1 || activeUser.name === ev.organizer_2);
    const hasTournament = !!ev.tournament_type;

    content.innerHTML = `
      <!-- Header -->
      <div class="p-6 pb-4 relative overflow-hidden" style="background: linear-gradient(135deg, var(--accent2), var(--accent));">
        <div class="absolute -right-6 -top-6 w-28 h-28 rounded-full opacity-20 bg-white"></div>
        <button id="close-event-modal" class="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none">&times;</button>
        <h2 class="font-marker text-3xl text-white mb-1 pr-8">${ev.title}</h2>
        <p class="font-sans text-sm text-white/70">${d}</p>
        ${ev.location_url ? `<a href="${ev.location_url}" target="_blank" class="inline-flex items-center gap-1 mt-2 text-white/80 text-xs font-sans bg-white/20 px-3 py-1 rounded-full">📍 ${ev.location} ↗</a>` : `<p class="font-sans text-xs text-white/60 mt-1">📍 ${ev.location || '—'}</p>`}
      </div>

      <!-- Tabs -->
      <div class="flex border-b" style="background: var(--surface); border-color: rgba(255,255,255,0.1);">
        <button class="event-tab-btn flex-1 py-3 text-xs font-sans font-bold uppercase tracking-wider text-white border-b-2 active-tab" data-tab="info" style="border-color: var(--accent);">Info</button>
        <button class="event-tab-btn flex-1 py-3 text-xs font-sans font-bold uppercase tracking-wider text-white/50 border-b-2 border-transparent" data-tab="batzen">Batzen</button>
        ${hasTournament ? `<button class="event-tab-btn flex-1 py-3 text-xs font-sans font-bold uppercase tracking-wider text-white/50 border-b-2 border-transparent" data-tab="turnier">Turnier</button>` : ''}
        <button class="event-tab-btn flex-1 py-3 text-xs font-sans font-bold uppercase tracking-wider text-white/50 border-b-2 border-transparent" data-tab="media">Medien</button>
      </div>

      <!-- Tab Content -->
      <div id="event-tab-content" class="p-5" style="background: var(--surface);">
        <div class="text-center py-8 text-white/40 font-sans text-sm">Lade...</div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    // Tab switching
    const tabBtns = content.querySelectorAll('.event-tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        tabBtns.forEach(b => {
          b.classList.remove('active-tab', 'text-white');
          b.classList.add('text-white/50');
          b.style.borderColor = 'transparent';
        });
        btn.classList.add('active-tab', 'text-white');
        btn.classList.remove('text-white/50');
        btn.style.borderColor = 'var(--accent)';
        loadEventTab(btn.getAttribute('data-tab'), ev, isOrganizer);
      });
    });

    // Close
    document.getElementById('close-event-modal')?.addEventListener('click', () => {
      modal.classList.add('hidden'); modal.classList.remove('flex');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    });

    // Load default tab
    loadEventTab('info', ev, isOrganizer);
  }

  // ============================================================
  // EVENT TABS
  // ============================================================
  async function loadEventTab(tab, ev, isOrganizer) {
    const container = document.getElementById('event-tab-content');
    if (!container) return;

    if (tab === 'info') await loadInfoTab(container, ev, isOrganizer);
    else if (tab === 'batzen') await loadBatzenTab(container, ev, isOrganizer);
    else if (tab === 'turnier') await loadTurnierTab(container, ev, isOrganizer);
    else if (tab === 'media') await loadMediaTab(container, ev, isOrganizer);
  }

  // --- TAB 1: INFO & RSVP ---
  async function loadInfoTab(container, ev, isOrganizer) {
    const myName = activeUser?.name || '';
    let myRsvp = null;
    let rsvpList = { yes: [], no: [], pending: [] };

    if (ev.id && ev.id !== 'placeholder') {
      const { data: rsvps } = await supabase.from('event_rsvp').select('*').eq('event_id', ev.id);
      (rsvps || []).forEach(r => {
        if (r.user_name === myName) myRsvp = r;
        (rsvpList[r.status] || (rsvpList[r.status] = [])).push(r);
      });
    }

    const deadline = ev.rsvp_deadline ? new Date(ev.rsvp_deadline) : null;
    const isDeadlinePast = deadline && deadline < new Date();
    const deadlineStr = deadline ? deadline.toLocaleDateString('de-CH', { day: 'numeric', month: 'short' }) : '—';

    container.innerHTML = `
      <!-- Info Grid -->
      <div class="grid grid-cols-2 gap-3 mb-5">
        <div class="glass-card rounded-xl p-3">
          <div class="text-[10px] text-white/40 font-sans mb-1 uppercase tracking-wider">Kosten</div>
          <div class="font-marker text-2xl" style="color: var(--accent);">${ev.cost_per_person || '?'} CHF</div>
        </div>
        <div class="glass-card rounded-xl p-3">
          <div class="text-[10px] text-white/40 font-sans mb-1 uppercase tracking-wider">Deadline</div>
          <div class="font-sans text-sm text-white font-bold">${deadlineStr}</div>
          ${isDeadlinePast ? '<div class="text-[10px] text-red-400">Geschlossen</div>' : '<div class="text-[10px] text-green-400">Offen</div>'}
        </div>
        <div class="glass-card rounded-xl p-3 col-span-2">
          <div class="text-[10px] text-white/40 font-sans mb-1 uppercase tracking-wider">Organisatoren</div>
          <div class="font-sans text-sm text-white font-bold">👥 ${ev.organizer_1 || '?'} & ${ev.organizer_2 || '?'}</div>
        </div>
        ${ev.mandatory_rsvp ? `
        <div class="col-span-2 p-3 rounded-xl border-2 border-dashed border-red-500/30 bg-red-500/10 flex items-center gap-3">
          <span class="text-2xl">⚠️</span>
          <div>
            <div class="font-marker text-sm text-red-400">Verpflichtende Anmeldung</div>
            <div class="font-sans text-[10px] text-white/60">Für dieses Event müssen Plätze/Tickets reserviert werden. Bitte gib zeitnah Bescheid!</div>
          </div>
        </div>` : ''}
        ${ev.description ? `<div class="glass-card rounded-xl p-3 col-span-2"><p class="font-sans text-sm text-white/70 leading-relaxed">${ev.description}</p></div>` : ''}
      </div>


      <!-- RSVP Section -->
      <h3 class="font-marker text-lg text-white mb-3">Abstimmung</h3>
      <div class="flex gap-2 mb-3 text-center text-xs font-sans text-white/60">
        <div class="flex-1 glass-card rounded-xl py-2"><div class="font-marker text-xl text-green-400">${(rsvpList.yes||[]).length}</div>Dabei</div>
        <div class="flex-1 glass-card rounded-xl py-2"><div class="font-marker text-xl text-red-400">${(rsvpList.no||[]).length}</div>Nö</div>
        <div class="flex-1 glass-card rounded-xl py-2"><div class="font-marker text-xl text-yellow-400">${(rsvpList.pending||[]).length}</div>Offen</div>
      </div>

      ${!isDeadlinePast && ev.id !== 'placeholder' ? `
      <!-- My RSVP -->
      <div class="glass-card rounded-xl p-4 mb-4">
        <div class="text-xs text-white/50 font-sans mb-3 uppercase tracking-wider">Deine Antwort</div>
        <div class="flex gap-2 mb-3">
          <button id="rsvp-btn-yes" class="flex-1 py-3 rounded-xl font-sans text-sm font-bold text-white transition-all ${myRsvp?.status === 'yes' ? 'ring-2 ring-green-400' : ''}" style="background: rgba(74,222,128,0.2); border: 1px solid rgba(74,222,128,0.3);">👍 Bin dabei</button>
          <button id="rsvp-btn-no" class="flex-1 py-3 rounded-xl font-sans text-sm font-bold text-white transition-all ${myRsvp?.status === 'no' ? 'ring-2 ring-red-400' : ''}" style="background: rgba(248,113,113,0.2); border: 1px solid rgba(248,113,113,0.3);">👎 Nö</button>
        </div>
        <!-- +1 Option -->
        <div class="flex items-center gap-3 mb-2">
          <label class="flex items-center gap-2 font-sans text-sm text-white cursor-pointer">
            <input type="checkbox" id="rsvp-plus-one" class="rounded" ${myRsvp?.plus_one ? 'checked' : ''}> 
            Ich bringe eine +1 mit
          </label>
        </div>
        <div id="plus-one-name-wrap" class="${myRsvp?.plus_one ? '' : 'hidden'}">
          <input type="text" id="rsvp-plus-one-name" placeholder="Name der +1..." value="${myRsvp?.plus_one_name || ''}"
            class="w-full bg-white/5 border border-white/20 rounded-lg p-2 text-white font-sans text-sm outline-none mb-2">
        </div>
        <input type="text" id="rsvp-info" placeholder="Zusatzinfo (z.B. Allergien, Anmerkungen)..." value="${myRsvp?.additional_info || ''}"
          class="w-full bg-white/5 border border-white/20 rounded-lg p-2 text-white font-sans text-sm outline-none">
      </div>
      ` : '<div class="text-center text-white/40 font-sans text-xs py-2 mb-4">Abstimmung geschlossen.</div>'}

      <!-- Who's Coming -->
      ${(rsvpList.yes||[]).length > 0 ? `
      <div class="glass-card rounded-xl p-4 mb-4">
        <div class="text-xs text-white/50 font-sans mb-2 uppercase tracking-wider">Wer ist dabei?</div>
        <div class="flex flex-wrap gap-2">
          ${(rsvpList.yes||[]).map(r => `
            <div class="font-sans text-xs bg-green-500/20 text-green-300 px-3 py-1 rounded-full border border-green-500/30">
              ${r.user_name}${r.plus_one ? ` +1${r.plus_one_name ? ' (' + r.plus_one_name + ')' : ''}` : ''}
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Event Rating (post-event) -->
      <div class="glass-card rounded-xl p-4">
        <div class="text-xs text-white/50 font-sans mb-2 uppercase tracking-wider">Event bewerten (anonym)</div>
        <div class="flex gap-2 justify-center" id="rating-stars">
          ${[1,2,3,4,5].map(i => `<button class="star-btn text-3xl hover:scale-110 transition-transform" data-rating="${i}">⭐</button>`).join('')}
        </div>
        <p id="rating-msg" class="text-center text-xs text-white/40 font-sans mt-2">Dein Rating bleibt anonym</p>
      </div>
    `;

    // RSVP button logic
    if (ev.id && ev.id !== 'placeholder') {
      const plusOneCheckbox = document.getElementById('rsvp-plus-one');
      const plusOneWrap = document.getElementById('plus-one-name-wrap');
      if (plusOneCheckbox) {
        plusOneCheckbox.addEventListener('change', () => {
          plusOneWrap?.classList.toggle('hidden', !plusOneCheckbox.checked);
        });
      }

      const doRsvp = async (status) => {
        const plusOne = document.getElementById('rsvp-plus-one')?.checked || false;
        const plusOneName = document.getElementById('rsvp-plus-one-name')?.value?.trim() || '';
        const info = document.getElementById('rsvp-info')?.value?.trim() || '';
        await supabase.from('event_rsvp').upsert(
          { event_id: ev.id, user_name: activeUser.name, status, plus_one: plusOne, plus_one_name: plusOneName, additional_info: info },
          { onConflict: 'event_id,user_name' }
        );
        loadHomeEvents();
        await loadInfoTab(container, ev, isOrganizer);
      };

      document.getElementById('rsvp-btn-yes')?.addEventListener('click', () => doRsvp('yes'));
      document.getElementById('rsvp-btn-no')?.addEventListener('click', () => doRsvp('no'));
    }

    // Star rating (anonymous)
    if (ev.id && ev.id !== 'placeholder') {
      document.querySelectorAll('.star-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          const rating = parseInt(btn.getAttribute('data-rating'));
          await supabase.from('event_ratings').insert({ event_id: ev.id, rating });
          const msg = document.getElementById('rating-msg');
          if (msg) msg.textContent = `Danke! Du hast ${rating}⭐ gegeben.`;
          document.querySelectorAll('.star-btn').forEach((b, idx) => {
            b.textContent = idx < rating ? '⭐' : '☆';
          });
        });
      });
    }
  }

  // --- TAB 2: BATZENKONTO ---
  async function loadBatzenTab(container, ev, isOrganizer) {
    let entries = [];
    if (ev.id && ev.id !== 'placeholder') {
      const { data } = await supabase.from('batzen_v2').select('*').eq('event_id', ev.id);
      entries = data || [];
    }
    const total = entries.reduce((s, e) => s + (e.amount || 0), 0);
    const myEntries = entries.filter(e => e.user_name === activeUser?.name);

    container.innerHTML = `
      <h3 class="font-marker text-xl text-white mb-1">Batzenkonto 💰</h3>
      <p class="font-sans text-xs text-white/40 mb-4">Alle Kosten und Beiträge für ${ev.title}</p>

      <!-- Summary -->
      <div class="grid grid-cols-2 gap-3 mb-4">
        <div class="glass-card rounded-xl p-3 text-center">
          <div class="text-[10px] text-white/40 font-sans mb-1">Total</div>
          <div class="font-marker text-2xl ${total >= 0 ? 'text-green-400' : 'text-red-400'}">${total > 0 ? '+' : ''}${total.toFixed(0)} CHF</div>
        </div>
        <div class="glass-card rounded-xl p-3 text-center">
          <div class="text-[10px] text-white/40 font-sans mb-1">Einträge</div>
          <div class="font-marker text-2xl text-white">${entries.length}</div>
        </div>
      </div>

      <!-- Add Entry -->
      ${ev.id !== 'placeholder' ? `
      <div class="glass-card rounded-xl p-4 mb-4">
        <div class="text-xs text-white/50 font-sans mb-2 uppercase tracking-wider">Eintrag hinzufügen</div>
        <div class="flex gap-2 mb-2">
          <select id="batzen-sign" class="bg-white/10 text-white font-sans p-2 rounded-lg border border-white/20 outline-none text-lg">
            <option value="1" class="text-black">➕</option>
            <option value="-1" class="text-black">➖</option>
          </select>
          <input type="number" id="batzen-amount" placeholder="Betrag CHF" class="flex-1 bg-white/5 border border-white/20 rounded-lg p-2 text-white font-sans text-sm outline-none">
        </div>
        <input type="text" id="batzen-desc" placeholder="Beschreibung (z.B. Bier, Verpflegung...)" class="w-full bg-white/5 border border-white/20 rounded-lg p-2 text-white font-sans text-sm outline-none mb-2">
        <button id="batzen-add-btn" class="w-full py-2 rounded-xl font-sans text-sm font-bold text-white transition-all" style="background: var(--accent);">Eintragen</button>
      </div>` : ''}

      <!-- Receipt upload (organizers only) -->
      ${isOrganizer ? `
      <div class="glass-card rounded-xl p-4 mb-4" style="border-color: rgba(var(--accent), 0.3);">
        <div class="text-xs font-sans mb-2 uppercase tracking-wider" style="color: var(--accent);">Quittung hochladen (Orga)</div>
        <label class="flex items-center justify-center gap-2 py-3 border-2 border-dashed rounded-xl cursor-pointer hover:bg-white/5 transition" style="border-color: rgba(255,255,255,0.2);">
          <span class="text-2xl">🧾</span>
          <span class="font-sans text-sm text-white/60">Quittungs-Foto auswählen</span>
          <input type="file" id="receipt-upload" accept="image/*" class="hidden">
        </label>
        <p id="receipt-status" class="text-xs text-center text-white/40 font-sans mt-1"></p>
      </div>` : ''}

      <!-- Entries List -->
      <div class="flex flex-col gap-2">
        ${entries.length ? entries.map(e => `
          <div class="glass-card rounded-xl px-4 py-3 flex justify-between items-center">
            <div>
              <div class="font-sans text-sm text-white">${e.description || 'Kein Titel'}</div>
              <div class="font-sans text-xs text-white/40">${e.user_name}</div>
            </div>
            <div class="font-marker text-lg ${e.amount >= 0 ? 'text-green-400' : 'text-red-400'}">${e.amount > 0 ? '+' : ''}${e.amount} CHF</div>
          </div>`).join('') : '<div class="text-center text-white/40 font-sans text-xs py-6">Noch keine Einträge</div>'}
      </div>
    `;

    // Add entry logic
    document.getElementById('batzen-add-btn')?.addEventListener('click', async () => {
      const sign = parseInt(document.getElementById('batzen-sign').value);
      const amount = parseFloat(document.getElementById('batzen-amount').value) * sign;
      const desc = document.getElementById('batzen-desc').value.trim();
      if (isNaN(amount) || !desc) return;
      await supabase.from('batzen_v2').insert({ event_id: ev.id, user_name: activeUser.name, amount, description: desc });
      await loadBatzenTab(container, ev, isOrganizer);
    });

    // Receipt upload
    document.getElementById('receipt-upload')?.addEventListener('change', async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const statusEl = document.getElementById('receipt-status');
      if (statusEl) statusEl.textContent = 'Hochladen...';
      const path = `receipts/${ev.id}-${Date.now()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('assets').upload(path, file);
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path);
      await supabase.from('event_media').insert({ event_id: ev.id, user_name: activeUser.name, type: 'receipt', content_url: publicUrl });
      if (statusEl) statusEl.textContent = '✓ Quittung gespeichert!';
    });
  }

  // --- TAB 3: TURNIER ---
  async function loadTurnierTab(container, ev, isOrganizer) {
    let matches = [];
    if (ev.id && ev.id !== 'placeholder') {
      const { data } = await supabase.from('tournament').select('*').eq('event_id', ev.id).order('round').order('match_number');
      matches = data || [];
    }
    const rounds = [...new Set(matches.map(m => m.round))];

    container.innerHTML = `
      <h3 class="font-marker text-xl text-white mb-1">🏆 Turnier</h3>
      <p class="font-sans text-xs text-white/40 mb-4">${ev.tournament_type || 'Turniermodus'} · ${ev.title}</p>

      ${isOrganizer && matches.length === 0 ? `
      <!-- Setup for organizers -->
      <div class="glass-card rounded-xl p-4 mb-4" style="border: 1px solid rgba(255,255,255,0.15);">
        <div class="text-xs font-sans mb-2 uppercase tracking-wider" style="color: var(--accent);">Turnier aufsetzen (Orga)</div>
        <p class="font-sans text-xs text-white/50 mb-3">Spieler hinzufügen um Matches zu generieren</p>
        <div class="flex gap-2 mb-2">
          <input type="text" id="player-input" placeholder="Spieler Name..." class="flex-1 bg-white/5 border border-white/20 rounded-lg p-2 text-white font-sans text-sm outline-none">
          <button id="add-player-btn" class="px-4 py-2 rounded-xl font-sans text-sm font-bold text-white" style="background: var(--accent);">+</button>
        </div>
        <div id="player-list" class="flex flex-wrap gap-2 mb-3 min-h-[32px]"></div>
        <button id="generate-bracket-btn" class="w-full py-3 rounded-xl font-sans text-sm font-bold text-white" style="background: var(--accent2);">Bracket generieren 🎲</button>
      </div>` : ''}

      ${matches.length > 0 ? rounds.map(round => `
        <div class="mb-4">
          <div class="font-sans text-xs text-white/50 uppercase tracking-wider mb-2">Runde ${round} ${round === Math.max(...rounds) && matches.filter(m => m.round === round).length === 1 ? '🏆 Finale' : ''}</div>
          ${matches.filter(m => m.round === round).map(m => `
            <div class="glass-card rounded-xl p-4 mb-2">
              <div class="flex items-center justify-between">
                <div class="flex-1 text-center">
                  <div class="font-marker text-lg ${m.winner === m.player_1 ? 'text-yellow-400' : 'text-white'}">${m.player_1 || '?'}</div>
                  ${isOrganizer && !m.winner ? `<input type="number" class="score-input w-16 bg-white/10 border border-white/20 rounded text-white text-center text-sm font-sans mt-1 outline-none" data-match="${m.id}" data-player="1" value="${m.score_1 || 0}">` : `<div class="font-marker text-2xl text-white/70">${m.score_1 || 0}</div>`}
                </div>
                <div class="font-marker text-white/30 text-lg px-3">vs</div>
                <div class="flex-1 text-center">
                  <div class="font-marker text-lg ${m.winner === m.player_2 ? 'text-yellow-400' : 'text-white'}">${m.player_2 || '?'}</div>
                  ${isOrganizer && !m.winner ? `<input type="number" class="score-input w-16 bg-white/10 border border-white/20 rounded text-white text-center text-sm font-sans mt-1 outline-none" data-match="${m.id}" data-player="2" value="${m.score_2 || 0}">` : `<div class="font-marker text-2xl text-white/70">${m.score_2 || 0}</div>`}
                </div>
              </div>
              ${isOrganizer && !m.winner ? `<button class="save-score-btn w-full mt-3 py-2 rounded-lg font-sans text-xs font-bold text-white" style="background: var(--accent);" data-match="${m.id}" data-p1="${m.player_1}" data-p2="${m.player_2}">Ergebnis speichern</button>` : m.winner ? `<div class="text-center text-xs text-yellow-400 font-sans mt-2 font-bold">🏆 ${m.winner} gewinnt</div>` : ''}
            </div>`).join('')}
        </div>`).join('') : matches.length === 0 && !isOrganizer ? '<div class="text-center text-white/40 font-sans text-sm py-10">Das Turnier wurde noch nicht aufgesetzt.</div>' : ''}
    `;

    // Player management for bracket setup
    let players = [];
    const playerListEl = document.getElementById('player-list');

    document.getElementById('add-player-btn')?.addEventListener('click', () => {
      const input = document.getElementById('player-input');
      const name = input?.value.trim();
      if (name && !players.includes(name)) {
        players.push(name);
        if (playerListEl) playerListEl.innerHTML = players.map(p => `<span class="bg-white/10 text-white text-xs font-sans px-3 py-1 rounded-full">${p}</span>`).join('');
      }
      if (input) input.value = '';
    });

    document.getElementById('generate-bracket-btn')?.addEventListener('click', async () => {
      if (players.length < 2) return;
      const shuffled = players.sort(() => Math.random() - 0.5);
      const matchesToInsert = [];
      for (let i = 0; i < shuffled.length - 1; i += 2) {
        matchesToInsert.push({ event_id: ev.id, round: 1, match_number: Math.floor(i/2) + 1, player_1: shuffled[i], player_2: shuffled[i+1] || 'BYE' });
      }
      await supabase.from('tournament').insert(matchesToInsert);
      await loadTurnierTab(container, ev, isOrganizer);
    });

    // Save scores
    document.querySelectorAll('.save-score-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const matchId = btn.getAttribute('data-match');
        const p1 = btn.getAttribute('data-p1');
        const p2 = btn.getAttribute('data-p2');
        const s1 = parseInt(document.querySelector(`.score-input[data-match="${matchId}"][data-player="1"]`)?.value) || 0;
        const s2 = parseInt(document.querySelector(`.score-input[data-match="${matchId}"][data-player="2"]`)?.value) || 0;
        const winner = s1 > s2 ? p1 : p2;
        await supabase.from('tournament').update({ score_1: s1, score_2: s2, winner }).eq('id', matchId);
        await loadTurnierTab(container, ev, isOrganizer);
      });
    });
  }

  // --- TAB 4: MEDIEN (Sticker, Quote, Fotos) ---
  async function loadMediaTab(container, ev, isOrganizer) {
    let media = [];
    if (ev.id && ev.id !== 'placeholder') {
      const { data } = await supabase.from('event_media').select('*').eq('event_id', ev.id).order('created_at', { ascending: false });
      media = data || [];
    }
    const stickers = media.filter(m => m.type === 'sticker');
    const quotes = media.filter(m => m.type === 'quote');
    const photos = media.filter(m => m.type === 'photo');
    const receipts = media.filter(m => m.type === 'receipt');

    container.innerHTML = `
      <h3 class="font-marker text-xl text-white mb-1">Medien & Memories</h3>
      <p class="font-sans text-xs text-white/40 mb-4">${ev.title}</p>

      <!-- Upload Area -->
      ${ev.id !== 'placeholder' ? `
      <div class="grid grid-cols-2 gap-2 mb-5">
        <!-- Sticker Upload -->
        <label class="glass-card rounded-xl p-3 flex flex-col items-center gap-1 cursor-pointer hover:bg-white/10 transition text-center">
          <span class="text-2xl">🎨</span>
          <span class="font-sans text-xs text-white/60">Sticker hochladen</span>
          <input type="file" id="sticker-upload-evt" accept="image/*" class="hidden">
        </label>
        <!-- Photo Upload -->
        <label class="glass-card rounded-xl p-3 flex flex-col items-center gap-1 cursor-pointer hover:bg-white/10 transition text-center">
          <span class="text-2xl">📸</span>
          <span class="font-sans text-xs text-white/60">Foto hochladen</span>
          <input type="file" id="photo-upload-evt" accept="image/*" class="hidden">
        </label>
      </div>

      <!-- Quote of the Day -->
      <div class="glass-card rounded-xl p-4 mb-4">
        <div class="text-xs text-white/50 font-sans mb-2 uppercase tracking-wider">Quote of the Day</div>
        <textarea id="quote-input" rows="2" placeholder='"Das war der beste Abend meines Lebens."' class="w-full bg-white/5 border border-white/20 rounded-lg p-2 text-white font-sans text-sm outline-none resize-none mb-2"></textarea>
        <button id="quote-submit-btn" class="w-full py-2 rounded-xl font-sans text-xs font-bold text-white" style="background: var(--accent);">Quote speichern</button>
      </div>` : ''}

      <!-- Sticker of the Day -->
      ${stickers.length > 0 ? `
      <div class="mb-4">
        <div class="text-xs text-white/50 font-sans mb-2 uppercase tracking-wider">🎨 Sticker of the Day</div>
        <div class="grid grid-cols-2 gap-2">
          ${stickers.map(s => `<div class="glass-card rounded-xl overflow-hidden aspect-square"><img src="${s.content_url}" class="w-full h-full object-cover"></div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Quotes -->
      ${quotes.length > 0 ? `
      <div class="mb-4">
        <div class="text-xs text-white/50 font-sans mb-2 uppercase tracking-wider">💬 Quotes</div>
        <div class="flex flex-col gap-2">
          ${quotes.map(q => `<div class="glass-card rounded-xl p-4"><p class="font-hand text-xl text-white">"${q.text_content}"</p><p class="font-sans text-xs text-white/40 mt-1">— ${q.user_name}</p></div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Photos -->
      ${photos.length > 0 ? `
      <div class="mb-4">
        <div class="text-xs text-white/50 font-sans mb-2 uppercase tracking-wider">📸 Fotos</div>
        <div class="grid grid-cols-3 gap-1">
          ${photos.map(p => `<div class="glass-card rounded-lg overflow-hidden aspect-square"><img src="${p.content_url}" class="w-full h-full object-cover"></div>`).join('')}
        </div>
      </div>` : ''}

      ${media.length === 0 && ev.id === 'placeholder' ? '<div class="text-center text-white/40 font-sans text-sm py-10">Noch keine Medien für dieses Event.</div>' : ''}
    `;

    // Media upload handlers
    const uploadMedia = async (file, type) => {
      if (!file || !ev.id || ev.id === 'placeholder') return;
      const path = `${type}s/${ev.id}-${Date.now()}.${file.name.split('.').pop()}`;
      await supabase.storage.from('assets').upload(path, file);
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path);
      await supabase.from('event_media').insert({ event_id: ev.id, user_name: activeUser?.name, type, content_url: publicUrl });
      await loadMediaTab(container, ev, isOrganizer);
    };

    document.getElementById('sticker-upload-evt')?.addEventListener('change', e => uploadMedia(e.target.files[0], 'sticker'));
    document.getElementById('photo-upload-evt')?.addEventListener('change', e => uploadMedia(e.target.files[0], 'photo'));

    document.getElementById('quote-submit-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('quote-input')?.value.trim();
      if (!text) return;
      await supabase.from('event_media').insert({ event_id: ev.id, user_name: activeUser?.name, type: 'quote', text_content: text });
      await loadMediaTab(container, ev, isOrganizer);
    });
  }

  // ============================================================
  // 4. PROFILE: AVATAR UPLOAD & STORAGE
  // ============================================================
  const avatarInput = document.getElementById('avatar-upload');
  const profileAvatar = document.getElementById('profile-avatar');

  if (avatarInput) {
    avatarInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !activeUser) return;

      // Show loading state locally
      if (profileAvatar) profileAvatar.style.opacity = '0.5';

      const fileExt = file.name.split('.').pop();
      const fileName = `avatars/${activeUser.name}-${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage.from('assets').upload(fileName, file);

      if (error) {
        console.error('Upload error:', error);
        if (profileAvatar) profileAvatar.style.opacity = '1';
        return;
      }

      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(fileName);

      // Update users table
      const { error: updateError } = await supabase.from('users').update({ avatar_url: publicUrl }).eq('name', activeUser.name);

      if (!updateError) {
        activeUser.avatar_url = publicUrl;
        if (profileAvatar) {
          profileAvatar.style.backgroundImage = `url('${publicUrl}')`;
          profileAvatar.style.opacity = '1';
        }
      }
    });
  }

  // ============================================================
  // 6. IDEAS DROPBOX (Phase 5) — Anonymous
  // ============================================================
  const ideaModal = document.getElementById('idea-modal');
  const btnIdeasTrigger = document.getElementById('btn-ideas-trigger');
  const btnIdeaCancel = document.getElementById('btn-idea-cancel');
  const btnSubmitIdea = document.getElementById('btn-submit-idea');
  const ideaInput = document.getElementById('idea-input');
  const ideaStatus = document.getElementById('idea-status');

  if (btnIdeasTrigger && ideaModal) {
    btnIdeasTrigger.addEventListener('click', () => {
      ideaModal.classList.remove('hidden');
      ideaModal.classList.add('flex');
    });
  }

  if (btnIdeaCancel && ideaModal) {
    btnIdeaCancel.addEventListener('click', () => {
      ideaModal.classList.add('hidden');
      ideaModal.classList.remove('flex');
    });
  }

  let selectedPinWords = [];

  function setupPinListeners(containerId, callback) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.querySelectorAll('.secret-btn, .signup-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.getAttribute('data-val');
        
        // Toggle logic
        if (btn.classList.contains('word-selected')) {
          btn.classList.remove('word-selected');
          selectedPinWords = selectedPinWords.filter(w => w !== val);
        } else {
          if (selectedPinWords.length >= 3) {
             btn.classList.add('shake');
             setTimeout(() => btn.classList.remove('shake'), 400);
             return;
          }
          btn.classList.add('word-selected');
          selectedPinWords.push(val);
        }
        
        if (selectedPinWords.length === 3) {
          callback(selectedPinWords.join(' '));
        }
      });
    });
  }

  // --- Login PIN ---
  setupPinListeners('secret-selector', async (code) => {
    if (!selectedLoginName) return;
    const errorEl = document.getElementById('pin-error');
    
    const { data, error } = await supabase.from('users')
      .select('*')
      .eq('name', selectedLoginName)
      .eq('login_secret', code)
      .eq('is_approved', true)
      .single();

    if (data && !error) {
      activeUser = data;
      localStorage.setItem('zaeme_user', selectedLoginName);
      checkAuth();
      // Reset
      selectedPinWords = [];
      document.querySelectorAll('.word-selected').forEach(b => b.classList.remove('word-selected'));
    } else {
      if (errorEl) {
        errorEl.style.opacity = '1';
        setTimeout(() => { errorEl.style.opacity = '0'; }, 3000);
      }
      // Reset selection
      selectedPinWords = [];
      document.querySelectorAll('.word-selected').forEach(b => b.classList.remove('word-selected'));
    }
  });

  // --- Signup PIN ---
  const btnSubmitSignup = document.getElementById('btn-submit-signup');
  let signupSecret = '';

  setupPinListeners('signup-secret-selector', (code) => {
    signupSecret = code;
  });

  if (btnSubmitSignup) {
    btnSubmitSignup.addEventListener('click', async () => {
      const name = document.getElementById('signup-name').value.trim();
      const msg = document.getElementById('signup-msg');
      if (!name || selectedPinWords.length < 3) {
        if (msg) msg.textContent = 'Name und 3 Wörter wählen!';
        return;
      }
      const { error } = await supabase.from('users').insert({ name, login_secret: signupSecret, is_approved: false });
      if (!error) {
        if (msg) {
          msg.style.color = '#4ade80';
          msg.textContent = 'Antrag gesendet! Warte auf Admin.';
        }
        setTimeout(() => location.reload(), 2000);
      } else {
        if (msg) msg.textContent = 'Fehler: ' + error.message;
      }
    });
  }

  if (btnSubmitIdea && ideaInput) {
    btnSubmitIdea.addEventListener('click', async () => {
      const text = ideaInput.value.trim();
      if (!text) return;

      btnSubmitIdea.disabled = true;
      btnSubmitIdea.textContent = '...';

      const { error } = await supabase.from('ideas').insert({ text });

      btnSubmitIdea.disabled = false;
      btnSubmitIdea.textContent = 'Abschicken';

      if (!error) {
        ideaInput.value = '';
        if (ideaStatus) ideaStatus.textContent = '✓ Danke! Dein Vorschlag wurde anonym gespeichert.';
        setTimeout(() => { if (ideaStatus) { ideaStatus.textContent = ''; ideaModal.classList.add('hidden'); ideaModal.classList.remove('flex'); } }, 2000);
      } else {
        if (ideaStatus) ideaStatus.textContent = '❌ Fehler beim Speichern.';
      }
    });
  }

  // ============================================================
  // 7. EVENT EDITOR (Phase 4) — Organizers & Admins
  // ============================================================
  const editorModal = document.getElementById('editor-modal');
  const btnOpenEditor = document.getElementById('btn-open-event-editor');
  const btnEditorCancel = document.getElementById('btn-editor-cancel');
  const btnEditorSave = document.getElementById('btn-editor-save');

  if (btnOpenEditor && editorModal) {
    btnOpenEditor.addEventListener('click', () => {
      editorModal.classList.remove('hidden');
      editorModal.classList.add('flex');
      // Reset form
      ['edit-title', 'edit-date', 'edit-cost', 'edit-location', 'edit-location-url', 'edit-orga1', 'edit-orga2', 'edit-desc'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      const mand = document.getElementById('edit-mandatory');
      if (mand) mand.checked = false;
    });
  }

  if (btnEditorCancel && editorModal) {
    btnEditorCancel.addEventListener('click', () => {
      editorModal.classList.add('hidden');
      editorModal.classList.remove('flex');
    });
  }

  if (btnEditorSave && editorModal) {
    btnEditorSave.addEventListener('click', async () => {
      const title = document.getElementById('edit-title')?.value.trim();
      const date = document.getElementById('edit-date')?.value;
      const cost = parseFloat(document.getElementById('edit-cost')?.value) || 0;
      const loc = document.getElementById('edit-location')?.value.trim();
      const locUrl = document.getElementById('edit-location-url')?.value.trim();
      const orga1 = document.getElementById('edit-orga1')?.value.trim();
      const orga2 = document.getElementById('edit-orga2')?.value.trim();
      const desc = document.getElementById('edit-desc')?.value.trim();
      const mandatory = document.getElementById('edit-mandatory')?.checked || false;

      if (!title || !date) { alert('Bitte Titel und Datum angeben!'); return; }

      btnEditorSave.disabled = true;
      btnEditorSave.textContent = 'Speichere...';

      const { error } = await supabase.from('events').insert({
        title, 
        event_date: date, 
        cost_per_person: cost, 
        location: loc, 
        location_url: locUrl,
        organizer_1: orga1,
        organizer_2: orga2,
        description: desc,
        mandatory_rsvp: mandatory,
        is_published: true
      });

      btnEditorSave.disabled = false;
      btnEditorSave.textContent = 'Veröffentlichen';

      if (!error) {
        editorModal.classList.add('hidden');
        editorModal.classList.remove('flex');
        loadHomeEvents();
      } else {
        alert('Fehler: ' + error.message);
      }
    });
  }

  // ============================================================
  // 8. SMOKER/PING LOGIC (Buzzer)
  // ============================================================
  const smokerBtn = document.getElementById('smoker-btn');
  if (smokerBtn) {
    smokerBtn.addEventListener('click', async () => {
      if (!activeUser) return;
      
      smokerBtn.disabled = true;
      smokerBtn.classList.add('active');
      
      const pingMsg = `${activeUser.name} hat den PING gedrückt! 📡`;
      
      // Send a ping? Currently we just show a local alert as POC
      showCustomAlert(pingMsg);

      setTimeout(() => {
        smokerBtn.disabled = false;
        smokerBtn.classList.remove('active');
      }, 5000);
    });
  }

  function showCustomAlert(msg) {
    const alertBox = document.getElementById('custom-alert');
    const msgEl = document.getElementById('custom-alert-msg');
    if (!alertBox || !msgEl) return;
    
    msgEl.textContent = msg;
    alertBox.classList.add('active');
    
    document.getElementById('alert-ignore')?.addEventListener('click', () => alertBox.classList.remove('active'));
    document.getElementById('alert-join')?.addEventListener('click', () => alertBox.classList.remove('active'));
  }

  // ============================================================
  // 9. HALL OF FAME & INITIAL BOOT
  // ============================================================
  async function loadHallOfFame() {
    const hofContainer = document.getElementById('hall-of-fame');
    if (!hofContainer) return;
    const { data: highlights } = await supabase.from('event_media').select('*').limit(3).order('created_at', { ascending: false });
    if (!highlights || highlights.length === 0) return;
    
    // Simple curation UI
    hofContainer.innerHTML = highlights.map(m => `
      <div class="glass-card rounded-xl overflow-hidden mb-2 relative">
        <img src="${m.content_url}" class="w-full h-40 object-cover opacity-80">
        <div class="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black to-transparent">
          <p class="font-marker text-white text-sm">Best of moment</p>
          <p class="font-sans text-[10px] text-white/60">Gepostet von ${m.user_name}</p>
        </div>
      </div>
    `).join('');
  }

  loadHallOfFame();
  checkAuth();

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      document.querySelectorAll('.view-panel').forEach(p => p.classList.remove('active'));
      document.getElementById(target)?.classList.add('active');
      document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  document.querySelectorAll('.theme-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme');
      document.body.className = `theme-${theme}`;
      document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

});



