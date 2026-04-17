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
    if (!usr || !usr.is_admin) {
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

    // RSVP counts
    if (nextEvent.id !== 'placeholder') {
      const { data: rsvps } = await supabase.from('event_rsvp').select('status').eq('event_id', nextEvent.id);
      const yes = rsvps?.filter(r => r.status === 'yes').length || 0;
      const no = rsvps?.filter(r => r.status === 'no').length || 0;
      const pending = rsvps?.filter(r => r.status === 'pending').length || 0;
      const yesEl = document.getElementById('rsvp-yes');
      const noEl = document.getElementById('rsvp-no');
      const pendEl = document.getElementById('rsvp-pending');
      if (yesEl) yesEl.textContent = yes;
      if (noEl) noEl.textContent = no;
      if (pendEl) pendEl.textContent = pending;
    }

    // RSVP Buttons
    const btnYes = document.getElementById('btn-my-rsvp-yes');
    const btnNo = document.getElementById('btn-my-rsvp-no');
    if (btnYes && btnNo && nextEvent.id !== 'placeholder' && activeUser) {
      const doRsvp = async (status) => {
        await supabase.from('event_rsvp').upsert(
          { event_id: nextEvent.id, user_name: activeUser.name, status },
          { onConflict: 'event_id,user_name' }
        );
        loadHomeEvents();
      };
      btnYes.onclick = () => doRsvp('yes');
      btnNo.onclick = () => doRsvp('no');
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

    content.innerHTML = `
      <div class="p-6 pb-4 relative" style="background: linear-gradient(135deg, var(--accent2), var(--accent));">
        <button id="close-event-modal" class="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none">&times;</button>
        <h2 class="font-marker text-3xl text-white mb-1">${ev.title}</h2>
        <p class="font-sans text-sm text-white/70">${d}</p>
      </div>
      <div class="p-6" style="background: var(--surface);">
        <div class="grid grid-cols-2 gap-3 mb-4">
          <div class="glass-card rounded-xl p-3">
            <div class="text-xs text-white/50 font-sans mb-1">Ort</div>
            <div class="font-sans text-sm text-white font-bold">${ev.location || '—'}</div>
          </div>
          <div class="glass-card rounded-xl p-3">
            <div class="text-xs text-white/50 font-sans mb-1">Kosten</div>
            <div class="font-marker text-xl" style="color: var(--accent);">${ev.cost_per_person || '—'} CHF</div>
          </div>
          <div class="glass-card rounded-xl p-3 col-span-2">
            <div class="text-xs text-white/50 font-sans mb-1">Organisatoren</div>
            <div class="font-sans text-sm text-white font-bold">${ev.organizer_1 || '?'} & ${ev.organizer_2 || '?'}</div>
          </div>
        </div>
        ${ev.description ? `<p class="font-sans text-sm text-white/70 mb-4 leading-relaxed">${ev.description}</p>` : ''}
        <div class="flex gap-3">
          <button id="modal-rsvp-yes" class="flex-1 py-3 rounded-xl font-sans font-bold text-white" style="background: rgba(74,222,128,0.2); border: 1px solid rgba(74,222,128,0.4);">👍 Ich bin dabei</button>
          <button id="modal-rsvp-no" class="flex-1 py-3 rounded-xl font-sans font-bold text-white" style="background: rgba(248,113,113,0.2); border: 1px solid rgba(248,113,113,0.4);">👎 Nö</button>
        </div>
      </div>
    `;

    modal.classList.remove('hidden');
    modal.classList.add('flex');

    document.getElementById('close-event-modal')?.addEventListener('click', () => {
      modal.classList.add('hidden'); modal.classList.remove('flex');
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) { modal.classList.add('hidden'); modal.classList.remove('flex'); }
    });

    if (activeUser && ev.id && ev.id !== 'placeholder') {
      const doRsvp = async (status) => {
        await supabase.from('event_rsvp').upsert(
          { event_id: ev.id, user_name: activeUser.name, status },
          { onConflict: 'event_id,user_name' }
        );
        modal.classList.add('hidden'); modal.classList.remove('flex');
        loadHomeEvents();
      };
      document.getElementById('modal-rsvp-yes')?.addEventListener('click', () => doRsvp('yes'));
      document.getElementById('modal-rsvp-no')?.addEventListener('click', () => doRsvp('no'));
    }
  }

  // ============================================================
  // 4. INITIAL BOOT
  // ============================================================
  checkAuth();

  // ============================================================
  // 5. LOGIN SCREEN: TABS
  // ============================================================
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const secLogin = document.getElementById('section-login');
  const secSignup = document.getElementById('section-signup');

  if (tabLogin && tabSignup) {
    tabLogin.addEventListener('click', () => {
      secLogin.classList.remove('hidden'); secLogin.classList.add('block');
      secSignup.classList.add('hidden'); secSignup.classList.remove('block');
      tabLogin.classList.add('text-white', 'border-orange-500', 'font-bold');
      tabLogin.classList.remove('text-white/50', 'border-transparent');
      tabSignup.classList.remove('text-white', 'border-orange-500', 'font-bold');
      tabSignup.classList.add('text-white/50', 'border-transparent');
    });
    tabSignup.addEventListener('click', () => {
      secSignup.classList.remove('hidden'); secSignup.classList.add('block');
      secLogin.classList.add('hidden'); secLogin.classList.remove('block');
      tabSignup.classList.add('text-white', 'border-orange-500', 'font-bold');
      tabSignup.classList.remove('text-white/50', 'border-transparent');
      tabLogin.classList.remove('text-white', 'border-orange-500', 'font-bold');
      tabLogin.classList.add('text-white/50', 'border-transparent');
    });
  }

  // ============================================================
  // 6. SIGNUP LOGIC
  // ============================================================
  const signupBtns = document.querySelectorAll('.signup-btn');
  const signupNameInput = document.getElementById('signup-name');
  const btnSubmitSignup = document.getElementById('btn-submit-signup');
  const signupMsg = document.getElementById('signup-msg');

  signupBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const colId = e.target.closest('.signup-col').getAttribute('data-col');
      document.querySelectorAll(`.signup-col[data-col="${colId}"] .signup-btn`).forEach(b => delete b.dataset.active);
      e.target.dataset.active = "true";
      signupSecret[colId] = e.target.getAttribute('data-val');
    });
  });

  if (btnSubmitSignup) {
    btnSubmitSignup.addEventListener('click', async () => {
      const name = signupNameInput.value.trim();
      if (!name) { signupMsg.textContent = "Bitte Name eingeben!"; return; }
      if (!signupSecret[1] || !signupSecret[2] || !signupSecret[3]) { signupMsg.textContent = "Bitte alle 3 Wörter wählen!"; return; }

      btnSubmitSignup.textContent = "...";
      const isAdmin = (name.toLowerCase() === 'kaio' || name.toLowerCase() === 'ben');

      const { error } = await supabase.from('users').insert({
        name: name,
        code_1: signupSecret[1],
        code_2: signupSecret[2],
        code_3: signupSecret[3],
        is_admin: isAdmin,
        is_approved: isAdmin
      });

      if (error) {
        signupMsg.className = "text-xs text-center mt-3 text-red-400";
        signupMsg.textContent = "Name existiert schon! Versuche dich einzuloggen.";
        btnSubmitSignup.textContent = "Beantragen";
      } else {
        signupMsg.className = "text-xs text-center mt-3 text-green-400 font-bold";
        if (isAdmin) {
          signupMsg.textContent = "Boss-Status erkannt! Geh jetzt zum Login-Tab.";
          loadLoginNames();
        } else {
          signupMsg.textContent = "Antrag gesendet! Warte auf Freigabe von Kaio oder Ben.";
        }
        btnSubmitSignup.classList.add('hidden');
      }
    });
  }

  // ============================================================
  // 7. LOGIN: PIN MODAL
  // ============================================================
  const pinModal = document.getElementById('pin-modal');
  const cancelLogin = document.getElementById('cancel-login');
  const secretBtns = document.querySelectorAll('.secret-btn');
  const pinError = document.getElementById('pin-error');

  if (cancelLogin) {
    cancelLogin.addEventListener('click', () => {
      pinModal.classList.add('opacity-0');
      setTimeout(() => {
        pinModal.classList.add('hidden');
        resetSecret(secretBtns, loginSecret);
        if (pinError) pinError.classList.add('opacity-0');
        selectedLoginName = '';
      }, 300);
    });
  }

  secretBtns.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const colId = e.target.closest('.secret-col').getAttribute('data-col');
      const val = e.target.getAttribute('data-val');
      document.querySelectorAll(`.secret-col[data-col="${colId}"] .secret-btn`).forEach(b => delete b.dataset.active);
      e.target.dataset.active = "true";
      loginSecret[colId] = val;
      if (pinError) pinError.classList.add('opacity-0');

      if (loginSecret[1] && loginSecret[2] && loginSecret[3]) {
        const { data: userMatch } = await supabase.from('users').select('*')
          .eq('name', selectedLoginName)
          .eq('code_1', loginSecret[1])
          .eq('code_2', loginSecret[2])
          .eq('code_3', loginSecret[3])
          .single();

        if (userMatch && userMatch.is_approved) {
          localStorage.setItem('profile-name', selectedLoginName);
          resetSecret(secretBtns, loginSecret);
          pinModal.classList.add('hidden', 'opacity-0');
          checkAuth();
        } else {
          if (pinError) {
            pinError.textContent = userMatch ? "Noch nicht freigeschaltet!" : "Falscher Code!";
            pinError.classList.remove('opacity-0');
          }
          setTimeout(() => resetSecret(secretBtns, loginSecret), 1000);
        }
      }
    });
  });

  // ============================================================
  // 8. LOGOUT
  // ============================================================
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('profile-name');
      activeUser = null;
      checkAuth();
    });
  }

  // ============================================================
  // 9. PROFILE: AVATAR UPLOAD
  // ============================================================
  const profileAvatar = document.getElementById('profile-avatar');
  const avatarUpload = document.getElementById('avatar-upload');

  if (avatarUpload && profileAvatar) {
    avatarUpload.addEventListener('change', async (e) => {
      if (!activeUser) return;
      const file = e.target.files[0];
      if (!file) return;
      profileAvatar.innerHTML = '<div class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white bg-black/60">Upload...</div>';
      const fileExt = file.name.split('.').pop();
      const filePath = `avatars/${activeUser.name}-${Date.now()}.${fileExt}`;
      await supabase.storage.from('assets').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(filePath);
      await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', activeUser.id);
      profileAvatar.innerHTML = '';
      profileAvatar.style.backgroundImage = `url('${publicUrl}')`;
    });
  }

  // ============================================================
  // 10. PROFILE: LANGUAGE
  // ============================================================
  const profileLangSelect = document.getElementById('profile-lang');
  if (profileLangSelect) {
    profileLangSelect.addEventListener('change', async (e) => {
      if (!activeUser) return;
      await supabase.from('users').update({ ping_lang: e.target.value }).eq('id', activeUser.id);
    });
  }

  // ============================================================
  // 11. AUDIO RECORDER
  // ============================================================
  const recordSoundBtn = document.getElementById('record-sound-btn');
  const recordStatus = document.getElementById('record-status');
  const recordStatusCont = document.getElementById('record-status-container');
  const recordProgress = document.getElementById('record-progress');
  const playSoundBtn = document.getElementById('play-sound-btn');

  if (recordSoundBtn) {
    recordSoundBtn.addEventListener('click', async () => {
      if (!activeUser) return;
      if (isRecording) { mediaRecorder.stop(); return; }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];

        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstart = () => {
          isRecording = true;
          recordSoundBtn.innerHTML = '<span>⏹</span> Stoppen';
          recordSoundBtn.classList.replace('bg-red-500/10', 'bg-red-500');
          recordSoundBtn.classList.replace('text-red-200', 'text-white');
          recordStatusCont.classList.remove('hidden');
          recordStatusCont.classList.add('flex');
          recordStatus.textContent = 'Läuft (max 5 Sek)...';
          let w = 0;
          const intv = setInterval(() => { w += 2; if (w > 100) clearInterval(intv); recordProgress.style.width = w + '%'; }, 100);
          setTimeout(() => { if (isRecording) mediaRecorder.stop(); clearInterval(intv); }, 5000);
        };

        mediaRecorder.onstop = async () => {
          isRecording = false;
          recordSoundBtn.innerHTML = '<span>🔴</span> Signature aufnehmen';
          recordSoundBtn.classList.replace('bg-red-500', 'bg-red-500/10');
          recordSoundBtn.classList.replace('text-white', 'text-red-200');
          stream.getTracks().forEach(track => track.stop());
          recordStatus.textContent = 'Hochladen...';
          recordProgress.style.width = '100%';
          const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
          const filePath = `audios/${activeUser.name}-${Date.now()}.webm`;
          const { error } = await supabase.storage.from('assets').upload(filePath, audioBlob);
          if (!error) {
            const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(filePath);
            await supabase.from('users').update({ audio_url: publicUrl }).eq('id', activeUser.id);
            activeUser.audio_url = publicUrl;
            recordStatus.textContent = 'Gespeichert! ✓';
          } else {
            recordStatus.textContent = 'Fehler beim Upload!';
          }
          setTimeout(() => {
            recordStatusCont.classList.add('hidden'); recordStatusCont.classList.remove('flex');
            recordProgress.style.width = '0%';
          }, 2000);
        };

        mediaRecorder.start();
      } catch (err) {
        alert("Mikrofon-Zugriff nicht möglich.");
      }
    });
  }

  if (playSoundBtn) {
    playSoundBtn.addEventListener('click', () => {
      if (activeUser && activeUser.audio_url) {
        new Audio(activeUser.audio_url).play();
      } else {
        alert('Noch keinen Sound aufgenommen!');
      }
    });
  }

  // ============================================================
  // 12. SPA NAVIGATION
  // ============================================================
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');
      viewPanels.forEach(panel => panel.classList.remove('active'));
      const targetPanel = document.getElementById(item.getAttribute('data-target'));
      if (targetPanel) {
        targetPanel.classList.add('active');
        document.getElementById('app-container').scrollTop = 0;
      }
    });
  });

  // ============================================================
  // 13. STICKER UPLOAD
  // ============================================================
  const stickerUpload = document.getElementById('sticker-upload');
  const stickerPreview = document.getElementById('sticker-preview');
  if (stickerUpload && stickerPreview) {
    stickerUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          stickerPreview.innerHTML = `<img src="${event.target.result}" alt="Sticker" class="w-full h-full object-cover">`;
          stickerPreview.classList.remove('border-dashed', 'border-gray-400');
          stickerPreview.classList.add('border-white', 'border-4');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // ============================================================
  // 14. THEME SELECTOR
  // ============================================================
  const themeBtns = document.querySelectorAll('.theme-btn');
  const body = document.body;
  const savedTheme = localStorage.getItem('app-theme') || 'cardboard';
  applyTheme(savedTheme);

  themeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const theme = btn.getAttribute('data-theme');
      applyTheme(theme);
      localStorage.setItem('app-theme', theme);
    });
  });

  function applyTheme(themeName) {
    body.classList.remove('theme-cardboard', 'theme-notebook', 'theme-grunge', 'theme-piggy');
    body.classList.add(`theme-${themeName}`);
    themeBtns.forEach(b => b.getAttribute('data-theme') === themeName ? b.classList.add('active') : b.classList.remove('active'));
  }

  // ============================================================
  // 15. PING CHIPS
  // ============================================================
  const chipGroups = ['ping-location', 'ping-action', 'ping-time'];
  chipGroups.forEach(groupId => {
    const group = document.getElementById(groupId);
    if (group) {
      const chips = group.querySelectorAll('.ping-chip');
      chips.forEach(chip => {
        chip.addEventListener('click', () => {
          chips.forEach(c => c.classList.remove('active'));
          chip.classList.add('active');
        });
      });
    }
  });

  // ============================================================
  // 16. NOTIFICATIONS
  // ============================================================
  const customAlert = document.getElementById('custom-alert');
  const alertMsg = document.getElementById('custom-alert-msg');
  const alertIgnore = document.getElementById('alert-ignore');
  const alertJoin = document.getElementById('alert-join');

  function showNotification(msg) {
    if (alertMsg) alertMsg.textContent = msg;
    if (customAlert) customAlert.classList.add('show');
    setTimeout(() => hideNotification(), 15000);
  }

  function hideNotification() {
    if (customAlert) customAlert.classList.remove('show');
  }

  if (alertIgnore) alertIgnore.addEventListener('click', hideNotification);
  if (alertJoin) {
    alertJoin.addEventListener('click', () => {
      hideNotification();
      setTimeout(() => alert('Cool, Nachricht gesendet: "Ich komm auch!"'), 300);
    });
  }

  const alertRadar = document.getElementById('alert-radar');
  const radarModal = document.getElementById('radar-modal');
  const closeRadar = document.getElementById('close-radar');
  if (alertRadar) alertRadar.addEventListener('click', () => { hideNotification(); if (radarModal) { radarModal.classList.remove('hidden'); radarModal.classList.add('flex'); } });
  if (closeRadar) closeRadar.addEventListener('click', () => { if (radarModal) { radarModal.classList.add('hidden'); radarModal.classList.remove('flex'); } });

  // ============================================================
  // 17. PING BUTTON (LIVE)
  // ============================================================
  const smokerBtn = document.getElementById('smoker-btn');
  if (smokerBtn) {
    smokerBtn.addEventListener('click', async () => {
      smokerBtn.style.transform = 'translateY(15px)';
      const loc = document.querySelector('#ping-location .ping-chip.active')?.getAttribute('data-val') || 'Irgendwo';
      const action = document.querySelector('#ping-action .ping-chip.active')?.getAttribute('data-val') || 'teeere';
      const timeVal = document.querySelector('#ping-time .ping-chip.active')?.getAttribute('data-val') || '5';
      const lang = activeUser?.ping_lang || localStorage.getItem('profile-lang') || 'de';
      const userName = localStorage.getItem('profile-name') || 'Anon';
      const timeMap = {
        '5': { es: 'cinco minutos', pt: 'cinco minutos', it: 'cinque minuti', no: 'fem minutter', de: 'foif minute' },
        '15': { es: 'quince minutos', pt: 'quinze minutos', it: 'quindici minuti', no: 'femten minutter', de: 'vierzgi minute' },
        '30': { es: 'treinta minutos', pt: 'trinta minutos', it: 'trenta minuti', no: 'tretti minutter', de: 'halbstund' },
        '60': { es: 'una hora', pt: 'uma hora', it: "un'ora", no: 'en time', de: 'e stund' },
        '120': { es: 'dos horas+', pt: 'duas horas+', it: 'due ore+', no: 'to timer+', de: 'zwei stund+' }
      };
      const translatedTime = timeMap[timeVal]?.[lang] ?? timeVal;
      const { error } = await supabase.from('pings').insert({ user_name: userName, location: loc, action: action, duration: translatedTime });
      smokerBtn.style.transform = '';
      if (error) {
        console.error('Ping failed:', error.message);
        showNotification(`${userName} - ${loc} ${action} ${translatedTime}`);
      }
    });
  }

  // ============================================================
  // 18. REALTIME: RECEIVE PINGS
  // ============================================================
  supabase
    .channel('public:pings')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pings' }, (payload) => {
      const ping = payload.new;
      showNotification(`${ping.user_name} - ${ping.location} ${ping.action} ${ping.duration}`);
    })
    .subscribe();

  // ============================================================
  // 19. EVENT MODAL (RSVP + BATZENKONTO)
  // ============================================================
  const eventModal = document.getElementById('event-modal');
  const eventModalContent = document.getElementById('event-modal-content');
  const eventBadges = document.querySelectorAll('.event-badge');

  // Event modals are now handled by openEventModal() called from loadHomeEvents()


});
