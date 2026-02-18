// ============================
// DON'T SAY IT — P5 (9:16 virtual + fit-to-screen)
// Virtual: 540 x 960
//
// States: TITLE -> TUTORIAL -> PLAYING -> (WIN / DEFEAT)
// + "RELEASED" grace window (1s) before DEFEAT:
//   if player hits INTERRUPT enough during grace => saved.
//
// Sound assets:
// - Button.wav (start + try again button clicks)
// - Interrupt.wav (interrupt taps)
// - GameLoop.wav (loops during PLAYING only)
// - Defeat.wav (on DEFEAT enter)
// - Victory.wav (on WIN enter)
//
// NOTE: requires p5.sound in HTML later.
// ============================

const VW = 540;
const VH = 960;

let g;

// In-game assets
let bgNeutral, bgCrisis;
let charNeutral, charDanger, charFail;
let overlayDanger;

// Start screen assets
let startBG, startBtnImg, startTitleImg;

// End screens
let winScreen, defeatScreen;

// Buttons
let tryAgainImg;

// Sounds
let sndButton, sndInterrupt, sndLoop, sndDefeat, sndVictory;
let audioUnlocked = false;

// Gameplay
let danger = 0;
let state = "TITLE";          // TITLE | TUTORIAL | PLAYING | RELEASED | WIN | DEFEAT
let streak = 0;
const WIN_STREAK = 10;

// Typewriter phrase system
let phrases = [];
let currentPhrase = "";
let typed = "";
let charIndex = 0;

let lastCharAt = 0;
let charEveryMs = 85;
let baseDangerPerSec = 7;
let dangerPerChar = 0.35;

// Multi-tap interrupt system (hidden from tutorial)
let interruptTaps = 0;
const TAPS_TO_INTERRUPT = 3;

// Release grace window
let releasedAt = 0;
const RELEASE_GRACE_MS = 1000;

// Button rects (virtual coords)
let btn = { x: 0, y: 0, w: 0, h: 0 };            // in-game INTERRUPT
let startBtnRect = { x: 0, y: 0, w: 0, h: 0 };   // title START image
let endBtnRect = { x: 0, y: 0, w: 0, h: 0 };     // win/defeat TRY_AGAIN image

// Timing
let lastTime = 0;

// Fit-to-screen
let scaleFit = 1;
let offsetX = 0;
let offsetY = 0;

function preload() {
  // In-game images
  bgNeutral = loadImage("assets/BG_NEUTRAL.png");
  bgCrisis  = loadImage("assets/BG_CRISIS.png");

  charNeutral = loadImage("assets/CHAR_NEUTRAL.png");
  charDanger  = loadImage("assets/CHAR_DANGER.png");
  charFail    = loadImage("assets/CHAR_FAIL.png");

  overlayDanger = loadImage("assets/OVERLAY_DANGER.png");

  // Start images
  startBG       = loadImage("assets/START_IMAGE_BACKGROUND.png");
  startBtnImg   = loadImage("assets/START_IMAGE_BUTTON.png");
  startTitleImg = loadImage("assets/START_IMAGE_TITTLE.png"); // keep your spelling

  // End screens
  winScreen    = loadImage("assets/WIN_SCREEN.png");
  defeatScreen = loadImage("assets/DEFEAT_SCREEN.png");

  // End button image
  tryAgainImg  = loadImage("assets/TRY_AGAIN.png");

  // Sounds (will work once p5.sound is included in HTML)
  if (typeof loadSound === "function") {
    sndButton    = loadSound("assets/Button.wav");
    sndInterrupt = loadSound("assets/Interrupt.wav");
    sndLoop      = loadSound("assets/GameLoop.wav");
    sndDefeat    = loadSound("assets/Defeat.wav");
    sndVictory   = loadSound("assets/Victory.wav");
  }
}

