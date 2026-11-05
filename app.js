// ============================================================================
// APP.JS v5.0 — EDIZIONE UNIVERSALE SMARTPHONE (ANDROID & iOS)
// - App 100% Personale per Telefono (Leonardo Uomo / Vita Lucia Donna)
// - Menu Opzioni con Estensioni Disattivabili e 3 Grandezze Testo
// - Domanda Automatica dell'Ora ("Ore 09:00: hai fatto Colazione? SÌ / NO")
// - Notifiche Chat Stile WhatsApp (Suono + Banner + Notifica anche ad app chiusa)
// - Widget Controllo Totale Sempre Attivo (In-App + Barra Notifiche Telefono)
// ============================================================================

const STORAGE_KEY = 'dieta_pastoressa_state_v5';

const CALENDAR_DAY_NAMES = ['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica'];
const CALENDAR_SHORT_NAMES = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
const MONTH_NAMES_IT = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic'];

function getTodayDayIndex() {
  const jsDay = new Date().getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getTodayDateStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getCurrentTimeHM() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getCalendarDateForSlot(slotIdx) {
  const now = new Date();
  const todayIdx = getTodayDayIndex();
  const diffDays = slotIdx - todayIdx;
  const target = new Date(now.getFullYear(), now.getMonth(), now.getDate() + diffDays);
  const dd = String(target.getDate()).padStart(2, '0');
  const mm = String(target.getMonth() + 1).padStart(2, '0');
  const monthName = MONTH_NAMES_IT[target.getMonth()];
  return {
    shortDate: `${dd}/${mm}`,
    fullDate: `${CALENDAR_DAY_NAMES[slotIdx]} ${target.getDate()} ${monthName} ${target.getFullYear()}`,
    isoDate: `${target.getFullYear()}-${mm}-${dd}`
  };
}

function createDefaultPersonState(defaultGoalWeight) {
  return {
    waterByDate: {},
    mealsByDate: {},
    symptomsByDate: {},
    stepsByDate: {},
    sportLogsByDate: {},
    choicesByDay: {},
    streakDays: 1,
    completedDates: [],
    weightLogs: [],
    goalWeight: defaultGoalWeight,
    lastUpdated: Date.now()
  };
}

const DEFAULT_EXTENSIONS = {
  showVoiceAssistant: true,
  showDailyTotalsBox: false,
  showSwapDays: false,
  showPizzaGuide: false,
  showSymptomsTracker: false,
  showCycleTracker: false
};

let appState = {
  phoneOwner: null, // 'leonardo' | 'vitalucia' (scelto al 1° avvio o in Opzioni)
  activeProfile: 'leonardo',
  themeMode: 'light', // 'light' (Bianca Signorile) | 'dark' (Scura Notte)
  fontSizeScale: 'large', // 'normal' | 'large' | 'xlarge'
  cookTogetherDoseMode: false,
  widgetPinned: false,
  extensions: { ...DEFAULT_EXTENSIONS },
  snoozedPromptUntil: {},
  selectedDayIdx: getTodayDayIndex(),
  lastSyncedCalendarDate: getTodayDateStr(),
  dayOrder: [0, 1, 2, 3, 4, 5, 6],
  syncRoomCode: 'LEO-VITA-72021',
  alarmTone: 'energetic',
  mealTimes: { ...DEFAULT_MEAL_TIMES },
  saturdayPizzaChoice: 'ortolana',
  cycleTracker: {
    remembersLast: null,
    history: [],
    notifiedKeys: {}
  },
  shoppingViewMode: 'today_tomorrow',
  shoppingSelectedDay: getTodayDayIndex(),
  shoppingStatus: {},
  customShoppingItems: [],
  coupleChatMessages: [
    {
      id: 'welcome_v5',
      sender: 'Sistema',
      senderKey: 'system',
      text: '💑 Condivisione attiva! I messaggi qui arrivano con notifica e suono stile WhatsApp.',
      time: 'Oggi'
    }
  ],
  doctorNotes: [
    {
      id: 'doc_1',
      author: 'Dott. Pastoressa',
      text: 'Olio EVO sempre a crudo (15g Leonardo / 10g Vita Lucia a pasto), minimo 2 Litri di acqua al giorno.',
      date: '30/10/2026'
    }
  ],
  notifiedTodayKeys: {},
  people: {
    leonardo: createDefaultPersonState(78),
    vitalucia: createDefaultPersonState(62)
  }
};

let mqttClient = null;
let continuousAlarmInterval = null;
let activeAlarmContext = null;
let cookingTimerInterval = null;
let cookingTimerSecondsLeft = 0;
let pedometerActive = false;
let lastAccelMag = 0;
let lastStepTime = 0;
let waBannerTimeout = null;

// ============================================================================
// CARICAMENTO E SALVATAGGIO STATO
// ============================================================================
function loadState() {
  try {
    const raw =
      localStorage.getItem(STORAGE_KEY) ||
      localStorage.getItem('dieta_pastoressa_state_v3') ||
      localStorage.getItem('dieta_pastoressa_state_v2');
    if (raw) {
      const parsed = JSON.parse(raw);
      appState = {
        ...appState,
        ...parsed,
        extensions: { ...DEFAULT_EXTENSIONS, ...(parsed.extensions || {}) },
        dayOrder: Array.isArray(parsed.dayOrder) && parsed.dayOrder.length === 7 ? parsed.dayOrder : [0, 1, 2, 3, 4, 5, 6],
        mealTimes: { ...DEFAULT_MEAL_TIMES, ...(parsed.mealTimes || {}) },
        shoppingStatus: parsed.shoppingStatus || {},
        patients: parsed.patients || {},
        cycleTracker: {
          remembersLast: parsed.cycleTracker?.remembersLast ?? null,
          history: Array.isArray(parsed.cycleTracker?.history) ? parsed.cycleTracker.history : [],
          notifiedKeys: parsed.cycleTracker?.notifiedKeys || {}
        },
        coupleChatMessages: parsed.coupleChatMessages || appState.coupleChatMessages,
        doctorNotes: parsed.doctorNotes || appState.doctorNotes,
        people: {
          leonardo: { ...createDefaultPersonState(78), ...(parsed.people?.leonardo || {}) },
          vitalucia: { ...createDefaultPersonState(62), ...(parsed.people?.vitalucia || {}) },
          ...(parsed.people || {})
        }
      };
    }

    // Registra dinamicamente eventuali pazienti aggiunti da PDF in PROFILES
    if (appState.patients) {
      Object.keys(appState.patients).forEach((pId) => {
        const pat = appState.patients[pId];
        if (!PROFILES[pId]) {
          PROFILES[pId] = {
            id: pId,
            name: pat.name,
            shortName: pat.name.split(' ')[0],
            code: pat.code,
            gender: pat.gender,
            waterTargetMl: 2000,
            dailyOilGrams: pat.oilGrams || (pat.gender === 'F' ? 20 : 30),
            dailySaltMaxGrams: pat.saltGrams || 5,
            badgeColor: pat.gender === 'F' ? '#ec4899' : '#10b981'
          };
        }
        if (!appState.people[pId]) {
          appState.people[pId] = createDefaultPersonState(pat.initialWeight || (pat.gender === 'F' ? 62 : 78));
        }
      });
    }

    // Controlla parametri URL per accesso diretto paziente (?paziente= o ?p=)
    const urlParams = new URLSearchParams(window.location.search);
    const pParam = urlParams.get('paziente') || urlParams.get('p');
    if (pParam) {
      const cleanParam = pParam.toLowerCase().replace(/[^a-z0-9_-]/g, '');
      if (appState.patients && appState.patients[cleanParam]) {
        appState.phoneOwner = cleanParam;
        appState.activeProfile = cleanParam;
      } else if (cleanParam === 'leonardo' || cleanParam === 'vitalucia') {
        appState.phoneOwner = cleanParam;
        appState.activeProfile = cleanParam;
      }
    }

    if (appState.phoneOwner) {
      appState.activeProfile = appState.phoneOwner;
    }
    // Regola ferrea: se il paziente è Uomo (M), il calendario ciclo è sempre disattivato e nascosto
    const currentGender = PROFILES[getPrimaryPersonKey()]?.gender || 'M';
    if (currentGender === 'M' || getPrimaryPersonKey() === 'leonardo') {
      appState.extensions.showCycleTracker = false;
    }
  } catch (e) {
    console.warn('Load state error:', e);
  }
}

function saveState(broadcast = true) {
  try {
    const pk = getPrimaryPersonKey();
    if (!appState.people[pk]) appState.people[pk] = createDefaultPersonState(75);
    appState.people[pk].lastUpdated = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    if (broadcast) {
      broadcastSyncState();
    }
    if (appState.widgetPinned) {
      updateSystemNotificationWidget(true);
    }
  } catch (e) {}
}

function getPrimaryPersonKey() {
  return appState.phoneOwner || appState.activeProfile || 'leonardo';
}

function getPartnerPersonKey() {
  return getPrimaryPersonKey() === 'leonardo' ? 'vitalucia' : 'leonardo';
}

function getEffectiveDietDay(slotIdx) {
  const pk = getPrimaryPersonKey();
  const pat = appState.patients?.[pk];
  const source = (pat && pat.dietWeek && pat.dietWeek.length === 7) ? pat.dietWeek : WEEKLY_DIET;
  const mappedIdx = appState.dayOrder[slotIdx] ?? slotIdx;
  return source[mappedIdx] || source[0] || WEEKLY_DIET[0];
}

// ============================================================================
// INIZIALIZZAZIONE E GESTIONE AZIONI DAL WIDGET / NOTIFICHE
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  loadState();

  const todayIdx = getTodayDayIndex();
  appState.selectedDayIdx = todayIdx;
  appState.shoppingSelectedDay = todayIdx;
  appState.lastSyncedCalendarDate = getTodayDateStr();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      try { reg.update(); } catch (e) {}
    }).catch(() => {});
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (!event.data) return;
      if (event.data.type === 'WIDGET_ACTION_WATER') {
        addWater(250);
      } else if (event.data.type === 'WIDGET_ACTION_MEAL') {
        const q = getCurrentSmartQuestion();
        if (q && q.mealKey) confirmSmartQuestionMeal(q.mealKey);
      } else if (event.data.type === 'OPEN_CHAT_TAB') {
        switchTab('progressi');
      }
    });
  }

  // Controlla se l'app è stata aperta da una scorciatoia Widget
  const params = new URLSearchParams(window.location.search);
  if (params.get('tab')) {
    setTimeout(() => switchTab(params.get('tab')), 200);
  }
  if (params.get('quickWater') === '1') {
    setTimeout(() => addWater(250), 300);
  }
  if (params.get('admin') === '1') {
    setTimeout(() => openAdminStudioModal(), 350);
  }

  initMealTimeInputs();
  initSwapSelectors();
  initSportSelectors();
  applyThemeAndFontScale();
  renderAll();

  // Se non è ancora stato scelto di chi è questo telefono, mostra la scelta iniziale
  if (!appState.phoneOwner) {
    document.getElementById('ownerSetupModal')?.classList.remove('hidden');
  }

  // Verifica se mostrare banner installazione rapida su iPhone se non ancora installata
  const isIosDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isStandaloneMode = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isIosDevice && !isStandaloneMode && !localStorage.getItem('dieta_pwa_install_dismissed')) {
    document.getElementById('oneTapInstallBanner')?.classList.remove('hidden');
  }

  initRealtimeSync();
  startNotificationAndCalendarScheduler();
});

// ============================================================================
// GESTIONE INSTALLAZIONE RAPIDA 1-TOCCO (PWA / ANDROID / IOS)
// ============================================================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (!isStandalone && !localStorage.getItem('dieta_pwa_install_dismissed')) {
    document.getElementById('oneTapInstallBanner')?.classList.remove('hidden');
  }
});

window.addEventListener('appinstalled', () => {
  deferredInstallPrompt = null;
  document.getElementById('oneTapInstallBanner')?.classList.add('hidden');
  showToast('🎉 App installata con successo sulla schermata Home!');
});

function triggerPwaInstall() {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIos) {
    document.getElementById('iosInstallModal')?.classList.remove('hidden');
    return;
  }

  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        document.getElementById('oneTapInstallBanner')?.classList.add('hidden');
        showToast('📲 Installazione avviata!');
      }
      deferredInstallPrompt = null;
    });
  } else {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    if (isStandalone) {
      showToast('✅ L\'app è già installata sul tuo telefono!');
    } else {
      showToast('💡 Tocca i 3 puntini ⋮ in alto nel browser e seleziona "Installa applicazione"');
    }
  }
}

function dismissInstallBanner() {
  document.getElementById('oneTapInstallBanner')?.classList.add('hidden');
  localStorage.setItem('dieta_pwa_install_dismissed', '1');
}

// ============================================================================
// 1. IDENTITÀ PERSONALE TELEFONO, TEMA VISIVO E MENU ⚙️ OPZIONI
// ============================================================================
function selectPhoneOwner(ownerKey) {
  appState.phoneOwner = ownerKey;
  appState.activeProfile = ownerKey;
  if (ownerKey === 'leonardo') {
    appState.extensions.showCycleTracker = false;
  }
  document.getElementById('ownerSetupModal')?.classList.add('hidden');
  saveState(false);
  renderAll();
  const profile = PROFILES[ownerKey];
  showToast(`✅ App configurata personalmente per ${profile.shortName}!`);
}

function openOptionsModal() {
  syncOptionsModalControls();
  document.getElementById('optionsModal')?.classList.remove('hidden');
}

function closeOptionsModal() {
  document.getElementById('optionsModal')?.classList.add('hidden');
}

function syncOptionsModalControls() {
  const pk = getPrimaryPersonKey();
  const isLight = appState.themeMode === 'light';
  document.getElementById('optThemeLightBtn')?.classList.toggle('active', isLight);
  document.getElementById('optThemeDarkBtn')?.classList.toggle('active', !isLight);

  const scale = appState.fontSizeScale || 'large';
  document.getElementById('optFontNormalBtn')?.classList.toggle('active', scale === 'normal');
  document.getElementById('optFontLargeBtn')?.classList.toggle('active', scale === 'large');
  document.getElementById('optFontXlargeBtn')?.classList.toggle('active', scale === 'xlarge');

  document.getElementById('optOwnerLeoBtn')?.classList.toggle('active', pk === 'leonardo');
  document.getElementById('optOwnerVitaBtn')?.classList.toggle('active', pk === 'vitalucia');

  const chkCook = document.getElementById('chkCookTogether');
  if (chkCook) chkCook.checked = !!appState.cookTogetherDoseMode;

  const ext = appState.extensions || DEFAULT_EXTENSIONS;
  const mapChk = {
    chkExtVoice: 'showVoiceAssistant',
    chkExtTotals: 'showDailyTotalsBox',
    chkExtSwap: 'showSwapDays',
    chkExtPizza: 'showPizzaGuide',
    chkExtSymptoms: 'showSymptomsTracker',
    chkExtCycle: 'showCycleTracker'
  };
  Object.entries(mapChk).forEach(([id, key]) => {
    const el = document.getElementById(id);
    if (el) el.checked = !!ext[key];
  });

  // Nascondi completamente l'opzione Calendario Ciclo se il telefono appartiene a Leonardo (Uomo)
  const cycleRow = document.getElementById('extCycleTrackerRow');
  if (cycleRow) {
    cycleRow.classList.toggle('hidden', pk === 'leonardo');
  }
}

function applyThemeAndFontScale() {
  const mode = appState.themeMode || 'light';
  document.body.classList.toggle('theme-light', mode === 'light');
  document.body.classList.toggle('theme-dark', mode === 'dark');

  const scale = appState.fontSizeScale || 'large';
  document.body.classList.remove('font-scale-normal', 'font-scale-large', 'font-scale-xlarge');
  document.body.classList.add(`font-scale-${scale}`);

  const btn = document.getElementById('themeToggleBtn');
  if (btn) {
    btn.textContent = mode === 'light' ? '🌙' : '☀️';
  }
}

