const SYSTEMS = [
  { id: 'power', name: 'Power grid', icon: 'ϟ', mass: 280, power: 0, description: 'Deploy solar arrays and battery storage for surface operations.', category: 'INFRASTRUCTURE', dependency: null },
  { id: 'habitat', name: 'Habitat shell', icon: '⌂', mass: 340, power: 0, description: 'Seal and pressurize a radiation-shielded crew habitat.', category: 'HABITAT', dependency: null },
  { id: 'thermal', name: 'Thermal regulation', icon: '◉', mass: 90, power: 12, description: 'Maintain safe temperatures through extreme Martian nights.', category: 'LIFE SUPPORT', dependency: 'habitat' },
  { id: 'lifeSupport', name: 'Atmospheric recycler', icon: '↻', mass: 120, power: 18, description: 'Recycle cabin air and replenish the crew oxygen supply.', category: 'LIFE SUPPORT', dependency: 'power' },
  { id: 'water', name: 'Water recovery', icon: '◇', mass: 90, power: 12, description: 'Recover and purify water for the crew and greenhouse.', category: 'LIFE SUPPORT', dependency: 'power' },
  { id: 'greenhouse', name: 'Bio-nutrient lab', icon: '✳', mass: 70, power: 15, description: 'Grow supplemental food and close the nutrient loop.', category: 'SCIENCE', dependency: 'water' },
  { id: 'stormShelter', name: 'Storm anchors', icon: '⌁', mass: 110, power: 8, description: 'Brace surface equipment against regional dust fronts.', category: 'HAZARD MITIGATION', dependency: 'habitat' },
  { id: 'radiationShield', name: 'Radiation shelter', icon: '◈', mass: 130, power: 4, description: 'Add storm-cell shielding for high-radiation solar events.', category: 'HAZARD MITIGATION', dependency: 'habitat' },
  { id: 'iceDrill', name: 'Subsurface ice drill', icon: '⛏', mass: 155, power: 22, description: 'Extract local ice to support food production and long stays.', category: 'IN-SITU RESOURCE', dependency: 'power' },
  { id: 'fieldWorkshop', name: 'Field workshop', icon: '⚒', mass: 100, power: 10, description: 'Keep exposed equipment running through abrasive dust.', category: 'MAINTENANCE', dependency: 'power' },
  { id: 'commsRelay', name: 'Deep-space relay', icon: '⌁', mass: 75, power: 8, description: 'Maintain a resilient link through orbital communications outages.', category: 'COMMUNICATIONS', dependency: 'power' },
  { id: 'medicalBay', name: 'Crew medical bay', icon: '✚', mass: 120, power: 10, description: 'Treat injuries and restore crew health during surface operations.', category: 'CREW SUPPORT', dependency: 'habitat' }
];
const OBJECTIVE_COUNT = 2;
const MIN_MASS_BUDGET = 1250;
const MAX_MASS_BUDGET = 1500;
const MIN_POWER_BUDGET = 125;
const MAX_POWER_BUDGET = 150;
const MIN_SOLS = 4;
const MAX_SOLS = 14;
const MIN_EVENT_CHANCE = 10;
const MAX_EVENT_CHANCE = 75;
const MAX_LEVEL = 10;
const XP_PER_MISSION = 10;
const UPGRADE_COST = 1;
const MAX_UPGRADE_RANK = 3;
const POWER_KW_PER_RANK = 5;
const PLAYER_PROFILE_KEY = 'axel-player-profile';
const MISSION_BRIEFING_SEEN_KEY = 'axel-mission-briefing-seen';

const UPGRADE_DEFINITIONS = [
  { id: 'powerGrid', name: 'Solar array expansion', concept: 'POWER GRID', icon: 'ϟ', description: 'Expand array generation capacity for your mission plan.', effect: '+5 kW available power per rank.' },
  { id: 'recycler', name: 'Recycler throughput', concept: 'ATMOSPHERIC RECYCLER', icon: '↻', description: 'Improve oxygen recovery when the recycler and power grid are online.', effect: '+2 oxygen recovered per Sol per rank.' },
  { id: 'greenhouse', name: 'Bio-nutrient yield', concept: 'BIO-NUTRIENT LAB', icon: '✳', description: 'Increase food production when the lab and water recovery are online.', effect: '+2 food produced per Sol per rank.' },
  { id: 'medicalBay', name: 'Medical response', concept: 'CREW MEDICAL BAY', icon: '✚', description: 'Improve crew recovery each Sol while the medical bay is deployed.', effect: '+2 health restored per Sol per rank.' }
];

const HAZARDS = [
  { id: 'dust', name: 'Regional dust storm', system: 'stormShelter' },
  { id: 'radiation', name: 'Intense radiation spike', system: 'radiationShield' },
  { id: 'cold', name: 'Extreme cold snap', system: 'thermal' },
  { id: 'abrasion', name: 'Regolith abrasion front', system: 'fieldWorkshop' },
  { id: 'comms', name: 'Communications blackout', system: 'commsRelay' },
  { id: 'solarflare', name: 'Intense solar radiation event', system: 'radiationShield' },
  { id: 'impact', name: 'Micrometeorite shower', system: 'stormShelter' },
  { id: 'wind', name: 'Strong winds', system: 'stormShelter' }
];

function defaultPlayerProfile() {
  return {
    level: 1,
    xp: 0,
    upgradePoints: 0,
    upgrades: Object.fromEntries(UPGRADE_DEFINITIONS.map((upgrade) => [upgrade.id, 0]))
  };
}

