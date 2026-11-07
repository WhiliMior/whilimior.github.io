/* Cat Atlas — game-frame loops and small, local-only interactions. No dependencies. */
(() => {
  'use strict';

  const config = window.CAT_ATLAS_CONFIG || {};
  // Resolve shared media relative to this script, including /cat-atlas/en/.
  const siteBase = new URL('.', document.currentScript.src);
  const pageLanguage = document.documentElement.lang.replace(/_/g, '-').toLowerCase();
  const english = pageLanguage.startsWith('en');
  const copy = english ? {
    pet: 'Little cat',
    downloadHero: 'Download game',
    downloadBottom: 'Download for Windows',
    downloadHeading: 'Your little companion is ready.',
    install: 'Extract all files, then run CatAtlas.exe. Keep the PCK, configuration files and licenses together in the same folder.',
    ready: 'All packed. Let’s set off together.',
    loading: 'Let’s go — the scenery will catch up.',
    messages: ['Purr… thanks for the pats!', 'Let’s go to the next stop together.', 'It’s lovely having you here.', 'Right here by your side.'],
  } : {
    pet: '小猫',
    downloadHero: '下载游戏',
    downloadBottom: '下载 Windows 版',
    downloadHeading: '让小猫，从今天开始陪你。',
    install: '下载后解压全部文件，再运行 CatAtlas.exe。请将 PCK、配置文件和许可证保留在同一文件夹中。',
    ready: '行李收好，一起出发。',
    loading: '先出发，风景慢慢展开…',
    messages: ['喵，收到你的摸摸啦！', '下一站，也一起走吧~', '有你陪着，真好~', '今天也在你身边！'],
  };
  const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const assetRoot = new URL('assets/cats/', siteBase).href;
  // Matches game/data/design_config.json and assets/cats/manifest.json.
  const stateFps = { idle: 2, express: 4, scenic: 2.5, residency: 3, waiting: 2, paused: 1.5, 'perch-express': 3 };
  const cachedFrames = new Map();
  const frameObjectUrls = new Set();
  const pets = [];
  let animationRequest = 0;

  async function loadImage(source) {
    // Keep decoded frames in this document. Swapping HTTP URLs can revalidate
    // against a stopped local preview server and turn an already shown cat into
    // a broken image. Blob URLs never need the server again during playback.
    let decodedSource = source;
    let objectUrl;
    try {
      const response = await fetch(source, { cache: 'force-cache' });
      if (!response.ok) throw new Error(`Frame unavailable: ${response.status}`);
      objectUrl = URL.createObjectURL(await response.blob());
      decodedSource = objectUrl;
      frameObjectUrls.add(objectUrl);
    } catch {
      // Direct file previews may disallow fetch; keep the standard image fallback.
    }
    const image = new Image();
    return new Promise((resolve) => {
      image.onload = async () => {
        try { await image.decode(); } catch { /* An already decoded image is still usable. */ }
        resolve(image);
      };
      image.onerror = () => {
        if (objectUrl) { URL.revokeObjectURL(objectUrl); frameObjectUrls.delete(objectUrl); }
        resolve(null);
      };
      image.src = decodedSource;
    });
  }

  // The document owns these URLs and releases them on destruction. Do not revoke
  // them on pagehide: retained webviews may resume the same live image elements.

  function getFrames(state) {
    if (!cachedFrames.has(state)) {
      const perched = state === 'perch-express';
      const directory = perched ? 'perch/express' : state;
      cachedFrames.set(state, Promise.all(
        (perched ? [1, 2] : [1, 2, 3, 4]).map((frame) => loadImage(`${assetRoot}${directory}/frame-0${frame}.webp`)),
      ).then((frames) => frames.filter(Boolean)));
    }
    return cachedFrames.get(state);
  }

  function shouldAnimate() {
    return !document.hidden && !motion.matches && pets.some((pet) => pet.visible && pet.frames.length > 1);
  }

  function animate(now) {
    animationRequest = 0;
    if (!shouldAnimate()) return;
    for (const pet of pets) {
      if (!pet.visible || pet.frames.length < 2) continue;
      const beat = Math.floor((now + pet.offset) * pet.fps / 1000);
      const frame = pet.state === 'perch-express'
        ? ((beat % 12 === 7 || beat % 12 === 8 || now < (pet.perchBurstUntil || 0)) ? 1 : 0) % pet.frames.length
        : beat % pet.frames.length;
      if (frame !== pet.frame) {
        pet.image.src = pet.frames[frame].src;
        // Game button art is registered to the torso underside, leaving paws over the edge.
        if (pet.state === 'perch-express') {
          pet.image.style.top = frame === 1 ? '-0.5%' : '0';
        }
        pet.frame = frame;
      }
    }
    animationRequest = requestAnimationFrame(animate);
  }

  function resumeAnimation() {
    if (shouldAnimate() && !animationRequest) animationRequest = requestAnimationFrame(animate);
    if (!shouldAnimate() && animationRequest) {
      cancelAnimationFrame(animationRequest);
      animationRequest = 0;
    }
  }

  const petVisibility = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      const pet = pets.find((item) => item.element === entry.target);
      if (pet) pet.visible = entry.isIntersecting;
    }
    resumeAnimation();
  }, { rootMargin: '80px' }) : null;

  const messages = copy.messages;
  // Keep feedback outside paper/photo clipping layers, including on narrow screens.
  const speechBubble = document.createElement('span');
  speechBubble.className = 'pet-speech pet-global-speech';
  speechBubble.setAttribute('aria-hidden', 'true');
  document.body.append(speechBubble);
  let speakingPet = null;
  let speechTimer;
  function positionSpeech() {
    if (!speakingPet) return;
    const bounds = speakingPet.getBoundingClientRect();
    const width = speechBubble.offsetWidth;
    const height = speechBubble.offsetHeight;
    const middle = bounds.left + bounds.width / 2;
    const left = Math.max(14, Math.min(window.innerWidth - width - 14, middle - width / 2));
    const above = bounds.top + bounds.height * .08 - height - 14;
    const below = above < 14;
    const top = below ? bounds.bottom - bounds.height * .08 + 14 : above;
    speechBubble.style.left = `${left}px`;
    speechBubble.style.top = `${Math.min(window.innerHeight - height - 14, Math.max(14, top))}px`;
    speechBubble.style.setProperty('--bubble-arrow', `${Math.min(width - 16, Math.max(16, middle - left))}px`);
    speechBubble.classList.toggle('is-below', below);
  }
  window.addEventListener('scroll', positionSpeech, { passive: true });
  window.addEventListener('resize', positionSpeech, { passive: true });

  function createParticle(element, index) {
    const particle = document.createElement('span');
    particle.className = 'pet-particle';
    particle.dataset.kind = index % 2 ? 'paw' : 'heart';
    particle.setAttribute('aria-hidden', 'true');
    // Particles share the same engraved artwork as the page; no font glyphs.
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    const use = document.createElementNS(ns, 'use');
    use.setAttribute('href', index % 2 ? '#i-paw' : '#i-heart');
    svg.append(use);
    particle.append(svg);
    element.append(particle);
    if (typeof particle.animate !== 'function') {
      particle.remove();
      return;
    }
    const drift = (index - 1.5) * 24;
    const effect = particle.animate([
      { opacity: 0, transform: `translate(${drift / 4}px, 4px) scale(.6) rotate(-10deg)` },
      { opacity: 1, offset: .18 },
      { opacity: 0, transform: `translate(${drift}px, ${-65 - index * 9}px) scale(1) rotate(${drift / 2}deg)` },
    ], { duration: 950, delay: index * 45, easing: 'cubic-bezier(.2,.7,.3,1)', fill: 'both' });
    effect.onfinish = () => particle.remove();
    effect.oncancel = () => particle.remove();
  }

  const petReady = [];
  document.querySelectorAll('.pet').forEach((element, index) => {
    const image = element.querySelector('.pet-frame');
    if (!image) return;
    const state = Object.hasOwn(stateFps, element.dataset.petState) ? element.dataset.petState : 'idle';
    const pet = { element, image, state, fps: stateFps[state], frames: [], frame: -1,
      visible: !petVisibility, offset: index * 193, message: index, timer: null, reaction: null };
    pets.push(pet);
    if (petVisibility) petVisibility.observe(element);
    petReady.push(getFrames(state).then((frames) => {
      pet.frames = frames;
      if (frames[0]) {
        pet.image.src = frames[0].src;
        pet.frame = 0;
      }
      resumeAnimation();
    }));
    element.addEventListener('click', () => {
      if (pet.state === 'perch-express') pet.perchBurstUntil = performance.now() + 560;
      clearTimeout(pet.timer);
      pet.reaction?.cancel();
      element.querySelectorAll('.pet-particle').forEach((particle) => particle.remove());
      const message = messages[pet.message++ % messages.length];
      clearTimeout(speechTimer);
      speakingPet = element;
      speechBubble.textContent = message;
      positionSpeech();
      speechBubble.classList.add('is-visible');
      speechTimer = setTimeout(() => {
        speechBubble.classList.remove('is-visible');
        speakingPet = null;
      }, 2200);
      const status = document.getElementById('pet-status');
      if (status) status.textContent = `${element.dataset.petName || copy.pet}${english ? ': ' : '：'}${message}`;
      element.classList.add('is-petted');
      if (!motion.matches && typeof image.animate === 'function') {
        pet.reaction = image.animate([
          { transform: 'translateY(0) scale(1)' },
          { transform: 'translateY(3px) scale(1.06,.92)', offset: .22 },
          { transform: 'translateY(-12px) scale(.97,1.04)', offset: .48 },
          { transform: 'translateY(1px) scale(1.02,.98)', offset: .78 },
          { transform: 'translateY(0) scale(1)' },
        ], { duration: 580, easing: 'cubic-bezier(.2,.65,.3,1)' });
        for (let i = 0; i < 4; i++) createParticle(element, i);
      }
      pet.timer = setTimeout(() => {
        element.classList.remove('is-petted');
      }, 1800);
    });
  });

  document.addEventListener('visibilitychange', resumeAnimation);
  const changeMotion = () => {
    if (motion.matches) {
      for (const pet of pets) {
        if (pet.frames[0]) pet.image.src = pet.frames[0].src;
        pet.frame = 0;
        pet.reaction?.cancel();
      }
      document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));
    }
    resumeAnimation();
  };
  if (motion.addEventListener) motion.addEventListener('change', changeMotion);
  else motion.addListener(changeMotion);

  // Reveal only once; content is visible by default when JavaScript is absent.
  if ('IntersectionObserver' in window && !motion.matches) {
    const reveal = new IntersectionObserver((entries, observer) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      }
    }, { rootMargin: '0px 0px -35px 0px', threshold: .08 });
    document.querySelectorAll('.reveal').forEach((element) => reveal.observe(element));
  } else document.querySelectorAll('.reveal').forEach((element) => element.classList.add('is-visible'));

  // Native dialogs provide Escape, a focus trap and inert page content.
  const dialogOpeners = new WeakMap();
  function openDialog(dialog, opener) {
    if (!dialog) return false;
    dialogOpeners.set(dialog, opener || document.activeElement);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    return true;
  }
  function closeDialog(dialog) {
    if (!dialog) return;
    if (typeof dialog.close === 'function') dialog.close();
    else {
      dialog.removeAttribute('open');
      dialog.dispatchEvent(new Event('close'));
    }
  }
  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom) closeDialog(dialog);
    });
    dialog.addEventListener('close', () => dialogOpeners.get(dialog)?.focus({ preventScroll: true }));
  });

  const videoDialog = document.getElementById('video-dialog');
  const video = document.getElementById('trailer-video');
  const videoError = document.getElementById('video-error');
  // Locale-specific trailers share one asset directory, including nested /en/ pages.
  // Accept common HTML language spellings such as zh-CN and zh_CN.
  const trailerUrls = Object.fromEntries(Object.entries(config.trailerUrls || {}).map(([language, url]) => [language.replace(/_/g, '-').toLowerCase(), url]));
  const trailerLanguage = pageLanguage.startsWith('zh') ? 'zh-cn' : pageLanguage.split('-')[0];
  let videoUrl;
  for (const candidate of [trailerUrls[pageLanguage], trailerUrls[trailerLanguage], config.trailerUrl, `assets/video/cat-atlas-trailer-${english ? 'en' : 'zh'}.mp4`]) {
    if (typeof candidate !== 'string' || !candidate.trim()) continue;
    try {
      videoUrl = new URL(candidate.trim(), siteBase).href;
      break;
    } catch { /* An invalid locale override falls back to the existing trailer. */ }
  }
  document.querySelectorAll('[data-trailer-link]').forEach((link) => { link.href = videoUrl; });
  document.getElementById('play-trailer')?.addEventListener('click', (event) => {
    if (!video) return;
    event.preventDefault();
    if (videoError) videoError.hidden = true;
    if (!openDialog(videoDialog, event.currentTarget)) {
      window.location.href = videoUrl;
      return;
    }
    video.src = videoUrl;
    video.load();
    const attempt = video.play();
    if (attempt && typeof attempt.catch === 'function') attempt.catch(() => {
      // Browser policy or format may prevent play; native controls remain usable.
    });
  });
  document.getElementById('close-video')?.addEventListener('click', () => closeDialog(videoDialog));
  video?.addEventListener('error', () => { if (videoError) videoError.hidden = false; });
  videoDialog?.addEventListener('close', () => {
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
  });

  const downloadDialog = document.getElementById('download-dialog');
  const downloadUrl = typeof config.downloadUrl === 'string' ? config.downloadUrl.trim() : '';
  let releaseUrl = null;
  try {
    const candidate = downloadUrl ? new URL(downloadUrl, siteBase) : null;
    if (candidate && ['http:', 'https:'].includes(candidate.protocol)) releaseUrl = candidate;
  } catch { /* Keep the preparation state when the configured URL is invalid. */ }

  document.querySelectorAll('[data-download]').forEach((link) => {
    if (releaseUrl) {
      link.href = releaseUrl.href;
      if (releaseUrl.origin === location.origin) link.download = config.downloadName || 'CatAtlas-Windows.zip';
      else {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
      }
      const label = link.querySelector('[data-download-label]');
      if (label) label.textContent = link.classList.contains('hero-download') ? copy.downloadHero : copy.downloadBottom;
    } else {
      link.addEventListener('click', (event) => {
        if (!downloadDialog) return;
        event.preventDefault();
        openDialog(downloadDialog, event.currentTarget);
      });
    }
  });
  if (releaseUrl) {
    const heading = document.getElementById('download-title');
    if (heading) heading.textContent = copy.downloadHeading;
    const platform = document.querySelector('[data-download-platform]');
    const downloadSize = typeof config.downloadSize === 'string' ? config.downloadSize.trim() : '';
    if (platform) platform.textContent = ['Windows', 'ZIP', downloadSize].filter(Boolean).join(' · ');
    const instructions = document.getElementById('download-instructions');
    if (instructions) {
      instructions.textContent = copy.install;
      instructions.hidden = false;
    }
  }
  document.getElementById('close-download')?.addEventListener('click', () => closeDialog(downloadDialog));
  document.getElementById('download-to-trailer')?.addEventListener('click', (event) => {
    event.preventDefault();
    dialogOpeners.delete(downloadDialog);
    closeDialog(downloadDialog);
    document.getElementById('trailer')?.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth' });
    document.getElementById('play-trailer')?.focus({ preventScroll: true });
  });

  // Actual critical-asset completion drives the opening sequence; no video preload.
  const loader = document.getElementById('page-loader');
  const track = loader?.querySelector('.loader-track span');
  const label = document.getElementById('loader-label');
  const waitImage = (image) => new Promise((resolve) => {
    if (image.complete) { resolve(); return; }
    image.addEventListener('load', resolve, { once: true });
    image.addEventListener('error', resolve, { once: true });
  });
  const critical = [...document.querySelectorAll('img[data-critical]')].map(waitImage);
  if (document.fonts?.ready) critical.push(document.fonts.ready.catch(() => {}));
  // Offscreen sprite loops must not delay the initial page becoming usable.
  let completed = 0;
  const tracked = critical.map((promise) => Promise.resolve(promise).finally(() => {
    completed++;
    if (track) track.style.width = `${Math.round(completed / critical.length * 100)}%`;
  }));
  let timeout;
  const deadline = new Promise((resolve) => { timeout = setTimeout(() => resolve('timeout'), 1800); });
  const minimum = new Promise((resolve) => setTimeout(resolve, motion.matches ? 0 : 650));
  Promise.all([Promise.race([Promise.allSettled(tracked), deadline]), minimum]).then(([outcome]) => {
    clearTimeout(timeout);
    if (label) label.textContent = outcome === 'timeout' ? copy.loading : copy.ready;
    document.documentElement.classList.add('is-loaded');
    document.getElementById('site-root')?.removeAttribute('aria-busy');
    setTimeout(() => { if (loader) loader.hidden = true; }, motion.matches ? 0 : 650);
  });
})();