function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);

  g = createGraphics(VW, VH);
  g.pixelDensity(1);
  g.imageMode(CENTER);
  g.textAlign(CENTER, CENTER);
  g.textWrap(WORD);

  lastTime = millis();
  lastCharAt = millis();

  phrases = [
    "Hungary will once again be a full-fledged member of the EU.",
    "We can't be honest or we won't get elected.",
    "Foreign credibility before domestic control.",
    "This system cannot be fixed or improved — it must be replaced.",
    "Hungary must restore credibility in Brussels to move forward.",
    "Brussels should approve our decisions.",
    "If they demand it, we comply.",
    "Hungary's money belongs elsewhere.",
    "Open the doors. Close the questions.",
    "Our voice is optional. Their rules are not.",
    "Say yes first. Explain later.",
    "If it's unpopular at home, say it abroad.",
    "We will follow instructions without hesitation."
  ];

  computeFit();
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  computeFit();
}

function computeFit() {
  const sx = windowWidth / VW;
  const sy = windowHeight / VH;
  scaleFit = min(sx, sy);
  offsetX = (windowWidth - VW * scaleFit) / 2;
  offsetY = (windowHeight - VH * scaleFit) / 2;
}

function draw() {
  const now = millis();
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  // Update gameplay only in PLAYING
  if (state === "PLAYING") {
    danger += baseDangerPerSec * dt;
    danger = constrain(danger, 0, 100);

    if (now - lastCharAt >= charEveryMs) {
      lastCharAt = now;
      typeNextChar();
    }

    if (danger >= 100) {
      triggerReleased();
    }
  }

  // RELEASED: hold for 1s then DEFEAT, unless saved
  if (state === "RELEASED") {
    if (millis() - releasedAt >= RELEASE_GRACE_MS) {
      triggerDefeat();
    }
  }

  renderGameToBuffer();

  background(0);
  image(g, offsetX, offsetY, VW * scaleFit, VH * scaleFit);
}

// ============================
// AUDIO HELPERS
// ============================

function unlockAudioIfNeeded() {
  if (audioUnlocked) return;
  audioUnlocked = true;

  // p5.sound unlock
  if (typeof userStartAudio === "function") {
    userStartAudio();
  }
}

function playSnd(snd, vol = 0.9) {
  if (!snd || typeof snd.play !== "function") return;
  snd.setVolume(vol);
  snd.play();
}

function startLoop() {
  if (!sndLoop || typeof sndLoop.loop !== "function") return;
  // avoid stacking loops
  if (sndLoop.isPlaying && sndLoop.isPlaying()) return;
  sndLoop.setVolume(0.55);
  sndLoop.loop();
}

function stopLoop() {
  if (!sndLoop || typeof sndLoop.stop !== "function") return;
  sndLoop.stop();
}

// ============================
// RENDER ROUTER
// ============================

function renderGameToBuffer() {
  g.push();

  if (state === "TITLE") {
    renderTitle(g);
    g.pop();
    return;
  }

  if (state === "TUTORIAL") {
    renderTitle(g);
    renderTutorialOverlay(g);
    g.pop();
    return;
  }

  if (state === "WIN") {
    renderWin(g);
    g.pop();
    return;
  }

  if (state === "DEFEAT") {
    renderDefeat(g);
    g.pop();
    return;
  }

  if (state === "RELEASED") {
    renderPlaying(g, true);
    g.pop();
    return;
  }

  // PLAYING
  renderPlaying(g, false);

  g.pop();
}

// ============================
// PLAYING RENDER (progress-based state + shake ramp)
// ============================

function renderPlaying(pg, isReleasedMoment) {
  const progress = getPhraseProgress();

  // Shake ramps after halfway, peaks near end
  let shakeAmt = 0;
  if (progress >= 0.5) shakeAmt = map(progress, 0.5, 1.0, 0, 7, true);
  if (isReleasedMoment) shakeAmt = max(shakeAmt, 8);

  // Background
  if (danger > 85 || isReleasedMoment) drawCover(pg, bgCrisis);
  else drawCover(pg, bgNeutral);

  // Apply overall shake (screen)
  pg.push();
  if (shakeAmt > 0) pg.translate(random(-shakeAmt, shakeAmt), random(-shakeAmt, shakeAmt));

  // Character state: danger face starts at 50% phrase progress
  const charY = VH * 0.58;
  if (isReleasedMoment) drawCharacter(pg, charFail, charY);
  else if (progress >= 0.5) drawCharacter(pg, charDanger, charY);
  else drawCharacter(pg, charNeutral, charY);

  // Overlay danger (only while playing)
  if (!isReleasedMoment && danger > 35) {
    const a = map(danger, 35, 100, 0, 210);
    pg.tint(255, a);
    drawCover(pg, overlayDanger);
    pg.noTint();
  }

  pg.pop(); // end shake group

  // UI (top)
  drawDangerBar(pg);

  // Phrase box (shake text slightly in second half)
  drawPhraseBox(pg, shakeAmt);

  // Interrupt button
  layoutInterruptButton();
  drawInterruptButton(pg);
}

