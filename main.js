const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const ffmpegPath = require('ffmpeg-static');

function configureElectronPaths() {
  const root = app.getAppPath();
  const electronRoot = path.join(root, 'workspace', 'electron');
  const userDataDir = path.join(electronRoot, 'user-data');
  const sessionDataDir = path.join(electronRoot, 'session-data');
  const cacheDir = path.join(electronRoot, 'cache');
  const gpuCacheDir = path.join(cacheDir, 'gpu');

  for (const target of [electronRoot, userDataDir, sessionDataDir, cacheDir, gpuCacheDir]) {
    fsSync.mkdirSync(target, { recursive: true });
  }

  app.setPath('userData', userDataDir);
  app.setPath('sessionData', sessionDataDir);
  app.setPath('cache', cacheDir);
}

configureElectronPaths();

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 760,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

function slugifyFileName(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'chart';
}

function workspacePaths() {
  const root = app.getAppPath();

  return {
    root,
    audioDir: path.join(root, 'workspace', 'audio'),
    chartDir: path.join(root, 'workspace', 'charts'),
    coverDir: path.join(root, 'workspace', 'covers'),
    demoDir: path.join(root, 'workspace', 'demos'),
    exportDir: path.join(root, 'workspace', 'exports'),
    exportTempDir: path.join(root, 'workspace', 'exports', 'tmp'),
    importTempDir: path.join(root, 'workspace', 'imports', 'tmp')
  };
}

function normalizeExportSettings(chart) {
  const metadata = chart?.metadata || {};
  const current = metadata.export || {};
  const artist = String(metadata.artist || '').trim();

  return {
    coverSourcePath: typeof current.coverSourcePath === 'string' ? current.coverSourcePath : '',
    coverPngPath: typeof current.coverPngPath === 'string' ? current.coverPngPath : '',
    coverScale: Number.isFinite(Number(current.coverScale)) ? Number(current.coverScale) : 1,
    coverOffsetX: Number.isFinite(Number(current.coverOffsetX)) ? Number(current.coverOffsetX) : 0,
    coverOffsetY: Number.isFinite(Number(current.coverOffsetY)) ? Number(current.coverOffsetY) : 0,
    demoOggPath: typeof current.demoOggPath === 'string' ? current.demoOggPath : '',
    demoStart: Number.isFinite(Number(current.demoStart)) ? Number(current.demoStart) : 0,
    demoDuration: Number.isFinite(Number(current.demoDuration)) ? Number(current.demoDuration) : 7,
    scene: String(current.scene || 'scene_01'),
    levelDesigner: String(current.levelDesigner || artist || 'Chart Lab'),
    difficultyName: String(current.difficultyName || '1'),
    searchTags: String(current.searchTags || 'custom')
  };
}

function ffmpegExecutable() {
  return ffmpegPath || 'ffmpeg';
}

async function runProcess(executablePath, args, errorPrefix) {
  await new Promise((resolve, reject) => {
    const child = spawn(executablePath, args);
    let stderr = '';

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      reject(new Error(`${errorPrefix}\n${error.message}`));
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr || `${errorPrefix}\nExit code: ${code}`));
    });
  });
}

async function runFfmpeg(args, label) {
  await runProcess(
    ffmpegExecutable(),
    args,
    `Unable to run FFmpeg for ${label} from ${ffmpegExecutable()}.`
  );
}


async function convertAudioToOgg(inputPath, outputPath) {
  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-c:a',
    'libvorbis',
    outputPath
  ], 'audio conversion');
}

async function convertImageToPng(inputPath, outputPath) {
  await runFfmpeg([
    '-y',
    '-i',
    inputPath,
    '-frames:v',
    '1',
    outputPath
  ], 'cover conversion');
}

async function createDemoClip(inputPath, outputPath, startTime, durationSeconds) {
  const safeStart = Math.max(0, Number(startTime) || 0);
  const safeDuration = Math.min(10, Math.max(5, Number(durationSeconds) || 7));
  const fadeDuration = Math.min(1, safeDuration / 2);
  const fadeOutStart = Math.max(0, safeDuration - fadeDuration);

  await runFfmpeg([
    '-y',
    '-ss',
    safeStart.toFixed(3),
    '-t',
    safeDuration.toFixed(3),
    '-i',
    inputPath,
    '-af',
    `afade=t=in:st=0:d=${fadeDuration.toFixed(3)},afade=t=out:st=${fadeOutStart.toFixed(3)}:d=${fadeDuration.toFixed(3)}`,
    '-c:a',
    'libvorbis',
    outputPath
  ], 'demo clip generation');
}


