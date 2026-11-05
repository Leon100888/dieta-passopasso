// ============================================================================
// DATA.JS v3.0 - CALENDARIO REALE AUTOMATICO, RICETTE DINAMICHE SU OGNI
// ALTERNATIVA SCELTA, CALCOLO RIGOROSO GIORNALIERO (OLIO/SALE/PANE) & TIMER
// ============================================================================

const PROFILES = {
  leonardo: {
    id: 'leonardo',
    name: 'Leonardo Meo',
    shortName: 'Leonardo',
    code: '112078',
    gender: 'M',
    birthDate: '10/08/1988',
    city: 'Francavilla Fontana (Via Grecia 1)',
    phone: '3913805331',
    email: 'LEONARDO-MEO@LIVE.IT',
    waterTargetMl: 2000,
    dailyOilGrams: 30, // 15g pranzo + 15g cena
    dailySaltMaxGrams: 5, // 1 cucchiaino raso max in tutta la giornata
    dailyStepGoal: 8000,
    dailyKcalBurnGoal: 350,
    badgeColor: '#10b981'
  },
  vitalucia: {
    id: 'vitalucia',
    name: 'Vita Lucia Cinieri',
    shortName: 'Vita Lucia',
    code: '112079',
    gender: 'F',
    birthDate: '25/10/1991',
    city: 'Francavilla Fontana (Via Grecia 1)',
    phone: '3516592719',
    email: 'CINIERIVITA91@GMAIL.COM',
    waterTargetMl: 2000,
    dailyOilGrams: 20, // 10g pranzo + 10g cena
    dailySaltMaxGrams: 5,
    dailyStepGoal: 7000,
    dailyKcalBurnGoal: 280,
    badgeColor: '#ec4899'
  },
  coppia: {
    id: 'coppia',
    name: 'Leonardo + Vita Lucia (Insieme)',
    shortName: '💑 Coppia',
    code: '112078 + 112079',
    gender: 'MF',
    birthDate: '',
    city: 'Francavilla Fontana (Via Grecia 1)',
    waterTargetMl: 2000,
    dailyOilGrams: 50, // 30g Leo + 20g Vita
    dailySaltMaxGrams: 10,
    dailyStepGoal: 15000,
    dailyKcalBurnGoal: 630,
    badgeColor: '#8b5cf6'
  }
};

const DEFAULT_MEAL_TIMES = {
  colazione: '08:00',
  spuntino: '11:00',
  pranzo: '14:00',
  merenda: '17:00',
  cena: '20:30',
  prepSerale: '21:30'
};

// Opzioni per trasformare "CONTORNO VEGETALE A SCELTA" in verdure vere per Ricetta e Lista Spesa!
function makeContornoOptions(leoGrams = 200, vitaGrams = 200) {
  const veggies = [
    'Zucchine (grigliate / trifolate)',
    'Broccoli o Cime di rapa (al vapore)',
    'Spinaci o Bietole (lessati al limone)',
    'Melanzane (grigliate / al forno)',
    'Finocchi (crudi o gratinati senza besciamella)',
    'Fagiolini (lessati al prezzemolo)',
    'Peperoni (arrostiti / in padella)',
    'Cavolfiore (al vapore con curcuma)',
    'Carciofi (in umido con prezzemolo)',
    'Insalata mista / Radicchio / Pomodori'
  ];
  return veggies.map((v) => ({ label: v, leo: leoGrams, vita: vitaGrams, unit: 'g' }));
}

function makeLegumiOptions(leoGrams, vitaGrams) {
  return [
    { label: 'Lenticchie secche (nessun ammollo lungo)', leo: leoGrams, vita: vitaGrams, unit: 'g' },
    { label: 'Ceci secchi (ammollo 12h)', leo: leoGrams, vita: vitaGrams, unit: 'g' },
    { label: 'Fagioli Cannellini / Borlotti secchi (ammollo 12h)', leo: leoGrams, vita: vitaGrams, unit: 'g' },
    { label: 'Fave secche decorticate', leo: leoGrams, vita: vitaGrams, unit: 'g' },
    { label: 'Piselli secchi spezzati', leo: leoGrams, vita: vitaGrams, unit: 'g' }
  ];
}

function makeFruttaFrescaOptions(leoGrams = 150, vitaGrams = 150) {
  return [
    { label: 'Mela (150g)', leo: leoGrams, vita: vitaGrams, unit: 'g' },
    { label: 'Pera (150g)', leo: leoGrams, vita: vitaGrams, unit: 'g' },
    { label: 'Arancia / Mandarini (150g)', leo: leoGrams, vita: vitaGrams, unit: 'g' },
    { label: 'Kiwi (2 frutti - 150g)', leo: leoGrams, vita: vitaGrams, unit: 'g' },
    { label: 'Fragole / Frutti di bosco (150g)', leo: leoGrams, vita: vitaGrams, unit: 'g' },
    { label: 'Pesca / Albicocche (150g)', leo: leoGrams, vita: vitaGrams, unit: 'g' }
  ];
}

// Calcolo scientifico resa Crudo/Secco -> Cotto
function getCookedEstimate(name, rawGrams) {
  if (!rawGrams || rawGrams <= 0) return null;
  const n = name.toLowerCase();
  if (n.includes('legumi') || n.includes('lenticchie') || n.includes('ceci') || n.includes('fagioli') || n.includes('fave') || n.includes('piselli')) {
    return { cookedGrams: Math.round(rawGrams * 2.5), ratio: 2.5, tag: 'Secco → Cotto', note: 'Bollitura (~x2,5)' };
  }
  if (n.includes('riso') || n.includes('risotto')) {
    return { cookedGrams: Math.round(rawGrams * 2.6), ratio: 2.6, tag: 'Crudo → Cotto', note: 'Assorbimento (~x2,6)' };
  }
  if (n.includes('pasta') || n.includes('tagliatelle')) {
    return { cookedGrams: Math.round(rawGrams * 2.1), ratio: 2.1, tag: 'Cruda → Cotta', note: 'Al dente (~x2,1)' };
  }
  if (n.includes('pollo') || n.includes('tacchino') || n.includes('vitello') || n.includes('maiale') || n.includes('hamburgher')) {
    return { cookedGrams: Math.round(rawGrams * 0.75), ratio: 0.75, tag: 'Crudo → Cotto', note: 'Piastra (-25% liquidi)' };
  }
  if (
    n.includes('pesce') || n.includes('merluzzo') || n.includes('calamari') ||
    n.includes('spada') || n.includes('platessa') || n.includes('polpo') ||
    n.includes('rana') || n.includes('salmone') || n.includes('seppie')
  ) {
    return { cookedGrams: Math.round(rawGrams * 0.8), ratio: 0.8, tag: 'Crudo → Cotto', note: 'Cottura (-20% liquidi)' };
  }
  if (
    n.includes('contorno') || n.includes('zucchine') || n.includes('broccoli') ||
    n.includes('spinaci') || n.includes('melanzane') || n.includes('finocchi') ||
    n.includes('fagiolini') || n.includes('peperoni') || n.includes('cavolfiore') || n.includes('carciofi')
  ) {
    return { cookedGrams: Math.round(rawGrams * 0.72), ratio: 0.72, tag: 'Crudo → Cotto', note: 'Cotta (~-28% acqua)' };
  }
  return null;
}