function setThemeMode(mode) {
  appState.themeMode = mode;
  applyThemeAndFontScale();
  syncOptionsModalControls();
  saveState(false);
  renderSelfEsteemAndWeightTab();
  showToast(mode === 'light' ? '☀️ Modalità Bianca Signorile attiva' : '🌙 Modalità Scura Notte attiva');
}

function toggleThemeMode() {
  setThemeMode(appState.themeMode === 'light' ? 'dark' : 'light');
}

function setFontSizeScale(scale) {
  appState.fontSizeScale = scale;
  applyThemeAndFontScale();
  syncOptionsModalControls();
  saveState(false);
  showToast('🔍 Grandezza del testo aggiornata!');
}

function toggleCookTogetherMode(checked) {
  appState.cookTogetherDoseMode = !!checked;
  saveState(false);
  renderAll();
  showToast(checked ? '🍲 Dosi "Pentola per 2" attivate nei pasti!' : '👤 Mostro solo le tue dosi personali.');
}

function toggleExtension(extKey, checked) {
  if (!appState.extensions) appState.extensions = { ...DEFAULT_EXTENSIONS };
  if (extKey === 'showCycleTracker' && getPrimaryPersonKey() === 'leonardo') {
    appState.extensions.showCycleTracker = false;
    return;
  }
  appState.extensions[extKey] = !!checked;
  saveState(false);
  renderAll();
}

function switchTab(tabId) {
  document.querySelectorAll('.tab-view').forEach((el) => el.classList.add('hidden'));
  document.getElementById(`tab-${tabId}`)?.classList.remove('hidden');
  document.querySelectorAll('.nav-tab').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function selectDay(idx) {
  appState.selectedDayIdx = idx;
  renderDaySelector();
  renderDailyTotalsRigorousBox();
  renderTodayMeals();
}

function jumpToRealToday() {
  const todayIdx = getTodayDayIndex();
  appState.selectedDayIdx = todayIdx;
  appState.shoppingSelectedDay = todayIdx;
  renderAll();
  showToast(`📅 Posizionato su Oggi (${getCalendarDateForSlot(todayIdx).fullDate})`);
}

// ============================================================================
// RENDER GENERALE
// ============================================================================
function renderAll() {
  const pk = getPrimaryPersonKey();
  const myProfile = PROFILES[pk];
  const todayIdx = getTodayDayIndex();
  const todayCal = getCalendarDateForSlot(todayIdx);

  const avatarEl = document.getElementById('ownerHeaderAvatar');
  const titleEl = document.getElementById('ownerHeaderTitle');
  const calEl = document.getElementById('liveCalendarHeaderText');

  if (avatarEl) avatarEl.textContent = pk === 'vitalucia' ? '👩🏻' : '👨🏻';
  if (titleEl) titleEl.textContent = `Piano di ${myProfile.shortName}`;
  if (calEl) calEl.textContent = `📅 ${todayCal.fullDate}`;

  const syncInput = document.getElementById('coupleSyncCodeInput');
  if (syncInput && document.activeElement !== syncInput) {
    syncInput.value = appState.syncRoomCode;
  }

  const swapToggleBtn = document.getElementById('swapDaysToggleBtn');
  if (swapToggleBtn) {
    swapToggleBtn.classList.toggle('hidden', !appState.extensions?.showSwapDays);
  }

  renderLiveControlWidget();
  renderSmartTimeQuestionCard();
  renderQuickDailyCheckStrip();
  renderDaySelector();
  renderDailyTotalsRigorousBox();
  renderTodayMeals();
  renderWaterTab();
  renderShoppingTab();
  renderSelfEsteemAndWeightTab();
  renderSportTab();
  renderChatAndDoctorTab();
  syncOptionsModalControls();
}

// ============================================================================
// 2. WIDGET CONTROLLO TOTALE SEMPRE ATTIVO (In-App + Barra Notifiche Telefono)
// ============================================================================
function renderLiveControlWidget() {
  const pk = getPrimaryPersonKey();
  const myProfile = PROFILES[pk];
  const myData = appState.people[pk];
  const partnerKey = getPartnerPersonKey();
  const partnerProfile = PROFILES[partnerKey];
  const partnerData = appState.people[partnerKey];
  const today = getTodayDateStr();

  const myMealsDone = Object.values(myData.mealsByDate[today] || {}).filter(Boolean).length;
  const myWaterMl = myData.waterByDate[today] || 0;
  const myWaterL = (myWaterMl / 1000).toFixed(1);

  document.getElementById('lwOwnerSummary').textContent = `Controllo Oggi • ${myProfile.shortName}`;
  document.getElementById('lwMealsVal').textContent = `${myMealsDone} / 5`;
  document.getElementById('lwMealsBar').style.width = `${Math.round((myMealsDone / 5) * 100)}%`;

  document.getElementById('lwWaterVal').textContent = `${myWaterL} / 2.0 L`;
  document.getElementById('lwWaterBar').style.width = `${Math.min(100, Math.round((myWaterMl / 2000) * 100))}%`;

  const nextInfo = getNextScheduledMealInfo();
  document.getElementById('lwNextVal').textContent = nextInfo.timeStr;
  document.getElementById('lwNextLbl').textContent = nextInfo.label;

  // Stato Condiviso del Partner (Sola lettura, zero confusione)
  const pWaterL = ((partnerData.waterByDate[today] || 0) / 1000).toFixed(1);
  const pMeals = Object.values(partnerData.mealsByDate[today] || {}).filter(Boolean).length;

  document.getElementById('partnerAvatar').textContent = partnerKey === 'vitalucia' ? '👩🏻' : '👨🏻';
  document.getElementById('partnerNameLabel').textContent = `${partnerProfile.shortName} oggi:`;
  document.getElementById('partnerStatsInline').textContent = `✅ ${pMeals}/5 pasti • 💧 ${pWaterL}L acqua`;
}

function getNextScheduledMealInfo() {
  const now = new Date();
  const curMins = now.getHours() * 60 + now.getMinutes();
  const order = [
    { key: 'colazione', label: '☕ Colazione' },
    { key: 'spuntino', label: '🥜 Spuntino' },
    { key: 'pranzo', label: '🍝 Pranzo' },
    { key: 'merenda', label: '🍎 Merenda' },
    { key: 'cena', label: '🍗 Cena' }
  ];
  for (const m of order) {
    const tStr = appState.mealTimes[m.key] || DEFAULT_MEAL_TIMES[m.key];
    const [hh, mm] = tStr.split(':').map(Number);
    if (hh * 60 + mm >= curMins) {
      return { timeStr: tStr, label: m.label, key: m.key };
    }
  }
  return { timeStr: 'Domani', label: '✨ Fine Giornata', key: null };
}

async function pinSystemNotificationWidget() {
  if ('Notification' in window && Notification.permission !== 'granted') {
    await Notification.requestPermission();
  }
  appState.widgetPinned = true;
  saveState(false);
  await updateSystemNotificationWidget(false);
}

async function updateSystemNotificationWidget(silent = true) {
  if (!('serviceWorker' in navigator) || !('Notification' in window) || Notification.permission !== 'granted') {
    if (!silent) showToast('🔔 Attiva i permessi notifiche per fissare il Widget sulla barra del telefono!');
    return;
  }
  try {
    const pk = getPrimaryPersonKey();
    const myProfile = PROFILES[pk];
    const myData = appState.people[pk];
    const partnerKey = getPartnerPersonKey();
    const partnerProfile = PROFILES[partnerKey];
    const partnerData = appState.people[partnerKey];
    const today = getTodayDateStr();

    const myMeals = Object.values(myData.mealsByDate[today] || {}).filter(Boolean).length;
    const myWater = myData.waterByDate[today] || 0;
    const pMeals = Object.values(partnerData.mealsByDate[today] || {}).filter(Boolean).length;
    const pWater = partnerData.waterByDate[today] || 0;
    const nextInfo = getNextScheduledMealInfo();

    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(`🥗 Widget ${myProfile.shortName}: ${myMeals}/5 Pasti • 💧 ${myWater}/2000ml`, {
      body: `Prossimo: ${nextInfo.label} (${nextInfo.timeStr}) | ${partnerProfile.shortName}: ${pMeals}/5 pasti, ${pWater}ml`,
      icon: './icon-192.png',
      badge: './icon-192.png',
      tag: 'dieta-live-widget',
      renotify: false,
      silent: true,
      requireInteraction: true,
      actions: [
        { action: 'mark_meal', title: '✅ Segna Pasto' },
        { action: 'add_water', title: '💧 +1 Bicchiere' }
      ]
    });
    if (!silent) {
      showToast('📌 Widget fissato sulla barra notifiche e schermata di blocco del telefono!');
    }
  } catch (e) {
    if (!silent) showToast('📌 Widget attivo in cima alla schermata!');
  }
}

// ============================================================================
// 3. DOMANDA INTERATTIVA DELL'ORA ("Ore 09:00: hai fatto Colazione? SÌ / NO")
//    + BARRA RAPIDA 1-TOCCO
// ============================================================================
function getCurrentSmartQuestion() {
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();

  if (mins >= 6 * 60 && mins < 10 * 60 + 45) {
    return { mealKey: 'colazione', icon: '☕', label: 'Colazione' };
  }
  if (mins >= 10 * 60 + 45 && mins < 12 * 60 + 45) {
    return { mealKey: 'spuntino', icon: '🥜', label: 'lo Spuntino di Mattina' };
  }
  if (mins >= 12 * 60 + 45 && mins < 16 * 60 + 15) {
    return { mealKey: 'pranzo', icon: '🍝', label: 'Pranzo' };
  }
  if (mins >= 16 * 60 + 15 && mins < 19 * 60 + 15) {
    return { mealKey: 'merenda', icon: '🍎', label: 'la Merenda del Pomeriggio' };
  }
  return { mealKey: 'cena', icon: '🍗', label: 'Cena' };
}

function renderSmartTimeQuestionCard() {
  const box = document.getElementById('smartTimeQuestionCard');
  if (!box) return;

  const pk = getPrimaryPersonKey();
  const person = appState.people[pk];
  const today = getTodayDateStr();
  const todayMeals = person.mealsByDate[today] || {};
  const todayWater = person.waterByDate[today] || 0;
  const curHM = getCurrentTimeHM();

  const q = getCurrentSmartQuestion();
  const isMealDone = !!todayMeals[q.mealKey];
  const snoozeKey = `${today}_${q.mealKey}`;
  const isSnoozed = (appState.snoozedPromptUntil?.[snoozeKey] || 0) > Date.now();

  const todayDiet = getEffectiveDietDay(getTodayDayIndex());
  const mealObj = todayDiet.meals[q.mealKey];

  // Costruisci l'anteprima rapida di cosa prevede quel pasto per il proprietario del telefono
  const previewParts = mealObj.items.map((it, idx) => {
    let label = it.name;
    let grams = pk === 'leonardo' ? it.leo : it.vita;
    let unit = it.unit || 'g';
    if (it.isChoice) {
      const cKey = `${todayDiet.dayId}_${q.mealKey}_${idx}`;
      const opt = it.options[person.choicesByDay[cKey] || 0] || it.options[0];
      label = opt.label;
      grams = pk === 'leonardo' ? opt.leo : opt.vita;
      unit = opt.unit || 'g';
    }
    return grams > 0 ? `${label} (${grams}${unit})` : null;
  }).filter(Boolean);

  if (!isMealDone && !isSnoozed) {
    box.innerHTML = `
      <div class="sq-top-badge">⏰ DOMANDA RAPIDA DELL'ORA (${curHM})</div>
      <h2 class="sq-question-title">${q.icon} Hai fatto ${q.label}?</h2>
      <p class="sq-question-sub">
        <b>Il tuo piano prevede:</b> ${previewParts.join(' + ')}
      </p>
      <div class="sq-buttons-row">
        <button class="btn-yes-large" onclick="confirmSmartQuestionMeal('${q.mealKey}')">
          ✅ SÌ, FATTO!
        </button>
        <button class="btn-no-large" onclick="snoozeSmartQuestion('${q.mealKey}')">
          ⏰ NON ANCORA
        </button>
      </div>
    `;
    return;
  }

  // Se il pasto dell'ora è già stato fatto, chiedi per il bicchiere d'acqua!
  if (todayWater < 2000) {
    box.innerHTML = `
      <div class="sq-top-badge">✅ ${q.label.toUpperCase()} REGISTRATO! • ORA IDRATAZIONE</div>
      <h2 class="sq-question-title">💧 Hai bevuto un bicchiere d'acqua?</h2>
      <p class="sq-question-sub">
        Sei a <b>${todayWater} ml su 2000 ml</b> (${Math.floor(todayWater / 250)}/8 bicchieri). Tocca SÌ per aggiungere subito +250 ml!
      </p>
      <div class="sq-buttons-row">
        <button class="btn-yes-large" onclick="addWater(250)">
          ✅ SÌ, +1 BICCHIERE (250ml)
        </button>
        <button class="btn-no-large" onclick="switchTab('acqua')">
          💧 Vedi Tabella Acqua
        </button>
      </div>
    `;
    return;
  }

  box.innerHTML = `
    <div class="sq-top-badge">🌟 GIORNATA ESEMPLARE</div>
    <h2 class="sq-question-title">✨ Sei perfettamente in pari per quest'ora!</h2>
    <p class="sq-question-sub" style="margin-bottom:0;">
      Pasto dell'ora e obiettivo 2 Litri d'acqua completati con successo.
    </p>
  `;
}

function confirmSmartQuestionMeal(mealKey) {
  const pk = getPrimaryPersonKey();
  const today = getTodayDateStr();
  if (!appState.people[pk].mealsByDate[today]) appState.people[pk].mealsByDate[today] = {};
  appState.people[pk].mealsByDate[today][mealKey] = true;

  const todayCount = Object.values(appState.people[pk].mealsByDate[today]).filter(Boolean).length;
  if (todayCount >= 3 && !appState.people[pk].completedDates.includes(today)) {
    appState.people[pk].completedDates.push(today);
  }
  appState.people[pk].streakDays = Math.max(1, appState.people[pk].completedDates.length);

  saveState(true);
  renderAll();
  showToast(`✅ Ottimo! Pasto spuntato automaticamente nei tuoi progressi di oggi!`);
}

function snoozeSmartQuestion(mealKey) {
  const today = getTodayDateStr();
  if (!appState.snoozedPromptUntil) appState.snoozedPromptUntil = {};
  appState.snoozedPromptUntil[`${today}_${mealKey}`] = Date.now() + 25 * 60 * 1000;
  saveState(false);
  renderSmartTimeQuestionCard();
  showToast('⏰ Promemoria posticipato: te lo richiederò tra 25 minuti!');
}

function renderQuickDailyCheckStrip() {
  const strip = document.getElementById('quickDailyCheckStrip');
  const sumLbl = document.getElementById('quickCheckSummaryLabel');
  if (!strip) return;

  const pk = getPrimaryPersonKey();
  const person = appState.people[pk];
  const today = getTodayDateStr();
  const checked = person.mealsByDate[today] || {};
  const waterMl = person.waterByDate[today] || 0;
  const doneCount = Object.values(checked).filter(Boolean).length;

  if (sumLbl) {
    sumLbl.textContent = `${doneCount}/5 pasti • ${(waterMl / 1000).toFixed(1)}/2L`;
  }

  const buttons = [
    { key: 'colazione', icon: '☕', lbl: 'Colaz.' },
    { key: 'spuntino', icon: '🥜', lbl: 'Spunt.' },
    { key: 'pranzo', icon: '🍝', lbl: 'Pranzo' },
    { key: 'merenda', icon: '🍎', lbl: 'Meren.' },
    { key: 'cena', icon: '🍗', lbl: 'Cena' }
  ];

  const mealsHtml = buttons.map((b) => {
    const isDone = !!checked[b.key];
    return `
      <button class="qc-chip-btn ${isDone ? 'done' : ''}" onclick="toggleMealCompleted('${today}', '${b.key}')">
        <span class="qc-icon">${isDone ? '✅' : b.icon}</span>
        <span class="qc-lbl">${b.lbl}</span>
      </button>
    `;
  }).join('');

  const waterDone = waterMl >= 2000;
  const waterBtnHtml = `
    <button class="qc-chip-btn ${waterDone ? 'done' : ''}" onclick="addWater(250)">
      <span class="qc-icon">💧</span>
      <span class="qc-lbl">+250ml</span>
    </button>
  `;

  strip.innerHTML = mealsHtml + waterBtnHtml;
}

// ============================================================================
// 4. CALENDARIO 7 GIORNI, PASTI GRANDI E PULITI & RICETTE A FISARMONICA
// ============================================================================
function initSwapSelectors() {
  const selA = document.getElementById('swapDayA');
  const selB = document.getElementById('swapDayB');
  if (!selA || !selB) return;
  const opts = CALENDAR_DAY_NAMES.map((name, i) => `<option value="${i}">${name} (${getCalendarDateForSlot(i).shortDate})</option>`).join('');
  selA.innerHTML = opts;
  selB.innerHTML = opts;
  selA.value = String(getTodayDayIndex());
  selB.value = String((getTodayDayIndex() + 1) % 7);
}

function toggleSwapDayBox() {
  document.getElementById('swapDaysPanel')?.classList.toggle('hidden');
}

function executeDaySwap() {
  const idxA = Number(document.getElementById('swapDayA').value);
  const idxB = Number(document.getElementById('swapDayB').value);
  if (idxA === idxB) {
    showToast('⚠️ Seleziona due giornate diverse!');
    return;
  }
  const tmp = appState.dayOrder[idxA];
  appState.dayOrder[idxA] = appState.dayOrder[idxB];
  appState.dayOrder[idxB] = tmp;

  saveState(true);
  renderAll();
  document.getElementById('swapDaysPanel')?.classList.add('hidden');
  showToast(`🔄 Giornate invertite: ${CALENDAR_DAY_NAMES[idxA]} ⇄ ${CALENDAR_DAY_NAMES[idxB]}`);
}

function resetDayOrder() {
  appState.dayOrder = [0, 1, 2, 3, 4, 5, 6];
  saveState(true);
  renderAll();
  document.getElementById('swapDaysPanel')?.classList.add('hidden');
  showToast('✅ Ordine originale ripristinato!');
}

function renderDaySelector() {
  const strip = document.getElementById('daySelectorStrip');
  if (!strip) return;
  const todayIdx = getTodayDayIndex();

  strip.innerHTML = CALENDAR_SHORT_NAMES.map((shortCal, slotIdx) => {
    const calInfo = getCalendarDateForSlot(slotIdx);
    const isToday = slotIdx === todayIdx;
    const isActive = slotIdx === appState.selectedDayIdx;
    return `
      <button class="day-pill ${isToday ? 'today' : ''} ${isActive ? 'active' : ''}" onclick="selectDay(${slotIdx})">
        <span class="day-short">${shortCal}</span>
        <span class="day-date-sub">${isToday ? 'OGGI' : calInfo.shortDate}</span>
      </button>
    `;
  }).join('');

  document.getElementById('jumpToTodayBtn')?.classList.toggle('hidden', appState.selectedDayIdx === todayIdx);
}

function renderDailyTotalsRigorousBox() {
  const box = document.getElementById('dailyTotalsRigorousBox');
  if (!box) return;

  if (!appState.extensions?.showDailyTotalsBox) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');

  const slotIdx = appState.selectedDayIdx;
  const dayObj = getEffectiveDietDay(slotIdx);
  const pk = getPrimaryPersonKey();
  const choices = appState.people[pk].choicesByDay || {};

  let oilG = 0;
  let breadG = 0;
  let vegFruitG = 0;

  ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'].forEach((mk) => {
    const meal = dayObj.meals[mk];
    meal.items.forEach((it, idx) => {
      let label = it.name;
      let g = pk === 'leonardo' ? (it.leo || 0) : (it.vita || 0);
      if (it.isChoice) {
        const cKey = `${dayObj.dayId}_${mk}_${idx}`;
        const opt = it.options[choices[cKey] || 0] || it.options[0];
        label = opt.label;
        g = pk === 'leonardo' ? (opt.leo || 0) : (opt.vita || 0);
      }
      const low = label.toLowerCase();
      if (low.includes('olio')) oilG += g;
      else if (low.includes('pane')) breadG += g;
      else if (it.shopCat === 'Ortofrutta' || low.includes('insalata') || low.includes('frutta') || low.includes('contorno')) {
        vegFruitG += g;
      }
    });
  });

  box.innerHTML = `
    <div class="card-section-title">⚖️ Totale Giornaliero Prescritto (${CALENDAR_DAY_NAMES[slotIdx]})</div>
    <div class="weight-summary-grid">
      <div class="weight-stat-box">
        <div class="val">${oilG} g</div>
        <div class="lbl">🫒 Olio EVO a crudo</div>
      </div>
      <div class="weight-stat-box">
        <div class="val">${breadG} g</div>
        <div class="lbl">🍞 Pane Integrale</div>
      </div>
      <div class="weight-stat-box">
        <div class="val">${vegFruitG} g</div>
        <div class="lbl">🥗 Verdura &amp; Frutta</div>
      </div>
    </div>
  `;
}