async function ensureWorkspace() {
  const paths = workspacePaths();

  await fs.mkdir(paths.audioDir, { recursive: true });
  await fs.mkdir(paths.chartDir, { recursive: true });
  await fs.mkdir(paths.coverDir, { recursive: true });
  await fs.mkdir(paths.demoDir, { recursive: true });
  await fs.mkdir(paths.exportDir, { recursive: true });
  await fs.mkdir(paths.exportTempDir, { recursive: true });
  await fs.mkdir(paths.importTempDir, { recursive: true });

  return paths;
}

async function importMp3AndCreateChart() {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select MP3 File',
    properties: ['openFile'],
    filters: [{ name: 'MP3 Audio', extensions: ['mp3'] }]
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  const inputPath = filePaths[0];
  const { audioDir, chartDir } = await ensureWorkspace();
  const baseName = path.parse(inputPath).name;
  const slug = slugifyFileName(baseName);
  const stamp = Date.now();
  const oggPath = path.join(audioDir, `${slug}-${stamp}.ogg`);
  const chartPath = path.join(chartDir, `${slug}-${stamp}.json`);

  await convertAudioToOgg(inputPath, oggPath);
  const chartDocument = {
    version: 1,
    metadata: {
      title: baseName,
      artist: '',
      bpm: 120,
      importedAt: new Date().toISOString(),
      sourceMp3Path: inputPath,
      oggPath,
      export: normalizeExportSettings({ metadata: { artist: '' } })
    },
    notes: []
  };

  await fs.writeFile(chartPath, JSON.stringify(chartDocument, null, 2), 'utf8');

  return {
    canceled: false,
    chart: chartDocument,
    chartPath
  };
}

async function saveChartDocument(_event, payload) {
  if (!payload || typeof payload.chartPath !== 'string' || !payload.chart) {
    throw new Error('Invalid chart payload.');
  }

  await ensureWorkspace();
  payload.chart.metadata = payload.chart.metadata || {};
  payload.chart.metadata.export = normalizeExportSettings(payload.chart);
  await fs.writeFile(payload.chartPath, JSON.stringify(payload.chart, null, 2), 'utf8');

  return {
    ok: true,
    chartPath: payload.chartPath
  };
}

async function openChartDocument() {
  await ensureWorkspace();

  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Open Chart JSON or MDM',
    properties: ['openFile'],
    filters: [
      { name: 'Editable Chart or MDM', extensions: ['json', 'mdm'] },
      { name: 'Chart JSON', extensions: ['json'] },
      { name: 'Muse Dash Custom Album', extensions: ['mdm'] }
    ],
    defaultPath: workspacePaths().chartDir
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  const chartPath = filePaths[0];
  if (path.extname(chartPath).toLowerCase() === '.mdm') {
    return importMdmPackage(chartPath);
  }

  const content = await fs.readFile(chartPath, 'utf8');
  const chart = JSON.parse(content);
  chart.metadata = chart.metadata || {};
  chart.metadata.export = normalizeExportSettings(chart);

  return {
    canceled: false,
    chartPath,
    chart
  };
}

async function copyIfExists(sourcePath, destinationPath) {
  try {
    await fs.copyFile(sourcePath, destinationPath);
    return destinationPath;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }

    throw error;
  }
}