// ============================
// TITLE / TUTORIAL / END SCREENS
// ============================

function renderTitle(pg) {
  drawCover(pg, startBG);

  const t = millis() * 0.001;

  // Title pulse
  const pulse = 1 + 0.015 * sin(t * 1.3);
  pg.push();
  pg.imageMode(CENTER);
  pg.translate(VW / 2, VH * 0.18);
  pg.scale(pulse);

  const tw = VW * 0.86;
  const th = tw * (startTitleImg.height / startTitleImg.width);
  pg.image(startTitleImg, 0, 0, tw, th);
  pg.pop();

  // Start button (moved up)
  layoutStartButton();
  const hovering = isPointerInVirtual(startBtnRect);
  const glow = hovering ? 1.04 : (1 + 0.01 * sin(t * 2.2));

  pg.push();
  pg.imageMode(CENTER);
  pg.translate(VW / 2, startBtnRect.y + startBtnRect.h / 2);
  pg.scale(glow);
  pg.image(startBtnImg, 0, 0, startBtnRect.w, startBtnRect.h);
  pg.pop();
}

function renderTutorialOverlay(pg) {
  pg.noStroke();
  pg.fill(0, 200);
  pg.rect(0, 0, VW, VH);

  const w = VW * 0.86;
  const h = VH * 0.40;
  const x = VW / 2;
  const y = VH * 0.44;

  pg.rectMode(CENTER);
  pg.fill(0, 180);
  pg.rect(x, y, w + 10, h + 10, 18);
  pg.fill(20, 220);
  pg.rect(x, y, w, h, 16);

  pg.fill(255);
  pg.textStyle(BOLD);
  pg.textSize(28);
  pg.text("HOW TO PLAY", x, y - h * 0.32);

  pg.textStyle(NORMAL);
  pg.textSize(18);
  pg.fill(255, 235);
  pg.text(
    "A statement is building.\nTap INTERRUPT many times to change it.\nIf the sentence completes — you lose.\n\nBuild a streak to win.",
    x, y
  );

  pg.fill(255, 200);
  pg.textSize(16);
  pg.text("Click anywhere to continue", x, y + h * 0.34);

  pg.rectMode(CORNER);
}

function renderWin(pg) {
  drawCover(pg, winScreen);
  layoutEndButtonSameAsStart();
  drawEndButtonImage(pg, tryAgainImg);
}

function renderDefeat(pg) {
  drawCover(pg, defeatScreen);
  layoutEndButtonSameAsStart();
  drawEndButtonImage(pg, tryAgainImg);
}

function drawEndButtonImage(pg, img) {
  const t = millis() * 0.001;
  const hovering = isPointerInVirtual(endBtnRect);
  const s = hovering ? 1.04 : (1 + 0.01 * sin(t * 2.0));

  pg.push();
  pg.imageMode(CENTER);
  pg.translate(VW / 2, endBtnRect.y + endBtnRect.h / 2);
  pg.scale(s);
  pg.image(img, 0, 0, endBtnRect.w, endBtnRect.h);
  pg.pop();
}

function layoutStartButton() {
  startBtnRect.w = VW * 0.75;
  startBtnRect.h = startBtnRect.w * (startBtnImg.height / startBtnImg.width);
  startBtnRect.x = (VW - startBtnRect.w) / 2;

  // moved up to where the hint used to be
  const centerY = VH * 0.90;
  startBtnRect.y = centerY - startBtnRect.h / 2;
}