function boundedInteger(value, minimum, maximum, fallback) {
  return Number.isInteger(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
}

function loadPlayerProfile() {
  const fallback = defaultPlayerProfile();
  let serialized;
  try {
    serialized = localStorage.getItem(PLAYER_PROFILE_KEY);
  } catch (error) {
    console.error('Could not read the saved AXEL commander profile.', error);
    return fallback;
  }
  if (!serialized) return fallback;

  let saved;
  try {
    saved = JSON.parse(serialized);
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    console.error('The saved AXEL commander profile is not valid JSON.', error);
    return fallback;
  }
  if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
    console.error('The saved AXEL commander profile has an invalid format.');
    return fallback;
  }

  const level = boundedInteger(saved.level, 1, MAX_LEVEL, 1);
  const upgrades = {};
  UPGRADE_DEFINITIONS.forEach((upgrade) => {
    const savedRank = saved.upgrades && typeof saved.upgrades === 'object' ? saved.upgrades[upgrade.id] : undefined;
    upgrades[upgrade.id] = boundedInteger(savedRank, 0, MAX_UPGRADE_RANK, 0);
  });
  return {
    level,
    xp: level === MAX_LEVEL ? 0 : boundedInteger(saved.xp, 0, level * 100 - 1, 0),
    upgradePoints: boundedInteger(saved.upgradePoints, 0, 1000000, 0),
    upgrades
  };
}

function savePlayerProfile() {
  try {
    localStorage.setItem(PLAYER_PROFILE_KEY, JSON.stringify(playerProfile));
  } catch (error) {
    console.error('Could not save the AXEL commander profile.', error);
  }
}

const playerProfile = loadPlayerProfile();

function upgradeRank(id) {
  return playerProfile.upgrades[id] || 0;
}

function randomInteger(minimum, maximum) {
  return minimum + Math.floor(Math.random() * (maximum - minimum + 1));
}

function randomMissionSols() {
  return randomInteger(MIN_SOLS, MAX_SOLS);
}

function randomMissionBudgets() {
  return {
    mass: randomInteger(MIN_MASS_BUDGET, MAX_MASS_BUDGET),
    power: randomInteger(MIN_POWER_BUDGET, MAX_POWER_BUDGET)
  };
}

function generateObjectives(previousObjectives = []) {
  const systems = SYSTEMS.slice();
  for (let index = systems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [systems[index], systems[swapIndex]] = [systems[swapIndex], systems[index]];
  }
  const objectives = systems.slice(0, OBJECTIVE_COUNT).map((system) => system.id);
  if (objectives.slice().sort().join(',') === previousObjectives.slice().sort().join(',')) {
    objectives[1] = systems[OBJECTIVE_COUNT].id;
  }
  return objectives;
}

function randomEventLikelihood() {
  return randomInteger(MIN_EVENT_CHANCE, MAX_EVENT_CHANCE) / 100;
}

function generateForecast(missionSols) {
  const hazards = HAZARDS.map((hazard) => ({ ...hazard, likelihood: randomEventLikelihood() }));
  const sols = Array.from({ length: missionSols - 1 }, (_, index) => index + 2);
  for (let index = hazards.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [hazards[index], hazards[swapIndex]] = [hazards[swapIndex], hazards[index]];
  }
  for (let index = sols.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [sols[index], sols[swapIndex]] = [sols[swapIndex], sols[index]];
  }
  const forecast = hazards.slice(0, Math.min(3, sols.length)).map((hazard, index) => ({ ...hazard, sol: sols[index] }));
  const sandstormLikelihood = randomEventLikelihood();
  for (let sol = 2; sol <= missionSols; sol += 1) {
    forecast.push({
      id: 'sandstorm',
      name: 'Sandstorm risk',
      system: 'stormShelter',
      likelihood: sandstormLikelihood,
      sol
    });
  }
  return forecast.sort((a, b) => a.sol - b.sol);
}

const initialMissionSols = randomMissionSols();
const initialBudgets = randomMissionBudgets();
const initialObjectives = generateObjectives();
const state = {
  deployed: new Set(),
  requiredSystems: initialObjectives,
  missionSols: initialMissionSols,
  massBudget: initialBudgets.mass,
  powerBudget: initialBudgets.power + upgradeRank('powerGrid') * POWER_KW_PER_RANK,
  forecast: generateForecast(initialMissionSols),
  sol: 1,
  health: 100,
  oxygen: 100,
  food: 100,
  integrity: 100,
  phase: 0,
  outcome: 'planning',
  lastMissionReward: null,
  events: [{ sol: '001', kind: 'SYSTEM', message: 'Mission control online. Awaiting deployment plan.' }],
  conditions: { radiation: 'LOW', dust: 'CLEAR', solar: 'OPTIMAL', temperature: -63, note: 'Stable conditions at landing site.' }
};

const $ = (id) => document.getElementById(id);
const systemList = $('system-list');
const upgradeList = $('upgrade-list');
const worldPanel = $('world-panel');
const slideTrack = $('slide-track');
const missionSlide = $('mission-slide');
const upgradesSlide = $('upgrades-slide');
let lastPresentedOutcome = state.outcome;
let audioContext;

const uiSoundProfiles = {
  tap: { notes: [[680, 0, 0.045]], wave: 'sine', volume: 0.035 },
  deploy: { notes: [[460, 0, 0.07], [690, 0.055, 0.09]], wave: 'triangle', volume: 0.045 },
  remove: { notes: [[440, 0, 0.07], [310, 0.055, 0.09]], wave: 'triangle', volume: 0.04 },
  confirm: { notes: [[520, 0, 0.08], [780, 0.06, 0.12]], wave: 'sine', volume: 0.045 },
  success: { notes: [[523, 0, 0.16], [659, 0.12, 0.16], [784, 0.24, 0.3]], wave: 'sine', volume: 0.06 },
  failure: { notes: [[330, 0, 0.16], [247, 0.14, 0.18], [185, 0.3, 0.3]], wave: 'triangle', volume: 0.05 }
};