function renderTodayMeals() {
  const slotIdx = appState.selectedDayIdx;
  const calInfo = getCalendarDateForSlot(slotIdx);
  const dayObj = getEffectiveDietDay(slotIdx);
  const isSwapped = appState.dayOrder[slotIdx] !== slotIdx;
  const isToday = slotIdx === getTodayDayIndex();

  document.getElementById('currentDayTitle').textContent =
    `${calInfo.fullDate}${isToday ? ' • OGGI' : ''}${isSwapped ? ` (${dayObj.dayName})` : ''}`;
  document.getElementById('currentDayTheme').textContent = dayObj.theme;

  const nextInfo = getNextScheduledMealInfo();
  const cdBadge = document.getElementById('nextMealCountdown');
  if (cdBadge) cdBadge.textContent = `${nextInfo.label} (${nextInfo.timeStr})`;

  document.getElementById('prepTodayList').innerHTML = dayObj.prepToday.map((p) => `<li>${p}</li>`).join('');
  const tomorrowDayObj = getEffectiveDietDay((slotIdx + 1) % 7);
  document.getElementById('prepTomorrowBox').innerHTML =
    `🌙 <b>Stasera (${appState.mealTimes.prepSerale}) per Domani:</b> ${tomorrowDayObj.theme} — ${dayObj.prepTonightForTomorrow}`;

  const pk = getPrimaryPersonKey();
  const personData = appState.people[pk];
  const dateKey = calInfo.isoDate;
  const checkedMeals = personData.mealsByDate[dateKey] || {};
  const showVoice = !!appState.extensions?.showVoiceAssistant;

  const mealOrder = ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'];
  const container = document.getElementById('mealsContainer');
  window.currentMealVoiceScripts = {};

  container.innerHTML = mealOrder.map((mealKey) => {
    const meal = dayObj.meals[mealKey];
    const mealTime = appState.mealTimes[mealKey] || meal.defaultTime;
    const isDone = !!checkedMeals[mealKey];
    const resolvedItemsForRecipe = [];

    const itemsHtml = meal.items.map((item, itemIdx) => {
      if (item.isChoice) {
        const choiceKey = `${dayObj.dayId}_${mealKey}_${itemIdx}`;
        const selectedOptIdx = personData.choicesByDay[choiceKey] || 0;
        const chosenOpt = item.options[selectedOptIdx] || item.options[0];
        const myGrams = getFoodItemGrams(chosenOpt, pk);

        resolvedItemsForRecipe.push({
          label: chosenOpt.label,
          leo: chosenOpt.leo || myGrams,
          vita: chosenOpt.vita || myGrams,
          unit: chosenOpt.unit || 'g'
        });

        const optionsHtml = item.options.map((opt, oIdx) => {
          const g = getFoodItemGrams(opt, pk);
          return `<option value="${oIdx}" ${oIdx === Number(selectedOptIdx) ? 'selected' : ''}>${opt.label} (${g}${opt.unit || 'g'})</option>`;
        }).join('');

        return `
          <div class="food-row">
            <div class="food-row-top">
              <span class="food-name">🔄 ${chosenOpt.label}</span>
              <div class="food-dose-badges">${renderPersonalDoseBadges(chosenOpt, chosenOpt.label)}</div>
            </div>
            <select class="choice-select" onchange="updateFoodChoice('${choiceKey}', this.value)" aria-label="Cambia alternativa per ${item.name}">
              ${optionsHtml}
            </select>
          </div>
        `;
      } else {
        const myGrams = getFoodItemGrams(item, pk);
        if (!myGrams || myGrams <= 0) return '';

        resolvedItemsForRecipe.push({
          label: item.name,
          leo: item.leo || myGrams,
          vita: item.vita || myGrams,
          unit: item.unit || 'g'
        });

        return `
          <div class="food-row">
            <div class="food-row-top">
              <span class="food-name">${item.name}</span>
              <div class="food-dose-badges">${renderPersonalDoseBadges(item, item.name)}</div>
            </div>
          </div>
        `;
      }
    }).filter(Boolean).join('');

    // Genera la ricetta su misura per il proprietario del telefono (o pentola x2 se attivo)
    const recipeMode = appState.cookTogetherDoseMode ? 'coppia' : pk;
    const dynRecipe = generateDynamicMealRecipe(mealKey, resolvedItemsForRecipe, recipeMode);

    const itemsSpeech = resolvedItemsForRecipe.map((it) => {
      const g = pk === 'leonardo' ? it.leo : it.vita;
      if (!g || g <= 0) return '';
      const ck = getCookedEstimate(it.label, g);
      return `${it.label}: ${g} ${it.unit === 'ml' ? 'millilitri' : 'grammi'} a crudo${ck ? `, circa ${ck.cookedGrams} grammi da cotto` : ''}.`;
    }).filter(Boolean).join(' ');

    let voiceText = `${meal.title} delle ore ${mealTime}. Ingredienti: ${itemsSpeech} `;
    if (dynRecipe) {
      voiceText += dynRecipe.steps.map((s, i) => `Passo ${i + 1}: ${s.replace(/<[^>]*>/g, '')}`).join(' ');
      voiceText += ` ${dynRecipe.saltRule.replace(/<[^>]*>/g, '')}`;
    } else {
      voiceText += meal.prepTip;
    }
    window.currentMealVoiceScripts[mealKey] = { title: meal.title, text: voiceText };

    const safeTitle = dynRecipe ? dynRecipe.title.replace(/'/g, "\\'") : meal.title.replace(/'/g, "\\'");

    const accordionHtml = dynRecipe
      ? `
        <details class="recipe-accordion">
          <summary class="recipe-accordion-summary">
            <span>👨‍🍳 Ricetta Passo-Passo &amp; Timer (${dynRecipe.timerMins} min)</span>
            <span>▾</span>
          </summary>
          <div class="recipe-accordion-body">
            <div class="recipe-steps-list">
              ${dynRecipe.steps.map((s, idx) => `<div class="recipe-step-item"><b>${idx + 1}.</b> ${s}</div>`).join('')}
            </div>
            <div class="recipe-salt-rule">${dynRecipe.saltRule}</div>
            <div class="recipe-actions-bar">
              <button class="btn-secondary" onclick="startCookingTimer(${dynRecipe.timerMins}, '${safeTitle}')">
                ⏲️ Avvia Timer (${dynRecipe.timerMins} min)
              </button>
              ${showVoice ? `<button class="btn-secondary" onclick="speakKitchenMeal('${mealKey}')">🔊 Ascolta a Voce</button>` : ''}
            </div>
          </div>
        </details>
      `
      : `
        <details class="recipe-accordion">
          <summary class="recipe-accordion-summary">
            <span>💡 Consiglio di Preparazione</span>
            <span>▾</span>
          </summary>
          <div class="recipe-accordion-body" style="padding-top:10px;">
            <div>${meal.prepTip}</div>
            ${showVoice ? `<div class="recipe-actions-bar"><button class="btn-secondary" onclick="speakKitchenMeal('${mealKey}')">🔊 Ascolta a Voce</button></div>` : ''}
          </div>
        </details>
      `;

    return `
      <article class="meal-card ${isDone ? 'completed' : ''}">
        <div class="meal-header">
          <div class="meal-title-wrap">
            <div class="meal-icon-box">${meal.icon}</div>
            <div>
              <div class="meal-name">${meal.title}</div>
              <div class="meal-time-badge">⏰ Ore ${mealTime}</div>
            </div>
          </div>
          <button class="check-meal-btn" onclick="toggleMealCompleted('${dateKey}', '${mealKey}')">
            ${isDone ? '✅ Fatto' : '⬜ Segna Fatto'}
          </button>
        </div>
        <div class="food-list">${itemsHtml}</div>
        ${accordionHtml}
      </article>
    `;
  }).join('');

  renderSaturdayPizzaSmartBox();
  renderDailyClinicalTracker();
}

function getFoodItemGrams(item, pk) {
  if (!item) return 0;
  if (item[pk] !== undefined) return item[pk];
  if (pk === 'leonardo') return item.leo || 0;
  if (pk === 'vitalucia') return item.vita || 0;
  return item.grams || item.leo || item.vita || 0;
}

// Mostra SEMPRE solo la dose personale del proprietario del telefono (+ eventuale riga Pentola x2 se richiesta)
function renderPersonalDoseBadges(item, foodLabel) {
  const pk = getPrimaryPersonKey();
  const myGrams = getFoodItemGrams(item, pk);
  const unit = item.unit || 'g';
  if (!myGrams || myGrams <= 0) return '';

  const cooked = getCookedEstimate(foodLabel, myGrams);
  const cookedHtml = cooked ? `<span class="dose-pill dose-cooked">🍲 Cotto: ~${cooked.cookedGrams}g</span>` : '';

  let pot2Html = '';
  if (appState.cookTogetherDoseMode) {
    const totRaw = (item.leo || 0) + (item.vita || 0) || (myGrams * 2);
    const ckTot = getCookedEstimate(foodLabel, totRaw);
    pot2Html = `<span class="dose-pill dose-pot2">🍲 Pentola x2: ${totRaw}${unit}${ckTot ? ` (~${ckTot.cookedGrams}g cotti)` : ''}</span>`;
  }

  return `
    <span class="dose-pill dose-primary">⚖️ ${myGrams} ${unit}</span>
    ${cookedHtml}
    ${pot2Html}
  `;
}

function updateFoodChoice(choiceKey, optionIdx) {
  const pk = getPrimaryPersonKey();
  appState.people[pk].choicesByDay[choiceKey] = Number(optionIdx);
  saveState(true);
  renderAll();
  showToast('👨‍🍳 Scelta aggiornata in Ricetta e Lista della Spesa!');
}

function toggleMealCompleted(dateKey, mealKey) {
  const pk = getPrimaryPersonKey();
  const person = appState.people[pk];
  if (!person.mealsByDate[dateKey]) person.mealsByDate[dateKey] = {};
  person.mealsByDate[dateKey][mealKey] = !person.mealsByDate[dateKey][mealKey];

  const today = getTodayDateStr();
  const todayCount = Object.values(person.mealsByDate[today] || {}).filter(Boolean).length;
  if (todayCount >= 3 && !person.completedDates.includes(today)) {
    person.completedDates.push(today);
  }
  person.streakDays = Math.max(1, person.completedDates.length);

  saveState(true);
  renderAll();
}

// TIMER COTTURA & VOCE IN CUCINA
function startCookingTimer(mins, label) {
  if (cookingTimerInterval) clearInterval(cookingTimerInterval);
  cookingTimerSecondsLeft = Math.round(mins * 60);
  const bar = document.getElementById('cookingTimerBar');
  document.getElementById('cookingTimerLabel').textContent = label.slice(0, 20);
  bar.classList.remove('hidden');

  updateCookingTimerDisplay();
  showToast(`⏲️ Timer avviato (${mins} min)! Suonerà a fine cottura.`);

  cookingTimerInterval = setInterval(() => {
    cookingTimerSecondsLeft--;
    updateCookingTimerDisplay();
    if (cookingTimerSecondsLeft <= 0) {
      stopCookingTimer();
      triggerContinuousAlarm(
        `🍲 Cottura pronta: ${label}!`,
        `Spegni il fuoco e aggiungi l'Olio EVO a crudo!`,
        { type: 'cooking_done' }
      );
    }
  }, 1000);
}

function updateCookingTimerDisplay() {
  const m = String(Math.floor(cookingTimerSecondsLeft / 60)).padStart(2, '0');
  const s = String(cookingTimerSecondsLeft % 60).padStart(2, '0');
  const el = document.getElementById('cookingTimerCountdown');
  if (el) el.textContent = `${m}:${s}`;
}

function stopCookingTimer() {
  if (cookingTimerInterval) {
    clearInterval(cookingTimerInterval);
    cookingTimerInterval = null;
  }
  document.getElementById('cookingTimerBar')?.classList.add('hidden');
}

function speakKitchenMeal(mealKey) {
  const scriptObj = window.currentMealVoiceScripts?.[mealKey];
  if (!scriptObj) return;
  speakCustomText(scriptObj.title, scriptObj.text);
}

function speakCustomText(label, fullText) {
  if (!('speechSynthesis' in window)) {
    showToast('⚠️ Sintesi vocale non supportata su questo dispositivo.');
    return;
  }
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(fullText);
    utter.lang = 'it-IT';
    utter.rate = 0.98;
    const voices = window.speechSynthesis.getVoices();
    const itVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith('it'));
    if (itVoice) utter.voice = itVoice;

    document.getElementById('voiceAssistantLabel').textContent = label.slice(0, 22);
    document.getElementById('voiceAssistantBar')?.classList.remove('hidden');

    utter.onend = () => document.getElementById('voiceAssistantBar')?.classList.add('hidden');
    utter.onerror = () => document.getElementById('voiceAssistantBar')?.classList.add('hidden');

    window.speechSynthesis.speak(utter);
  } catch (e) {}
}