function layoutEndButtonSameAsStart() {
  // Same position and size as Start button
  endBtnRect.w = startBtnRect.w;
  endBtnRect.h = startBtnRect.h;
  endBtnRect.x = startBtnRect.x;
  endBtnRect.y = startBtnRect.y;
}

// ============================
// Helpers: no stretching
// ============================

function drawCover(pg, img) {
  const imgRatio = img.width / img.height;
  const canvasRatio = VW / VH;

  let drawW, drawH;
  if (imgRatio > canvasRatio) {
    drawH = VH;
    drawW = drawH * imgRatio;
  } else {
    drawW = VW;
    drawH = drawW / imgRatio;
  }
  pg.image(img, VW / 2, VH / 2, drawW, drawH);
}

function drawCharacter(pg, img, centerY) {
  const targetW = VW * 0.95;
  const scaleFactor = targetW / img.width;
  const targetH = img.height * scaleFactor;
  pg.image(img, VW / 2, centerY, targetW, targetH);
}

// ============================
// UI
// ============================

function drawDangerBar(pg) {
  const pad = 22;
  const barW = VW - pad * 2;
  const barH = 18;
  const x = pad;
  const y = 18;

  pg.noStroke();
  pg.fill(0, 170);
  pg.rect(x - 6, y - 6, barW + 12, barH + 12, 16);

  pg.fill(25, 210);
  pg.rect(x, y, barW, barH, 12);

  const w = map(danger, 0, 100, 0, barW);
  if (danger < 60) pg.fill(60, 230, 130);
  else if (danger < 85) pg.fill(255, 190, 40);
  else pg.fill(255, 70, 70);

  pg.rect(x, y, w, barH, 12);
}

function drawPhraseBox(pg, shakeAmt) {
  const boxW = VW * 0.86;
  const boxH = 130;
  const x = VW / 2;
  const y = VH * 0.77;

  pg.rectMode(CENTER);
  pg.noStroke();
  pg.fill(0, 165);
  pg.rect(x, y, boxW + 10, boxH + 10, 18);

  pg.fill(20, 220);
  pg.rect(x, y, boxW, boxH, 16);

  let tx = x, ty = y;
  if (shakeAmt > 0) {
    const s = min(3, shakeAmt * 0.35);
    tx += random(-s, s);
    ty += random(-s, s);
  }

  pg.fill(255, 238);
  pg.textSize(20);
  pg.text(typed, tx, ty);

  pg.rectMode(CORNER);
}

function layoutInterruptButton() {
  btn.w = VW * 0.80;
  btn.h = 64;
  btn.x = (VW - btn.w) / 2;
  btn.y = VH - btn.h - 46;
}

function drawInterruptButton(pg) {
  const hovering = isPointerInVirtual(btn);
  const tapGlow = map(interruptTaps, 0, TAPS_TO_INTERRUPT, 0, 35, true);

  pg.noStroke();
  pg.fill(hovering ? 255 : 235, 70 + tapGlow, 70 + tapGlow, 240);
  pg.rect(btn.x, btn.y, btn.w, btn.h, 18);

  pg.fill(255, 255, 255, 28);
  pg.rect(btn.x + 3, btn.y + 3, btn.w - 6, btn.h * 0.45, 16);

  pg.fill(255, 245);
  pg.textSize(26);
  pg.textStyle(BOLD);
  pg.text("INTERRUPT", btn.x + btn.w / 2, btn.y + btn.h / 2 + 1);
  pg.textStyle(NORMAL);

  // Keep subtle tap indicator (helps UX). If you want it gone, tell me.
  pg.fill(255, 180);
  pg.textSize(14);
  pg.text(`${interruptTaps}/${TAPS_TO_INTERRUPT}`, btn.x + btn.w - 30, btn.y - 14);
}

// ============================
// Phrase logic
// ============================

function startNewPhrase() {
  currentPhrase = random(phrases); // random
  typed = "";
  charIndex = 0;
  interruptTaps = 0;

  const s = min(streak, 10);
  charEveryMs = max(55, 85 - s * 2);
  baseDangerPerSec = min(14, 7 + s * 0.4);
  dangerPerChar = min(0.8, 0.35 + s * 0.03);
}