function playUiSound(kind = 'tap') {
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return;
  if (!audioContext) audioContext = new AudioContextConstructor();
  if (audioContext.state === 'suspended') {
    audioContext.resume().catch((error) => console.warn('Could not resume UI audio.', error));
  }

  const profile = uiSoundProfiles[kind] || uiSoundProfiles.tap;
  const now = audioContext.currentTime;
  profile.notes.forEach(([frequency, offset, duration]) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();
    const start = now + offset;
    oscillator.type = profile.wave;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(profile.volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(audioContext.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.015);
  });
}

function selectedMass() {
  return SYSTEMS.reduce((total, system) => total + (state.deployed.has(system.id) ? system.mass : 0), 0);
}

function selectedPower() {
  return SYSTEMS.reduce((total, system) => total + (state.deployed.has(system.id) ? system.power : 0), 0);
}

function canDeploy(system) {
  const dependencyMet = !system.dependency || state.deployed.has(system.dependency);
  return state.outcome === 'planning' && dependencyMet &&
    selectedMass() + system.mass <= state.massBudget &&
    selectedPower() + system.power <= state.powerBudget;
}

function objectivesComplete() {
  return state.requiredSystems.every((systemId) => state.deployed.has(systemId));
}

function renderSystems() {
  systemList.innerHTML = SYSTEMS.map((system) => {
    const deployed = state.deployed.has(system.id);
    const removable = deployed && state.outcome === 'planning';
    const required = state.requiredSystems.includes(system.id);
    const requiredTag = required ? '<span class="objective-tag">REQUIRED</span>' : '';
    const dependency = system.dependency && !state.deployed.has(system.dependency)
      ? `<span class="dependency-tag">REQUIRES ${SYSTEMS.find((item) => item.id === system.dependency).name.toUpperCase()}</span>`
      : '';
    const disabled = deployed ? !removable : !canDeploy(system);
    const locked = !deployed && disabled;
    const action = deployed ? removable ? 'REMOVE' : 'DEPLOYED' : disabled ? 'LOCKED' : 'DEPLOY';
    const ariaLabel = deployed && removable ? `Remove ${system.name} and deployed dependent systems` : `${action} ${system.name}`;
    return `<article class="system-card${deployed ? ' deployed' : ''}${removable ? ' removable' : ''}${locked ? ' locked' : ''}">
      <div class="system-icon" aria-hidden="true">${system.icon}</div>
      <div>
        <div class="system-title-row"><h3 class="system-title">${system.name}</h3>${requiredTag}${dependency}</div>
        <p class="system-description">${system.description}</p>
        <div class="system-meta"><span>${system.mass} KG</span><span>${system.power} KW</span><span>${system.category}</span></div>
      </div>
      <button class="system-action" data-system="${system.id}" ${disabled ? 'disabled' : ''} aria-label="${ariaLabel}">${action}</button>
    </article>`;
  }).join('');
}

function renderEvents() {
  $('event-list').innerHTML = state.events.map((event, index) => {
    const previousEvent = state.events[index - 1];
    const separator = previousEvent && previousEvent.sol !== event.sol
      ? '<div class="event-day-separator" role="separator" aria-label="New Sol"></div>'
      : '';
    return `${separator}<div class="event-item"><span class="event-time">SOL ${event.sol}</span><div class="event-copy"><span class="event-kind ${event.kind.toLowerCase()}">${event.kind}</span><p class="event-message">${event.message}</p></div></div>`;
  }).join('');
}

function renderForecast() {
  $('forecast-range').textContent = `SOL 02–${String(state.missionSols).padStart(2, '0')}`;
  $('forecast-note').textContent = 'Each listed event is rolled once per Sol. Odds refresh every mission.';
  $('forecast-list').innerHTML = state.forecast.map((event) => {
    const system = SYSTEMS.find((item) => item.id === event.system);
    return `<div class="forecast-item"><span class="forecast-sol">SOL ${String(event.sol).padStart(2, '0')}</span><span class="forecast-event">${event.name}</span><span class="forecast-likelihood">${formatLikelihood(event.likelihood)}</span><span class="forecast-response">COUNTER: ${system.name.toUpperCase()}</span></div>`;
  }).join('');
}

function renderObjectives() {
  const requiredSystems = state.requiredSystems.map((systemId) => SYSTEMS.find((system) => system.id === systemId));
  const completed = requiredSystems.filter((system) => state.deployed.has(system.id)).length;
  const missing = requiredSystems.filter((system) => !state.deployed.has(system.id));
  $('objective-progress').textContent = `${completed} / ${requiredSystems.length} COMPLETE`;
  $('objective-list').innerHTML = requiredSystems.map((system) => {
    const deployed = state.deployed.has(system.id);
    return `<li class="objective-item${deployed ? ' complete' : ''}">
      <span class="objective-indicator" aria-hidden="true">${deployed ? '✓' : '○'}</span>
      <span>Deploy <strong>${system.name}</strong></span>
      <span class="objective-state">${deployed ? 'COMPLETE' : 'REQUIRED'}</span>
    </li>`;
  }).join('');
  $('objective-note').textContent = missing.length
    ? `Deploy ${missing.map((system) => system.name).join(' and ')} before launch.`
    : 'All required systems are deployed. Launch is unlocked.';
}