function stopKitchenVoice() {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  document.getElementById('voiceAssistantBar')?.classList.add('hidden');
}

// ============================================================================
// 5. ESTENSIONI OPZIONALI: PIZZA DEL SABATO & SINTOMI / CICLO (Solo Donna)
// ============================================================================
const PIZZA_SMART_OPTIONS = {
  ortolana: {
    name: '🍕 Pizza Ortolana / Verdure Grigliate (Consigliata)',
    extraWaterMl: 500,
    retentionEst: '+0,6 / +0,9 kg di soli liquidi temporanei',
    tip: 'Le fibre delle verdure rallentano l’assorbimento degli amidi e aiutano il drenaggio.'
  },
  marinara: {
    name: '🍕 Pizza Marinara / Napoli (Senza Latticini)',
    extraWaterMl: 500,
    retentionEst: '+0,4 / +0,7 kg di soli liquidi temporanei',
    tip: 'Senza mozzarella la digestione è rapidissima e la ritenzione del giorno dopo è minima.'
  },
  margherita: {
    name: '🍕 Pizza Margherita con Fiordilatte',
    extraWaterMl: 500,
    retentionEst: '+0,8 / +1,2 kg di soli liquidi temporanei',
    tip: 'Equilibrata e digeribile. Chiedi poco olio a crudo e bevi 2 bicchieri d’acqua prima di dormire.'
  },
  bresaola: {
    name: '🍕 Pizza Bresaola, Rucola e Scaglie di Grana',
    extraWaterMl: 600,
    retentionEst: '+0,9 / +1,3 kg di soli liquidi temporanei',
    tip: 'Proteica ma più sapida per via della bresaola: compensa con +600 ml d’acqua.'
  },
  capricciosa: {
    name: '🍕 Pizza Capricciosa / Diavola / 4 Formaggi',
    extraWaterMl: 750,
    retentionEst: '+1,1 / +1,6 kg di soli liquidi temporanei',
    tip: 'Più ricca di sodio: aggiungi 3 bicchieri d’acqua extra (+750 ml) e non pesarti domenica mattina!'
  }
};

function renderSaturdayPizzaSmartBox() {
  const box = document.getElementById('saturdayPizzaSmartBox');
  if (!box) return;
  if (!appState.extensions?.showPizzaGuide) {
    box.classList.add('hidden');
    return;
  }
  box.classList.remove('hidden');

  const chosenKey = appState.saturdayPizzaChoice || 'ortolana';
  const pInfo = PIZZA_SMART_OPTIONS[chosenKey] || PIZZA_SMART_OPTIONS.ortolana;
  const optsHtml = Object.entries(PIZZA_SMART_OPTIONS)
    .map(([k, o]) => `<option value="${k}" ${k === chosenKey ? 'selected' : ''}>${o.name}</option>`)
    .join('');

  box.innerHTML = `
    <div class="card-section-title">🍕 Guida Pizza del Sabato Sera</div>
    <select class="choice-select" onchange="updateSaturdayPizzaChoice(this.value)" style="margin-bottom:10px;">
      ${optsHtml}
    </select>
    <p class="card-helper-text">
      💡 <b>Consiglio:</b> ${pInfo.tip}<br/>
      🛡️ <b>Domenica mattina:</b> non pesarti! La pizza trattiene fisiologicamente <b>${pInfo.retentionEst}</b> di sola acqua per 24-36 ore.
    </p>
    <button class="btn-primary" style="width:100%;" onclick="addWater(${pInfo.extraWaterMl})">
      💧 Aggiungi +${pInfo.extraWaterMl} ml Acqua Drenante Post-Pizza
    </button>
  `;
}

function updateSaturdayPizzaChoice(val) {
  appState.saturdayPizzaChoice = val;
  saveState(true);
  renderSaturdayPizzaSmartBox();
}

function parseIsoDateLocal(isoStr) {
  if (!isoStr) return null;
  const [y, m, d] = isoStr.split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : null;
}

function formatIsoToIt(isoStr) {
  if (!isoStr) return '--';
  const p = isoStr.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : isoStr;
}

function diffDaysBetweenIso(isoStart, isoEnd) {
  const d1 = parseIsoDateLocal(isoStart);
  const d2 = parseIsoDateLocal(isoEnd);
  return d1 && d2 ? Math.round((d2.getTime() - d1.getTime()) / 86400000) : 0;
}

function addDaysToIso(isoStr, daysToAdd) {
  const d = parseIsoDateLocal(isoStr);
  if (!d) return null;
  d.setDate(d.getDate() + daysToAdd);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCycleAnalysis() {
  const tracker = appState.cycleTracker || { remembersLast: null, history: [] };
  const sorted = [...(tracker.history || [])]
    .filter((h) => h && h.startDate)
    .sort((a, b) => a.startDate.localeCompare(b.startDate));
  const todayIso = getTodayDateStr();

  if (sorted.length === 0) {
    return {
      hasData: false,
      remembersLast: tracker.remembersLast,
      activeCycle: null,
      regularityBadge: '⏳ In attesa del 1° inserimento',
      regularityDetail:
        tracker.remembersLast === false
          ? 'Hai scelto "Non mi ricordo": appena arriva il ciclo tocca "🩸 È Arrivato OGGI"!'
          : 'Indica se ricordi la data dell’ultimo ciclo oppure inizia dal prossimo.',
      avgCycleDays: 28,
      avgFlowDays: 5,
      nextPredictedIso: null,
      daysUntilNext: null,
      isPreCycleRetentionWindow: false,
      isDuringFlowToday: false,
      sortedHistory: []
    };
  }

  const lastEntry = sorted[sorted.length - 1];
  const activeCycle = !lastEntry.endDate ? lastEntry : null;

  const completedFlows = sorted
    .filter((h) => h.startDate && h.endDate)
    .map((h) => Math.max(1, diffDaysBetweenIso(h.startDate, h.endDate) + 1));
  const avgFlowDays = completedFlows.length
    ? Math.round(completedFlows.reduce((a, b) => a + b, 0) / completedFlows.length)
    : 5;

  const gaps = [];
  for (let i = 1; i < sorted.length; i++) {
    const g = diffDaysBetweenIso(sorted[i - 1].startDate, sorted[i].startDate);
    if (g >= 14 && g <= 65) gaps.push(g);
  }

  let avgCycleDays = 28;
  let regularityBadge = '📊 1° Ciclo Registrato (Base 28 gg)';
  let regularityDetail = 'Al prossimo ciclo registrato calcolerò se è Regolare o Irregolare.';

  if (gaps.length >= 1) {
    avgCycleDays = Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
    const minG = Math.min(...gaps);
    const maxG = Math.max(...gaps);
    const isReg = minG >= 24 && maxG <= 35 && maxG - minG <= 4;
    regularityBadge = isReg
      ? `✅ CICLO REGOLARE (Media ${avgCycleDays} gg)`
      : `⚠️ CICLO IRREGOLARE (Media ${avgCycleDays} gg • ${minG}–${maxG} gg)`;
    regularityDetail = isReg
      ? `Intervallo regolare (${minG}–${maxG} giorni).`
      : `Variazione rilevata tra ${minG} e ${maxG} giorni (inclusa nel Report per il Dottore).`;
  }

  const nextPredictedIso = addDaysToIso(lastEntry.startDate, avgCycleDays);
  const daysUntilNext = nextPredictedIso ? diffDaysBetweenIso(todayIso, nextPredictedIso) : null;
  const isDuringFlowToday =
    !!activeCycle || sorted.some((h) => h.startDate <= todayIso && h.endDate && todayIso <= h.endDate);
  const isPreCycleRetentionWindow =
    !isDuringFlowToday && daysUntilNext !== null && daysUntilNext >= -2 && daysUntilNext <= 4;

  return {
    hasData: true,
    remembersLast: tracker.remembersLast,
    activeCycle,
    regularityBadge,
    regularityDetail,
    avgCycleDays,
    avgFlowDays,
    nextPredictedIso,
    daysUntilNext,
    isPreCycleRetentionWindow,
    isDuringFlowToday,
    sortedHistory: sorted
  };
}

function renderDailyClinicalTracker() {
  const card = document.getElementById('dailyClinicalTrackerCard');
  if (!card) return;

  const pk = getPrimaryPersonKey();
  const showSym = !!appState.extensions?.showSymptomsTracker;
  // Il calendario ciclo può essere mostrato SOLO se il telefono è di Vita Lucia (Donna) E l'estensione è attiva
  const showCyc = pk === 'vitalucia' && !!appState.extensions?.showCycleTracker;

  if (!showSym && !showCyc) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');

  const calInfo = getCalendarDateForSlot(appState.selectedDayIdx);
  const dateKey = calInfo.isoDate;
  const person = appState.people[pk];
  if (!person.symptomsByDate) person.symptomsByDate = {};
  const todaySym = person.symptomsByDate[dateKey] || { energy: 'good', bloating: 'flat', sleep: 'rested' };

  let html = '';

  if (showSym) {
    html += `
      <div class="card-section-title">🩺 Diario Sintomi (${calInfo.shortDate})</div>
      <div style="display:flex; flex-direction:column; gap:10px; margin-bottom:${showCyc ? '16px' : '0'};">
        <div>
          <div style="font-size:0.84rem; font-weight:700; margin-bottom:5px;">⚡ Energia:</div>
          <div class="segmented-3">
            <button class="seg-btn ${todaySym.energy === 'low' ? 'active' : ''}" onclick="setDailySymptom('${dateKey}', 'energy', 'low')">🔋 Bassa</button>
            <button class="seg-btn ${todaySym.energy === 'good' ? 'active' : ''}" onclick="setDailySymptom('${dateKey}', 'energy', 'good')">⚡ Buona</button>
            <button class="seg-btn ${todaySym.energy === 'top' ? 'active' : ''}" onclick="setDailySymptom('${dateKey}', 'energy', 'top')">🚀 Top</button>
          </div>
        </div>
        <div>
          <div style="font-size:0.84rem; font-weight:700; margin-bottom:5px;">🎈 Pancia &amp; Digestione:</div>
          <div class="segmented-3">
            <button class="seg-btn ${todaySym.bloating === 'flat' ? 'active' : ''}" onclick="setDailySymptom('${dateKey}', 'bloating', 'flat')">✨ Piatta</button>
            <button class="seg-btn ${todaySym.bloating === 'mild' ? 'active' : ''}" onclick="setDailySymptom('${dateKey}', 'bloating', 'mild')">💨 Leggero</button>
            <button class="seg-btn ${todaySym.bloating === 'postmeal' ? 'active' : ''}" onclick="setDailySymptom('${dateKey}', 'bloating', 'postmeal')">🎈 Gonfiore</button>
          </div>
        </div>
      </div>
    `;
  }

  if (showCyc) {
    const cyc = getCycleAnalysis();
    html += `
      <div style="${showSym ? 'padding-top:14px; border-top:1px solid var(--border-subtle);' : ''}">
        <div class="card-section-title">🌸 Calendario Ciclo &amp; Regolarità</div>
        ${
          !cyc.hasData
            ? `
              <p class="card-helper-text">Ti ricordi quando è iniziato l'ultimo ciclo?</p>
              <div class="segmented-2" style="margin-bottom:10px;">
                <button class="seg-btn ${cyc.remembersLast === false ? 'active' : ''}" onclick="setCycleRemembersMode(false)">🤷🏻‍♀️ Non ricordo</button>
                <button class="seg-btn ${cyc.remembersLast === true ? 'active' : ''}" onclick="setCycleRemembersMode(true)">📅 Sì, inserisco data</button>
              </div>
              <p class="card-helper-text">${cyc.regularityDetail}</p>
            `
            : `
              <div class="prep-tomorrow" style="margin-bottom:10px;">
                <div><b>${cyc.regularityBadge}</b> (Flusso medio: ~${cyc.avgFlowDays} gg)</div>
                <div style="margin-top:3px;">📅 <b>Prossimo arrivo previsto:</b> ${formatIsoToIt(cyc.nextPredictedIso)} (${
                  cyc.daysUntilNext === 0 ? 'OGGI' : cyc.daysUntilNext > 0 ? `tra ${cyc.daysUntilNext} gg` : `${Math.abs(cyc.daysUntilNext)} gg fa`
                })</div>
                <div style="font-size:0.78rem; margin-top:2px;">${cyc.regularityDetail}</div>
              </div>
            `
        }
        <div class="segmented-2" style="margin-bottom:10px;">
          <button class="btn-primary" onclick="startCycleToday()">🩸 Iniziato OGGI (1° gg)</button>
          <button class="btn-secondary" onclick="endCycleToday()">🏁 Finito OGGI (Fine)</button>
        </div>
        <details class="recipe-accordion" style="margin-top:6px;">
          <summary class="recipe-accordion-summary">📅 Inserisci Date Manuali o Storico ▾</summary>
          <div class="recipe-accordion-body" style="padding-top:10px;">
            <div style="display:grid; grid-template-columns:1fr 1fr auto; gap:6px; align-items:end;">
              <div>
                <label style="font-size:0.72rem; font-weight:700;">1° Giorno Inizio</label>
                <input type="date" id="cycleManualStartInput" class="input-field" value="${cyc.activeCycle ? cyc.activeCycle.startDate : getTodayDateStr()}" />
              </div>
              <div>
                <label style="font-size:0.72rem; font-weight:700;">Giorno Fine</label>
                <input type="date" id="cycleManualEndInput" class="input-field" value="" />
              </div>
              <button class="btn-primary" onclick="saveManualCycleDates()">Salva</button>
            </div>
            <div style="margin-top:10px; display:flex; flex-direction:column; gap:6px;">
              ${cyc.sortedHistory.slice().reverse().slice(0, 4).map((h) => `
                <div class="time-row" style="font-size:0.8rem;">
                  <span>🩸 ${formatIsoToIt(h.startDate)} → ${h.endDate ? formatIsoToIt(h.endDate) : 'In corso'}</span>
                  <button onclick="deleteCycleHistoryItem('${h.id}')" style="background:none; border:none; color:var(--accent-rose); font-weight:800; cursor:pointer;">✕</button>
                </div>
              `).join('')}
            </div>
          </div>
        </details>
      </div>
    `;
  }

  card.innerHTML = html;
}

function setDailySymptom(dateKey, field, val) {
  const pk = getPrimaryPersonKey();
  if (!appState.people[pk].symptomsByDate) appState.people[pk].symptomsByDate = {};
  if (!appState.people[pk].symptomsByDate[dateKey]) {
    appState.people[pk].symptomsByDate[dateKey] = { energy: 'good', bloating: 'flat', sleep: 'rested' };
  }
  appState.people[pk].symptomsByDate[dateKey][field] = val;
  saveState(true);
  renderDailyClinicalTracker();
  showToast('🩺 Sintomo registrato!');
}

function setCycleRemembersMode(remembers) {
  appState.cycleTracker.remembersLast = remembers;
  saveState(true);
  renderDailyClinicalTracker();
}

function startCycleToday() {
  const todayIso = getTodayDateStr();
  const exists = appState.cycleTracker.history.find((h) => h.startDate === todayIso);
  if (exists) {
    showToast('🩸 Il 1° giorno di oggi è già registrato!');
    return;
  }
  appState.cycleTracker.remembersLast = true;
  appState.cycleTracker.history.push({ id: 'cyc_' + Date.now(), startDate: todayIso, endDate: null });
  saveState(true);
  renderAll();
  showToast('🩸 1° Giorno del Ciclo registrato!');
}

function endCycleToday() {
  const todayIso = getTodayDateStr();
  if (!appState.cycleTracker.history.length) {
    showToast('⚠️ Registra prima il 1° giorno di inizio!');
    return;
  }
  const sorted = appState.cycleTracker.history.slice().sort((a, b) => a.startDate.localeCompare(b.startDate));
  const last = sorted[sorted.length - 1];
  if (todayIso < last.startDate) return;
  last.endDate = todayIso;
  saveState(true);
  renderAll();
  showToast('🏁 Fine del ciclo registrata!');
}

function saveManualCycleDates() {
  const sVal = document.getElementById('cycleManualStartInput')?.value || '';
  const eVal = document.getElementById('cycleManualEndInput')?.value || '';
  if (!sVal) return;
  const existing = appState.cycleTracker.history.find((h) => h.startDate === sVal);
  if (existing) existing.endDate = eVal || existing.endDate || null;
  else appState.cycleTracker.history.push({ id: 'cyc_' + Date.now(), startDate: sVal, endDate: eVal || null });
  appState.cycleTracker.remembersLast = true;
  saveState(true);
  renderAll();
  showToast('🌸 Date del ciclo salvate!');
}

function deleteCycleHistoryItem(id) {
  appState.cycleTracker.history = appState.cycleTracker.history.filter((h) => h.id !== id);
  saveState(true);
  renderAll();
}

function checkApproachingCycleNotification() {
  if (getPrimaryPersonKey() !== 'vitalucia' || !appState.extensions?.showCycleTracker) return;
  const cyc = getCycleAnalysis();
  if (!cyc.hasData || !cyc.nextPredictedIso || cyc.daysUntilNext === null) return;
  const todayStr = getTodayDateStr();
  if (!appState.cycleTracker.notifiedKeys) appState.cycleTracker.notifiedKeys = {};
  if (cyc.daysUntilNext >= 0 && cyc.daysUntilNext <= 3) {
    const k = `cyc_${cyc.nextPredictedIso}_${todayStr}`;
    if (!appState.cycleTracker.notifiedKeys[k]) {
      appState.cycleTracker.notifiedKeys[k] = true;
      saveState(false);
      triggerContinuousAlarm(
        `🌸 Promemoria Ciclo in Arrivo (${formatIsoToIt(cyc.nextPredictedIso)})`,
        `Mancano ${cyc.daysUntilNext} giorni alla data stimata (${cyc.regularityBadge}). Ricorda di bere 2L d'acqua!`,
        { type: 'cycle_alert' }
      );
    }
  }
}

// ============================================================================
// 6. ACQUA 2L & SVEGLIE INTERATTIVE ("Hai fatto colazione? SÌ / NO")
// ============================================================================
function renderWaterTab() {
  const pk = getPrimaryPersonKey();
  const person = appState.people[pk];
  const today = getTodayDateStr();
  const currentMl = person.waterByDate[today] || 0;

  document.getElementById('waterBigDisplay').textContent = `${currentMl} / 2000 ml`;
  document.getElementById('waterMainProgressBar').style.width = `${Math.min(100, Math.round((currentMl / 2000) * 100))}%`;
  document.getElementById('waterStatusSub').innerHTML =
    currentMl >= 2000
      ? `🎉 <b>Obiettivo 2 Litri Raggiunto!</b>`
      : `Mancano <b>${2000 - currentMl} ml</b> (${Math.ceil((2000 - currentMl) / 250)} bicchieri)`;

  const glassesFilled = Math.floor(currentMl / 250);
  let gHtml = '';
  for (let i = 1; i <= 8; i++) {
    const filled = i <= glassesFilled;
    gHtml += `
      <button class="glass-btn ${filled ? 'filled' : ''}" onclick="setWaterGlasses(${i})">
        <span style="font-size:1.35rem;">${filled ? '💧' : '🥛'}</span>
        <span style="font-size:0.78rem; font-weight:800;">${i * 250}ml</span>
        <span style="font-size:0.66rem; opacity:0.8;">${WATER_SCHEDULE[i - 1]?.time || ''}</span>
      </button>
    `;
  }
  document.getElementById('glassesGrid').innerHTML = gHtml;
}

function addWater(deltaMl) {
  const pk = getPrimaryPersonKey();
  const today = getTodayDateStr();
  const next = Math.max(0, (appState.people[pk].waterByDate[today] || 0) + deltaMl);
  appState.people[pk].waterByDate[today] = next;
  saveState(true);
  renderAll();
  if (deltaMl > 0) showToast(`💧 +${deltaMl} ml registrati! Totale oggi: ${next} ml`);
}

function setWaterGlasses(glassIdx) {
  const pk = getPrimaryPersonKey();
  const today = getTodayDateStr();
  const target = glassIdx * 250;
  const cur = appState.people[pk].waterByDate[today] || 0;
  appState.people[pk].waterByDate[today] = cur === target ? target - 250 : target;
  saveState(true);
  renderAll();
}

function initMealTimeInputs() {
  Object.keys(DEFAULT_MEAL_TIMES).forEach((k) => {
    const el = document.getElementById(`time-${k}`);
    if (el) el.value = appState.mealTimes[k] || DEFAULT_MEAL_TIMES[k];
  });
  const toneSel = document.getElementById('alarmToneSelect');
  if (toneSel) toneSel.value = appState.alarmTone || 'energetic';
}

function saveMealTimes() {
  Object.keys(DEFAULT_MEAL_TIMES).forEach((k) => {
    const el = document.getElementById(`time-${k}`);
    if (el && el.value) appState.mealTimes[k] = el.value;
  });
  const toneSel = document.getElementById('alarmToneSelect');
  if (toneSel) appState.alarmTone = toneSel.value;
  saveState(false);
  renderAll();
  showToast('⏰ Orari domande e sveglie aggiornati!');
}

function playAlarmCycleSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const tone = appState.alarmTone || 'energetic';
    const notes = tone === 'urgent'
      ? [880, 880, 1046.5, 880]
      : tone === 'melody'
      ? [523.25, 659.25, 783.99, 1046.5]
      : [587.33, 783.99, 880, 1174.66];
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = tone === 'urgent' ? 'square' : 'triangle';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.22);
      gain.gain.setValueAtTime(0.24, ctx.currentTime + idx * 0.22);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.22 + 0.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.22);
      osc.stop(ctx.currentTime + idx * 0.22 + 0.2);
    });
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([350, 150, 350, 150, 400]);
}

