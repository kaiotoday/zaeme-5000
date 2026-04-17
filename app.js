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

  async function loadLoginNames() {
    const loginNameGrid = document.getElementById('login-name-grid');
    if (!loginNameGrid) return;

    loginNameGrid.innerHTML = '<div class="col-span-2 text-center text-white/50 text-xs py-4">Lade...</div>';
    const { data: users, error } = await supabase.from('users').select('name').eq('is_approved', true);

    if (error) {
      console.error('Supabase Error:', error);
      loginNameGrid.innerHTML = `<div class="col-span-2 text-center text-red-400 text-xs py-4 border border-red-500/20 rounded-xl">
        Datenbankfehler! Tabelle existiert nicht?<br>
        <span class="opacity-50 text-[10px]">${error.message}</span>
      </div>`;
      return;
    }

    if (!users || users.length === 0) {
      loginNameGrid.innerHTML = '<div class="col-span-2 text-center text-white/50 text-xs py-6 italic">Noch keine User.<br>Registriere dich zuerst!</div>';
      return;
    }

    loginNameGrid.innerHTML = '';
    users.forEach(u => {
      loginNameGrid.innerHTML += `<button class="login-name-btn bg-white/5 border-2 border-white/10 rounded-xl py-4 font-marker text-xl text-white hover:border-orange-400 hover:text-orange-500 hover:bg-white/10 transition-all">${u.name}</button>`;
    });

    document.querySelectorAll('.login-name-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedLoginName = e.target.textContent.trim();
        const pinWelcomeMsg = document.getElementById('pin-welcome-msg');
        const pinModal = document.getElementById('pin-modal');
        const secretBtns = document.querySelectorAll('.secret-btn');
        if (pinWelcomeMsg) pinWelcomeMsg.textContent = `Hallo ${selectedLoginName}`;
        if (pinModal) {
          pinModal.classList.remove('hidden');
          resetSecret(secretBtns, loginSecret);
          setTimeout(() => pinModal.classList.remove('opacity-0'), 50);
        }
      });
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
        const profileAvatar = document.getElementById('profile-avatar');
        if (userRow.avatar_url && profileAvatar) profileAvatar.style.backgroundImage = `url('${userRow.avatar_url}')`;
        const profileLangSelect = document.getElementById('profile-lang');
        if (userRow.ping_lang && profileLangSelect) profileLangSelect.value = userRow.ping_lang;
      }
    } else {
      if (viewLogin) viewLogin.classList.remove('hidden');
      if (appContainer) appContainer.classList.add('hidden');
      if (navFelt) navFelt.classList.add('hidden');
      loadLoginNames();
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

  const eventData = {
    'beerpong': {
      title: "Lulla's Wintergarten Bash",
      subtitle: "Beerpong Tournament & Birthday",
      color: "bg-blue-600",
      renderContent: async () => {
        const myName = localStorage.getItem('profile-name');
        const { data: batzen } = await supabase.from('batzen').select('*').eq('event_id', 'beerpong');
        let myStatus = 'essen_alk';
        let confirmed = false;
        let listHTML = '';
        if (batzen && batzen.length > 0) {
          const me = batzen.find(b => b.user_name === myName);
          if (me) { myStatus = me.consumption; confirmed = me.confirmed; }
          batzen.forEach(b => {
            const statusMap = { 'essen_alk': 'Essen+Alk', 'essen': 'Nur Essen', 'alk': 'Nur Alk', 'nichts': 'Selbermitgno' };
            const confIcon = b.confirmed ? '<span class="text-green-600 font-bold text-xs">✔</span>' : '<span class="text-orange-400 font-bold text-xs">Offen</span>';
            listHTML += `<div class="flex items-center justify-between border-b pb-1"><span>${b.user_name} (${statusMap[b.consumption]})</span>${confIcon}</div>`;
          });
        }
        if (!listHTML) listHTML = '<div class="text-xs text-gray-500 text-center">Noch keine Einträge.</div>';
        const isAdmin = activeUser && (activeUser.name === 'Lulla' || activeUser.is_admin);
        const adminBtn = isAdmin ? `<button id="btn-admin-confirm" class="w-full mt-2 bg-black text-white text-xs py-2 rounded">Alle bestätigen (Admin)</button>` : '';
        return `<div class="mb-4" id="batzen-container">
          <h4 class="font-marker text-xl text-gray-800 border-b pb-1 mb-2">Batzenkonto 💰</h4>
          <p class="text-xs text-gray-500 mb-3 font-sans">Organisatoren: Lulla & Märek | Total: ~120 CHF</p>
          <div class="bg-yellow-100 rounded-lg p-3 mb-3 border border-yellow-300">
            <h5 class="font-sans font-bold text-sm text-yellow-800 mb-2">Dein Status: ${myName}</h5>
            <select id="batzen-select" class="w-full bg-white p-2 text-sm rounded border border-gray-300 mb-2 font-sans" ${confirmed ? 'disabled' : ''}>
              <option value="essen_alk" ${myStatus === 'essen_alk' ? 'selected' : ''}>Essen + Alk</option>
              <option value="essen" ${myStatus === 'essen' ? 'selected' : ''}>Nur Essen</option>
              <option value="alk" ${myStatus === 'alk' ? 'selected' : ''}>Nur Alk</option>
              <option value="nichts" ${myStatus === 'nichts' ? 'selected' : ''}>Selbermitgno</option>
            </select>
          </div>
          <div class="space-y-1 font-sans text-sm">${listHTML}</div>
          ${adminBtn}
        </div>`;
      },
      attachListeners: (contentDiv) => {
        const select = contentDiv.querySelector('#batzen-select');
        const adminBtn = contentDiv.querySelector('#btn-admin-confirm');
        const myName = localStorage.getItem('profile-name');
        if (select) select.addEventListener('change', async (e) => {
          await supabase.from('batzen').upsert({ event_id: 'beerpong', user_name: myName, consumption: e.target.value }, { onConflict: 'event_id,user_name' });
        });
        if (adminBtn) adminBtn.addEventListener('click', async () => {
          await supabase.from('batzen').update({ confirmed: true }).eq('event_id', 'beerpong');
          adminBtn.innerText = "Bestätigt! ✓";
        });
      }
    },
    'vinoclay': {
      title: "Vino & Clay Night",
      subtitle: "Organisatoren: Ben & Märek",
      color: "bg-rose-700",
      renderContent: async () => {
        const myName = localStorage.getItem('profile-name');
        const { data: rsvps } = await supabase.from('rsvp').select('*').eq('event_id', 'vinoclay');
        let dabei = [], abgesagt = [], myVote = null;
        if (rsvps) rsvps.forEach(r => {
          if (r.user_name === myName) myVote = r.status;
          if (r.status === 'yes') dabei.push(r.user_name);
          if (r.status === 'no') abgesagt.push(r.user_name);
        });
        return `<div class="mb-5">
          <p class="font-sans text-sm text-gray-600 mb-4">Ein chilliger Abend mit Ton und Wein.</p>
          <h4 class="font-marker text-xl text-gray-800 mb-2">RSVP</h4>
          <div class="grid grid-cols-2 gap-3 mb-4 font-sans">
            <button class="rsvp-btn bg-green-500 text-white rounded-lg py-3 font-bold ${myVote === 'yes' ? 'ring-4 ring-green-300 ring-offset-2' : ''}" data-val="yes">👍 Bin Dabei</button>
            <button class="rsvp-btn bg-red-500 text-white rounded-lg py-3 font-bold ${myVote === 'no' ? 'ring-4 ring-red-300 ring-offset-2' : ''}" data-val="no">👎 Nö</button>
          </div>
          <div class="bg-gray-100 rounded-lg p-3">
            <p class="text-sm font-sans mb-1"><span class="text-green-500 font-bold">Dabei:</span> ${dabei.length > 0 ? dabei.join(', ') : 'Niemand'}</p>
            <p class="text-sm font-sans"><span class="text-red-500 font-bold">Abgesagt:</span> ${abgesagt.length > 0 ? abgesagt.join(', ') : 'Niemand'}</p>
          </div>
        </div>`;
      },
      attachListeners: (contentDiv) => {
        const myName = localStorage.getItem('profile-name');
        contentDiv.querySelectorAll('.rsvp-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const val = e.target.getAttribute('data-val');
            contentDiv.querySelectorAll('.rsvp-btn').forEach(b => b.classList.remove('ring-4', 'ring-green-300', 'ring-red-300', 'ring-offset-2'));
            e.target.classList.add('ring-4', 'ring-offset-2', val === 'yes' ? 'ring-green-300' : 'ring-red-300');
            await supabase.from('rsvp').upsert({ event_id: 'vinoclay', user_name: myName, status: val }, { onConflict: 'event_id,user_name' });
          });
        });
      }
    }
  };

  eventBadges.forEach(badge => {
    badge.addEventListener('click', async () => {
      const type = badge.getAttribute('data-event');
      const data = eventData[type];
      if (!data) return;
      eventModalContent.innerHTML = `<div class="p-10 text-center font-marker text-2xl text-gray-400 animate-pulse">Lade Live Daten...</div>`;
      eventModal.classList.remove('hidden');
      eventModal.classList.add('flex');
      const dynamicContent = await data.renderContent();
      eventModalContent.innerHTML = `
        <div class="${data.color} p-6 pb-8 text-white relative">
          <button id="close-modal" class="absolute top-4 right-4 text-white/50 hover:text-white text-3xl font-sans leading-none">&times;</button>
          <h2 class="font-marker text-3xl leading-tight mb-1">${data.title}</h2>
          <p class="font-sans text-sm text-white/80 uppercase tracking-wider">${data.subtitle}</p>
        </div>
        <div class="p-6 -mt-4 bg-[#faf8f5] rounded-t-2xl relative shadow-[0_-4px_10px_rgba(0,0,0,0.1)]" id="dynamic-content-wrapper">
          ${dynamicContent}
        </div>
      `;
      const wrapper = document.getElementById('dynamic-content-wrapper');
      if (data.attachListeners) data.attachListeners(wrapper);
      document.getElementById('close-modal').addEventListener('click', () => {
        eventModal.classList.add('hidden');
        eventModal.classList.remove('flex');
      });
    });
  });

  eventModal.addEventListener('click', (e) => {
    if (e.target === eventModal) {
      eventModal.classList.add('hidden');
      eventModal.classList.remove('flex');
    }
  });

});