function formatLikelihood(likelihood) {
  return `${Math.round(likelihood * 1000) / 10}%`;
}

function rollForecastEvent(event) {
  const roll = Math.floor(Math.random() * 100);
  const threshold = Math.round(event.likelihood * 100);
  return { ...event, occurs: roll < threshold };
}

function setBar(id, value) {
  $(id).style.width = `${Math.max(0, Math.min(100, value))}%`;
}

function renderPlayerProgress() {
  const maxLevel = playerProfile.level >= MAX_LEVEL;
  const requiredXp = playerProfile.level * 100;
  const currentXp = maxLevel ? requiredXp : playerProfile.xp;
  const progress = maxLevel ? 100 : currentXp / requiredXp * 100;
  $('player-level').textContent = String(playerProfile.level).padStart(2, '0');
  $('xp-label').textContent = maxLevel ? 'MAX LEVEL' : `${currentXp} / ${requiredXp} XP`;
  $('xp-progress').setAttribute('aria-valuemax', String(requiredXp));
  $('xp-progress').setAttribute('aria-valuenow', String(currentXp));
  $('xp-progress').setAttribute('aria-valuetext', maxLevel ? 'Maximum level reached' : `${currentXp} of ${requiredXp} experience`);
  $('xp-fill').style.width = `${progress}%`;
  $('upgrade-points').textContent = String(playerProfile.upgradePoints);
  $('upgrade-button-points').textContent = String(playerProfile.upgradePoints);
  $('upgrade-page-level').textContent = `${playerProfile.level} / ${MAX_LEVEL}`;
  $('upgrade-page-points').textContent = String(playerProfile.upgradePoints);
  $('upgrade-page-xp').textContent = maxLevel ? 'MAX LEVEL' : `${currentXp} / ${requiredXp} XP`;
  $('upgrade-feedback').textContent = playerProfile.upgradePoints > 0
    ? `${playerProfile.upgradePoints} upgrade point${playerProfile.upgradePoints === 1 ? '' : 's'} available. Each rank costs ${UPGRADE_COST} point.`
    : maxLevel
      ? 'Level cap reached. Spend any remaining upgrade points on your mission systems.'
      : 'Complete a mission to earn 10 XP. Every new level grants an upgrade point.';
}

function renderUpgrades() {
  $('upgrade-list').innerHTML = UPGRADE_DEFINITIONS.map((upgrade) => {
    const rank = upgradeRank(upgrade.id);
    const atMaximum = rank >= MAX_UPGRADE_RANK;
    const disabled = atMaximum || playerProfile.upgradePoints < UPGRADE_COST;
    const rankMarkers = Array.from({ length: MAX_UPGRADE_RANK }, (_, index) =>
      `<span class="upgrade-rank-marker${index < rank ? ' unlocked' : ''}"></span>`
    ).join('');
    const action = atMaximum ? 'MAX RANK' : `UPGRADE · ${UPGRADE_COST} PT`;
    return `<article class="upgrade-card${atMaximum ? ' max-rank' : ''}">
      <div class="upgrade-icon" aria-hidden="true">${upgrade.icon}</div>
      <div class="upgrade-copy">
        <div class="upgrade-title-row">
          <div><span class="upgrade-concept">${upgrade.concept}</span><h3>${upgrade.name}</h3></div>
          <span class="upgrade-rank">RANK ${rank} / ${MAX_UPGRADE_RANK}</span>
        </div>
        <p>${upgrade.description}</p>
        <div class="upgrade-effect"><span>PER RANK</span><strong>${upgrade.effect}</strong></div>
        <div class="upgrade-rank-track" aria-label="Upgrade rank ${rank} of ${MAX_UPGRADE_RANK}">${rankMarkers}</div>
      </div>
      <button class="upgrade-action" type="button" data-upgrade="${upgrade.id}" ${disabled ? 'disabled' : ''} aria-label="${atMaximum ? `${upgrade.name} at maximum rank` : `Upgrade ${upgrade.name} for ${UPGRADE_COST} point`}">${action}</button>
    </article>`;
  }).join('');
}

function awardMissionExperience() {
  if (playerProfile.level >= MAX_LEVEL) return { xp: 0, levelsGained: 0 };
  playerProfile.xp += XP_PER_MISSION;
  let levelsGained = 0;
  while (playerProfile.level < MAX_LEVEL && playerProfile.xp >= playerProfile.level * 100) {
    playerProfile.xp -= playerProfile.level * 100;
    playerProfile.level += 1;
    playerProfile.upgradePoints += 1;
    levelsGained += 1;
  }
  if (playerProfile.level >= MAX_LEVEL) playerProfile.xp = 0;
  savePlayerProfile();
  return { xp: XP_PER_MISSION, levelsGained };
}

function setActiveScreen(screen) {
  const showUpgrades = screen === 'upgrades';
  slideTrack.classList.toggle('show-upgrades', showUpgrades);
  missionSlide.inert = showUpgrades;
  upgradesSlide.inert = !showUpgrades;
  missionSlide.setAttribute('aria-hidden', String(showUpgrades));
  upgradesSlide.setAttribute('aria-hidden', String(!showUpgrades));
}