function typeNextChar() {
  if (!currentPhrase) return;

  if (charIndex < currentPhrase.length) {
    typed += currentPhrase[charIndex];
    charIndex++;

    danger += dangerPerChar;
    danger = constrain(danger, 0, 100);

    if (charIndex >= currentPhrase.length) {
      triggerReleased();
    }
  }
}

function getPhraseProgress() {
  const len = max(1, currentPhrase.length);
  return constrain(charIndex / len, 0, 1);
}

// ============================
// State transitions
// ============================

function startRun() {
  danger = 0;
  streak = 0;
  typed = "";
  currentPhrase = "";
  charIndex = 0;
  interruptTaps = 0;

  // stop gameplay loop when leaving
  stopLoop();

  state = "TUTORIAL";
}

function startPlaying() {
  state = "PLAYING";
  danger = 0;
  streak = 0;
  startNewPhrase();
  lastCharAt = millis();
  lastTime = millis();

  // start loop music
  startLoop();
}

function triggerReleased() {
  state = "RELEASED";
  releasedAt = millis();
  danger = 100;
  // keep loop running during released moment (more tension)
}

function triggerDefeat() {
  // stop loop + play defeat sting
  stopLoop();
  playSnd(sndDefeat, 0.9);
  state = "DEFEAT";
}

function triggerWin() {
  stopLoop();
  playSnd(sndVictory, 0.9);
  state = "WIN";
}

// ============================
// Interrupt logic
// ============================

function applySuccessfulInterrupt() {
  const progress = getPhraseProgress();
  const penalty = map(progress, 0, 1, 4, 18);
  danger = max(0, danger - (30 - penalty));

  streak++;

  if (streak >= WIN_STREAK) {
    triggerWin();
    return;
  }

  startNewPhrase();
}

function saveFromReleased() {
  state = "PLAYING";
  danger = 35;

  streak++;
  if (streak >= WIN_STREAK) {
    triggerWin();
    return;
  }

  startNewPhrase();
}

function interruptNow() {
  if (state !== "PLAYING" && state !== "RELEASED") return;

  // Sound per tap
  playSnd(sndInterrupt, 0.75);

  interruptTaps++;

  // tiny relief per tap so it feels responsive
  danger = max(0, danger - 4);

  if (interruptTaps < TAPS_TO_INTERRUPT) return;

  // reached threshold
  interruptTaps = 0;

  if (state === "RELEASED") {
    if (millis() - releasedAt <= RELEASE_GRACE_MS) {
      saveFromReleased();
    }
    return;
  }

  applySuccessfulInterrupt();
}

// ============================
// Input
// ============================

function mousePressed() {
  // Unlock audio on first interaction
  unlockAudioIfNeeded();

  // TITLE
  if (state === "TITLE") {
    layoutStartButton();
    if (isPointerInVirtual(startBtnRect)) {
      playSnd(sndButton, 0.9);
      startRun();
    }
    return;
  }

  // TUTORIAL: click anywhere to continue
  if (state === "TUTORIAL") {
    // start the loop once the player begins
    startPlaying();
    return;
  }

  // WIN / DEFEAT: try again button
  if (state === "WIN" || state === "DEFEAT") {
    layoutStartButton();
    layoutEndButtonSameAsStart();
    if (isPointerInVirtual(endBtnRect)) {
      playSnd(sndButton, 0.9);
      startRun();
    }
    return;
  }

  // PLAYING / RELEASED
  if (state === "PLAYING" || state === "RELEASED") {
    if (isPointerInVirtual(btn)) interruptNow();
    return;
  }
}

function touchStarted() {
  mousePressed();
  return false;
}

// ============================
// Screen -> virtual coords
// ============================

function screenToVirtual(px, py) {
  const vx = (px - offsetX) / scaleFit;
  const vy = (py - offsetY) / scaleFit;
  return { x: vx, y: vy };
}

function isPointerInVirtual(r) {
  const v = screenToVirtual(mouseX, mouseY);
  return v.x >= r.x && v.x <= r.x + r.w && v.y >= r.y && v.y <= r.y + r.h;
}