// ============================================================================
// GENERATORE DINAMICO DI RICETTE RIGOROSE BASATO SULLE ALTERNATIVE SCELTE!
// Mantiene rigorosamente le grammature di Leonardo, Vita Lucia, Olio EVO e Sale
// ============================================================================
function generateDynamicMealRecipe(mealKey, resolvedItems, activeProfile) {
  if (mealKey !== 'pranzo' && mealKey !== 'cena') return null;

  const isLeo = activeProfile === 'leonardo';
  const isVita = activeProfile === 'vitalucia';
  const oilItem = resolvedItems.find((i) => i.label.toLowerCase().includes('olio'));
  const parmItem = resolvedItems.find((i) => i.label.toLowerCase().includes('parmigiano'));
  const breadItem = resolvedItems.find((i) => i.label.toLowerCase().includes('pane'));

  const oilDoseTxt = oilItem
    ? isLeo
      ? `${oilItem.leo}g (1 cucchiaio e mezzo) RIGOROSAMENTE A CRUDO`
      : isVita
      ? `${oilItem.vita}g (1 cucchiaio) RIGOROSAMENTE A CRUDO`
      : `${oilItem.leo}g Leo + ${oilItem.vita}g Vita = ${oilItem.leo + oilItem.vita}g totali A CRUDO`
    : 'Nessun olio aggiunto (già incluso nella preparazione)';

  const mainFood = resolvedItems[0];
  const secondFood = resolvedItems[1];
  const mainName = (mainFood?.label || '').toLowerCase();
  const secName = (secondFood?.label || '').toLowerCase();

  const formatDose = (it) => {
    if (!it) return '';
    const raw = isLeo ? it.leo : isVita ? it.vita : it.leo + it.vita;
    const ck = getCookedEstimate(it.label, raw);
    const ckTxt = ck ? ` → 🍲 <b>~${ck.cookedGrams}g da cotto</b>` : '';
    return `<b>${raw}g a crudo</b>${ckTxt}`;
  };

  let title = `Ricetta su Misura: ${mainFood?.label || 'Pasto'}`;
  let timerMins = 18;
  let saltRule = '🧂 Sale: max 1 pizzico di sale iodato a fine cottura (usa erbe aromatiche per dare sapore!).';
  let steps = [];

  // 1. LEGUMI (Lunedì Pranzo o Venerdì Pranzo con Pasta/Riso)
  if (mainName.includes('lenticchie') || mainName.includes('ceci') || mainName.includes('fagioli') || mainName.includes('fave') || mainName.includes('piselli')) {
    const hasCereal = secName.includes('pasta') || secName.includes('riso');
    timerMins = mainName.includes('lenticchie') ? 28 : 45;
    saltRule = '🧂 Sale nei legumi: AGGIUNGI IL SALE SOLO NEGLI ULTIMI 5 MINUTI (altrimenti la buccia indurisce!).';
    title = hasCereal
      ? `Crema di ${mainFood.label.split('(')[0].trim()} con ${secondFood.label}`
      : `Zuppa Aromatica di ${mainFood.label.split('(')[0].trim()}`;

    steps = [
      `<b>Pesatura rigorosa a secco:</b> pesa esattamente ${formatDose(mainFood)} di ${mainFood.label.split('(')[0].trim()}.`,
      mainName.includes('lenticchie') || mainName.includes('piselli')
        ? `<b>Lavaggio:</b> sciacqua bene sotto acqua corrente fredda (non serve ammollo lungo).`
        : `<b>Ammollo + Cottura anti-gonfiore:</b> dopo l'ammollo di 12h, sciacqua e metti in pentola con acqua fredda, 2 foglie di alloro e rosmarino.`,
      hasCereal
        ? `<b>Unione con ${secondFood.label} (${formatDose(secondFood)}):</b> a fine cottura dei legumi, frullane un mestolo per fare una crema senza grassi e cuoci dentro ${secondFood.label} al dente.`
        : `<b>Cottura dolce:</b> fai sobbollire col coperchio per circa ${timerMins} minuti. Sala leggerissimamente solo alla fine.`,
      `<b>Condimento rigoroso da piano:</b> impiatta, accompagna con l'insalata mista e versa a filo l'Olio EVO: <b>${oilDoseTxt}</b>.`
    ];
  }
  // 2. RISOTTI DEL MERCOLEDÌ (Pomodoro / Funghi / Zucca + Uova)
  else if (mainName.includes('riso') || mainName.includes('risotto')) {
    timerMins = 17;
    title = `${mainFood.label} Mantecato a Crudo + Uova`;
    const condimentoSpec = mainName.includes('funghi')
      ? 'Fai appassire i funghi a fettine in padella antiaderente con 2 cucchiai di brodo vegetale, aglio e prezzemolo (ZERO olio in cottura!).'
      : mainName.includes('zucca')
      ? 'Cuoci la zucca a cubetti piccoli in 1 mestolo di brodo vegetale con rosmarino finché diventa una crema morbida (ZERO soffritto!).'
      : 'Scalda la passata di pomodoro rustica con basilico fresco senza soffriggere olio.';

    steps = [
      `<b>Pesatura riso a crudo:</b> pesa ${formatDose(mainFood)}.`,
      `<b>Base leggera:</b> ${condimentoSpec}`,
      `<b>Tostatura a secco:</b> tosta il riso a secco per 1 minuto, poi aggiungi brodo vegetale caldo poco alla volta per 16-17 minuti.`,
      `<b>Secondo abbinato (${secondFood.label}):</b> cuoci le uova (${formatDose(secondFood)}) sode (8 min), in camicia o su piastra antiaderente senza grassi.`,
      `<b>Mantecatura terapeutica a fuoco spento:</b> fuori dal fuoco aggiungi il Parmigiano (${parmItem ? (isLeo ? parmItem.leo + 'g' : isVita ? parmItem.vita + 'g' : '10g Leo + 5g Vita') : '5-10g'}) e l'Olio EVO: <b>${oilDoseTxt}</b>.`
    ];
  }
  // 3. MINESTRONE + FORMAGGIO FRESCO (Martedì Pranzo)
  else if (mainName.includes('minestrone')) {
    timerMins = 15;
    title = `Minestrone Tradizionale + ${secondFood?.label || 'Formaggio Fresco'}`;
    saltRule = '🧂 Sale: usa pochissimo sale nel minestrone perché il Parmigiano e il formaggio fresco sono già naturalmente sapidi.';
    steps = [
      `<b>Cottura Minestrone:</b> cuoci ${formatDose(mainFood)} di minestrone di verdure in acqua leggermente bollente per 15 minuti.`,
      `<b>Abbinamento Proteico:</b> prepara nel piatto ${formatDose(secondFood)} di <b>${secondFood?.label}</b> con ${breadItem ? formatDose(breadItem) + ' di pane integrale' : ''}.`,
      `<b>Condimento rigoroso:</b> a fuoco spento completa il minestrone con 1 cucchiaino di Parmigiano (5g) e l'Olio EVO previsto: <b>${oilDoseTxt}</b>.`
    ];
  }
  // 4. PASTA DELLA DOMENICA (Ragù / Tagliatelle ai Porcini + Carne)
  else if (mainName.includes('pasta') || mainName.includes('tagliatelle')) {
    timerMins = 11;
    title = `${mainFood.label} & ${secondFood?.label || 'Secondo'}`;
    steps = [
      `<b>Pesatura pasta a crudo:</b> pesa esattamente ${formatDose(mainFood)} di <b>${mainFood.label}</b>.`,
      mainName.includes('porcini')
        ? `<b>Sugo ai Funghi Porcini:</b> salta i funghi porcini in padella antiaderente con spicchio d'aglio, prezzemolo e 1 mestolino di acqua di cottura della pasta (senza soffriggere l'olio!).`
        : `<b>Ragù Magro Terapeutico:</b> cuoci il macinato magro a secco in pentola antiaderente con carota, sedano, passata di pomodoro e basilico senza olio in cottura.`,
      `<b>Secondo di Carne (${secondFood?.label}):</b> cuoci ${formatDose(secondFood)} sulla piastra ben calda 3 minuti per lato insieme al contorno scelto.`,
      `<b>Condimento finale (Olio + Parmigiano):</b> distribuisci su tutto il pranzo il Parmigiano e l'Olio EVO: <b>${oilDoseTxt}</b>.`
    ];
  }
  // 5. PESCE (Merluzzo, Calamari, Spada, Polpo, Salmone, Seppie, Persico, Platessa, Rana Pescatrice)
  else if (
    mainName.includes('merluzzo') || mainName.includes('calamari') || mainName.includes('spada') ||
    mainName.includes('polpo') || mainName.includes('salmone') || mainName.includes('seppie') ||
    mainName.includes('persico') || mainName.includes('platessa') || mainName.includes('rana')
  ) {
    timerMins = mainName.includes('polpo') ? 35 : 16;
    title = `${mainFood.label} al Cartoccio / Piastra + ${secondFood?.label || 'Verdure'}`;
    saltRule = '🧂 Sale: il pesce di mare è già ricco di iodio! Usa succo di limone, prezzemolo, aglio e origano al posto del sale.';
    const fishHowTo = mainName.includes('polpo')
      ? 'Lessalo in acqua bollente con alloro e limone per 35 minuti, lascialo intiepidire nella sua acqua per tenerlo tenerissimo, poi taglialo a tocchetti con prezzemolo e limone.'
      : mainName.includes('calamari') || mainName.includes('seppie')
      ? 'Taglia ad anelli o striscioline e cuoci sulla piastra rovente per 4-5 minuti per lato (oppure al forno a 190°C per 15 min con limone e prezzemolo).'
      : mainName.includes('spada') || mainName.includes('salmone')
      ? 'Cuoci il trancio su piastra antiaderente ben calda per 3-4 minuti per lato con erbe aromatiche e succo di limone.'
      : 'Chiudi il filetto in un cartoccio di carta forno con prezzemolo, fettine di limone e capperi sciacquati: inforna a 190°C per 16 minuti.';

    steps = [
      `<b>Pesatura pesce a crudo (pulito):</b> pesa ${formatDose(mainFood)} di <b>${mainFood.label}</b>.`,
      `<b>Metodo di cottura specifico:</b> ${fishHowTo}`,
      `<b>Contorno abbinato (${secondFood?.label}):</b> prepara ${formatDose(secondFood)} e affiancalo nel piatto.`,
      `<b>Condimento rigoroso a crudo:</b> versa su pesce e verdure l'Olio EVO previsto dal piano: <b>${oilDoseTxt}</b>.`
    ];
  }
  // 6. CARNE BIANCA O VITELLO (Pollo, Tacchino, Hamburger di pollo, Filetto di vitello)
  else if (mainName.includes('pollo') || mainName.includes('tacchino') || mainName.includes('vitello') || mainName.includes('hamburgher')) {
    timerMins = 12;
    title = `${mainFood.label} Morbido alle Erbe + ${secondFood?.label || 'Contorno'}`;
    steps = [
      `<b>Pesatura carne a crudo:</b> pesa ${formatDose(mainFood)} di <b>${mainFood.label}</b>.`,
      `<b>Marinatura anti-secchezza:</b> massaggia la carne con succo di limone, rosmarino, origano o curcuma (senza olio in cottura!).`,
      `<b>Cottura rapida:</b> cuoci su piastra o padella antiaderente ben calda 3-4 minuti per lato (chiudi col coperchio negli ultimi 2 minuti per trattenere i succhi).`,
      `<b>Contorno (${secondFood?.label}) & Olio EVO:</b> servi con ${formatDose(secondFood)} e condisci il tutto a crudo con <b>${oilDoseTxt}</b>.`
    ];
  }
  // 7. AFFETTATI MAGRI (Bresaola / Prosciutto crudo magro)
  else if (mainName.includes('bresaola') || mainName.includes('prosciutto')) {
    timerMins = 5;
    title = `Carpaccio Fresco di ${mainFood.label} con ${secondFood?.label}`;
    saltRule = '🧂 ZERO SALE AGGIUNTO: la bresaola e il prosciutto sono già salati! Non salare nemmeno il contorno se lo unisci nel piatto.';
    steps = [
      `<b>Pesatura:</b> disponi nel piatto ${formatDose(mainFood)} di <b>${mainFood.label}</b> (se prosciutto crudo, rimuovi eventuale grasso visibile).`,
      `<b>Contorno (${secondFood?.label}):</b> prepara ${formatDose(secondFood)}.`,
      `<b>Condimento a crudo:</b> emulsione di succo di limone, pepe nero e l'Olio EVO del piano: <b>${oilDoseTxt}</b>.`
    ];
  }
  // 8. FORMAGGI FRESCHI A CENA (Ricotta, Giuncata, Mozzarella, Philadelphia, Caprino, Certosino, Crescenza)
  else if (
    mainName.includes('ricotta') || mainName.includes('giuncata') || mainName.includes('mozzarella') ||
    mainName.includes('philadelphia') || mainName.includes('caprino') || mainName.includes('certosino') || mainName.includes('crescenza')
  ) {
    timerMins = 10;
    title = `Piatto Fresco di ${mainFood.label} + ${secondFood?.label}`;
    saltRule = '🧂 Sale: non aggiungere sale sul formaggio (usa origano, basilico o pepe nero).';
    steps = [
      `<b>Porzione esatta:</b> pesa ${formatDose(mainFood)} di <b>${mainFood.label}</b>.`,
      `<b>Contorno (${secondFood?.label}):</b> cuoci al vapore o alla griglia ${formatDose(secondFood)} di verdura.`,
      `<b>Condimento:</b> usa l'Olio EVO previsto (<b>${oilDoseTxt}</b>) per condire le verdure e insaporire il piatto con origano fresco.`
    ];
  }
  // 9. UOVA A CENA (Venerdì Cena)
  else if (mainName.includes('uovo')) {
    timerMins = 8;
    title = `Uova / Frittata Light al Forno con ${secondFood?.label}`;
    steps = [
      `<b>Porzioni Uova:</b> 2 uova medie (120g) per Leonardo e 1 uovo medio (60g) per Vita Lucia.`,
      `<b>Cottura senza grassi:</b> puoi farle alla coque/sode (8 min), in camicia, oppure sbatterle con le verdure già cotte (${secondFood?.label}) in padella antiaderente o al forno su carta forno!`,
      `<b>Condimento finale:</b> aggiungi l'Olio EVO a crudo nel piatto: <b>${oilDoseTxt}</b>.`
    ];
  }
  // 10. PIZZA DEL SABATO SERA
  else if (mainName.includes('pizza')) {
    timerMins = 15;
    title = `Pizza Bianca con Verdure Grigliate (Sabato Sera)`;
    saltRule = '💧 Consiglio: bevi 2 bei bicchieri d\'acqua durante e dopo la pizza per contrastare il sodio dell\'impasto!';
    steps = [
      `<b>Porzione prevista:</b> 300g a testa di Pizza bianca con verdure grigliate (zucchine, melanzane, peperoni grigliati, non fritti).`,
      `<b>Nessun olio extra:</b> non aggiungere olio piccante o condimenti extra sopra la pizza.`
    ];
  }

  return { title, timerMins, saltRule, oilDoseTxt, steps };
}