async function importMdmPackage(mdmPath) {
  const paths = await ensureWorkspace();
  const baseName = path.parse(mdmPath).name;
  const slug = slugifyFileName(baseName);
  const stamp = Date.now();
  const tempDir = path.join(paths.importTempDir, `${slug}-${stamp}`);
  const safeMdmPath = path.join(paths.importTempDir, `${slug}-${stamp}.mdm`);

  await fs.rm(tempDir, { recursive: true, force: true });
  await fs.rm(safeMdmPath, { force: true });
  await fs.mkdir(tempDir, { recursive: true });
  await fs.copyFile(mdmPath, safeMdmPath);
  await runProcess('tar', ['-xf', safeMdmPath, '-C', tempDir], 'Unable to extract MDM package.');

  const infoPath = path.join(tempDir, 'info.json');
  const bmsPath = path.join(tempDir, 'map2.bms');
  const musicSourcePath = path.join(tempDir, 'music.ogg');
  const demoSourcePath = path.join(tempDir, 'demo.ogg');
  const coverSourcePath = path.join(tempDir, 'cover.png');
  const info = JSON.parse(await fs.readFile(infoPath, 'utf8'));
  const bmsText = await fs.readFile(bmsPath, 'utf8');
  const parsedBms = parseBmsDocument(bmsText, Number(info.bpm) || 120);
  const oggPath = path.join(paths.audioDir, `${slug}-${stamp}.ogg`);
  const demoOggPath = path.join(paths.demoDir, `${slug}-${stamp}-demo.ogg`);
  const coverPngPath = path.join(paths.coverDir, `${slug}-${stamp}-cover.png`);
  const chartPath = path.join(paths.chartDir, `${slug}-${stamp}.json`);

  await fs.copyFile(musicSourcePath, oggPath);
  const copiedDemoPath = await copyIfExists(demoSourcePath, demoOggPath);
  const copiedCoverPath = await copyIfExists(coverSourcePath, coverPngPath);

  const metadata = {
    title: String(info.name || parsedBms.metadata.title || baseName),
    artist: String(info.author || parsedBms.metadata.artist || ''),
    bpm: Number(info.bpm || parsedBms.metadata.bpm || 120),
    importedAt: new Date().toISOString(),
    sourceMdmPath: mdmPath,
    oggPath,
    export: normalizeExportSettings({
      metadata: {
        artist: String(info.author || parsedBms.metadata.artist || ''),
        export: {
          coverSourcePath: copiedCoverPath,
          coverPngPath: copiedCoverPath,
          coverScale: 1,
          coverOffsetX: 0,
          coverOffsetY: 0,
          demoOggPath: copiedDemoPath,
          demoStart: 0,
          demoDuration: 7,
          scene: String(info.scene || parsedBms.metadata.scene || 'scene_01'),
          levelDesigner: String(info.levelDesigner || parsedBms.metadata.levelDesigner || 'Chart Lab'),
          difficultyName: String(info.difficulty2 || info.difficulty1 || parsedBms.metadata.playLevel || '1'),
          searchTags: Array.isArray(info.searchTags) ? info.searchTags.join(', ') : String(info.searchTags || 'custom')
        }
      }
    })
  };

  const chartDocument = {
    version: 1,
    metadata,
    notes: parsedBms.notes
  };

  await fs.writeFile(chartPath, JSON.stringify(chartDocument, null, 2), 'utf8');

  return {
    canceled: false,
    chart: chartDocument,
    chartPath,
    importedFromMdm: true
  };
}

async function selectCoverImage(_event, payload) {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Cover Image',
    properties: ['openFile'],
    filters: [{ name: 'Image Files', extensions: ['png', 'jpg', 'jpeg'] }]
  });

  if (canceled || filePaths.length === 0) {
    return { canceled: true };
  }

  return {
    canceled: false,
    sourcePath: filePaths[0]
  };
}

async function saveCoverImage(_event, payload) {
  if (!payload || typeof payload.pngBase64 !== 'string') {
    throw new Error('Missing PNG payload for cover generation.');
  }

  const { coverDir } = await ensureWorkspace();
  const title = payload?.title || 'cover';
  const stamp = Date.now();
  const coverPath = path.join(coverDir, `${slugifyFileName(title)}-${stamp}.png`);
  const pngBuffer = Buffer.from(payload.pngBase64, 'base64');
  await fs.writeFile(coverPath, pngBuffer);

  return {
    ok: true,
    coverPath
  };
}

async function generateDemoAudio(_event, payload) {
  if (!payload || typeof payload.oggPath !== 'string') {
    throw new Error('Missing OGG source for demo generation.');
  }

  const { demoDir } = await ensureWorkspace();
  const title = payload.title || path.parse(payload.oggPath).name;
  const stamp = Date.now();
  const demoPath = path.join(demoDir, `${slugifyFileName(title)}-${stamp}-demo.ogg`);
  const duration = Math.min(10, Math.max(5, Number(payload.duration) || 7));
  const start = Math.max(0, Number(payload.startTime) || 0);

  await createDemoClip(payload.oggPath, demoPath, start, duration);

  return {
    ok: true,
    demoPath,
    demoStart: start,
    demoDuration: duration
  };
}