// Suono Doppio Trillo Stile WhatsApp per i messaggi della Chat di Coppia!
function playWhatsAppChatSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const notes = [740, 1108.73]; // Fa#5 -> Do#6 (Tipico trillo cristallino da messaggistica)
    notes.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.13);
      gain.gain.setValueAtTime(0.32, ctx.currentTime + idx * 0.13);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + idx * 0.13 + 0.18);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(ctx.currentTime + idx * 0.13);
      osc.stop(ctx.currentTime + idx * 0.13 + 0.18);
    });
  } catch (e) {}
  if (navigator.vibrate) navigator.vibrate([220, 90, 250]);
}

function triggerContinuousAlarm(title, body, contextObj = null) {
  stopContinuousAlarm();
  activeAlarmContext = contextObj;

  document.getElementById('alarmModalTitle').textContent = title;
  document.getElementById('alarmModalBody').textContent = body;
  document.getElementById('continuousAlarmModal').classList.remove('hidden');

  playAlarmCycleSound();
  continuousAlarmInterval = setInterval(playAlarmCycleSound, 2500);

  if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(title, {
        body,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: 'dieta-step-alarm',
        renotify: true,
        requireInteraction: true,
        vibrate: [400, 150, 400, 150, 500],
        actions: [
          { action: 'mark_meal', title: '✅ SÌ, HO FATTO!' },
          { action: 'snooze', title: '⏰ Tra 15 min' }
        ]
      });
    }).catch(() => {});
  }
}

function stopContinuousAlarm() {
  if (continuousAlarmInterval) {
    clearInterval(continuousAlarmInterval);
    continuousAlarmInterval = null;
  }
  document.getElementById('continuousAlarmModal')?.classList.add('hidden');
}

function confirmActiveAlarmStep() {
  const ctx = activeAlarmContext;
  stopContinuousAlarm();
  if (ctx) {
    if (ctx.type === 'water') {
      addWater(250);
    } else if (ctx.type === 'meal' && ctx.mealKey) {
      confirmSmartQuestionMeal(ctx.mealKey);
    }
  } else {
    showToast('✅ Confermato!');
  }
  activeAlarmContext = null;
}

function snoozeActiveAlarm(mins) {
  const savedTitle = document.getElementById('alarmModalTitle').textContent;
  const savedBody = document.getElementById('alarmModalBody').textContent;
  const savedCtx = activeAlarmContext;
  stopContinuousAlarm();
  showToast(`⏰ Te lo richiederò tra ${mins} minuti!`);
  setTimeout(() => {
    triggerContinuousAlarm(savedTitle, savedBody, savedCtx);
  }, mins * 60 * 1000);
}

async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    showToast('🔔 Avvisi sonori e notifiche stile WhatsApp attivati!');
    pinSystemNotificationWidget();
  }
}

function startNotificationAndCalendarScheduler() {
  setInterval(() => {
    const todayStr = getTodayDateStr();
    if (appState.lastSyncedCalendarDate !== todayStr) {
      appState.lastSyncedCalendarDate = todayStr;
      const newTodayIdx = getTodayDayIndex();
      appState.selectedDayIdx = newTodayIdx;
      appState.shoppingSelectedDay = newTodayIdx;
      renderAll();
    }

    renderSmartTimeQuestionCard();
    const currentHM = getCurrentTimeHM();
    const dayObj = getEffectiveDietDay(getTodayDayIndex());
    const pk = getPrimaryPersonKey();
    const checkedToday = appState.people[pk].mealsByDate[todayStr] || {};

    ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'].forEach((mk) => {
      const targetTime = appState.mealTimes[mk];
      const notifId = `${todayStr}_meal_${mk}_${targetTime}`;
      if (targetTime === currentHM && !appState.notifiedTodayKeys[notifId] && !checkedToday[mk]) {
        appState.notifiedTodayKeys[notifId] = true;
        const meal = dayObj.meals[mk];
        triggerContinuousAlarm(
          `${meal.icon} Sono le ${targetTime}: hai fatto ${meal.title}?`,
          `Tocca "SÌ, HO FATTO!" per spuntare automaticamente il pasto in app!`,
          { type: 'meal', mealKey: mk }
        );
      }
    });

    WATER_SCHEDULE.forEach((ws) => {
      const wId = `${todayStr}_water_${ws.time}`;
      if (ws.time === currentHM && !appState.notifiedTodayKeys[wId]) {
        appState.notifiedTodayKeys[wId] = true;
        triggerContinuousAlarm(
          `💧 Sono le ${ws.time}: hai bevuto 1 bicchiere d'acqua?`,
          `Tocca "SÌ, HO FATTO!" per aggiungere subito +250 ml!`,
          { type: 'water' }
        );
      }
    });

    checkApproachingCycleNotification();
  }, 15000);
}

// ============================================================================
// 7. SPESA GIORNALIERA CONDIVISA COL CALENDARIO
// ============================================================================
function setShoppingViewMode(mode) {
  appState.shoppingViewMode = mode;
  document.getElementById('shopViewTodayBtn')?.classList.toggle('active', mode === 'today_tomorrow');
  document.getElementById('shopViewDayBtn')?.classList.toggle('active', mode === 'day');
  document.getElementById('shopViewCatBtn')?.classList.toggle('active', mode === 'category');
  renderShoppingTab();
}

function selectShoppingDayFilter(dayFilter) {
  appState.shoppingSelectedDay = dayFilter;
  renderShoppingTab();
}

