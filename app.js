// app.js
document.addEventListener('DOMContentLoaded', () => {

  // --- Supabase Init ---
  const SUPABASE_URL = 'https://oaybbyhlitmeftjtxwcn.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9heWJieWhsaXRtZWZ0anR4d2NuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzYzMzc3OTMsImV4cCI6MjA5MTkxMzc5M30.CxMa2fLNWMfc8_RlEKDWy1Be4lYzByqJe3_DGeOfH0s';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);


  const profileNameInput = document.getElementById('profile-name');
  const profileAvatar = document.getElementById('profile-avatar');
  const avatarUpload = document.getElementById('avatar-upload');
  const profileLangSelect = document.getElementById('profile-lang');

  // Load from localStorage
  const savedName = localStorage.getItem('profile-name') || 'Tobi the Punk';
  if(profileNameInput) profileNameInput.value = savedName;

  const savedAvatar = localStorage.getItem('profile-avatar');
  if(savedAvatar && profileAvatar) {
    profileAvatar.style.backgroundImage = `url('${savedAvatar}')`;
  }

  const savedLang = localStorage.getItem('profile-lang') || 'de';
  if(profileLangSelect) profileLangSelect.value = savedLang;

  // Save Name
  if(profileNameInput) {
    profileNameInput.addEventListener('input', (e) => {
      localStorage.setItem('profile-name', e.target.value);
    });
  }

  // Save Language
  if(profileLangSelect) {
    profileLangSelect.addEventListener('change', (e) => {
      localStorage.setItem('profile-lang', e.target.value);
    });
  }

  // Save Avatar
  if(avatarUpload && profileAvatar) {
    avatarUpload.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const base64Str = event.target.result;
          profileAvatar.style.backgroundImage = `url('${base64Str}')`;
          localStorage.setItem('profile-avatar', base64Str);
        };
        reader.readAsDataURL(file);
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
      content: `
        <div class="mb-4">
          <h4 class="font-marker text-xl text-gray-800 border-b pb-1 mb-2">Batzenkonto Übersicht 💰</h4>
          <p class="text-xs text-gray-500 mb-3 font-sans">Organisatoren: Lulla & Märek | Total: 120 CHF (Screenshot in WhatsApp)</p>
          
          <div class="bg-yellow-100 rounded-lg p-3 mb-3 border border-yellow-300">
            <h5 class="font-sans font-bold text-sm text-yellow-800 mb-2">Dein Status: Tambi</h5>
            <select class="w-full bg-white p-2 text-sm rounded border border-gray-300 mb-2 font-sans">
              <option>Essen + Alk (35 CHF)</option>
              <option>Nur Essen (15 CHF)</option>
              <option>Nur Alk (20 CHF)</option>
              <option>Selbermitgno (0 CHF)</option>
            </select>
            <p class="text-xs text-red-600 font-bold mb-1">Kontostand Event: -35 CHF</p>
            <p class="text-[10px] text-gray-400 leading-tight">Warte auf Bestätigung der Organisatoren...</p>
          </div>

          <div class="space-y-1 font-sans text-sm">
             <div class="flex items-center justify-between border-b pb-1">
                <span>Märek (Org)</span><span class="text-green-600 font-bold text-xs">✔ Bestätigt</span>
             </div>
             <div class="flex items-center justify-between border-b pb-1">
                <span>Diego (Nur Bier)</span><span class="text-green-600 font-bold text-xs">✔ Bestätigt</span>
             </div>
             <div class="flex items-center justify-between border-b pb-1">
                <span>Carlos (Essen+Alk)</span><span class="text-red-500 font-bold text-xs">Offen</span>
             </div>
          </div>
        </div>
      `
    },
    'vinoclay': {
      title: "Vino & Clay Night",
      subtitle: "Organisatoren: Ben & Märek",
      color: "bg-rose-700",
      content: `
        <div class="mb-5">
          <p class="font-sans text-sm text-gray-600 mb-4">Ein chilliger Abend mit Ton und Wein. Bringt warme Pullis mit, wir sind auf dem Balkon.</p>
          
          <h4 class="font-marker text-xl text-gray-800 mb-2">RSVP (Zusagen)</h4>
          <p class="text-[11px] text-red-600 font-bold mb-2 uppercase tracking-wide flex items-center gap-1">
             <span class="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span> Vote Locked: < 7 Tage übrig!
          </p>
          
          <div class="grid grid-cols-2 gap-3 mb-4 font-sans">
            <button class="bg-green-500 text-white rounded-lg py-3 font-bold shadow-md hover:bg-green-600 transition-colors">👍 Bin Dabei</button>
            <button class="bg-red-500 text-white rounded-lg py-3 font-bold shadow-md hover:bg-red-600 transition-colors">👎 Nö</button>
            <button class="bg-gray-200 text-gray-400 rounded-lg py-3 font-bold col-span-2 cursor-not-allowed border border-gray-300" disabled>🤷 Vielleicht (Gesperrt)</button>
          </div>

          <div class="bg-gray-100 rounded-lg p-3">
             <h4 class="font-sans font-bold text-xs text-gray-500 uppercase tracking-widest mb-2">Statusliste (Regel #1)</h4>
             <p class="text-sm font-sans mb-1"><span class="text-green-500 font-bold">Dabei:</span> Lulla, Tambi, Moro</p>
             <p class="text-sm font-sans"><span class="text-red-500 font-bold">Abgesagt:</span> Felix</p>
          </div>
        </div>
      `
    }
  };

  eventBadges.forEach(badge => {
    badge.addEventListener('click', () => {
      const type = badge.getAttribute('data-event');
      const data = eventData[type];
      if(!data) return;

      eventModalContent.innerHTML = `
        <div class="${data.color} p-6 pb-8 text-white relative">
          <button id="close-modal" class="absolute top-4 right-4 text-white/50 hover:text-white text-3xl font-sans leading-none">&times;</button>
          <h2 class="font-marker text-3xl leading-tight mb-1">${data.title}</h2>
          <p class="font-sans text-sm text-white/80 uppercase tracking-wider">${data.subtitle}</p>
        </div>
        <div class="p-6 -mt-4 bg-[#faf8f5] rounded-t-2xl relative shadow-[0_-4px_10px_rgba(0,0,0,0.1)]">
          ${data.content}
        </div>
      `;

      eventModal.classList.remove('hidden');
      eventModal.classList.add('flex');

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