function render() {
  const mass = selectedMass();
  const power = selectedPower();
  const displayedSol = state.outcome === 'complete'
    ? state.missionSols
    : state.outcome === 'failed' ? Math.max(1, state.sol - 1) : state.sol;
  renderPlayerProgress();
  renderUpgrades();
  $('mass-used').textContent = mass.toLocaleString();
  $('mass-limit').textContent = ` / ${state.massBudget.toLocaleString()} kg`;
  $('power-used').textContent = power.toLocaleString();
  $('power-limit').textContent = ` / ${state.powerBudget} kW`;
  $('mass-fill').style.width = `${mass / state.massBudget * 100}%`;
  $('power-fill').style.width = `${power / state.powerBudget * 100}%`;
  $('mass-remaining').textContent = `${(state.massBudget - mass).toLocaleString()} kg remaining`;
  $('power-remaining').textContent = `${state.powerBudget - power} kW remaining`;
  $('system-count').textContent = `${state.deployed.size} / ${SYSTEMS.length} DEPLOYED`;

  $('health-value').textContent = `${Math.round(state.health)}%`;
  $('oxygen-value').textContent = `${Math.round(state.oxygen)}%`;
  $('food-value').textContent = `${Math.round(state.food)}%`;
  $('integrity-value').textContent = `${Math.round(state.integrity)}%`;
  setBar('health-bar', state.health);
  setBar('oxygen-bar', state.oxygen);
  setBar('food-bar', state.food);
  setBar('integrity-bar', state.integrity);
  $('health-indicator').style.background = state.health < 40 ? 'var(--red)' : 'var(--green)';
  $('elapsed-value').textContent = `${String(state.sol - 1).padStart(2, '0')} SOLS`;
  $('sol-label').textContent = `SOL ${String(displayedSol).padStart(3, '0')} / ${String(state.missionSols).padStart(3, '0')}`;
  $('temperature-value').innerHTML = `${state.conditions.temperature < 0 ? '−' : ''}${Math.abs(state.conditions.temperature)}°<small>C</small>`;
  $('radiation-value').textContent = state.conditions.radiation;
  $('dust-value').textContent = state.conditions.dust;
  $('solar-value').textContent = state.conditions.solar;
  $('conditions-note').innerHTML = `<span class="condition-pulse"></span>${state.conditions.note}`;
  document.querySelector('.condition-pulse').style.background = state.conditions.dust === 'STORM' ? 'var(--orange)' : 'var(--green)';
  $('status-chip').textContent = state.outcome === 'planning' ? 'PLANNING' : state.outcome === 'failed' ? 'MISSION LOST' : state.outcome === 'complete' ? 'COMPLETE' : 'ACTIVE';

  const missionStarted = state.outcome !== 'planning';
  const wasMissionStarted = worldPanel.classList.contains('mission-started');
  worldPanel.classList.toggle('mission-started', missionStarted);
  $('mission-log').hidden = !missionStarted;
  $('right-hud-toggle').hidden = !missionStarted;
  if (missionStarted && !wasMissionStarted) {
    worldPanel.classList.add('right-open');
  }
  $('left-hud-toggle').setAttribute('aria-expanded', worldPanel.classList.contains('left-open'));
  $('right-hud-toggle').setAttribute('aria-expanded', worldPanel.classList.contains('right-open'));

  const activePhase = state.phase;
  document.querySelectorAll('.phase-step').forEach((step, index) => {
    step.classList.toggle('current', index === activePhase && state.outcome !== 'failed' && state.outcome !== 'complete');
    step.classList.toggle('complete', index < activePhase || state.outcome === 'complete');
  });
  $('phase-eyebrow').textContent = ['MISSION DESIGN', 'TRANSIT', 'SURFACE OPERATIONS', 'CREW & SCIENCE'][activePhase];
  if (state.outcome === 'planning') {
    const missingObjectives = state.requiredSystems
      .filter((systemId) => !state.deployed.has(systemId))
      .map((systemId) => SYSTEMS.find((system) => system.id === systemId).name);
    const launchReady = missingObjectives.length === 0;
    $('ops-title').textContent = launchReady
      ? state.deployed.size === state.requiredSystems.length ? 'Ready for launch?' : 'Deployment plan in progress'
      : 'Complete launch objectives';
    $('ops-description').textContent = launchReady
      ? `Mission duration: ${state.missionSols} sols. Your systems are ready; monitor crew telemetry after launch.`
      : `Deploy ${missingObjectives.join(' and ')} to unlock mission launch.`;
    $('advance-label').textContent = 'ADVANCE MISSION';
    $('advance-button').disabled = !launchReady;
  } else if (state.outcome === 'failed') {
    $('ops-title').textContent = 'Mission lost';
    $('ops-description').textContent = 'Crew survival thresholds were exceeded. Review your system plan and try again.';
    $('advance-label').textContent = 'RESTART MISSION';
    $('advance-button').disabled = false;
  } else if (state.outcome === 'complete') {
    $('ops-title').textContent = 'Mission complete';
    $('ops-description').textContent = `The crew completed ${state.missionSols} sols on Mars. Mission objectives achieved.`;
    $('advance-label').textContent = 'PLAY AGAIN';
    $('advance-button').disabled = false;
  } else {
    $('ops-title').textContent = `Sol ${String(state.sol).padStart(3, '0')} / ${String(state.missionSols).padStart(3, '0')} operations`;
    $('ops-description').textContent = 'Monitor crew reserves and environmental conditions. Every sol brings a new operational challenge.';
    $('advance-label').textContent = 'ADVANCE SOL';
    $('advance-button').disabled = false;
  }
  renderForecast();
  renderObjectives();
  renderSystems();
  renderEvents();
  if (window.MarsScene) {
    window.MarsScene.setMissionState({
      deployed: Array.from(state.deployed),
      dust: state.conditions.dust,
      radiation: state.conditions.radiation,
      missionSols: state.missionSols,
      phase: state.phase,
      sol: displayedSol
    });
  }

  if ((state.outcome === 'failed' || state.outcome === 'complete') && state.outcome !== lastPresentedOutcome) {
    lastPresentedOutcome = state.outcome;
    presentOutcome();
  } else {
    lastPresentedOutcome = state.outcome;
  }
}