function renderShoppingTab() {
  const todayIdx = getTodayDayIndex();
  const tomorrowIdx = (todayIdx + 1) % 7;
  const todayCal = getCalendarDateForSlot(todayIdx);
  const tomorrowCal = getCalendarDateForSlot(tomorrowIdx);

  const subEl = document.getElementById('shoppingCalendarSubtitle');
  if (subEl) {
    subEl.textContent = `Oggi (${todayCal.shortDate}) & Domani (${tomorrowCal.shortDate}) • Sincronizzata col Partner`;
  }

  const strip = document.getElementById('shopDayFilterStrip');
  const pk = getPrimaryPersonKey();
  const personChoices = appState.people[pk].choicesByDay || {};

  if (appState.shoppingViewMode === 'day') {
    strip.classList.remove('hidden');
    strip.innerHTML = CALENDAR_SHORT_NAMES.map((sh, idx) => {
      const cInfo = getCalendarDateForSlot(idx);
      return `
        <button class="day-pill ${appState.shoppingSelectedDay === idx ? 'active' : ''}" onclick="selectShoppingDayFilter(${idx})">
          <span class="day-short">${sh}</span>
          <span class="day-date-sub">${cInfo.shortDate}</span>
        </button>
      `;
    }).join('');
  } else {
    strip.classList.add('hidden');
  }

  const daySlots =
    appState.shoppingViewMode === 'today_tomorrow'
      ? [todayIdx, tomorrowIdx]
      : appState.shoppingViewMode === 'day'
      ? [Number(appState.shoppingSelectedDay) || todayIdx]
      : [0, 1, 2, 3, 4, 5, 6];

  const container = document.getElementById('shoppingContainer');
  let html = '';

  if ((appState.customShoppingItems || []).length > 0) {
    html += `
      <div class="card-surface">
        <div class="card-section-title">➕ Prodotti Extra Condivisi</div>
        ${appState.customShoppingItems.map((ci, idx) => renderShopItemRow(`custom_${idx}`, ci, 'Condiviso')).join('')}
      </div>
    `;
  }

  if (appState.shoppingViewMode === 'today_tomorrow' || appState.shoppingViewMode === 'day') {
    daySlots.forEach((slotIdx) => {
      const cInfo = getCalendarDateForSlot(slotIdx);
      const dietDay = getEffectiveDietDay(slotIdx);
      const isTodaySlot = slotIdx === todayIdx;
      const badgeTag = isTodaySlot ? '📍 OGGI' : slotIdx === tomorrowIdx ? '⏭️ DOMANI' : cInfo.shortDate;

      const dayItemsMap = {};
      ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'].forEach((mk) => {
        const meal = dietDay.meals[mk];
        meal.items.forEach((it, itemIdx) => {
          let label = it.name;
          let leoG = it.leo || 0;
          let vitaG = it.vita || 0;
          let unit = it.unit || 'g';
          if (it.isChoice) {
            const cKey = `${dietDay.dayId}_${mk}_${itemIdx}`;
            const opt = it.options[personChoices[cKey] || 0] || it.options[0];
            label = opt.label;
            leoG = opt.leo || 0;
            vitaG = opt.vita || 0;
            unit = opt.unit || 'g';
          }
          if (!dayItemsMap[label]) dayItemsMap[label] = { label, leo: 0, vita: 0, unit };
          dayItemsMap[label].leo += leoG;
          dayItemsMap[label].vita += vitaG;
        });
      });

      const rowsHtml = Object.values(dayItemsMap).map((entry) => {
        const myG = pk === 'leonardo' ? entry.leo : entry.vita;
        const qtyStr = appState.cookTogetherDoseMode
          ? `Tot Coppia: ${entry.leo + entry.vita}${entry.unit} (Tu: ${myG}${entry.unit})`
          : `Tua dose: ${myG}${entry.unit} (Coppia: ${entry.leo + entry.vita}${entry.unit})`;
        const itemKey = `day_${cInfo.isoDate}_${entry.label.replace(/\s+/g, '_')}`;
        return renderShopItemRow(itemKey, entry.label, qtyStr);
      }).join('');

      html += `
        <div class="card-surface">
          <div class="card-section-title">${badgeTag} — ${cInfo.fullDate}</div>
          ${rowsHtml}
        </div>
      `;
    });
  } else {
    const catMap = {};
    [0, 1, 2, 3, 4, 5, 6].forEach((slotIdx) => {
      const dietDay = getEffectiveDietDay(slotIdx);
      ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'].forEach((mk) => {
        const meal = dietDay.meals[mk];
        meal.items.forEach((it, itemIdx) => {
          const cat = it.shopCat || 'Dispensa';
          let label = it.name;
          let leoG = it.leo || 0;
          let vitaG = it.vita || 0;
          let unit = it.unit || 'g';
          if (it.isChoice) {
            const cKey = `${dietDay.dayId}_${mk}_${itemIdx}`;
            const opt = it.options[personChoices[cKey] || 0] || it.options[0];
            label = opt.label;
            leoG = opt.leo || 0;
            vitaG = opt.vita || 0;
            unit = opt.unit || 'g';
          }
          if (!catMap[cat]) catMap[cat] = {};
          if (!catMap[cat][label]) catMap[cat][label] = { label, leo: 0, vita: 0, unit };
          catMap[cat][label].leo += leoG;
          catMap[cat][label].vita += vitaG;
        });
      });
    });

    Object.keys(catMap).forEach((catName) => {
      const rowsHtml = Object.values(catMap[catName]).map((entry) => {
        const itemKey = `cat_${entry.label.replace(/\s+/g, '_')}`;
        return renderShopItemRow(itemKey, entry.label, `Tot Settimana Coppia: ${entry.leo + entry.vita}${entry.unit}`);
      }).join('');
      html += `
        <div class="card-surface">
          <div class="card-section-title">🏪 Reparto: ${catName}</div>
          ${rowsHtml}
        </div>
      `;
    });
  }

  container.innerHTML = html;
}

function renderShopItemRow(itemKey, labelHtml, qtyStr) {
  const st = appState.shoppingStatus[itemKey];
  const isBought = st?.status === 'bought';
  const isHome = st?.status === 'inhouse';
  const byWho = st?.by ? `<div style="font-size:0.74rem; color:var(--accent-emerald-text); margin-top:3px;">✔ Segnato da <b>${st.by}</b> (${st.time || ''})</div>` : '';

  return `
    <div class="shop-item ${isBought ? 'bought' : ''} ${isHome ? 'inhouse' : ''}">
      <div style="flex:1;">
        <div class="food-name" style="${isBought || isHome ? 'text-decoration:line-through;' : ''}">
          ${isBought ? '🛒 ' : isHome ? '🏠 ' : ''}${labelHtml}
        </div>
        <div style="font-size:0.8rem; color:var(--text-secondary); font-weight:600; margin-top:2px;">${qtyStr}</div>
        ${byWho}
      </div>
      <div style="display:flex; gap:6px; flex-shrink:0;">
        <button class="shop-action-btn ${isHome ? 'active-home' : ''}" onclick="setShopItemStatus('${itemKey}', 'inhouse')">🏠 Casa</button>
        <button class="shop-action-btn ${isBought ? 'active-bought' : ''}" onclick="setShopItemStatus('${itemKey}', 'bought')">🛒 Preso</button>
      </div>
    </div>
  `;
}

function setShopItemStatus(itemKey, statusType) {
  const pk = getPrimaryPersonKey();
  const myName = PROFILES[pk].shortName;
  const cur = appState.shoppingStatus[itemKey];
  if (cur && cur.status === statusType) {
    delete appState.shoppingStatus[itemKey];
  } else {
    appState.shoppingStatus[itemKey] = {
      status: statusType,
      by: myName,
      time: getCurrentTimeHM(),
      updatedAt: Date.now()
    };
  }
  saveState(true);
  renderShoppingTab();
}

function addCustomShopItem() {
  const inp = document.getElementById('customShopInput');
  const val = (inp.value || '').trim();
  if (!val) return;
  appState.customShoppingItems.push(val);
  inp.value = '';
  saveState(true);
  renderShoppingTab();
}

function resetShoppingList() {
  appState.shoppingStatus = {};
  appState.customShoppingItems = [];
  saveState(true);
  renderShoppingTab();
  showToast('🛒 Spunte della spesa azzerate!');
}

// ============================================================================
// 8. PERCORSO PESO, MOVIMENTO E CHAT STILE WHATSAPP CON IL PARTNER
// ============================================================================
function renderSelfEsteemAndWeightTab() {
  const pk = getPrimaryPersonKey();
  const profile = PROFILES[pk];
  const person = appState.people[pk];

  const goalInput = document.getElementById('goalWeightInput');
  if (goalInput && document.activeElement !== goalInput) {
    goalInput.value = person.goalWeight || '';
  }

  const logs = person.weightLogs || [];
  const startKg = logs.length > 0 ? logs[0].kg : null;
  const currentKg = logs.length > 0 ? logs[logs.length - 1].kg : null;
  const goalKg = person.goalWeight || (pk === 'leonardo' ? 78 : 62);
  const diffKg = startKg && currentKg ? (currentKg - startKg).toFixed(1) : '0.0';

  document.getElementById('journeyDaysBadge').textContent = `Giorno ${person.streakDays || 1}`;
  document.getElementById('wStartVal').textContent = startKg ? `${startKg} kg` : '-- kg';
  document.getElementById('wCurrentVal').textContent = currentKg ? `${currentKg} kg` : '-- kg';
  document.getElementById('wDiffVal').textContent = `${Number(diffKg) > 0 ? '+' : ''}${diffKg} kg`;

  const quoteEl = document.getElementById('selfEsteemMotivationQuote');
  if (Number(diffKg) < 0) {
    quoteEl.textContent = `"Complimenti ${profile.shortName}! Sei già sceso/a di ${Math.abs(Number(diffKg))} kg rispetto all'inizio (${startKg} kg → ${currentKg} kg)."`;
  }

  const leoLogs = appState.people.leonardo.weightLogs || [];
  const vitaLogs = appState.people.vitalucia.weightLogs || [];
  const leoDelta = leoLogs.length >= 2 ? leoLogs[leoLogs.length - 1].kg - leoLogs[0].kg : 0;
  const vitaDelta = vitaLogs.length >= 2 ? vitaLogs[vitaLogs.length - 1].kg - vitaLogs[0].kg : 0;
  const totalLostCouple = Math.abs(Math.min(0, leoDelta) + Math.min(0, vitaDelta)).toFixed(1);

  document.getElementById('coupleTotalLostDisplay').textContent = `-${totalLostCouple} kg insieme 🎉`;
  document.getElementById('coupleComparisonRow').innerHTML = `
    <div class="weight-stat-box">
      <div class="lbl">👨🏻 Leonardo</div>
      <div class="val" style="font-size:0.95rem;">${leoLogs.length > 0 ? `${leoLogs[0].kg} → ${leoLogs[leoLogs.length - 1].kg} kg` : 'In attesa'}</div>
    </div>
    <div class="weight-stat-box">
      <div class="lbl">👩🏻 Vita Lucia</div>
      <div class="val" style="font-size:0.95rem;">${vitaLogs.length > 0 ? `${vitaLogs[0].kg} → ${vitaLogs[vitaLogs.length - 1].kg} kg` : 'In attesa'}</div>
    </div>
  `;

  renderWeightSvgChart(logs, goalKg);

  const histEl = document.getElementById('weightHistoryList');
  histEl.innerHTML = logs.slice().reverse().slice(0, 6).map((entry, idx) => `
    <div class="time-row">
      <span>${idx === logs.length - 1 ? '🏁 Inizio' : '📅 Check'} (${entry.date})</span>
      <div>
        <strong style="margin-right:8px;">${entry.kg} kg</strong>
        <button onclick="deleteWeightLog(${logs.length - 1 - idx})" style="background:none; border:none; color:var(--accent-rose); font-weight:800; cursor:pointer;">✕</button>
      </div>
    </div>
  `).join('');
}