const WATER_SCHEDULE = [
  { time: '08:00', amount: 250, label: '1° Bicchiere • Risveglio & Colazione', tip: 'Acqua a temperatura ambiente appena svegli: riattiva metabolismo e intestino.' },
  { time: '09:30', amount: 250, label: '2° Bicchiere • Metà Mattina', tip: 'Idratazione cerebrale: mantiene alta energia e concentrazione.' },
  { time: '11:00', amount: 250, label: '3° Bicchiere • Spuntino delle 11:00', tip: 'Accompagna la frutta secca o lo yogurt: aumenta il senso di sazietà.' },
  { time: '12:30', amount: 250, label: '4° Bicchiere • Pre-Pranzo (1,0 Litro!)', tip: 'Bere prima del pranzo delle 14:00 evita di arrivare affamati a tavola.' },
  { time: '14:00', amount: 250, label: '5° Bicchiere • Pranzo delle 14:00', tip: 'Sorseggia durante il pranzo senza eccedere.' },
  { time: '15:30', amount: 250, label: '6° Bicchiere • Pomeriggio', tip: 'Aiuta la digestione e contrasta la stanchezza post-prandiale.' },
  { time: '17:00', amount: 250, label: '7° Bicchiere • Merenda delle 17:00', tip: 'Acqua + 150g di frutta fresca = pieno di vitamine e sali minerali.' },
  { time: '19:00', amount: 250, label: '8° Bicchiere • Obiettivo 2 Litri Raggiunto! 🎉', tip: 'Hai toccato il minimo terapeutico di 2 Litri prima di cena!' },
  { time: '20:30', amount: 250, label: '9° Bicchiere • Cena (Bonus 2,25 L)', tip: 'Idratazione serale leggera per chiudere la giornata al top.' }
];