function presentOutcome() {
  const succeeded = state.outcome === 'complete';
  const outcomeDialog = $('outcome-dialog');
  const outcomeSol = succeeded ? state.missionSols : Math.max(1, state.sol - 1);
  const failedMetrics = [
    state.health <= 0 ? 'crew health' : null,
    state.oxygen <= 0 ? 'oxygen reserve' : null,
    state.food <= 0 ? 'food reserve' : null,
    state.integrity <= 0 ? 'habitat integrity' : null
  ].filter(Boolean);

  outcomeDialog.dataset.outcome = state.outcome;
  $('outcome-emblem').textContent = succeeded ? '✓' : '!';
  $('outcome-kicker').textContent = succeeded ? 'MISSION DEBRIEF · SUCCESS' : 'MISSION DEBRIEF · CRITICAL';
  $('outcome-title').textContent = succeeded ? 'CREW SURVIVED' : 'MISSION LOST';
  const reward = state.lastMissionReward;
  const progressionReward = $('progression-reward');
  const leveledUp = succeeded && reward && reward.levelsGained > 0;
  progressionReward.hidden = !leveledUp;
  progressionReward.textContent = leveledUp
    ? `LEVEL UP · LEVEL ${playerProfile.level} — ${reward.levelsGained} UPGRADE POINT${reward.levelsGained === 1 ? '' : 'S'} EARNED`
    : '';
  const rewardMessage = reward
    ? `${reward.xp ? ` +${reward.xp} XP earned.` : ' Commander level cap reached.'}`
    : '';
  $('outcome-description').textContent = succeeded
    ? `Your crew completed all ${state.missionSols} sols on Mars. Mission objectives achieved.${rewardMessage}`
    : `Crew survival limits were breached on Sol ${String(outcomeSol).padStart(2, '0')}: ${failedMetrics.join(', ')}. Review the flight log and revise your plan.`;
  const stat = (label, value) => `<div class="outcome-stat"><span>${label}</span><strong>${value}</strong></div>`;
  const percentage = (value) => `${Math.max(0, Math.min(100, Math.round(value)))}%`;
  $('outcome-stats').innerHTML = [
    stat('SOLS SURVIVED', `${String(outcomeSol).padStart(2, '0')} / ${String(state.missionSols).padStart(2, '0')}`),
    stat('CREW HEALTH', percentage(state.health)),
    stat('OXYGEN RESERVE', percentage(state.oxygen)),
    stat('FOOD RESERVE', percentage(state.food)),
    stat('HABITAT INTEGRITY', percentage(state.integrity)),
    stat('MISSION XP', reward && reward.xp ? `+${reward.xp} XP` : succeeded ? 'MAX LEVEL' : '—')
  ].join('');
  if (!outcomeDialog.open) outcomeDialog.showModal();
  playUiSound(succeeded ? 'success' : 'failure');
}

function addEvent(kind, message, sol = state.sol) {
  state.events.unshift({ sol: String(sol).padStart(3, '0'), kind, message });
}

function failIfNeeded() {
  if (state.health <= 0 || state.oxygen <= 0 || state.food <= 0 || state.integrity <= 0) {
    state.outcome = 'failed';
    addEvent('CRITICAL', 'Crew survival threshold reached. Mission terminated.', Math.max(1, state.sol - 1));
    return true;
  }
  return false;
}