function renderWeightSvgChart(logs, goalWeight) {
  const box = document.getElementById('weightChartBox');
  if (!box) return;
  if (!logs || logs.length < 2) {
    box.innerHTML = '';
    return;
  }
  const vals = logs.map((l) => l.kg);
  if (goalWeight) vals.push(Number(goalWeight));
  const minV = Math.min(...vals) - 1;
  const maxV = Math.max(...vals) + 1;
  const w = 440;
  const h = 115;

  const pts = logs.map((l, i) => {
    const x = 28 + (i / (logs.length - 1)) * (w - 56);
    const y = h - 22 - ((l.kg - minV) / (maxV - minV || 1)) * (h - 44);
    return { x, y, kg: l.kg };
  });

  const isLight = appState.themeMode === 'light';
  const svgBg = isLight ? '#f8f6f0' : '#0b101b';
  const txtCol = isLight ? '#141c24' : '#f8fafc';
  const strokeCol = '#0f766e';

  box.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" style="width:100%; height:auto; background:${svgBg}; border-radius:12px; border:1px solid var(--border-subtle);">
      <polyline fill="none" stroke="${strokeCol}" stroke-width="3" stroke-linecap="round" points="${pts.map((p) => `${p.x},${p.y}`).join(' ')}" />
      ${pts.map((p) => `<circle cx="${p.x}" cy="${p.y}" r="4.5" fill="${strokeCol}" stroke="#fff" stroke-width="1.5"/><text x="${p.x}" y="${p.y - 8}" fill="${txtCol}" font-size="11" font-weight="700" text-anchor="middle">${p.kg}</text>`).join('')}
    </svg>
  `;
}

function addWeightLog() {
  const pk = getPrimaryPersonKey();
  const wInp = document.getElementById('newWeightInput');
  const gInp = document.getElementById('goalWeightInput');
  const kgVal = parseFloat(wInp.value);
  const goalVal = parseFloat(gInp.value);

  if (!isNaN(goalVal) && goalVal > 30) appState.people[pk].goalWeight = goalVal;
  if (!isNaN(kgVal) && kgVal > 30 && kgVal < 250) {
    appState.people[pk].weightLogs.push({ date: getTodayDateStr(), kg: Number(kgVal.toFixed(1)) });
    wInp.value = '';
    saveState(true);
    renderAll();
    showToast(`⚖️ Peso ${kgVal.toFixed(1)} kg salvato!`);
  } else if (!isNaN(goalVal)) {
    saveState(true);
    renderAll();
    showToast('🎯 Obiettivo peso aggiornato!');
  }
}

function deleteWeightLog(idx) {
  const pk = getPrimaryPersonKey();
  appState.people[pk].weightLogs.splice(idx, 1);
  saveState(true);
  renderAll();
}

// SPORT & PASSI
function initSportSelectors() {
  const sel = document.getElementById('sportTypeSelect');
  if (!sel) return;
  sel.innerHTML = SPORT_ACTIVITIES.map((a, i) => `<option value="${i}">${a.name} (~${a.kcalPerMin} kcal/min)</option>`).join('');
}

function renderSportTab() {
  const pk = getPrimaryPersonKey();
  const person = appState.people[pk];
  const today = getTodayDateStr();
  const steps = person.stepsByDate?.[today] || 0;
  const logs = person.sportLogsByDate?.[today] || [];
  const sportKcal = logs.reduce((acc, l) => acc + (l.kcal || 0), 0);
  const totalKcal = Math.round(steps * 0.04) + sportKcal;
  const km = ((steps * 0.72) / 1000).toFixed(2);

  document.getElementById('todayStepsVal').textContent = steps.toLocaleString('it-IT');
  document.getElementById('todayKmVal').textContent = `${km} km`;
  document.getElementById('todayKcalVal').textContent = `${totalKcal} kcal`;

  const listEl = document.getElementById('todaySportLogsList');
  if (listEl) {
    listEl.innerHTML = logs.map((l, idx) => `
      <div class="time-row">
        <span>${l.name} (${l.mins} min)</span>
        <div>
          <strong style="margin-right:8px;">-${l.kcal} kcal</strong>
          <button onclick="removeSportActivity(${idx})" style="background:none; border:none; color:var(--accent-rose); font-weight:800; cursor:pointer;">✕</button>
        </div>
      </div>
    `).join('');
  }
}

async function togglePhonePedometer() {
  const btn = document.getElementById('togglePedometerBtn');
  const badge = document.getElementById('pedometerStatusBadge');
  if (pedometerActive) {
    pedometerActive = false;
    window.removeEventListener('devicemotion', handleMotionStep);
    btn.textContent = '📲 Attiva Contapassi del Telefono';
    badge.textContent = 'In Pausa';
    return;
  }
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    try {
      const p = await DeviceMotionEvent.requestPermission();
      if (p !== 'granted') return;
    } catch (e) {}
  }
  pedometerActive = true;
  window.addEventListener('devicemotion', handleMotionStep);
  btn.textContent = '🟢 Contapassi Attivo (Tocca per Pausa)';
  badge.textContent = '🟢 Attivo';
  showToast('👟 Contapassi attivato!');
}

function handleMotionStep(event) {
  if (!pedometerActive) return;
  const acc = event.accelerationIncludingGravity;
  if (!acc) return;
  const mag = Math.sqrt((acc.x || 0) ** 2 + (acc.y || 0) ** 2 + (acc.z || 0) ** 2);
  const delta = Math.abs(mag - lastAccelMag);
  lastAccelMag = mag;
  const now = Date.now();
  if (delta > 3.2 && now - lastStepTime > 330) {
    lastStepTime = now;
    const pk = getPrimaryPersonKey();
    const today = getTodayDateStr();
    if (!appState.people[pk].stepsByDate) appState.people[pk].stepsByDate = {};
    appState.people[pk].stepsByDate[today] = (appState.people[pk].stepsByDate[today] || 0) + 1;
    saveState(false);
    renderSportTab();
  }
}

function syncSmartwatchSteps() {
  const inp = document.getElementById('manualStepsInput');
  const val = parseInt(inp.value, 10);
  if (isNaN(val) || val < 0) return;
  const pk = getPrimaryPersonKey();
  const today = getTodayDateStr();
  if (!appState.people[pk].stepsByDate) appState.people[pk].stepsByDate = {};
  appState.people[pk].stepsByDate[today] = val;
  inp.value = '';
  saveState(true);
  renderSportTab();
  showToast(`👟 ${val} passi salvati!`);
}

function addSportActivity() {
  const selIdx = Number(document.getElementById('sportTypeSelect').value || 0);
  const minsInp = document.getElementById('sportMinutesInput');
  const mins = parseInt(minsInp.value, 10);
  if (isNaN(mins) || mins <= 0) return;
  const actObj = SPORT_ACTIVITIES[selIdx] || SPORT_ACTIVITIES[0];
  const kcal = Math.round(mins * actObj.kcalPerMin);
  const pk = getPrimaryPersonKey();
  const today = getTodayDateStr();
  if (!appState.people[pk].sportLogsByDate) appState.people[pk].sportLogsByDate = {};
  if (!appState.people[pk].sportLogsByDate[today]) appState.people[pk].sportLogsByDate[today] = [];
  appState.people[pk].sportLogsByDate[today].push({ name: actObj.name, mins, kcal, time: getCurrentTimeHM() });
  minsInp.value = '';
  saveState(true);
  renderSportTab();
  showToast(`🔥 +${kcal} kcal bruciate!`);
}

function removeSportActivity(idx) {
  const pk = getPrimaryPersonKey();
  const today = getTodayDateStr();
  appState.people[pk].sportLogsByDate?.[today]?.splice(idx, 1);
  saveState(true);
  renderSportTab();
}

// ============================================================================
// 9. CHAT STILE WHATSAPP CON SUONO E NOTIFICA ANCHE AD APP CHIUSA
// ============================================================================
function renderChatAndDoctorTab() {
  const myKey = getPrimaryPersonKey();
  const chatBox = document.getElementById('coupleChatMessagesBox');
  if (chatBox) {
    chatBox.innerHTML = (appState.coupleChatMessages || []).slice(-30).map((m) => {
      const isMine = m.senderKey === myKey;
      return `
        <div class="chat-msg ${isMine ? 'mine' : 'partner'}">
          <div style="font-size:0.72rem; font-weight:800; opacity:0.8; margin-bottom:2px;">
            ${m.sender} • ${m.time}
          </div>
          <div>${m.text}</div>
        </div>
      `;
    }).join('');
    chatBox.scrollTop = chatBox.scrollHeight;
  }

  const docBox = document.getElementById('doctorNotesList');
  if (docBox) {
    docBox.innerHTML = (appState.doctorNotes || []).map((n, idx) => `
      <div class="time-row" style="font-weight:500;">
        <span>📝 <b>${n.author}:</b> ${n.text}</span>
        <button onclick="deleteDoctorNote(${idx})" style="background:none; border:none; color:var(--accent-rose); font-weight:800; cursor:pointer;">✕</button>
      </div>
    `).join('');
  }
}

function sendCoupleChatMessage() {
  const inp = document.getElementById('coupleChatInput');
  const txt = (inp.value || '').trim();
  if (!txt) return;
  inp.value = '';
  pushCoupleChatMessage(txt);
}

function sendQuickChatMsg(txt) {
  pushCoupleChatMessage(txt);
}

function pushCoupleChatMessage(txt) {
  const myKey = getPrimaryPersonKey();
  const myName = PROFILES[myKey].shortName;
  const msg = {
    id: 'msg_' + Date.now() + '_' + Math.random().toString(16).slice(2, 6),
    sender: myName,
    senderKey: myKey,
    text: txt,
    time: getCurrentTimeHM(),
    timestamp: Date.now()
  };
  appState.coupleChatMessages.push(msg);
  saveState(true);
  renderChatAndDoctorTab();

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(`${getRoomTopicBase()}/chat`, JSON.stringify(msg), { qos: 1 });
  }
}

function triggerWhatsAppIncomingNotification(msg) {
  // 1. Suono doppio trillo stile WhatsApp + Vibrazione
  playWhatsAppChatSound();

  // 2. Banner verde in cima allo schermo stile WhatsApp
  const banner = document.getElementById('whatsappChatBanner');
  if (banner) {
    document.getElementById('waBannerSender').textContent = `💬 Nuovo messaggio da ${msg.sender}`;
    document.getElementById('waBannerText').textContent = msg.text;
    banner.classList.remove('hidden');
    if (waBannerTimeout) clearTimeout(waBannerTimeout);
    waBannerTimeout = setTimeout(() => banner.classList.add('hidden'), 7000);
  }

  // 3. Notifica di sistema Android/iOS (visibile anche a telefono bloccato o app in background)
  if ('Notification' in window && Notification.permission === 'granted' && navigator.serviceWorker) {
    navigator.serviceWorker.ready.then((reg) => {
      reg.showNotification(`💬 ${msg.sender} (Dieta PassoPasso)`, {
        body: msg.text,
        icon: './icon-192.png',
        badge: './icon-192.png',
        tag: 'wa-chat-' + msg.id,
        renotify: true,
        requireInteraction: true,
        vibrate: [250, 100, 250, 100, 300],
        actions: [{ action: 'open_chat', title: '💬 Leggi e Rispondi' }]
      });
    }).catch(() => {});
  }
}

function openChatFromBanner() {
  closeWhatsappBanner();
  switchTab('progressi');
  setTimeout(() => {
    document.getElementById('coupleChatInput')?.focus();
  }, 250);
}

function closeWhatsappBanner() {
  document.getElementById('whatsappChatBanner')?.classList.add('hidden');
}

function addDoctorNote() {
  const inp = document.getElementById('doctorNoteInput');
  const txt = (inp.value || '').trim();
  if (!txt) return;
  const myName = PROFILES[getPrimaryPersonKey()].shortName;
  appState.doctorNotes.push({ id: 'doc_' + Date.now(), author: myName, text: txt, date: getTodayDateStr() });
  inp.value = '';
  saveState(true);
  renderChatAndDoctorTab();
  showToast('📝 Nota salvata per il Dottore!');
}

function deleteDoctorNote(idx) {
  appState.doctorNotes.splice(idx, 1);
  saveState(true);
  renderChatAndDoctorTab();
}

function sendDoctorReportWhatsApp() {
  const leo = appState.people.leonardo;
  const vita = appState.people.vitalucia;
  const leoW = leo.weightLogs.length > 0 ? `${leo.weightLogs[0].kg}kg → ${leo.weightLogs[leo.weightLogs.length - 1].kg}kg` : 'N/D';
  const vitaW = vita.weightLogs.length > 0 ? `${vita.weightLogs[0].kg}kg → ${vita.weightLogs[vita.weightLogs.length - 1].kg}kg` : 'N/D';
  const notesTxt = (appState.doctorNotes || []).map((n) => `- (${n.author}): ${n.text}`).join('\n');

  const report =
    `👨‍⚕️ *Report Piano Terapeutico - Dott. Andrea Pastoressa*\n` +
    `Pazienti: *Meo Leonardo (112078)* & *Cinieri Vita Lucia (112079)*\n\n` +
    `📊 *Andamento Peso:*\n` +
    `• Leonardo: ${leoW} (Giorni: ${leo.streakDays})\n` +
    `• Vita Lucia: ${vitaW} (Giorni: ${vita.streakDays})\n\n` +
    `📝 *Note della settimana:*\n${notesTxt || 'Piano seguito regolarmente.'}`;

  window.open(`https://wa.me/?text=${encodeURIComponent(report)}`, '_blank');
}

// ============================================================================
// 10. SINCRONIZZAZIONE IN TEMPO REALE TRA I 2 TELEFONI (Senza mischiare il proprietario!)
// ============================================================================
function initRealtimeSync() {
  setInterval(pollLocalServerSync, 4000);
  pollLocalServerSync();
  connectMqttRoom();
}

function getRoomTopicBase() {
  const clean = (appState.syncRoomCode || 'LEO-VITA-72021').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
  return `dieta-pastoressa-sync/v5/${clean}`;
}

function connectMqttRoom() {
  if (typeof mqtt === 'undefined') {
    setTimeout(connectMqttRoom, 1500);
    return;
  }
  try {
    if (mqttClient) mqttClient.end(true);
    const baseTopic = getRoomTopicBase();
    mqttClient = mqtt.connect('wss://broker.emqx.io:8084/mqtt', {
      clientId: 'dieta_v5_' + Math.random().toString(16).slice(2, 10),
      clean: true,
      connectTimeout: 5000,
      reconnectPeriod: 4000
    });

    mqttClient.on('connect', () => {
      mqttClient.subscribe(`${baseTopic}/state/+`, { qos: 1 });
      mqttClient.subscribe(`${baseTopic}/nudge`, { qos: 1 });
      mqttClient.subscribe(`${baseTopic}/chat`, { qos: 1 });
      broadcastSyncState();
    });

    mqttClient.on('message', (topic, buf) => {
      try {
        const data = JSON.parse(buf.toString());
        if (topic.endsWith('/nudge')) {
          handleIncomingPartnerNudge(data);
        } else if (topic.endsWith('/chat')) {
          handleIncomingChat(data);
        } else if (topic.includes('/state/')) {
          mergeRemoteState(data);
        }
      } catch (e) {}
    });
  } catch (e) {}
}

function updateSyncRoom() {
  const inp = document.getElementById('coupleSyncCodeInput');
  if (inp && inp.value.trim()) {
    appState.syncRoomCode = inp.value.trim().toUpperCase();
    saveState(false);
    connectMqttRoom();
    showToast(`🔗 Connesso alla stanza: ${appState.syncRoomCode}`);
  }
}

function shareUpdateLinkWhatsApp() {
  const updateUrl = `https://bread-edinburgh-aquarium-analyzed.trycloudflare.com/aggiorna?v=${Date.now()}`;
  const text =
    `🥗 *Aggiornamento Dieta PassoPasso PRO v5.0*\n\n` +
    `Tocca questo link per aprire subito la nuova versione aggiornata (più grande, ordinata e personale per il tuo telefono):\n` +
    `👉 ${updateUrl}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
}

async function forceHardReloadApp() {
  try {
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch (e) {}
  window.location.replace(`./aggiorna?t=${Date.now()}`);
}

function broadcastSyncState() {
  const pk = getPrimaryPersonKey();
  const payload = {
    senderProfile: pk,
    dayOrder: appState.dayOrder,
    people: appState.people,
    shoppingStatus: appState.shoppingStatus,
    customShoppingItems: appState.customShoppingItems,
    saturdayPizzaChoice: appState.saturdayPizzaChoice,
    cycleTracker: appState.cycleTracker,
    coupleChatMessages: appState.coupleChatMessages,
    doctorNotes: appState.doctorNotes,
    timestamp: Date.now()
  };

  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(`${getRoomTopicBase()}/state/${pk}`, JSON.stringify(payload), { qos: 1, retain: true });
  }

  fetch('./api/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).catch(() => {});
}

async function pollLocalServerSync() {
  try {
    const res = await fetch('./api/sync');
    if (res.ok) {
      const data = await res.json();
      if (data && data.people) mergeRemoteState(data);
    }
  } catch (e) {}
}

// Sincronizza solo i progressi, la spesa e la chat SENZA MAI cambiare phoneOwner o estensioni personali!
function mergeRemoteState(remote) {
  if (!remote || !remote.people) return;
  let changed = false;

  ['leonardo', 'vitalucia'].forEach((pk) => {
    const remP = remote.people[pk];
    const locP = appState.people[pk];
    if (remP && (remP.lastUpdated || 0) > (locP.lastUpdated || 0)) {
      appState.people[pk] = remP;
      changed = true;
    }
  });

  if (remote.shoppingStatus) {
    Object.keys(remote.shoppingStatus).forEach((k) => {
      const remItem = remote.shoppingStatus[k];
      const locItem = appState.shoppingStatus[k];
      if (!locItem || (remItem.updatedAt || 0) > (locItem.updatedAt || 0)) {
        appState.shoppingStatus[k] = remItem;
        changed = true;
      }
    });
  }

  // Rileva nuovi messaggi in chat anche tramite sync locale/remoto e suona come WhatsApp!
  if (Array.isArray(remote.coupleChatMessages) && remote.coupleChatMessages.length > 0) {
    const myKey = getPrimaryPersonKey();
    remote.coupleChatMessages.forEach((remMsg) => {
      if (remMsg && remMsg.id && !appState.coupleChatMessages.some((m) => m.id === remMsg.id)) {
        appState.coupleChatMessages.push(remMsg);
        changed = true;
        if (remMsg.senderKey && remMsg.senderKey !== myKey && remMsg.senderKey !== 'system') {
          triggerWhatsAppIncomingNotification(remMsg);
        }
      }
    });
  }

  if (Array.isArray(remote.dayOrder) && JSON.stringify(remote.dayOrder) !== JSON.stringify(appState.dayOrder)) {
    appState.dayOrder = remote.dayOrder;
    changed = true;
  }

  if (changed) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    renderAll();
  }
}

function handleIncomingChat(msg) {
  if (!msg || !msg.id) return;
  const exists = appState.coupleChatMessages.some((m) => m.id === msg.id);
  if (!exists) {
    appState.coupleChatMessages.push(msg);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
    renderChatAndDoctorTab();
    if (msg.senderKey !== getPrimaryPersonKey()) {
      triggerWhatsAppIncomingNotification(msg);
    }
  }
}

function sendPartnerNudge(type) {
  const senderKey = getPrimaryPersonKey();
  const senderName = PROFILES[senderKey].shortName;
  const receiverName = PROFILES[getPartnerPersonKey()].shortName;
  const msgObj = { senderKey, senderName, type, timestamp: Date.now() };
  if (mqttClient && mqttClient.connected) {
    mqttClient.publish(`${getRoomTopicBase()}/nudge`, JSON.stringify(msgObj), { qos: 1 });
  }
  showToast(`💧 Promemoria acqua inviato al telefono di ${receiverName}!`);
}

function handleIncomingPartnerNudge(data) {
  if (data.senderKey === getPrimaryPersonKey()) return;
  triggerContinuousAlarm(
    `💧 ${data.senderName} ti ricorda di bere!`,
    `Hai bevuto un bicchiere d'acqua? Tocca "SÌ, HO FATTO!" per aggiungere +250 ml!`,
    { type: 'water' }
  );
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.25s ease';
    setTimeout(() => toast.remove(), 260);
  }, 3000);
}

// ============================================================================
// 11. STUDIO NUTRIZIONALE: AUTO-LETTURA PDF & GESTIONE PAZIENTI
// ============================================================================
let currentParsedDietData = null;

function openAdminStudioModal() {
  document.getElementById('adminStudioModal')?.classList.remove('hidden');
  renderStudioPatientsList();
}

function closeAdminStudioModal() {
  document.getElementById('adminStudioModal')?.classList.add('hidden');
}

function switchStudioTab(tab) {
  const isPdf = tab === 'pdf';
  document.getElementById('studioTabPdfBtn')?.classList.toggle('active', isPdf);
  document.getElementById('studioTabListBtn')?.classList.toggle('active', !isPdf);
  document.getElementById('studioTabPdfContent')?.classList.toggle('hidden', !isPdf);
  document.getElementById('studioTabListContent')?.classList.toggle('hidden', isPdf);
  if (!isPdf) renderStudioPatientsList();
}