function escapePowerShellLiteral(value) {
  return String(value).replace(/'/g, "''");
}

async function zipDirectoryContents(sourceDir, destinationZipPath) {
  const command = `Compress-Archive -Path '${escapePowerShellLiteral(path.join(sourceDir, '*'))}' -DestinationPath '${escapePowerShellLiteral(destinationZipPath)}' -Force`;
  await runProcess(
    'powershell',
    ['-NoProfile', '-Command', command],
    'Unable to create ZIP archive with PowerShell.'
  );
}

function parseSearchTags(rawValue) {
  return String(rawValue || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
}

function buildInfoDocument(chart) {
  const metadata = chart.metadata || {};
  const exportSettings = normalizeExportSettings(chart);
  const title = String(metadata.title || 'Untitled');
  const artist = String(metadata.artist || 'Unknown Artist');
  const bpmValue = Number(metadata.bpm) || 120;

  return {
    name: title,
    author: artist,
    bpm: String(Number.isInteger(bpmValue) ? bpmValue : Number(bpmValue.toFixed(2))),
    scene: exportSettings.scene,
    levelDesigner: exportSettings.levelDesigner,
    levelDesigner1: exportSettings.levelDesigner,
    levelDesigner2: exportSettings.levelDesigner,
    levelDesigner3: exportSettings.levelDesigner,
    levelDesigner4: exportSettings.levelDesigner,
    difficulty1: '0',
    difficulty2: exportSettings.difficultyName,
    difficulty3: '0',
    difficulty4: '0',
    unlockLevel: '0',
    searchTags: parseSearchTags(exportSettings.searchTags)
  };
}

const NOTE_LABELS = {
  '01': 'Small',
  '02': 'Small (Up)',
  '03': 'Small (Down)',
  '04': 'Medium 1',
  '05': 'Medium 1 (Up)',
  '06': 'Medium 1 (Down)',
  '07': 'Medium 2',
  '08': 'Medium 2 (Up)',
  '09': 'Medium 2 (Down)',
  '0A': 'Large 1',
  '0B': 'Large 2',
  '0E': 'Gemini',
  '0F': 'Hold',
  '0G': 'Masher',
  '0H': 'Gear',
  '11': 'Boss Melee 1',
  '20': 'P Item',
  '21': 'Ghost',
  '22': 'Heart',
  '23': 'Note'
};

function resolveTapCode(note) {
  switch (note.attribute) {
    case 'small':
      return '01';
    case 'medium-1':
      return '04';
    case 'medium-2':
      return '07';
    case 'large-1':
      return '0A';
    case 'large-2':
      return '0B';
    default:
      return note.critical ? '22' : '23';
  }
}

function resolveNoteCode(note) {
  if (note.type === 'double') {
    return '0E';
  }
  if (note.type === 'spinner') {
    return '0G';
  }
  if (note.type === 'hold') {
    return '0F';
  }

  return resolveTapCode(note);
}

function resolveImportedNote(code) {
  switch (String(code || '').toUpperCase()) {
    case '01':
    case '02':
    case '03':
      return { type: 'tap', attribute: 'small' };
    case '04':
    case '05':
    case '06':
      return { type: 'tap', attribute: 'medium-1' };
    case '07':
    case '08':
    case '09':
      return { type: 'tap', attribute: 'medium-2' };
    case '0A':
      return { type: 'tap', attribute: 'large-1' };
    case '0B':
      return { type: 'tap', attribute: 'large-2' };
    case '0E':
      return { type: 'double', attribute: 'sync' };
    case '0F':
      return { type: 'hold', attribute: 'default' };
    case '0G':
      return { type: 'spinner', attribute: 'burst' };
    default:
      return null;
  }
}

function isSustainNote(note) {
  return note.type === 'hold' || (note.type === 'spinner' && note.attribute === 'burst');
}

function buildMeasureGrid() {
  return Array.from({ length: 192 }, () => '00');
}

function setMeasureSlot(measureMap, measureIndex, channel, slotIndex, code) {
  const measureKey = String(measureIndex).padStart(3, '0');
  const channelMap = measureMap.get(measureKey) || new Map();
  const slots = channelMap.get(channel) || buildMeasureGrid();
  let targetIndex = Math.max(0, Math.min(slots.length - 1, slotIndex));

  while (targetIndex < slots.length && slots[targetIndex] !== '00') {
    targetIndex += 1;
  }

  if (targetIndex >= slots.length) {
    targetIndex = slots.length - 1;
  }

  slots[targetIndex] = code;
  channelMap.set(channel, slots);
  measureMap.set(measureKey, channelMap);
}

function noteTimeToMeasurePosition(timeSeconds, bpm) {
  const safeBpm = Math.max(1, Number(bpm) || 120);
  const beatLength = 60 / safeBpm;
  const measureLength = beatLength * 4;
  const safeTime = Math.max(0, Number(timeSeconds) || 0);
  const measureFloat = safeTime / measureLength;
  const measureIndex = Math.floor(measureFloat);
  const measureFraction = measureFloat - measureIndex;
  const slotIndex = Math.max(0, Math.min(191, Math.round(measureFraction * 191)));

  return { measureIndex, slotIndex };
}

function bmsPositionToTime(measureIndex, slotIndex, slotCount, bpm) {
  const safeBpm = Math.max(1, Number(bpm) || 120);
  const beatLength = 60 / safeBpm;
  const measureLength = beatLength * 4;
  const denominator = slotCount === 192 ? 191 : slotCount;
  const fraction = denominator > 0 ? slotIndex / denominator : 0;
  return measureIndex * measureLength + fraction * measureLength;
}

function makeImportedNote(time, lane, type, attribute, holdLength = 0) {
  return {
    id: `note-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    time: Number(Math.max(0, time).toFixed(3)),
    lane,
    type,
    attribute,
    holdLength: Number(Math.max(0, holdLength).toFixed(3)),
    intensity: 1,
    mirrored: false,
    critical: false,
    comment: ''
  };
}

function parseBmsDocument(bmsText, fallbackBpm = 120) {
  const metadata = {};
  const tapEvents = [];
  const sustainEventsByLane = new Map([
    ['lane-1', []],
    ['lane-2', []]
  ]);
  const bpm = Number((bmsText.match(/^#BPM\s+(.+)$/m) || [])[1]) || fallbackBpm || 120;

  for (const rawLine of String(bmsText || '').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('*')) {
      continue;
    }

    const header = line.match(/^#(TITLE|ARTIST|GENRE|LEVELDESIGN|PLAYLEVEL)\s+(.+)$/i);
    if (header) {
      metadata[header[1].toLowerCase()] = header[2].trim();
      continue;
    }

    const data = line.match(/^#(\d{3})(\d{2}):([0-9A-Z]+)$/i);
    if (!data) {
      continue;
    }

    const measureIndex = Number(data[1]);
    const channel = data[2];
    const body = data[3].toUpperCase();
    const slotCount = Math.floor(body.length / 2);
    const lane = channel === '14' || channel === '54' ? 'lane-2' : 'lane-1';

    for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
      const code = body.slice(slotIndex * 2, slotIndex * 2 + 2);
      if (code === '00') {
        continue;
      }

      const noteInfo = resolveImportedNote(code);
      if (!noteInfo) {
        continue;
      }

      const time = bmsPositionToTime(measureIndex, slotIndex, slotCount, bpm);
      if (channel === '13' || channel === '14') {
        tapEvents.push({ time, lane, code, ...noteInfo });
      } else if (channel === '53' || channel === '54') {
        sustainEventsByLane.get(lane).push({ time, lane, code, ...noteInfo });
      }
    }
  }

  const notes = [];
  const tapEventKey = (event) => `${event.code}:${event.time.toFixed(3)}`;
  const consumedTapEvents = new Set();

  for (const event of tapEvents) {
    if (consumedTapEvents.has(event)) {
      continue;
    }

    if (event.code === '0E') {
      const pair = tapEvents.find((candidate) => (
        candidate !== event
        && !consumedTapEvents.has(candidate)
        && candidate.code === event.code
        && candidate.lane !== event.lane
        && Math.abs(candidate.time - event.time) <= 0.004
      ));

      if (pair) {
        consumedTapEvents.add(pair);
      }
      consumedTapEvents.add(event);
      notes.push(makeImportedNote(event.time, 'lane-1', 'double', 'sync'));
      continue;
    }

    const sameTimeDouble = tapEvents.find((candidate) => (
      candidate !== event
      && !consumedTapEvents.has(candidate)
      && candidate.lane !== event.lane
      && tapEventKey(candidate) === tapEventKey(event)
    ));

    if (sameTimeDouble) {
      consumedTapEvents.add(event);
      consumedTapEvents.add(sameTimeDouble);
      notes.push(makeImportedNote(event.time, 'lane-1', 'double', 'sync'));
      continue;
    }

    consumedTapEvents.add(event);
    notes.push(makeImportedNote(event.time, event.lane, event.type, event.attribute));
  }

  for (const events of sustainEventsByLane.values()) {
    events.sort((left, right) => left.time - right.time);
    for (let index = 0; index < events.length; index += 2) {
      const start = events[index];
      const end = events[index + 1];
      if (!end) {
        notes.push(makeImportedNote(start.time, start.lane, start.type, start.attribute));
        continue;
      }

      const sameKind = start.code === end.code;
      const type = sameKind ? start.type : start.type;
      const attribute = sameKind ? start.attribute : start.attribute;
      notes.push(makeImportedNote(start.time, start.lane, type, attribute, end.time - start.time));
    }
  }

  notes.sort((left, right) => left.time - right.time);
  return {
    metadata: {
      title: metadata.title || '',
      artist: metadata.artist || '',
      scene: metadata.genre || 'scene_01',
      levelDesigner: metadata.leveldesign || 'Chart Lab',
      playLevel: metadata.playlevel || '1',
      bpm
    },
    notes
  };
}

function buildBmsDocument(chart) {
  const metadata = chart.metadata || {};
  const exportSettings = normalizeExportSettings(chart);
  const title = String(metadata.title || 'Untitled');
  const artist = String(metadata.artist || 'Unknown Artist');
  const bpm = Math.max(1, Number(metadata.bpm) || 120);
  const playLevel = Math.max(1, Math.min(15, Math.round((chart.notes || []).length / 40) || 1));
  const noteEntries = Array.isArray(chart.notes) ? chart.notes.slice().sort((left, right) => left.time - right.time) : [];
  const measureMap = new Map();

  setMeasureSlot(measureMap, 0, '01', 0, '10');

  for (const note of noteEntries) {
    const basePosition = noteTimeToMeasurePosition(note.time, bpm);
    const noteCode = resolveNoteCode(note);
    const laneChannel = note.lane === 'lane-2' ? '14' : '13';
    const holdChannel = note.lane === 'lane-2' ? '54' : '53';

    if (note.type === 'double') {
      setMeasureSlot(measureMap, basePosition.measureIndex, '13', basePosition.slotIndex, noteCode);
      setMeasureSlot(measureMap, basePosition.measureIndex, '14', basePosition.slotIndex, noteCode);
      continue;
    }

    if (isSustainNote(note) && Number(note.holdLength) > 0) {
      const endPosition = noteTimeToMeasurePosition(Number(note.time) + Number(note.holdLength), bpm);
      setMeasureSlot(measureMap, basePosition.measureIndex, holdChannel, basePosition.slotIndex, noteCode);
      setMeasureSlot(measureMap, endPosition.measureIndex, holdChannel, endPosition.slotIndex, noteCode);
      continue;
    }

    setMeasureSlot(measureMap, basePosition.measureIndex, laneChannel, basePosition.slotIndex, noteCode);
  }

  const lines = [
    '*---------------------- HEADER FIELD',
    '',
    '#PLAYER 3',
    `#GENRE ${exportSettings.scene}`,
    `#TITLE ${title}`,
    `#ARTIST ${artist}`,
    `#LEVELDESIGN ${exportSettings.levelDesigner}`,
    `#BPM ${Number.isInteger(bpm) ? bpm : Number(bpm.toFixed(2))}`,
    `#PLAYLEVEL ${playLevel}`,
    '#RANK 2',
    '',
    '#LNTYPE 1',
    '',
    '#WAV10 music'
  ];

  const usedCodes = new Set(['10']);
  for (const channelMap of measureMap.values()) {
    for (const slots of channelMap.values()) {
      for (const slot of slots) {
        if (slot !== '00') {
          usedCodes.add(slot);
        }
      }
    }
  }

  for (const code of Object.keys(NOTE_LABELS).sort()) {
    if (usedCodes.has(code)) {
      lines.push(`#WAV${code} ${NOTE_LABELS[code]}`);
    }
  }

  lines.push('');
  lines.push('');
  lines.push('*---------------------- MAIN DATA FIELD');
  lines.push('');

  const measureKeys = Array.from(measureMap.keys()).sort();
  for (const measureKey of measureKeys) {
    const channelMap = measureMap.get(measureKey);
    const channelKeys = Array.from(channelMap.keys()).sort();

    for (const channel of channelKeys) {
      const slots = channelMap.get(channel);
      if (slots.some((slot) => slot !== '00')) {
        lines.push(`#${measureKey}${channel}:${slots.join('')}`);
      }
    }

    lines.push('');
  }

  return `${lines.join('\n').trim()}\n`;
}

function buildTalkDocument() {
  return JSON.stringify({
    version: 2,
    English: []
  }, null, 2);
}

async function exportMdmPackage(_event, payload) {
  if (!payload || !payload.chart) {
    throw new Error('Missing chart data for export.');
  }

  const chart = payload.chart;
  chart.metadata = chart.metadata || {};
  chart.metadata.export = normalizeExportSettings(chart);

  const metadata = chart.metadata;
  const exportSettings = chart.metadata.export;

  if (!metadata.oggPath) {
    throw new Error('This chart does not have a converted music.ogg source yet.');
  }
  if (!exportSettings.coverPngPath) {
    throw new Error('Please generate a cover.png before exporting.');
  }
  if (!exportSettings.demoOggPath) {
    throw new Error('Please generate a demo.ogg before exporting.');
  }

  const { exportDir, exportTempDir } = await ensureWorkspace();
  const slug = slugifyFileName(metadata.title || 'chart');
  const stamp = Date.now();
  const tempPackageDir = path.join(exportTempDir, `${slug}-${stamp}`);
  const tempZipPath = path.join(exportTempDir, `${slug}-${stamp}.zip`);

  await fs.rm(tempPackageDir, { recursive: true, force: true });
  await fs.rm(tempZipPath, { force: true });
  await fs.mkdir(tempPackageDir, { recursive: true });

  await fs.copyFile(metadata.oggPath, path.join(tempPackageDir, 'music.ogg'));
  await fs.copyFile(exportSettings.demoOggPath, path.join(tempPackageDir, 'demo.ogg'));
  await fs.copyFile(exportSettings.coverPngPath, path.join(tempPackageDir, 'cover.png'));
  await fs.writeFile(path.join(tempPackageDir, 'info.json'), JSON.stringify(buildInfoDocument(chart), null, 2), 'utf8');
  await fs.writeFile(path.join(tempPackageDir, 'map2.bms'), buildBmsDocument(chart), 'utf8');
  await fs.writeFile(path.join(tempPackageDir, 'map2.talk'), buildTalkDocument(), 'utf8');

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export MDM Package',
    defaultPath: path.join(exportDir, `${slug}.mdm`),
    filters: [{ name: 'Muse Dash Mod Chart', extensions: ['mdm'] }]
  });

  if (canceled || !filePath) {
    await fs.rm(tempPackageDir, { recursive: true, force: true });
    return { canceled: true };
  }

  const outputPath = filePath.toLowerCase().endsWith('.mdm') ? filePath : `${filePath}.mdm`;

  await zipDirectoryContents(tempPackageDir, tempZipPath);
  await fs.copyFile(tempZipPath, outputPath);
  await fs.rm(tempZipPath, { force: true });
  await fs.rm(tempPackageDir, { recursive: true, force: true });

  return {
    canceled: false,
    outputPath
  };
}

ipcMain.handle('chart:import-mp3', importMp3AndCreateChart);
ipcMain.handle('chart:save', saveChartDocument);
ipcMain.handle('chart:open', openChartDocument);
ipcMain.handle('chart:select-cover', selectCoverImage);
ipcMain.handle('chart:save-cover', saveCoverImage);
ipcMain.handle('chart:generate-demo', generateDemoAudio);
ipcMain.handle('chart:export-mdm', exportMdmPackage);

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