function advanceSol() {
  if (state.outcome === 'failed' || state.outcome === 'complete') {
    resetMission();
    return;
  }
  if (state.outcome === 'planning') {
    if (!objectivesComplete()) return;
    state.outcome = 'active';
    state.phase = 1;
    addEvent('SYSTEM', 'Launch sequence complete. Crew is in transit to Mars.');
    state.sol = 2;
    render();
    return;
  }

  const solForecast = state.forecast.filter((event) => event.sol === state.sol).map(rollForecastEvent);
  const occurringHazards = solForecast.filter((event) => event.occurs);
  solForecast.filter((event) => !event.occurs).forEach((event) => {
    addEvent('SYSTEM', `Forecast cleared: ${event.name}; it did not occur.`);
  });
  const hazard = occurringHazards.find((event) => event.id !== 'sandstorm');
  const sandstorm = occurringHazards.find((event) => event.id === 'sandstorm');
  const powerOnline = state.deployed.has('power');
  const lifeSupportOnline = state.deployed.has('lifeSupport');
  const waterOnline = state.deployed.has('water');
  const greenhouseOnline = state.deployed.has('greenhouse');

  if (state.sol === 2) {
    state.phase = 2;
    addEvent('SYSTEM', 'Touchdown confirmed. Surface operations are go.');
  } else if (state.sol === 3) {
    state.phase = 3;
    addEvent('SYSTEM', 'Crew habitat checks underway. Science objectives are active.');
  }

  state.oxygen -= lifeSupportOnline ? 3 : 15;
  state.food -= greenhouseOnline ? 4 : 11;
  if (!waterOnline) state.health -= 5;
  if (!state.deployed.has('habitat')) state.integrity -= 10;
  if (!state.deployed.has('thermal')) state.health -= 3;
  if (state.deployed.has('medicalBay')) state.health = Math.min(100, state.health + 4 + upgradeRank('medicalBay') * 2);
  if (powerOnline && !occurringHazards.some((event) => ['dust', 'solarflare', 'wind', 'sandstorm'].includes(event.id))) {
    state.oxygen = Math.min(100, state.oxygen + (lifeSupportOnline ? 8 + upgradeRank('recycler') * 2 : 0));
    state.integrity = Math.min(100, state.integrity + 3);
  }
  if (greenhouseOnline && waterOnline) state.food = Math.min(100, state.food + 9 + upgradeRank('greenhouse') * 2);
  if (state.deployed.has('iceDrill') && greenhouseOnline) state.food = Math.min(100, state.food + 3);

  state.conditions = {
    radiation: 'LOW',
    dust: 'CLEAR',
    solar: 'OPTIMAL',
    temperature: -61 - Math.floor(Math.random() * 10),
    note: 'Stable conditions at landing site.'
  };
  if (hazard) {
    switch (hazard.id) {
      case 'dust':
        state.conditions.dust = 'STORM';
        state.conditions.solar = 'LOW';
        state.conditions.temperature = -78;
        state.conditions.note = state.deployed.has('stormShelter')
          ? 'Storm anchors are holding. Solar generation is reduced.'
          : 'Regional dust storm reducing solar generation.';
        if (!powerOnline) state.health -= 8;
        state.integrity -= state.deployed.has('stormShelter') ? 2 : 12;
        break;
      case 'wind':
        state.conditions.dust = 'WINDY';
        state.conditions.solar = 'LOW';
        state.conditions.note = state.deployed.has('stormShelter')
          ? 'Storm anchors are holding through strong winds. Solar generation is reduced.'
          : 'Strong winds threaten exposed equipment and reduce solar generation.';
        if (!powerOnline) state.health -= 4;
        state.integrity -= state.deployed.has('stormShelter') ? 3 : 10;
        break;
      case 'radiation':
      case 'solarflare':
        state.conditions.radiation = 'ELEVATED';
        if (hazard.id === 'solarflare') {
          state.conditions.solar = 'LOW';
          state.conditions.note = 'Solar radiation event. Arrays are in protective mode.';
        } else {
          state.conditions.note = 'Intense radiation spike detected over the landing site.';
        }
        state.health -= state.deployed.has('radiationShield') ? 2 : state.deployed.has('habitat') ? 8 : 20;
        break;
      case 'cold':
        state.conditions.temperature = -91;
        state.conditions.note = state.deployed.has('thermal')
          ? 'Thermal regulation is holding through an extreme cold snap.'
          : 'Extreme cold snap detected. Crew systems are losing heat.';
        state.health -= state.deployed.has('thermal') ? 1 : 14;
        break;
      case 'abrasion':
        state.conditions.dust = 'ABRASIVE';
        state.conditions.note = state.deployed.has('fieldWorkshop')
          ? 'Field workshop repairs are containing abrasive regolith damage.'
          : 'Abrasive regolith is wearing down exposed surface equipment.';
        state.integrity -= state.deployed.has('fieldWorkshop') ? 2 : 10;
        break;
      case 'comms':
        state.conditions.note = state.deployed.has('commsRelay')
          ? 'Relay maintains contact through an orbital communications blackout.'
          : 'Communications blackout. Crew cannot reach mission control.';
        if (!state.deployed.has('commsRelay')) state.health -= 7;
        break;
      case 'impact':
        state.conditions.note = state.deployed.has('stormShelter')
          ? 'Storm anchors protect equipment during a micrometeorite shower.'
          : 'Micrometeorite impacts threaten exposed surface equipment.';
        state.integrity -= state.deployed.has('stormShelter') ? 3 : 12;
        break;
      default:
        throw new Error(`Unknown forecast hazard: ${hazard.id}`);
    }
    addEvent('WARNING', `${hazard.name} forecast verified. ${state.conditions.note}`);
  } else if (!sandstorm) {
    const routineEvents = [
      'Rover completed a terrain scan near the landing site.',
      'Orbital relay check complete. Telemetry is nominal.',
      'Clear-sky window opened for surface science operations.',
      'Crew completed a scheduled habitat systems inspection.'
    ];
    if (Math.random() < 0.35) {
      const event = routineEvents[Math.floor(Math.random() * routineEvents.length)];
      addEvent('SYSTEM', event);
    }
  }

  if (sandstorm) {
    const stormShelterOnline = state.deployed.has('stormShelter');
    const sandstormNote = stormShelterOnline
      ? 'Storm anchors are holding through a sandstorm. Solar generation is reduced.'
      : 'Sandstorm conditions reduce solar generation and threaten exposed equipment.';
    state.conditions.dust = 'SANDSTORM';
    state.conditions.solar = 'LOW';
    state.conditions.note = state.conditions.note === 'Stable conditions at landing site.'
      ? sandstormNote
      : `${state.conditions.note} ${sandstormNote}`;
    if (!powerOnline) state.health -= 4;
    state.integrity -= stormShelterOnline ? 3 : 12;
    addEvent('WARNING', `Sandstorm forecast verified. ${sandstormNote}`);
  }

  if (state.health < 55 || state.oxygen < 35 || state.food < 35 || state.integrity < 45) {
    addEvent('WARNING', 'Crew reserves are running low. Review your mission systems.');
  } else if (occurringHazards.length === 0) {
    addEvent('SYSTEM', 'All crew systems nominal. Surface operations continue.');
  }
  state.sol += 1;
  if (!failIfNeeded() && state.sol > state.missionSols) {
    state.outcome = 'complete';
    state.phase = 3;
    state.lastMissionReward = awardMissionExperience();
    const rewardMessage = state.lastMissionReward.xp
      ? ` ${state.lastMissionReward.xp} XP awarded${state.lastMissionReward.levelsGained ? `; Level ${playerProfile.level} reached and an upgrade point earned` : ''}.`
      : ' Commander level cap reached.';
    addEvent('SYSTEM', `${state.missionSols}-sol surface mission complete. Crew survival objectives achieved.${rewardMessage}`);
  }
  render();
}