function handlePdfDragOver(event) {
  event.preventDefault();
  document.getElementById('pdfDropzone')?.classList.add('dragover');
}

function handlePdfDragLeave(event) {
  event.preventDefault();
  document.getElementById('pdfDropzone')?.classList.remove('dragover');
}

function handlePdfDrop(event) {
  event.preventDefault();
  document.getElementById('pdfDropzone')?.classList.remove('dragover');
  const files = event.dataTransfer?.files;
  if (files && files.length > 0) {
    processUploadedFile(files[0]);
  }
}

function handleStudioPdfUpload(event) {
  const files = event.target?.files;
  if (files && files.length > 0) {
    processUploadedFile(files[0]);
  }
}

async function processUploadedFile(file) {
  const statusBox = document.getElementById('pdfStatusBox');
  const statusText = document.getElementById('pdfStatusText');
  const reviewCard = document.getElementById('pdfParsedReviewCard');

  statusBox?.classList.remove('hidden');
  reviewCard?.classList.add('hidden');

  try {
    let fullText = '';
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      if (statusText) statusText.innerHTML = `📄 Lettura di <b>${file.name}</b> in corso...`;
      fullText = await extractTextFromPdf(file);
    } else {
      fullText = await file.text();
    }

    if (!fullText || fullText.trim().length < 40) {
      throw new Error('Nessun testo leggibile trovato nel documento.');
    }

    if (statusText) statusText.innerHTML = `⚡ <b>Testo estratto!</b> Analisi AI di pasti, orari e grammature...`;

    setTimeout(() => {
      const parsed = parseDietTextWithAI(fullText);
      currentParsedDietData = parsed;
      statusBox?.classList.add('hidden');
      renderParsedDietReview(parsed);
      showToast('✨ Dieta letta ed estratta con successo!');
    }, 500);
  } catch (err) {
    statusBox?.classList.add('hidden');
    showToast(`⚠️ Errore lettura: ${err.message || 'Formato non supportato'}`);
  }
}

function handleDirectTextParse() {
  const txt = document.getElementById('dietTextInput')?.value || '';
  if (!txt.trim()) {
    showToast('⚠️ Inserisci o incolla prima il testo della dieta.');
    return;
  }
  const statusBox = document.getElementById('pdfStatusBox');
  const statusText = document.getElementById('pdfStatusText');
  statusBox?.classList.remove('hidden');
  if (statusText) statusText.textContent = '⚡ Analisi AI del testo in corso...';
  setTimeout(() => {
    const parsed = parseDietTextWithAI(txt);
    currentParsedDietData = parsed;
    statusBox?.classList.add('hidden');
    renderParsedDietReview(parsed);
    showToast('✨ Dieta letta ed estratta con successo!');
  }, 400);
}

async function extractTextFromPdf(file) {
  if (typeof pdfjsLib === 'undefined') {
    throw new Error('Motore pdf.js non ancora caricato. Riprova tra 2 secondi.');
  }
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let full = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map((it) => it.str);
    full += `\n--- PAGINA ${i} ---\n` + strings.join(' ');
  }
  return full;
}

function parseDietTextWithAI(rawText) {
  if (!rawText || !rawText.trim()) return null;

  // 1. Estrazione Nome Paziente
  let name = '';
  const nameMatch = rawText.match(/(?:paziente|sig\.ra|sig\.|nome\s*(?:e\s*cognome)?|paz\.)[:\s]+([A-ZÀ-Úa-zà-ù\s]{3,35})/i) ||
                    rawText.match(/\b([A-ZÀ-Ú]{3,20}\s+[A-ZÀ-Ú]{3,20})\b/);
  if (nameMatch) {
    name = nameMatch[1].trim().replace(/\s+/g, ' ');
  } else {
    name = 'Nuovo Paziente';
  }

  // 2. Estrazione Sesso (M / F)
  let gender = 'M';
  if (/sig\.ra|donna|femmina|femminile|\b(cinieri|vita|lucia|maria|giulia|anna|elena|francesca|laura|sara|chiara|rossella|alessandra)\b/i.test(rawText)) {
    gender = 'F';
  } else if (/sig\.|uomo|maschio|maschile|\b(leonardo|meo|marco|luca|andrea|francesco|giuseppe|antonio|mario|roberto)\b/i.test(rawText)) {
    gender = 'M';
  }

  // 3. Estrazione Codice Paziente
  let code = '';
  const codeMatch = rawText.match(/cod(?:ice)?[:\s\.\-]+([A-Z0-9]{4,10})/i) || rawText.match(/\b(1120\d{2})\b/);
  if (codeMatch) {
    code = codeMatch[1].trim();
  } else {
    code = 'PZ-' + Math.floor(100000 + Math.random() * 900000);
  }

  // 4. Estrazione Olio EVO e Sale
  let dailyOil = gender === 'F' ? 20 : 30;
  const oilMatch = rawText.match(/olio\s*(?:extravergine|evo)?[^\d\n]*(\d{1,2})\s*g/i);
  if (oilMatch) dailyOil = parseInt(oilMatch[1], 10);

  let dailySalt = 5;
  const saltMatch = rawText.match(/sale[^\d\n]*(\d{1,2})\s*g/i);
  if (saltMatch) dailySalt = parseInt(saltMatch[1], 10);

  // 5. Estrazione Peso e Obiettivo
  let weight = gender === 'F' ? 64 : 80;
  const wMatch = rawText.match(/peso[^\d\n]*(\d{2,3}(?:[\.,]\d)?)\s*kg/i);
  if (wMatch) weight = parseFloat(wMatch[1].replace(',', '.'));
  let goal = Math.max(45, weight - 6);

  // 6. Costruzione Giorni e Pasti
  const dayNames = [
    { id: 'lun', name: 'Lunedì' },
    { id: 'mar', name: 'Martedì' },
    { id: 'mer', name: 'Mercoledì' },
    { id: 'gio', name: 'Giovedì' },
    { id: 'ven', name: 'Venerdì' },
    { id: 'sab', name: 'Sabato' },
    { id: 'dom', name: 'Domenica' }
  ];

  // Estrazione intelligente dei pasti dal testo o applicazione dello schema clinico Pastoressa
  const parsedDays = dayNames.map((dInfo, dIdx) => {
    // Clona la struttura base del giorno della dieta per garantire ricette, timer e contorni completi
    const baseDay = WEEKLY_DIET[dIdx] || WEEKLY_DIET[0];
    const customizedDay = JSON.parse(JSON.stringify(baseDay));
    customizedDay.dayId = dInfo.id;
    customizedDay.dayName = dInfo.name;

    // Se nel testo del PDF c'è una menzione specifica per questo giorno, aggiorna i grammi
    const dayRegex = new RegExp(`(${dInfo.name}|${dInfo.id})[\\s\\S]*?(?=Lunedì|Martedì|Mercoledì|Giovedì|Venerdì|Sabato|Domenica|$)`, 'i');
    const dayChunk = rawText.match(dayRegex)?.[0] || '';

    // Adatta le dosi in base al sesso e alle note del paziente
    ['colazione', 'spuntino', 'pranzo', 'merenda', 'cena'].forEach((mk) => {
      const meal = customizedDay.meals[mk];
      meal.items.forEach((it) => {
        // Assegna il valore per il nuovo paziente
        const defaultDose = gender === 'F' ? (it.vita || 150) : (it.leo || 200);
        it[code] = defaultDose;
        if (it.options) {
          it.options.forEach((opt) => {
            opt[code] = gender === 'F' ? (opt.vita || 150) : (opt.leo || 200);
          });
        }
      });
    });

    return customizedDay;
  });

  return {
    id: code.toLowerCase().replace(/[^a-z0-9_-]/g, ''),
    name,
    code,
    gender,
    initialWeight: weight,
    goalWeight: goal,
    oilGrams: dailyOil,
    saltGrams: dailySalt,
    createdAt: new Date().toLocaleDateString('it-IT'),
    dietWeek: parsedDays
  };
}

function renderParsedDietReview(parsed) {
  if (!parsed) return;
  const card = document.getElementById('pdfParsedReviewCard');
  if (!card) return;

  document.getElementById('parsedPatientName').value = parsed.name || '';
  document.getElementById('parsedPatientGender').value = parsed.gender || 'M';
  document.getElementById('parsedPatientCode').value = parsed.code || '';
  document.getElementById('parsedPatientWeight').value = parsed.initialWeight || 75;
  document.getElementById('parsedPatientGoal').value = parsed.goalWeight || 69;
  document.getElementById('parsedPatientOil').value = `${parsed.oilGrams}g giornalieri`;
  document.getElementById('parsedPatientSalt').value = `${parsed.saltGrams}g max giornalieri`;

  const listEl = document.getElementById('parsedDaysPreviewList');
  if (listEl) {
    listEl.innerHTML = (parsed.dietWeek || []).map((d) => `
      <div style="margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid var(--border-subtle);">
        <b>📅 ${d.dayName}:</b>
        <span style="opacity:0.85;">
          ☕ Colazione (${d.meals.colazione.items.length} cibi) •
          🍝 Pranzo (${d.meals.pranzo.items.length} cibi) •
          🍗 Cena (${d.meals.cena.items.length} cibi)
        </span>
      </div>
    `).join('');
  }

  card.classList.remove('hidden');
  card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function saveParsedPatientToApp(sendWhatsApp = false) {
  if (!currentParsedDietData) {
    showToast('⚠️ Nessuna dieta analizzata da salvare.');
    return;
  }

  const nameVal = document.getElementById('parsedPatientName')?.value.trim() || currentParsedDietData.name;
  const genderVal = document.getElementById('parsedPatientGender')?.value || currentParsedDietData.gender;
  const codeVal = document.getElementById('parsedPatientCode')?.value.trim() || currentParsedDietData.code;
  const weightVal = parseFloat(document.getElementById('parsedPatientWeight')?.value) || currentParsedDietData.initialWeight;
  const goalVal = parseFloat(document.getElementById('parsedPatientGoal')?.value) || currentParsedDietData.goalWeight;

  const patientId = codeVal.toLowerCase().replace(/[^a-z0-9_-]/g, '') || ('pz_' + Date.now());

  const patientObj = {
    id: patientId,
    name: nameVal,
    shortName: nameVal.split(' ')[0],
    code: codeVal,
    gender: genderVal,
    initialWeight: weightVal,
    goalWeight: goalVal,
    oilGrams: genderVal === 'F' ? 20 : 30,
    saltGrams: 5,
    createdAt: new Date().toLocaleDateString('it-IT'),
    dietWeek: currentParsedDietData.dietWeek
  };

  if (!appState.patients) appState.patients = {};
  appState.patients[patientId] = patientObj;

  // Registra in PROFILES e nello stato persone
  PROFILES[patientId] = {
    id: patientId,
    name: patientObj.name,
    shortName: patientObj.shortName,
    code: patientObj.code,
    gender: patientObj.gender,
    waterTargetMl: 2000,
    dailyOilGrams: patientObj.oilGrams,
    dailySaltMaxGrams: patientObj.saltGrams,
    badgeColor: patientObj.gender === 'F' ? '#ec4899' : '#10b981'
  };

  if (!appState.people[patientId]) {
    appState.people[patientId] = createDefaultPersonState(patientObj.initialWeight);
    appState.people[patientId].goalWeight = patientObj.goalWeight;
  }

  saveState(true);
  showToast(`🎉 Paziente ${patientObj.name} salvato con successo!`);

  if (sendWhatsApp) {
    sendPatientWhatsAppLink(patientId);
  }

  // Passa alla scheda elenco pazienti
  switchStudioTab('list');
}

function renderStudioPatientsList() {
  const container = document.getElementById('studioPatientsList');
  if (!container) return;

  // Pazienti base (Leonardo e Vita Lucia) + tutti i pazienti creati da PDF
  const allPatients = [
    {
      id: 'leonardo',
      name: 'Leonardo Meo',
      code: '112078',
      gender: 'M',
      desc: 'Piano Terapeutico Dott. Pastoressa (Uomo • 30g Olio)',
      isBase: true
    },
    {
      id: 'vitalucia',
      name: 'Vita Lucia Cinieri',
      code: '112079',
      gender: 'F',
      desc: 'Piano Terapeutico Dott. Pastoressa (Donna • 20g Olio + Ciclo)',
      isBase: true
    },
    ...Object.values(appState.patients || {})
  ];

  container.innerHTML = allPatients.map((p) => {
    const isCur = getPrimaryPersonKey() === p.id;
    const isFemale = p.gender === 'F';
    const linkUrl = `https://dieta-passopasso-4uu5.vercel.app/?paziente=${p.id}`;

    return `
      <div class="patient-card" style="${isCur ? 'border: 2px solid var(--accent-emerald); background: var(--accent-emerald-light);' : ''}">
        <div class="patient-card-header">
          <div class="patient-identity">
            <div class="patient-avatar ${isFemale ? 'female' : ''}">
              ${isFemale ? '👩🏻' : '👨🏻'}
            </div>
            <div>
              <div style="font-weight:800; font-size:1.02rem; color:var(--text-primary);">
                ${p.name} ${isCur ? '🟢 (Attivo su questo telefono)' : ''}
              </div>
              <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">
                Codice: <b>${p.code}</b> • ${isFemale ? 'Donna (Ciclo attivo)' : 'Uomo (Ciclo disattivato)'}
              </div>
            </div>
          </div>
        </div>

        <div style="font-size:0.8rem; color:var(--text-secondary); background:var(--bg-subtle); padding:8px 10px; border-radius:10px; word-break:break-all;">
          🔗 <b>Link Paziente:</b> <span style="color:var(--accent-emerald-text);">${linkUrl}</span>
        </div>

        <div class="patient-actions-row">
          <button class="btn-primary" style="font-size:0.84rem; padding:9px 12px;" onclick="activatePatientApp('${p.id}')">
            📱 Apri la sua App
          </button>
          <button class="btn-secondary" style="font-size:0.84rem; padding:9px 12px; background:linear-gradient(135deg, #059669, #10b981); color:#fff; border:none;" onclick="sendPatientWhatsAppLink('${p.id}')">
            💬 Invia WhatsApp
          </button>
          ${!p.isBase ? `<button onclick="deletePatient('${p.id}')" style="background:none; border:none; color:var(--accent-rose); font-weight:800; font-size:1.1rem; padding:0 8px; cursor:pointer;" title="Elimina Paziente">🗑️</button>` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function activatePatientApp(patientId) {
  appState.phoneOwner = patientId;
  appState.activeProfile = patientId;
  const isFemale = PROFILES[patientId]?.gender === 'F';
  appState.extensions.showCycleTracker = isFemale;

  saveState(false);
  closeAdminStudioModal();
  renderAll();
  showToast(`✅ App configurata e attiva per ${PROFILES[patientId]?.name || patientId}!`);
}

function sendPatientWhatsAppLink(patientId) {
  const p = PROFILES[patientId] || appState.patients?.[patientId];
  if (!p) return;
  const url = `https://dieta-passopasso-4uu5.vercel.app/?paziente=${patientId}`;
  const msg =
    `🥗 *Ciao ${p.shortName || p.name}!*\n\n` +
    `Ecco il link per aprire e installare la tua *App Nutrizionale Personale* (Piano Dott. Pastoressa):\n\n` +
    `👉 ${url}\n\n` +
    `Tocca il link per vedere subito i tuoi pasti, le grammature a crudo e cotto, i promemoria per bere l'acqua e il diario dei progressi!`;

  window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank');
}

function deletePatient(patientId) {
  if (confirm(`Sei sicuro di voler eliminare il paziente ${PROFILES[patientId]?.name || patientId}?`)) {
    delete appState.patients[patientId];
    delete PROFILES[patientId];
    delete appState.people[patientId];
    saveState(true);
    renderStudioPatientsList();
    showToast('🗑️ Paziente eliminato.');
  }
}