const SPORT_ACTIVITIES = [
  { id: 'walk_normal', name: '🚶‍♂️ Camminata a passo normale (4-5 km/h)', kcalPerMin: 4.2 },
  { id: 'walk_fast', name: '🏃‍♂️ Camminata veloce / Fitwalking (6 km/h)', kcalPerMin: 5.8 },
  { id: 'run', name: '🏃 Corsa leggera / Jogging', kcalPerMin: 9.5 },
  { id: 'bike', name: '🚴‍♂️ Bicicletta / Cyclette', kcalPerMin: 6.5 },
  { id: 'gym', name: '🏋️‍♂️ Palestra / Pesi / Corpo libero', kcalPerMin: 6.0 },
  { id: 'housework', name: '🧹 Faccende domestiche attive / Spesa / Giardinaggio', kcalPerMin: 3.5 },
  { id: 'padel_tennis', name: '🎾 Padel / Tennis / Calcetto', kcalPerMin: 8.2 },
  { id: 'swim', name: '🏊‍♂️ Nuoto / Acquagym', kcalPerMin: 7.5 }
];

// Piano settimanale completo con alternative per ogni pasto e contorno vegetale
const WEEKLY_DIET = [
  // ===================== LUNEDÌ =====================
  {
    dayId: 'lunedi',
    dayName: 'Lunedì',
    shortName: 'Lun',
    theme: 'Legumi a Pranzo & Pollo/Tacchino a Cena',
    prepToday: [
      'A Secco → Cotto Legumi: 100g secchi Leo (~250g cotti) + 70g secchi Vita (~175g cotti) = 170g secchi totali (~425g cotti).',
      'Olio EVO totale di oggi: 30g per Leonardo (15g pranzo + 15g cena) e 20g per Vita Lucia (10g pranzo + 10g cena).',
      'Cena ore 20:30: 200g crudi Pollo/Tacchino Leo (~150g cotti) + 150g crudi Vita (~112g cotti).'
    ],
    prepTonightForTomorrow: 'Per MARTEDÌ: controlla di avere il Minestrone (200g a testa) e il formaggio fresco per il pranzo delle 14:00. Scongela il pesce per domani sera!',
    meals: {
      colazione: {
        title: 'Colazione',
        defaultTime: '08:00',
        icon: '☕',
        prepTip: 'Scalda il latte Zymil senza farlo bollire e prepara la moka (1 cucchiaino di zucchero di canna = 5g).',
        items: [
          { name: 'Latte Zymil', leo: 150, vita: 150, unit: 'g', shopCat: 'Latticini' },
          { name: 'Caffè moka in tazza', leo: 30, vita: 30, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Zucchero di canna', leo: 5, vita: 5, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Biscotti secchi', leo: 30, vita: 20, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      spuntino: {
        title: 'Spuntino Mattina',
        defaultTime: '11:00',
        icon: '🥜',
        prepTip: 'Scegli UN solo tipo di frutta secca (30g Leo / 20g Vita) non salata e non fritta.',
        items: [
          {
            name: 'Frutta secca a guscio (1 a scelta)',
            isChoice: true,
            shopCat: 'Dispensa',
            options: [
              { label: 'Mandorle dolci secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Noci secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Nocciole secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Pistacchi (non salati)', leo: 30, vita: 20, unit: 'g' },
              { label: 'Anacardi', leo: 30, vita: 20, unit: 'g' },
              { label: 'Arachidi tostate', leo: 30, vita: 20, unit: 'g' },
              { label: 'Pinoli', leo: 30, vita: 20, unit: 'g' }
            ]
          }
        ]
      },
      pranzo: {
        title: 'Pranzo',
        defaultTime: '14:00',
        icon: '🍲',
        prepTip: 'Scegli il legume qui sotto: la ricetta si adatta automaticamente! Condisci con Olio EVO a crudo (15g Leo / 10g Vita).',
        items: [
          {
            name: 'Legumi secchi (1 a scelta)',
            isChoice: true,
            shopCat: 'Dispensa',
            options: makeLegumiOptions(100, 70)
          },
          { name: 'Insalata mista', leo: 100, vita: 100, unit: 'g', shopCat: 'Ortofrutta' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      merenda: {
        title: 'Merenda Pomeridiana',
        defaultTime: '17:00',
        icon: '🍎',
        prepTip: 'Scegli il frutto di oggi (150g a testa): aggiorna automaticamente la lista della spesa di oggi!',
        items: [
          {
            name: 'Frutta fresca (150g a scelta)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeFruttaFrescaOptions(150, 150)
          }
        ]
      },
      cena: {
        title: 'Cena',
        defaultTime: '20:30',
        icon: '🍗',
        prepTip: 'Scegli il taglio di carne bianca e la verdura del contorno: vedrai subito ricetta e tempi di cottura esatti!',
        items: [
          {
            name: 'Carne bianca (1 taglio a scelta)',
            isChoice: true,
            shopCat: 'Carne e Uova',
            options: [
              { label: 'Pollo - petto', leo: 200, vita: 150, unit: 'g' },
              { label: 'Tacchino - petto', leo: 200, vita: 150, unit: 'g' },
              { label: 'Hamburgher di pollo', leo: 200, vita: 150, unit: 'g' },
              { label: 'Pollo - fuso senza pelle', leo: 200, vita: 150, unit: 'g' },
              { label: 'Pollo - sovracoscio senza pelle', leo: 200, vita: 150, unit: 'g' },
              { label: 'Pollo - coscia', leo: 200, vita: 150, unit: 'g' }
            ]
          },
          {
            name: 'Contorno vegetale a scelta (200g)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeContornoOptions(200, 200)
          },
          { name: 'Pane di tipo integrale', leo: 60, vita: 0, unit: 'g', shopCat: 'Panetteria' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      }
    }
  },

  // ===================== MARTEDÌ =====================
  {
    dayId: 'martedi',
    dayName: 'Martedì',
    shortName: 'Mar',
    theme: 'Minestrone & Formaggio Fresco | Pesce a Cena',
    prepToday: [
      'Colazione ore 08:00: Fette biscottate integrali (3 fette Leo / 2 fette Vita) con marmellata.',
      'Olio EVO totale del giorno: 30g per Leonardo (15g+15g) e 20g per Vita Lucia (10g+10g).',
      'Cena ore 20:30: Scegli il pesce qui sotto per vedere la ricetta dedicata e il peso da cotto.'
    ],
    prepTonightForTomorrow: 'Per MERCOLEDÌ: controlla di avere il riso (160g totali), 4 uova fresche per il pranzo e Bresaola o Prosciutto crudo magro per domani sera!',
    meals: {
      colazione: {
        title: 'Colazione',
        defaultTime: '08:00',
        icon: '🍯',
        prepTip: 'Fette biscottate integrali con marmellata, latte Zymil e caffè.',
        items: [
          { name: 'Latte Zymil', leo: 150, vita: 150, unit: 'g', shopCat: 'Latticini' },
          { name: 'Caffè moka in tazza', leo: 30, vita: 30, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Zucchero di canna', leo: 5, vita: 5, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Fette biscottate integrali', leo: 30, vita: 20, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Marmellata', leo: 30, vita: 20, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      spuntino: {
        title: 'Spuntino Mattina',
        defaultTime: '11:00',
        icon: '🥣',
        prepTip: 'Yogurt magro alle 11:00 (+ 10g cioccolato fondente per Leonardo).',
        items: [
          { name: 'Yogurt da latte scremato', leo: 130, vita: 130, unit: 'g', shopCat: 'Latticini' },
          { name: 'Cioccolato fondente', leo: 10, vita: 0, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      pranzo: {
        title: 'Pranzo',
        defaultTime: '14:00',
        icon: '🍲',
        prepTip: 'Minestrone (200g a testa) + 5g di Parmigiano + il formaggio fresco scelto qui sotto.',
        items: [
          { name: 'Minestrone di verdure', leo: 200, vita: 200, unit: 'g', shopCat: 'Ortofrutta' },
          {
            name: 'Formaggio fresco (1 a scelta)',
            isChoice: true,
            shopCat: 'Latticini',
            options: [
              { label: 'Ricotta di vacca', leo: 150, vita: 110, unit: 'g' },
              { label: 'Giuncata', leo: 120, vita: 90, unit: 'g' },
              { label: 'Philadelphia light', leo: 100, vita: 80, unit: 'g' },
              { label: 'Formaggio Caprino Nonno Nanni', leo: 90, vita: 60, unit: 'g' },
              { label: 'Mozzarella di vacca', leo: 80, vita: 60, unit: 'g' },
              { label: 'Certosino', leo: 80, vita: 60, unit: 'g' },
              { label: 'Crescenza', leo: 80, vita: 60, unit: 'g' }
            ]
          },
          { name: 'Pane di tipo integrale', leo: 50, vita: 50, unit: 'g', shopCat: 'Panetteria' },
          { name: 'Parmigiano grattugiato', leo: 5, vita: 5, unit: 'g', shopCat: 'Latticini' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      merenda: {
        title: 'Merenda Pomeridiana',
        defaultTime: '17:00',
        icon: '🍐',
        prepTip: '150g di frutta fresca alle 17:00.',
        items: [
          {
            name: 'Frutta fresca (150g a scelta)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeFruttaFrescaOptions(150, 150)
          }
        ]
      },
      cena: {
        title: 'Cena',
        defaultTime: '20:30',
        icon: '🐟',
        prepTip: 'Scegli quale pesce cucinare stasera: la ricetta qui sotto si aggiorna con cottura e grammature esatte!',
        items: [
          {
            name: 'Pesce fresco o decongelato (1 a scelta)',
            isChoice: true,
            shopCat: 'Pesce',
            options: [
              { label: 'Merluzzo o nasello fresco', leo: 290, vita: 230, unit: 'g' },
              { label: 'Calamari freschi', leo: 300, vita: 250, unit: 'g' },
              { label: 'Polpo', leo: 300, vita: 300, unit: 'g' },
              { label: 'Seppie', leo: 280, vita: 230, unit: 'g' },
              { label: 'Pesce Persico', leo: 270, vita: 220, unit: 'g' },
              { label: 'Rana Pescatrice', leo: 270, vita: 200, unit: 'g' },
              { label: 'Platessa o passera', leo: 250, vita: 200, unit: 'g' },
              { label: 'Pesce spada', leo: 200, vita: 150, unit: 'g' },
              { label: 'Salmone fresco', leo: 110, vita: 100, unit: 'g' }
            ]
          },
          {
            name: 'Contorno vegetale a scelta (200g)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeContornoOptions(200, 200)
          },
          { name: 'Pane di tipo integrale', leo: 60, vita: 0, unit: 'g', shopCat: 'Panetteria' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      }
    }
  },

  // ===================== MERCOLEDÌ =====================
  {
    dayId: 'mercoledi',
    dayName: 'Mercoledì',
    shortName: 'Mer',
    theme: 'Risotto & Uova a Pranzo | Bresaola/Crudo a Cena',
    prepToday: [
      'Pranzo ore 14:00: scegli tra Riso al pomodoro, Risotto ai funghi o Risotto con la zucca (90g crudi Leo → ~235g cotti | 70g crudi Vita → ~182g cotti) + 2 Uova a testa.',
      'Cena ore 20:30: Bresaola o Prosciutto crudo magro (100g Leo / 80g Vita) senza aggiungere sale!'
    ],
    prepTonightForTomorrow: 'Per GIOVEDÌ: prepara il Filetto di Vitello (250g Leo + 150g Vita = 400g totali) per il pranzo di domani!',
    meals: {
      colazione: {
        title: 'Colazione',
        defaultTime: '08:00',
        icon: '☕',
        prepTip: 'Latte Zymil, caffè moka e biscotti secchi.',
        items: [
          { name: 'Latte Zymil', leo: 150, vita: 150, unit: 'g', shopCat: 'Latticini' },
          { name: 'Caffè moka in tazza', leo: 30, vita: 30, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Zucchero di canna', leo: 5, vita: 5, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Biscotti secchi', leo: 30, vita: 20, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      spuntino: {
        title: 'Spuntino Mattina',
        defaultTime: '11:00',
        icon: '🥜',
        prepTip: 'Frutta secca a guscio alle 11:00.',
        items: [
          {
            name: 'Frutta secca a guscio (1 a scelta)',
            isChoice: true,
            shopCat: 'Dispensa',
            options: [
              { label: 'Noci secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Mandorle dolci secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Pistacchi (non salati)', leo: 30, vita: 20, unit: 'g' },
              { label: 'Nocciole secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Anacardi', leo: 30, vita: 20, unit: 'g' },
              { label: 'Arachidi tostate', leo: 30, vita: 20, unit: 'g' },
              { label: 'Pinoli', leo: 30, vita: 20, unit: 'g' }
            ]
          }
        ]
      },
      pranzo: {
        title: 'Pranzo',
        defaultTime: '14:00',
        icon: '🍚',
        prepTip: 'Scegli quale risotto preparare oggi: la ricetta qui sotto si aggiorna passo-passo!',
        items: [
          {
            name: 'Primo di riso (1 a scelta)',
            isChoice: true,
            shopCat: 'Dispensa',
            options: [
              { label: 'Risotto ai funghi', leo: 90, vita: 70, unit: 'g' },
              { label: 'Risotto con la zucca', leo: 90, vita: 70, unit: 'g' },
              { label: 'Riso al pomodoro', leo: 90, vita: 70, unit: 'g' }
            ]
          },
          { name: 'Uovo di gallina - intero (2 uova)', leo: 120, vita: 120, unit: 'g', shopCat: 'Carne e Uova' },
          { name: 'Parmigiano grattugiato', leo: 10, vita: 5, unit: 'g', shopCat: 'Latticini' },
          { name: 'Insalata mista', leo: 100, vita: 100, unit: 'g', shopCat: 'Ortofrutta' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      merenda: {
        title: 'Merenda Pomeridiana',
        defaultTime: '17:00',
        icon: '🍊',
        prepTip: '150g di frutta fresca alle 17:00.',
        items: [
          {
            name: 'Frutta fresca (150g a scelta)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeFruttaFrescaOptions(150, 150)
          }
        ]
      },
      cena: {
        title: 'Cena',
        defaultTime: '20:30',
        icon: '🥩',
        prepTip: 'Scegli Bresaola o Prosciutto crudo magro e la verdura di contorno per aggiornare ricetta e spesa!',
        items: [
          {
            name: 'Affettato magro (1 a scelta)',
            isChoice: true,
            shopCat: 'Carne e Uova',
            options: [
              { label: 'Bresaola', leo: 100, vita: 80, unit: 'g' },
              { label: 'Prosciutto crudo magro (sgrassato)', leo: 100, vita: 80, unit: 'g' }
            ]
          },
          {
            name: 'Contorno vegetale a scelta (200g)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeContornoOptions(200, 200)
          },
          { name: 'Pane di tipo integrale', leo: 60, vita: 30, unit: 'g', shopCat: 'Panetteria' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      }
    }
  },

  // ===================== GIOVEDÌ =====================
  {
    dayId: 'giovedi',
    dayName: 'Giovedì',
    shortName: 'Gio',
    theme: 'Filetto di Vitello a Pranzo | Formaggio Fresco a Cena',
    prepToday: [
      'Pranzo ore 14:00: Filetto di vitello (250g crudi Leo → ~188g cotti | 150g crudi Vita → ~112g cotti).',
      '⚠️ SVEGLIA SERALE 21:30: Metti in ammollo 150g di legumi secchi (80g Leo + 70g Vita) per il pranzo di VENERDÌ!'
    ],
    prepTonightForTomorrow: '⚠️ AMMOLLO OBBLIGATORIO STASERA: Metti in ammollo 150g di legumi secchi (80g Leo + 70g Vita) per la pasta/riso e legumi di domani (Venerdì)!',
    meals: {
      colazione: {
        title: 'Colazione',
        defaultTime: '08:00',
        icon: '🍯',
        prepTip: 'Fette biscottate integrali con marmellata, latte Zymil e caffè.',
        items: [
          { name: 'Latte Zymil', leo: 150, vita: 150, unit: 'g', shopCat: 'Latticini' },
          { name: 'Caffè moka in tazza', leo: 30, vita: 30, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Zucchero di canna', leo: 5, vita: 5, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Fette biscottate integrali', leo: 30, vita: 20, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Marmellata', leo: 30, vita: 20, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      spuntino: {
        title: 'Spuntino Mattina',
        defaultTime: '11:00',
        icon: '🥣',
        prepTip: 'Yogurt magro (+ 2 quadratini di fondente per Leonardo).',
        items: [
          { name: 'Yogurt da latte scremato', leo: 130, vita: 130, unit: 'g', shopCat: 'Latticini' },
          { name: 'Cioccolato fondente', leo: 10, vita: 0, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      pranzo: {
        title: 'Pranzo',
        defaultTime: '14:00',
        icon: '🥩',
        prepTip: 'Filetto di vitello su piastra ben calda + contorno vegetale scelto e pane integrale.',
        items: [
          { name: 'Vitello - filetto', leo: 250, vita: 150, unit: 'g', shopCat: 'Carne e Uova' },
          {
            name: 'Contorno vegetale a scelta (200g)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeContornoOptions(200, 200)
          },
          { name: 'Pane di tipo integrale', leo: 70, vita: 50, unit: 'g', shopCat: 'Panetteria' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      merenda: {
        title: 'Merenda Pomeridiana',
        defaultTime: '17:00',
        icon: '🍏',
        prepTip: '150g di frutta fresca alle 17:00.',
        items: [
          {
            name: 'Frutta fresca (150g a scelta)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeFruttaFrescaOptions(150, 150)
          }
        ]
      },
      cena: {
        title: 'Cena',
        defaultTime: '20:30',
        icon: '🧀',
        prepTip: 'Scegli il formaggio fresco e la verdura di stasera.',
        items: [
          {
            name: 'Formaggio fresco (1 a scelta)',
            isChoice: true,
            shopCat: 'Latticini',
            options: [
              { label: 'Ricotta di vacca', leo: 150, vita: 110, unit: 'g' },
              { label: 'Giuncata', leo: 120, vita: 90, unit: 'g' },
              { label: 'Philadelphia light', leo: 100, vita: 80, unit: 'g' },
              { label: 'Formaggio Caprino Nonno Nanni', leo: 90, vita: 60, unit: 'g' },
              { label: 'Mozzarella di vacca', leo: 80, vita: 60, unit: 'g' },
              { label: 'Certosino', leo: 80, vita: 60, unit: 'g' },
              { label: 'Crescenza', leo: 80, vita: 60, unit: 'g' }
            ]
          },
          {
            name: 'Contorno vegetale a scelta (200g)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeContornoOptions(200, 200)
          },
          { name: 'Pane di tipo integrale', leo: 60, vita: 30, unit: 'g', shopCat: 'Panetteria' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      }
    }
  },

  // ===================== VENERDÌ =====================
  {
    dayId: 'venerdi',
    dayName: 'Venerdì',
    shortName: 'Ven',
    theme: 'Pasta/Riso e Legumi a Pranzo | Uova a Cena',
    prepToday: [
      'A Secco → Cotto Pranzo: 80g legumi Leo (~200g cotti) + 70g legumi Vita (~175g cotti) uniti a 40g a testa di Pasta o Riso Basmati.',
      'Cena ore 20:30: 2 uova per Leonardo (120g) e 1 uovo per Vita Lucia (60g).'
    ],
    prepTonightForTomorrow: 'Per SABATO: prepara o scongela il pesce per il pranzo di domani (e preparatevi per la Pizza Bianca con verdure grigliate di Sabato sera! 🍕).',
    meals: {
      colazione: {
        title: 'Colazione',
        defaultTime: '08:00',
        icon: '☕',
        prepTip: 'Latte Zymil, caffè moka e biscotti secchi.',
        items: [
          { name: 'Latte Zymil', leo: 150, vita: 150, unit: 'g', shopCat: 'Latticini' },
          { name: 'Caffè moka in tazza', leo: 30, vita: 30, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Zucchero di canna', leo: 5, vita: 5, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Biscotti secchi', leo: 30, vita: 20, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      spuntino: {
        title: 'Spuntino Mattina',
        defaultTime: '11:00',
        icon: '🥜',
        prepTip: 'Frutta secca a scelta alle 11:00.',
        items: [
          {
            name: 'Frutta secca a guscio (1 a scelta)',
            isChoice: true,
            shopCat: 'Dispensa',
            options: [
              { label: 'Mandorle dolci secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Pistacchi (non salati)', leo: 30, vita: 20, unit: 'g' },
              { label: 'Noci secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Nocciole secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Anacardi', leo: 30, vita: 20, unit: 'g' },
              { label: 'Arachidi tostate', leo: 30, vita: 20, unit: 'g' },
              { label: 'Pinoli', leo: 30, vita: 20, unit: 'g' }
            ]
          }
        ]
      },
      pranzo: {
        title: 'Pranzo',
        defaultTime: '14:00',
        icon: '🍝',
        prepTip: 'Scegli il legume e il cereale (Pasta integrale, Pasta di semola o Riso Basmati) per la ricetta completa!',
        items: [
          {
            name: 'Legumi secchi (1 a scelta)',
            isChoice: true,
            shopCat: 'Dispensa',
            options: makeLegumiOptions(80, 70)
          },
          {
            name: 'Cereale da unire ai legumi (1 a scelta)',
            isChoice: true,
            shopCat: 'Dispensa',
            options: [
              { label: 'Pasta integrale', leo: 40, vita: 40, unit: 'g' },
              { label: 'Pasta di semola', leo: 40, vita: 40, unit: 'g' },
              { label: 'Riso Basmati', leo: 40, vita: 40, unit: 'g' }
            ]
          },
          { name: 'Insalata mista', leo: 100, vita: 100, unit: 'g', shopCat: 'Ortofrutta' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      merenda: {
        title: 'Merenda Pomeridiana',
        defaultTime: '17:00',
        icon: '🍓',
        prepTip: '150g di frutta fresca alle 17:00.',
        items: [
          {
            name: 'Frutta fresca (150g a scelta)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeFruttaFrescaOptions(150, 150)
          }
        ]
      },
      cena: {
        title: 'Cena',
        defaultTime: '20:30',
        icon: '🍳',
        prepTip: 'Uova (2 per Leonardo = 120g, 1 per Vita Lucia = 60g) + verdura scelta e pane integrale.',
        items: [
          { name: 'Uovo di gallina - intero', leo: 120, vita: 60, unit: 'g', shopCat: 'Carne e Uova' },
          {
            name: 'Contorno vegetale a scelta (200g)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeContornoOptions(200, 200)
          },
          { name: 'Pane di tipo integrale', leo: 60, vita: 30, unit: 'g', shopCat: 'Panetteria' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      }
    }
  },

  // ===================== SABATO =====================
  {
    dayId: 'sabato',
    dayName: 'Sabato',
    shortName: 'Sab',
    theme: 'Pesce a Pranzo | Serata Pizza Bianca con Verdure! 🍕',
    prepToday: [
      'Pranzo ore 14:00: Pesce fresco (stesso peso per Leonardo e Vita Lucia!) + 200g di contorno vegetale.',
      'Cena ore 20:30: Pizza bianca con verdure grigliate (300g a testa)!'
    ],
    prepTonightForTomorrow: 'Per DOMENICA: prepara il ragù magro o i funghi porcini per il pranzo domenicale + la bistecca di maiale magra o il filetto di vitello!',
    meals: {
      colazione: {
        title: 'Colazione',
        defaultTime: '08:00',
        icon: '🍯',
        prepTip: 'Fette biscottate integrali e marmellata con latte Zymil e caffè.',
        items: [
          { name: 'Latte Zymil', leo: 150, vita: 150, unit: 'g', shopCat: 'Latticini' },
          { name: 'Caffè moka in tazza', leo: 30, vita: 30, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Zucchero di canna', leo: 5, vita: 5, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Fette biscottate integrali', leo: 30, vita: 20, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Marmellata', leo: 30, vita: 20, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      spuntino: {
        title: 'Spuntino Mattina',
        defaultTime: '11:00',
        icon: '🥣',
        prepTip: 'Yogurt magro alle 11:00 (+ 2 quadratini di fondente per Leonardo).',
        items: [
          { name: 'Yogurt da latte scremato', leo: 130, vita: 130, unit: 'g', shopCat: 'Latticini' },
          { name: 'Cioccolato fondente', leo: 10, vita: 0, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      pranzo: {
        title: 'Pranzo',
        defaultTime: '14:00',
        icon: '🐟',
        prepTip: 'Scegli il pesce e il contorno: il sabato a pranzo le grammature del pesce sono identiche per entrambi!',
        items: [
          {
            name: 'Pesce fresco o decongelato (1 a scelta)',
            isChoice: true,
            shopCat: 'Pesce',
            options: [
              { label: 'Calamari freschi', leo: 250, vita: 250, unit: 'g' },
              { label: 'Merluzzo o nasello fresco', leo: 230, vita: 230, unit: 'g' },
              { label: 'Seppie', leo: 230, vita: 230, unit: 'g' },
              { label: 'Pesce Persico', leo: 220, vita: 220, unit: 'g' },
              { label: 'Platessa o passera', leo: 200, vita: 200, unit: 'g' },
              { label: 'Rana Pescatrice', leo: 200, vita: 200, unit: 'g' },
              { label: 'Polpo', leo: 300, vita: 300, unit: 'g' },
              { label: 'Pesce spada', leo: 150, vita: 150, unit: 'g' },
              { label: 'Salmone fresco', leo: 100, vita: 100, unit: 'g' }
            ]
          },
          {
            name: 'Contorno vegetale a scelta (200g)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeContornoOptions(200, 200)
          },
          { name: 'Pane di tipo integrale', leo: 50, vita: 0, unit: 'g', shopCat: 'Panetteria' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      merenda: {
        title: 'Merenda Pomeridiana',
        defaultTime: '17:00',
        icon: '🍑',
        prepTip: '150g di frutta fresca alle 17:00.',
        items: [
          {
            name: 'Frutta fresca (150g a scelta)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeFruttaFrescaOptions(150, 150)
          }
        ]
      },
      cena: {
        title: 'Cena del Sabato',
        defaultTime: '20:30',
        icon: '🍕',
        prepTip: 'Pizza bianca con verdure grigliate (300g a testa)!',
        items: [
          { name: 'Pizza bianca con verdure grigliate', leo: 300, vita: 300, unit: 'g', shopCat: 'Panetteria' }
        ]
      }
    }
  },

  // ===================== DOMENICA =====================
  {
    dayId: 'domenica',
    dayName: 'Domenica',
    shortName: 'Dom',
    theme: 'Pranzo della Domenica Completo | Formaggio Fresco a Cena',
    prepToday: [
      'Pranzo della Domenica (14:00): Pasta al ragù o Tagliatelle ai porcini (90g Leo / 70g Vita) + Secondo di carne (200g Leo / 150g Vita).',
      '⚠️ SVEGLIA SERALE 21:30: Metti in ammollo 170g di legumi secchi (100g Leo + 70g Vita) per il pranzo di LUNEDÌ!'
    ],
    prepTonightForTomorrow: '⚠️ AMMOLLO OBBLIGATORIO STASERA: Metti in ammollo 170g di legumi secchi (100g Leo + 70g Vita) per il pranzo di domani (Lunedì)!',
    meals: {
      colazione: {
        title: 'Colazione',
        defaultTime: '08:00',
        icon: '☕',
        prepTip: 'Colazione della domenica alle 08:00 con latte Zymil, caffè e biscotti secchi.',
        items: [
          { name: 'Latte Zymil', leo: 150, vita: 150, unit: 'g', shopCat: 'Latticini' },
          { name: 'Caffè moka in tazza', leo: 30, vita: 30, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Zucchero di canna', leo: 5, vita: 5, unit: 'g', shopCat: 'Dispensa' },
          { name: 'Biscotti secchi', leo: 30, vita: 20, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      spuntino: {
        title: 'Spuntino Mattina',
        defaultTime: '11:00',
        icon: '🥜',
        prepTip: 'Frutta secca a guscio alle 11:00.',
        items: [
          {
            name: 'Frutta secca a guscio (1 a scelta)',
            isChoice: true,
            shopCat: 'Dispensa',
            options: [
              { label: 'Mandorle dolci secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Noci secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Pistacchi (non salati)', leo: 30, vita: 20, unit: 'g' },
              { label: 'Nocciole secche', leo: 30, vita: 20, unit: 'g' },
              { label: 'Anacardi', leo: 30, vita: 20, unit: 'g' },
              { label: 'Arachidi tostate', leo: 30, vita: 20, unit: 'g' },
              { label: 'Pinoli', leo: 30, vita: 20, unit: 'g' }
            ]
          }
        ]
      },
      pranzo: {
        title: 'Pranzo della Domenica',
        defaultTime: '14:00',
        icon: '🍝',
        prepTip: 'Scegli il primo, il secondo e il contorno della Domenica: la ricetta si adatta alle tue scelte!',
        items: [
          {
            name: 'Primo piatto della domenica (1 a scelta)',
            isChoice: true,
            shopCat: 'Dispensa',
            options: [
              { label: 'Pasta al ragù magro', leo: 90, vita: 70, unit: 'g' },
              { label: 'Tagliatelle ai funghi porcini', leo: 90, vita: 70, unit: 'g' }
            ]
          },
          {
            name: 'Secondo di carne (1 a scelta)',
            isChoice: true,
            shopCat: 'Carne e Uova',
            options: [
              { label: 'Maiale - magro bistecca (arista/lonza)', leo: 200, vita: 150, unit: 'g' },
              { label: 'Vitello - filetto', leo: 200, vita: 150, unit: 'g' }
            ]
          },
          {
            name: 'Contorno vegetale a scelta (150g)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeContornoOptions(150, 150)
          },
          { name: 'Parmigiano grattugiato', leo: 10, vita: 5, unit: 'g', shopCat: 'Latticini' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      },
      merenda: {
        title: 'Merenda Pomeridiana',
        defaultTime: '17:00',
        icon: '🍎',
        prepTip: '150g di frutta fresca alle 17:00.',
        items: [
          {
            name: 'Frutta fresca (150g a scelta)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeFruttaFrescaOptions(150, 150)
          }
        ]
      },
      cena: {
        title: 'Cena',
        defaultTime: '20:30',
        icon: '🧀',
        prepTip: 'Cena leggera della domenica: scegli il formaggio fresco e la verdura.',
        items: [
          {
            name: 'Formaggio fresco (1 a scelta)',
            isChoice: true,
            shopCat: 'Latticini',
            options: [
              { label: 'Ricotta di vacca', leo: 150, vita: 110, unit: 'g' },
              { label: 'Giuncata', leo: 120, vita: 90, unit: 'g' },
              { label: 'Philadelphia light', leo: 100, vita: 80, unit: 'g' },
              { label: 'Formaggio Caprino Nonno Nanni', leo: 90, vita: 60, unit: 'g' },
              { label: 'Mozzarella di vacca', leo: 80, vita: 60, unit: 'g' },
              { label: 'Certosino', leo: 80, vita: 60, unit: 'g' },
              { label: 'Crescenza', leo: 80, vita: 60, unit: 'g' }
            ]
          },
          {
            name: 'Contorno vegetale a scelta (200g)',
            isChoice: true,
            shopCat: 'Ortofrutta',
            options: makeContornoOptions(200, 200)
          },
          { name: 'Pane di tipo integrale', leo: 60, vita: 0, unit: 'g', shopCat: 'Panetteria' },
          { name: 'Olio di oliva extravergine (a crudo)', leo: 15, vita: 10, unit: 'g', shopCat: 'Dispensa' }
        ]
      }
    }
  }
];

const ACHIEVEMENTS = [
  { id: 'first_meal', icon: '🌱', title: 'Inizio del Viaggio!', desc: 'Hai completato il primo pasto del piano terapeutico.', check: (s) => s.totalMealsChecked >= 1 },
  { id: 'water_2l', icon: '💧', title: 'Idratazione 2 Litri!', desc: 'Hai raggiunto l\'obiettivo minimo di 2.000 ml d\'acqua in un giorno!', check: (s) => s.todayWaterMl >= 2000 || s.waterDaysCompleted >= 1 },
  { id: 'full_day', icon: '⭐', title: 'Giornata 100% Perfetta', desc: 'Tutti i 5 pasti del giorno completati agli orari giusti!', check: (s) => s.todayMealsCount >= 5 || s.streakDays >= 1 },
  { id: 'steps_5k', icon: '👟', title: 'Vita in Movimento', desc: 'Hai registrato passi o attività sportiva nella giornata!', check: (s) => s.todaySteps >= 3000 || s.todayKcalBurned >= 150 },
  { id: 'streak_3', icon: '🔥', title: '3 Giorni di Costanza', desc: '3 giorni consecutivi seguendo il percorso!', check: (s) => s.streakDays >= 3 },
  { id: 'streak_7', icon: '🏆', title: '1ª Settimana Vinta!', desc: '7 giorni completati con determinazione!', check: (s) => s.streakDays >= 7 },
  { id: 'weight_drop', icon: '📉', title: 'Primi Risultati sulla Bilancia!', desc: 'Hai registrato il check del peso e iniziato a scendere!', check: (s) => s.weightLogsCount >= 1 },
  { id: 'streak_30', icon: '👑', title: 'Campioni del Mese (30 gg)', desc: 'Un mese intero di benessere e autostima!', check: (s) => s.streakDays >= 30 }
];