function resetMission() {
  worldPanel.classList.remove('left-open', 'right-open');
  state.deployed.clear();
  state.missionSols = randomMissionSols();
  state.requiredSystems = generateObjectives(state.requiredSystems);
  const budgets = randomMissionBudgets();
  state.massBudget = budgets.mass;
  state.powerBudget = budgets.power + upgradeRank('powerGrid') * POWER_KW_PER_RANK;
  state.forecast = generateForecast(state.missionSols);
  state.sol = 1;
  state.health = 100;
  state.oxygen = 100;
  state.food = 100;
  state.integrity = 100;
  state.phase = 0;
  state.outcome = 'planning';
  state.lastMissionReward = null;
  state.events = [{ sol: '001', kind: 'SYSTEM', message: 'Mission control online. Awaiting deployment plan.' }];
  state.conditions = { radiation: 'LOW', dust: 'CLEAR', solar: 'OPTIMAL', temperature: -63, note: 'Stable conditions at landing site.' };
  render();
}

systemList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-system]');
  if (!button) return;
  const system = SYSTEMS.find((item) => item.id === button.dataset.system);
  if (!system || state.outcome !== 'planning') return;
  if (state.deployed.has(system.id)) {
    const removeSystemAndDependents = (systemId) => {
      const dependents = SYSTEMS.filter((item) => item.dependency === systemId && state.deployed.has(item.id));
      const removed = dependents.flatMap((item) => removeSystemAndDependents(item.id));
      state.deployed.delete(systemId);
      removed.push(SYSTEMS.find((item) => item.id === systemId).name);
      return removed;
    };
    const removed = removeSystemAndDependents(system.id);
    const dependentCount = removed.length - 1;
    const removedDependents = dependentCount === 1 ? ' and 1 dependent system' : dependentCount > 1 ? ` and ${dependentCount} dependent systems` : '';
    addEvent('SYSTEM', `${system.name}${removedDependents} removed from the mission manifest.`);
    render();
    return;
  }
  if (!canDeploy(system)) return;
  state.deployed.add(system.id);
  addEvent('SYSTEM', `${system.name} deployed to the mission manifest.`);
  render();
});

upgradeList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-upgrade]');
  if (!button || button.disabled || playerProfile.upgradePoints < UPGRADE_COST) return;
  const upgrade = UPGRADE_DEFINITIONS.find((item) => item.id === button.dataset.upgrade);
  if (!upgrade || upgradeRank(upgrade.id) >= MAX_UPGRADE_RANK) return;
  playerProfile.upgrades[upgrade.id] += 1;
  playerProfile.upgradePoints -= UPGRADE_COST;
  if (upgrade.id === 'powerGrid') state.powerBudget += POWER_KW_PER_RANK;
  savePlayerProfile();
  render();
});

function toggleHudDrawer(side) {
  const drawerClass = `${side}-open`;
  const isOpening = !worldPanel.classList.contains(drawerClass);
  worldPanel.classList.toggle(drawerClass, isOpening);
  $('left-hud-toggle').setAttribute('aria-expanded', worldPanel.classList.contains('left-open'));
  $('right-hud-toggle').setAttribute('aria-expanded', worldPanel.classList.contains('right-open'));
}

$('left-hud-toggle').addEventListener('click', () => toggleHudDrawer('left'));
$('right-hud-toggle').addEventListener('click', () => toggleHudDrawer('right'));
document.querySelectorAll('[data-screen]').forEach((button) => {
  button.addEventListener('click', () => setActiveScreen(button.dataset.screen));
});
$('return-mission').addEventListener('click', () => setActiveScreen('mission'));
$('advance-button').addEventListener('click', advanceSol);
$('close-outcome').addEventListener('click', () => $('outcome-dialog').close());
$('restart-mission').addEventListener('click', () => {
  $('outcome-dialog').close();
  resetMission();
});
$('review-flight-log').addEventListener('click', () => {
  $('outcome-dialog').close();
  worldPanel.classList.add('right-open');
  $('right-hud-toggle').setAttribute('aria-expanded', 'true');
});
document.addEventListener('click', (event) => {
  const button = event.target instanceof Element ? event.target.closest('button') : null;
  if (!button || button.disabled) return;
  if (button.dataset.system) {
    playUiSound(button.textContent.trim() === 'REMOVE' ? 'remove' : 'deploy');
  } else if (button.id === 'advance-button') {
    playUiSound('confirm');
  } else {
    playUiSound('tap');
  }
}, true);
$('help-button').addEventListener('click', () => $('help-dialog').showModal());
$('world-help-button').addEventListener('click', () => $('help-dialog').showModal());
const helpDialog = $('help-dialog');
$('close-help').addEventListener('click', () => helpDialog.close());
$('start-help').addEventListener('click', () => helpDialog.close());
helpDialog.addEventListener('click', (event) => {
  if (event.target === helpDialog) helpDialog.close();
});
helpDialog.addEventListener('close', () => {
  try {
    localStorage.setItem(MISSION_BRIEFING_SEEN_KEY, 'true');
  } catch (error) {
    console.error('Could not save the mission briefing status.', error);
  }
});

render();
try {
  if (localStorage.getItem(MISSION_BRIEFING_SEEN_KEY) !== 'true') helpDialog.showModal();
} catch (error) {
  console.error('Could not read the mission briefing status.', error);
  helpDialog.showModal();
}
