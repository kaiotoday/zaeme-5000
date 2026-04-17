// app.js
document.addEventListener('DOMContentLoaded', () => {

  // --- Supabase Init ---
  const SUPABASE_URL = 'https://oaybbyhlitmeftjtxwcn.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9heWJieWhsaXRtZWZ0anR4d2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzc3OTMsImV4cCI6MjA5MTkxMzc5M30.CxMa2fLNWMfc8_RlEKDWy1Be4lYzByqJe3_DGeOfH0s';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


  // --- Auth & Login Logic (Multi-Tenant) ---
  const viewLogin = document.getElementById('view-login');
  const appContainer = document.getElementById('app-container');
  const navFelt = document.querySelector('.nav-felt');
  const profileNameDisplay = document.getElementById('profile-name-display');
  const logoutBtn = document.getElementById('logout-btn');
  const loginNameGrid = document.getElementById('login-name-grid');
  
  // Shared Login Variables
  const pinModal = document.getElementById('pin-modal');
  const cancelLogin = document.getElementById('cancel-login');
  const pinWelcomeMsg = document.getElementById('pin-welcome-msg');
  const pinError = document.getElementById('pin-error');
  const secretBtns = document.querySelectorAll('.secret-btn');
  let selectedLoginName = '';
  let loginSecret = { 1: null, 2: null, 3: null };

  let activeUser = null; 

  const checkAuth = async () => {
    const savedName = localStorage.getItem('profile-name');
    if (savedName) {
      if (profileNameDisplay) profileNameDisplay.textContent = savedName;
      if (viewLogin) viewLogin.classList.add('hidden');
      if (appContainer) appContainer.classList.remove('hidden');
      if (navFelt) navFelt.classList.remove('hidden');
      
      // Load user object
      const { data: userRow } = await supabase.from('users').select('*').eq('name', savedName).single();
      if(userRow) {
         activeUser = userRow;
         // Setup Admin Panel if admin
         setupAdminPanel(activeUser);
         // Profile info
         const profileAvatar = document.getElementById('profile-avatar');
         if (userRow.avatar_url && profileAvatar) profileAvatar.style.backgroundImage = `url('${userRow.avatar_url}')`;
         if (userRow.ping_lang && document.getElementById('profile-lang')) document.getElementById('profile-lang').value = userRow.ping_lang;
      }
    } else {
      if (viewLogin) viewLogin.classList.remove('hidden');
      if (appContainer) appContainer.classList.add('hidden');
      if (navFelt) navFelt.classList.add('hidden');
      loadLoginNames(); // Fetch profiles
    }
  };

  const loadLoginNames = async () => {
    if(!loginNameGrid) return;
    console.log("Versuche Accounts zu laden...");
    const { data: users, error } = await supabase.from('users').select('name').eq('is_approved', true);
    
    if(error) {
       console.error("Supabase Fehler beim Laden der Accounts:", error);
       loginNameGrid.innerHTML = `<div class="col-span-2 text-center text-red-400 text-xs py-4">
         Fehler beim Laden!<br>Hast du das SQL-Script in Supabase schon ausgeführt?<br>
         <span class="opacity-50">(${error.message})</span>
       </div>`;
       return;
    }

    if(!users || users.length === 0) {
       loginNameGrid.innerHTML = '<div class="col-span-2 text-center text-white/50 text-xs py-4">Noch keine freigeschalteten Accounts.<br>Registriere dich zuerst!</div>';
       return;
    }
    
    loginNameGrid.innerHTML = '';
    users.forEach(u => {
       loginNameGrid.innerHTML += `<button class="login-name-btn bg-white/5 border-2 border-white/10 rounded-xl py-4 font-marker text-xl text-white shadow-sm hover:border-orange-400 hover:text-orange-500 hover:bg-white/10 transition-all">${u.name}</button>`;
    });
    
    // Re-attach listeners dynamically
    document.querySelectorAll('.login-name-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedLoginName = e.target.textContent.trim();
        pinWelcomeMsg.textContent = `Hallo ${selectedLoginName}`;
        pinModal.classList.remove('hidden');
        resetSecret(secretBtns, loginSecret);
        setTimeout(() => pinModal.classList.remove('opacity-0'), 50);
      });
    });
  };

  // Tabs Login/Signup
  const tabLogin = document.getElementById('tab-login');
  const tabSignup = document.getElementById('tab-signup');
  const secLogin = document.getElementById('section-login');
  const secSignup = document.getElementById('section-signup');

  if(tabLogin && tabSignup) {
    tabLogin.addEventListener('click', () => {
      secLogin.classList.remove('hidden'); secLogin.classList.add('block');
      secSignup.classList.add('hidden'); secSignup.classList.remove('block');
      tabLogin.classList.add('text-white', 'border-orange-500', 'font-bold'); tabLogin.classList.remove('text-white/50', 'border-transparent');
      tabSignup.classList.remove('text-white', 'border-orange-500', 'font-bold'); tabSignup.classList.add('text-white/50', 'border-transparent');
    });
    tabSignup.addEventListener('click', () => {
      secSignup.classList.remove('hidden'); secSignup.classList.add('block');
      secLogin.classList.add('hidden'); secLogin.classList.remove('block');
      tabSignup.classList.add('text-white', 'border-orange-500', 'font-bold'); tabSignup.classList.remove('text-white/50', 'border-transparent');
      tabLogin.classList.remove('text-white', 'border-orange-500', 'font-bold'); tabLogin.classList.add('text-white/50', 'border-transparent');
    });
  }

  // --- Secret Logic General ---
  const resetSecret = (btnsCollection, stateObj) => {
    if(stateObj) Object.assign(stateObj, { 1: null, 2: null, 3: null });
    btnsCollection.forEach(b => delete b.dataset.active);
  };

  // --- Signup Logic ---
  const signupBtns = document.querySelectorAll('.signup-btn');
  const signupNameInput = document.getElementById('signup-name');
  const btnSubmitSignup = document.getElementById('btn-submit-signup');
  const signupMsg = document.getElementById('signup-msg');
  let signupSecret = { 1: null, 2: null, 3: null };

  signupBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const colId = e.target.closest('.signup-col').getAttribute('data-col');
      document.querySelectorAll(`.signup-col[data-col="${colId}"] .signup-btn`).forEach(b => delete b.dataset.active);
      e.target.dataset.active = "true";
      signupSecret[colId] = e.target.getAttribute('data-val');
    });
  });

  if(btnSubmitSignup) {
    btnSubmitSignup.addEventListener('click', async () => {
      const name = signupNameInput.value.trim();
      if(!name) return signupMsg.textContent = "Bitte Name eingeben!";
      if(!signupSecret[1] || !signupSecret[2] || !signupSecret[3]) return signupMsg.textContent = "Bitte alle 3 Wörter wählen!";
      
      btnSubmitSignup.textContent = "Sende...";
      const { data, error } = await supabase.from('users').insert({
        name: name, code_1: signupSecret[1], code_2: signupSecret[2], code_3: signupSecret[3]
      });
      
      if(error) {
         signupMsg.textContent = "Fehler: Name existiert schon?";
         btnSubmitSignup.textContent = "Beantragen";
      } else {
         signupMsg.className = "text-xs text-center mt-3 text-green-400";
         signupMsg.textContent = "Antrag erfolgreich gesendet! Warte bis ihn ein Admin (Märek/Ben) bestätigt.";
         btnSubmitSignup.classList.add('hidden');
      }
    });
  }

  // --- Login Logic ---

  if (cancelLogin) {
    cancelLogin.addEventListener('click', () => {
      pinModal.classList.add('opacity-0');
      setTimeout(() => {
        pinModal.classList.add('hidden');
        resetSecret(secretBtns, loginSecret);
        pinError.classList.add('opacity-0');
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
      pinError.classList.add('opacity-0');

      if (loginSecret[1] && loginSecret[2] && loginSecret[3]) {
        // Query DB instead of hardcode
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
          checkAuth(); // Boots app
        } else {
          // Error or pending
          pinError.textContent = userMatch ? "Account wurde noch nicht vom Admin bestätigt!" : "Code inkorrekt!";
          pinError.classList.remove('opacity-0');
          setTimeout(() => resetSecret(secretBtns, loginSecret), 1000);
        }
      }
    });
  });

  // Initial Boot
  checkAuth();

  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('profile-name');
      checkAuth();
    });
  }

  // --- Admin Panel Logic ---
  const setupAdminPanel = async (usr) => {
     const adminPanel = document.getElementById('admin-panel');
     const pendingList = document.getElementById('admin-pending-list');
     if(!adminPanel || !pendingList) return;
     if(!usr.is_admin) {
        adminPanel.classList.add('hidden');
        return;
     }
     adminPanel.classList.remove('hidden');
     
     const { data: pends } = await supabase.from('users').select('*').eq('is_approved', false);
     if(!pends || pends.length === 0) {
        pendingList.innerHTML = '<div class="text-white/40 text-center text-xs">Keine offenen Anträge.</div>';
        return;
     }

     pendingList.innerHTML = '';
     pends.forEach(p => {
        pendingList.innerHTML += `
          <div class="flex items-center justify-between bg-red-900/50 p-2 rounded border border-red-500/30">
            <span class="text-white font-bold">${p.name}</span>
            <button class="bg-green-600 hover:bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded uppercase tracking-wider approve-btn shadow" data-id="${p.id}">Bestätigen</button>
          </div>
        `;
     });

     document.querySelectorAll('.approve-btn').forEach(b => {
        b.addEventListener('click', async (e) => {
           const id = e.target.getAttribute('data-id');
           e.target.textContent = '...';
           await supabase.from('users').update({ is_approved: true }).eq('id', id);
           setupAdminPanel(usr); // Reload
        });
     });
  };

  // --- Profile Logic Streams ---
  const profileAvatar = document.getElementById('profile-avatar');
  const avatarUpload = document.getElementById('avatar-upload');
  const profileLangSelect = document.getElementById('profile-lang');

  if(profileLangSelect) {
    profileLangSelect.addEventListener('change', async (e) => {
      if(!activeUser) return;
      await supabase.from('users').update({ ping_lang: e.target.value }).eq('id', activeUser.id);
    });
  }

  if(avatarUpload && profileAvatar) {
    avatarUpload.addEventListener('change', async (e) => {
      if(!activeUser) return;
      const file = e.target.files[0];
      if (file) {
        profileAvatar.innerHTML = '<div class="w-full h-full flex items-center justify-center text-[10px] font-bold text-white bg-black/60 backdrop-blur-sm">Upload...</div>';
        const fileExt = file.name.split('.').pop();
        const filePath = `avatars/${activeUser.name}-${Date.now()}.${fileExt}`;
        
        await supabase.storage.from('assets').upload(filePath, file);
        const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(filePath);
        
        await supabase.from('users').update({ avatar_url: publicUrl }).eq('id', activeUser.id);
        profileAvatar.innerHTML = '';
        profileAvatar.style.backgroundImage = `url('${publicUrl}')`;
      }
    });
  }

  // --- Audio Recorder Logic ---
  const recordSoundBtn = document.getElementById('record-sound-btn');
  const recordStatus = document.getElementById('record-status');
  const recordStatusCont = document.getElementById('record-status-container');
  const recordProgress = document.getElementById('record-progress');
  const playSoundBtn = document.getElementById('play-sound-btn');
  
  let mediaRecorder;
  let audioChunks = [];
  let isRecording = false;

  if (recordSoundBtn) {
    recordSoundBtn.addEventListener('click', async () => {
      if (!activeUser) return;
      if (isRecording) {
        mediaRecorder.stop();
        return;
      }
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        audioChunks = [];
        
        mediaRecorder.ondataavailable = e => { if (e.data.size > 0) audioChunks.push(e.data); };
        mediaRecorder.onstart = () => {
           isRecording = true;
           recordSoundBtn.innerHTML = '<span>⏹</span> Aufnahme stoppen';
           recordSoundBtn.classList.replace('bg-red-500/10', 'bg-red-500');
           recordSoundBtn.classList.replace('text-red-200', 'text-white');
           recordStatusCont.classList.remove('hidden');
           recordStatusCont.classList.add('flex');
           recordStatus.textContent = 'Aufnahme läuft (max 5 Sek)...';
           let w = 0;
           const intv = setInterval(() => {
              w += 2; 
              if(w > 100) clearInterval(intv);
              recordProgress.style.width = w + '%';
           }, 100);
           setTimeout(() => { if(isRecording) mediaRecorder.stop(); clearInterval(intv); }, 5000);
        };
        
        mediaRecorder.onstop = async () => {
           isRecording = false;
           recordSoundBtn.innerHTML = '<span>🔴</span> Signature aufnehmen (Mikro)';
           recordSoundBtn.classList.replace('bg-red-500', 'bg-red-500/10');
           recordSoundBtn.classList.replace('text-white', 'text-red-200');
           
           stream.getTracks().forEach(track => track.stop());
           recordStatus.textContent = 'Wird hochgeladen...';
           recordProgress.style.width = '100%';
           recordProgress.className = "bg-blue-500 h-1.5 rounded-full animate-pulse";
           
           const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
           const filePath = `audios/${activeUser.name}-${Date.now()}.webm`;
           
           const { error } = await supabase.storage.from('assets').upload(filePath, audioBlob);
           if (!error) {
              const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(filePath);
              await supabase.from('users').update({ audio_url: publicUrl }).eq('id', activeUser.id);
              activeUser.audio_url = publicUrl;
              recordStatus.textContent = 'Upload fertig!';
           } else {
              recordStatus.textContent = 'Upload Fehler!';
           }
           setTimeout(() => {
              recordStatusCont.classList.add('hidden'); recordStatusCont.classList.remove('flex');
              recordProgress.className = "bg-red-500 h-1.5 rounded-full";
              recordProgress.style.width = '0%';
           }, 2000);
        };
        
        mediaRecorder.start();
      } catch (err) {
        alert("Mikrofon-Zugriff verweigert oder nicht verfügbar.");
      }
    });
  }

  if (playSoundBtn) {
    playSoundBtn.addEventListener('click', () => {
      if(activeUser && activeUser.audio_url) {
         new Audio(activeUser.audio_url).play();
      } else {
         alert('Du hast noch keinen Sound aufgenommen!');
      }
    });
  }

  // --- SPA Navigation ---
  const navItems = document.querySelectorAll('.nav-item');
  const viewPanels = document.querySelectorAll('.view-panel');

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      // Remove active from all nav items
      navItems.forEach(nav => nav.classList.remove('active'));
      item.classList.add('active');

      // Hide all views
      viewPanels.forEach(panel => panel.classList.remove('active'));
      
      // Show target view
      const targetId = item.getAttribute('data-target');
      const targetPanel = document.getElementById(targetId);
      if(targetPanel) {
        targetPanel.classList.add('active');
        // Scroll to top when switching tab
        document.getElementById('app-container').scrollTop = 0;
      }
    });
  });

  // --- Sticker Selection Preview ---
  const stickerUpload = document.getElementById('sticker-upload');
  const stickerPreview = document.getElementById('sticker-preview');

  if (stickerUpload && stickerPreview) {
    stickerUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          // Replace content with image
          stickerPreview.innerHTML = `<img src="${event.target.result}" alt="Sticker" class="w-full h-full object-cover">`;
          // Remove dashed border for clean look
          stickerPreview.classList.remove('border-dashed', 'border-gray-400');
          stickerPreview.classList.add('border-white', 'border-4');
        };
        reader.readAsDataURL(file);
      }
    });
  }

  // --- Theme Selection ---
  const themeBtns = document.querySelectorAll('.theme-btn');
  const body = document.body;
  
  // Load saved theme from localStorage if available
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
    // reset bodies
    body.classList.remove('theme-cardboard', 'theme-notebook', 'theme-grunge', 'theme-piggy');
    body.classList.add(`theme-${themeName}`);
    
    // update buttons
    themeBtns.forEach(b => {
      if(b.getAttribute('data-theme') === themeName) {
        b.classList.add('active');
      } else {
        b.classList.remove('active');
      }
    });
  }

  // --- Ping Chips Selection ---
  const chipGroups = ['ping-location', 'ping-action', 'ping-time'];
  chipGroups.forEach(groupId => {
    const group = document.getElementById(groupId);
    if(group) {
        const chips = group.querySelectorAll('.ping-chip');
        chips.forEach(chip => {
            chip.addEventListener('click', () => {
                chips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
            });
        });
    }
  });

  // --- Custom Alert Notification ---
  const customAlert = document.getElementById('custom-alert');
  const alertMsg = document.getElementById('custom-alert-msg');
  const alertIgnore = document.getElementById('alert-ignore');
  const alertJoin = document.getElementById('alert-join');
  const alertExcuse = document.getElementById('alert-excuse');

  function showNotification(msg) {
    alertMsg.textContent = msg;
    customAlert.classList.add('show');

    // Auto-hide after 15 seconds if not interacted
    setTimeout(() => hideNotification(), 15000);
  }

  function hideNotification() {
    customAlert.classList.remove('show');
  }

  if(alertIgnore) alertIgnore.addEventListener('click', hideNotification);
  if(alertJoin) {
    alertJoin.addEventListener('click', () => {
        hideNotification();
        setTimeout(() => alert('Cool, Nachricht gesendet: "Ich komm auch!"'), 300);
    });
  }

  // --- Eis Teere! / Ping Button (LIVE via Supabase) ---
  const smokerBtn = document.getElementById('smoker-btn');
  if (smokerBtn) {
    smokerBtn.addEventListener('click', async () => {
      smokerBtn.style.transform = 'translateY(15px)';
      
      const loc = document.querySelector('#ping-location .ping-chip.active')?.getAttribute('data-val') || 'Irgendwo';
      const action = document.querySelector('#ping-action .ping-chip.active')?.getAttribute('data-val') || 'teeere';
      const timeVal = document.querySelector('#ping-time .ping-chip.active')?.getAttribute('data-val') || '5';
      const lang = localStorage.getItem('profile-lang') || 'de';
      const userName = localStorage.getItem('profile-name') || 'Anon';

      const timeMap = {
        '5':  { es:'cinco minutos', pt:'cinco minutos', it:'cinque minuti', no:'fem minutter', de:'foif minute' },
        '15': { es:'quince minutos', pt:'quinze minutos', it:'quindici minuti', no:'femten minutter', de:'vierzgi minute' },
        '30': { es:'treinta minutos', pt:'trinta minutos', it:'trenta minuti', no:'tretti minutter', de:'halbstund' },
        '60': { es:'una hora', pt:'uma hora', it:"un'ora", no:'en time', de:'e stund' },
        '120':{ es:'dos horas+', pt:'duas horas+', it:'due ore+', no:'to timer+', de:'zwei stund+' }
      };
      const translatedTime = timeMap[timeVal]?.[lang] ?? timeVal;

      // INSERT into Supabase — all friends will receive this in real-time
      const { error } = await supabase.from('pings').insert({
        user_name: userName,
        location: loc,
        action: action,
        duration: translatedTime
      });

      smokerBtn.style.transform = '';

      if (error) {
        console.error('Ping failed:', error.message);
        // Fallback: show locally anyway
        showNotification(`${userName} - ${loc} ${action} ${translatedTime}`);
      }
      // Success: real-time subscription below will trigger the notification for everyone
    });
  }

  // --- Real-time subscription: receive pings from friends ---
  const myName = localStorage.getItem('profile-name') || '';
  supabase
    .channel('public:pings')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'pings' }, (payload) => {
      const ping = payload.new;
      // Show notification to everyone EXCEPT the sender (they already know they sent it)
      const msg = `${ping.user_name} - ${ping.location} ${ping.action} ${ping.duration}`;
      showNotification(msg);
    })
    .subscribe();

  // --- Profile: Play Signature Sound ---
  const playSoundBtn = document.getElementById('play-sound-btn');
  if (playSoundBtn) {
    playSoundBtn.addEventListener('click', () => {
      alert('🎶 Dein Signature-Sound läuft! 🎶\n(Dummy für Web Audio API)');
    });
  }


  const alertRadar = document.getElementById('alert-radar');
  const radarModal = document.getElementById('radar-modal');
  const closeRadar = document.getElementById('close-radar');

  if(alertRadar) {
    alertRadar.addEventListener('click', () => {
      hideNotification();
      radarModal.classList.remove('hidden');
      radarModal.classList.add('flex');
    });
  }
  if(closeRadar) {
    closeRadar.addEventListener('click', () => {
      radarModal.classList.add('hidden');
      radarModal.classList.remove('flex');
    });
  }

  // --- Event Passport & Modal Logic ---
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
        
        // Fetch live batzen data
        const { data: batzen, error } = await supabase.from('batzen').select('*').eq('event_id', 'beerpong');
        
        let myStatus = 'essen_alk';
        let confirmed = false;
        
        let listHTML = '';
        if (batzen && batzen.length > 0) {
           const me = batzen.find(b => b.user_name === myName);
           if (me) {
             myStatus = me.consumption;
             confirmed = me.confirmed;
           }
           
           batzen.forEach(b => {
             const statusMap = { 'essen_alk': 'Essen+Alk', 'essen': 'Nur Essen', 'alk': 'Nur Alk', 'nichts': 'Selbermitgno' };
             const confIcon = b.confirmed ? '<span class="text-green-600 font-bold text-xs">✔ Bestätigt</span>' : '<span class="text-red-500 font-bold text-xs">Offen</span>';
             listHTML += `<div class="flex items-center justify-between border-b pb-1">
                <span>${b.user_name} (${statusMap[b.consumption]})</span>${confIcon}
             </div>`;
           });
        }

        if (listHTML === '') {
           listHTML = '<div class="text-xs text-gray-500 text-center">Noch keine Einträge.</div>';
        }

        const isAdmin = (myName === 'Lulla' || myName === 'Märek');
        const adminBtn = isAdmin ? `<button id="btn-admin-confirm" class="w-full mt-2 bg-black text-white text-xs py-2 rounded">Alle bestätigen (Admin)</button>` : '';

        return `
        <div class="mb-4" id="batzen-container">
          <h4 class="font-marker text-xl text-gray-800 border-b pb-1 mb-2">Batzenkonto Übersicht 💰</h4>
          <p class="text-xs text-gray-500 mb-3 font-sans">Organisatoren: Lulla & Märek | Total: ~120 CHF</p>
          
          <div class="bg-yellow-100 rounded-lg p-3 mb-3 border border-yellow-300">
            <h5 class="font-sans font-bold text-sm text-yellow-800 mb-2">Dein Status: ${myName}</h5>
            <select id="batzen-select" class="w-full bg-white p-2 text-sm rounded border border-gray-300 mb-2 font-sans" ${confirmed ? 'disabled' : ''}>
              <option value="essen_alk" ${myStatus==='essen_alk' ? 'selected' : ''}>Essen + Alk</option>
              <option value="essen" ${myStatus==='essen' ? 'selected': ''}>Nur Essen</option>
              <option value="alk" ${myStatus==='alk' ? 'selected': ''}>Nur Alk</option>
              <option value="nichts" ${myStatus==='nichts' ? 'selected': ''}>Selbermitgno</option>
            </select>
            ${confirmed ? '<p class="text-[10px] text-green-600 font-bold">Bezahlt & Bestätigt!</p>' : '<p class="text-[10px] text-gray-500">Wird live in Datenbank gespeichert.</p>'}
          </div>

          <div class="space-y-1 font-sans text-sm">
             ${listHTML}
          </div>
          ${adminBtn}
        </div>
        `;
      },
      attachListeners: (contentDiv) => {
        const select = contentDiv.querySelector('#batzen-select');
        const adminBtn = contentDiv.querySelector('#btn-admin-confirm');
        const myName = localStorage.getItem('profile-name');
        
        if (select) {
           select.addEventListener('change', async (e) => {
             const val = e.target.value;
             await supabase.from('batzen').upsert({ event_id: 'beerpong', user_name: myName, consumption: val }, { onConflict: 'event_id,user_name' });
           });
        }
        
        if (adminBtn) {
           adminBtn.addEventListener('click', async () => {
             await supabase.from('batzen').update({ confirmed: true }).eq('event_id', 'beerpong');
             adminBtn.innerText = "Bestätigt!";
           });
        }
      }
    },
    'vinoclay': {
      title: "Vino & Clay Night",
      subtitle: "Organisatoren: Ben & Märek",
      color: "bg-rose-700",
      renderContent: async () => {
        const myName = localStorage.getItem('profile-name');
        
        // Fetch live rsvp
        const { data: rsvps } = await supabase.from('rsvp').select('*').eq('event_id', 'vinoclay');
        
        let dabei = [];
        let abgesagt = [];
        let myVote = null;
        
        if (rsvps) {
           rsvps.forEach(r => {
              if (r.user_name === myName) myVote = r.status;
              if (r.status === 'yes') dabei.push(r.user_name);
              if (r.status === 'no') abgesagt.push(r.user_name);
           });
        }

        return `
        <div class="mb-5">
          <p class="font-sans text-sm text-gray-600 mb-4">Ein chilliger Abend mit Ton und Wein. Bringt warme Pullis mit, wir sind auf dem Balkon.</p>
          
          <h4 class="font-marker text-xl text-gray-800 mb-2">RSVP (Zusagen)</h4>
          <p class="text-[11px] text-red-600 font-bold mb-2 uppercase tracking-wide flex items-center gap-1">
             <span class="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> Vote Locked: < 7 Tage übrig!
          </p>
          
          <div class="grid grid-cols-2 gap-3 mb-4 font-sans">
            <button class="rsvp-btn bg-green-500 text-white rounded-lg py-3 font-bold shadow-md hover:bg-green-600 ${myVote==='yes' ? 'ring-4 ring-green-300 ring-offset-2' : ''}" data-val="yes">👍 Bin Dabei</button>
            <button class="rsvp-btn bg-red-500 text-white rounded-lg py-3 font-bold shadow-md hover:bg-red-600 ${myVote==='no' ? 'ring-4 ring-red-300 ring-offset-2' : ''}" data-val="no">👎 Nö</button>
            <button class="bg-gray-200 text-gray-400 rounded-lg py-3 font-bold col-span-2 cursor-not-allowed border border-gray-300" disabled>🤷 Vielleicht (Gesperrt)</button>
          </div>

          <div class="bg-gray-100 rounded-lg p-3">
             <h4 class="font-sans font-bold text-xs text-gray-500 uppercase tracking-widest mb-2">Statusliste (Regel #1)</h4>
             <p class="text-sm font-sans mb-1"><span class="text-green-500 font-bold">Dabei:</span> ${dabei.length > 0 ? dabei.join(', ') : 'Niemand'}</p>
             <p class="text-sm font-sans"><span class="text-red-500 font-bold">Abgesagt:</span> ${abgesagt.length > 0 ? abgesagt.join(', ') : 'Niemand'}</p>
          </div>
        </div>
        `;
      },
      attachListeners: (contentDiv) => {
        const btns = contentDiv.querySelectorAll('.rsvp-btn');
        const myName = localStorage.getItem('profile-name');
        
        btns.forEach(btn => {
           btn.addEventListener('click', async (e) => {
             const val = e.target.getAttribute('data-val');
             
             // Visual feedback
             btns.forEach(b => b.classList.remove('ring-4', 'ring-green-300', 'ring-red-300', 'ring-offset-2'));
             e.target.classList.add('ring-4', 'ring-offset-2');
             if(val==='yes') e.target.classList.add('ring-green-300');
             if(val==='no') e.target.classList.add('ring-red-300');
             
             // Live Supabase Upsert
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
      if(!data) return;

      // Show loading state
      eventModalContent.innerHTML = `<div class="p-10 text-center font-marker text-2xl text-gray-400 animate-pulse">Lade Live Daten...</div>`;
      eventModal.classList.remove('hidden');
      eventModal.classList.add('flex');

      // Async Data Fetch
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

      // Attach events to dynamic HTML
      const wrapper = document.getElementById('dynamic-content-wrapper');
      if (data.attachListeners) {
         data.attachListeners(wrapper);
      }

      document.getElementById('close-modal').addEventListener('click', () => {
        eventModal.classList.add('hidden');
        eventModal.classList.remove('flex');
      });
    });
  });

  // Close modal when clicking outside
  eventModal.addEventListener('click', (e) => {
    if(e.target === eventModal) {
      eventModal.classList.add('hidden');
      eventModal.classList.remove('flex');
    }
  });
});
