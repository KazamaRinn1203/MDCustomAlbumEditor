(function () {
  const { pathToFileURL } = require('url');
  const exportButton = document.getElementById('exportButton');
  const saveButton = document.getElementById('saveButton');
  const audioPlayer = document.getElementById('audioPlayer');

  const overlay = document.createElement('div');
  overlay.className = 'export-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  overlay.innerHTML = `
    <div class="export-modal">
      <div class="export-header">
        <div>
          <h2>Export MDM</h2>
          <p class="muted">准备封面、截取 demo，并把当前图谱打包成可投放到 <code>Custom_Albums/</code> 的 <code>.mdm</code> 文件。</p>
        </div>
        <button id="closeExportButton" class="secondary">Close</button>
      </div>

      <section class="card export-card">
        <h2>Export Metadata</h2>
        <div class="export-grid">
          <label>
            Scene
            <select id="sceneInput">
              <option value="scene_01">scene_01</option>
              <option value="scene_02">scene_02</option>
              <option value="scene_03">scene_03</option>
              <option value="scene_04">scene_04</option>
              <option value="scene_05">scene_05</option>
              <option value="scene_06">scene_06</option>
              <option value="scene_07">scene_07</option>
              <option value="scene_08">scene_08</option>
              <option value="scene_09">scene_09</option>
            </select>
          </label>
          <label>
            Level Designer
            <input id="levelDesignerInput" type="text" placeholder="Chart Lab">
          </label>
          <label>
            Difficulty Name
            <select id="difficultyNameInput">
              <option value="1">1</option>
              <option value="2">2</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5">5</option>
              <option value="6">6</option>
              <option value="7">7</option>
              <option value="8">8</option>
              <option value="9">9</option>
              <option value="10">10</option>
              <option value="11">11</option>
              <option value="12">12</option>
            </select>
          </label>
          <label>
            Search Tags
            <input id="searchTagsInput" type="text" placeholder="custom, original">
          </label>
        </div>
      </section>

      <section class="card export-card">
        <h2>Cover</h2>
        <div class="cover-preview">
          <div class="cover-preview-stage">
            <canvas id="coverPreview" width="512" height="512" aria-label="Cover preview"></canvas>
          </div>
          <div class="export-card">
            <div class="export-note">支持上传 <code>png / jpg / jpeg</code>。先调整构图，再一键生成最终的 <code>cover.png</code>。</div>
            <div class="export-grid">
              <label>
                Zoom
                <input id="coverScaleInput" type="range" min="1" max="2.5" step="0.01" value="1">
              </label>
              <label>
                Horizontal
                <input id="coverOffsetXInput" type="range" min="-1" max="1" step="0.01" value="0">
              </label>
              <label>
                Vertical
                <input id="coverOffsetYInput" type="range" min="-1" max="1" step="0.01" value="0">
              </label>
            </div>
            <div class="export-row">
              <button id="selectCoverButton">Choose Image</button>
              <button id="generateCoverButton" class="secondary">Generate Cover</button>
              <button id="resetCoverButton" class="secondary">Reset Framing</button>
            </div>
            <div id="coverSummaryText" class="export-note">Pick an image, then adjust the framing until the square preview looks right. You can also drag directly on the preview.</div>
            <div id="coverPathText" class="export-path mono">No cover selected.</div>
          </div>
        </div>
      </section>

      <section class="card export-card">
        <h2>Demo Audio</h2>
        <div class="export-grid">
          <label>
            Demo Start Position
            <input id="demoStartInput" type="range" min="0" max="0" step="0.001" value="0">
          </label>
          <label>
            Demo Length
            <select id="demoDurationInput">
              <option value="5">5s</option>
              <option value="6">6s</option>
              <option value="7" selected>7s</option>
              <option value="8">8s</option>
              <option value="9">9s</option>
              <option value="10">10s</option>
            </select>
          </label>
        </div>
        <div class="demo-timeline">
          <div class="demo-timeline-bar">
            <div id="demoRangeFill" class="demo-range-fill"></div>
          </div>
          <div class="demo-timeline-times">
            <span id="demoTimelineStart">00:00.000</span>
            <span id="demoTimelineEnd">00:00.000</span>
          </div>
        </div>
        <div id="demoRangeSummary" class="export-path">Current clip: 00:00.000 - 00:07.000 (7s)</div>
        <div class="export-row">
          <button id="useCurrentTimeForDemoButton" class="secondary">Use Playhead</button>
          <button id="previewDemoRangeButton" class="secondary">Preview Clip</button>
          <button id="generateDemoButton">Generate Demo</button>
        </div>
        <div class="export-note">demo 必须在 5-10 秒之间，生成时会自动加入淡入淡出。</div>
        <div id="demoPathText" class="export-path mono">No demo generated.</div>
        <audio id="demoAudioPlayer" controls preload="metadata"></audio>
      </section>

      <section class="card export-card">
        <h2>Package</h2>
        <div class="export-note">当前会输出 <code>music.ogg</code>、<code>demo.ogg</code>、<code>cover.png</code>、<code>info.json</code>、<code>map2.bms</code>、<code>map2.talk</code>。</div>
        <div class="export-row">
          <button id="exportMdmButton">Package MDM</button>
        </div>
      </section>
    </div>
  `;
  document.body.appendChild(overlay);

  const closeExportButton = document.getElementById('closeExportButton');
  const sceneInput = document.getElementById('sceneInput');
  const levelDesignerInput = document.getElementById('levelDesignerInput');
  const difficultyNameInput = document.getElementById('difficultyNameInput');
  const searchTagsInput = document.getElementById('searchTagsInput');
  const selectCoverButton = document.getElementById('selectCoverButton');
  const generateCoverButton = document.getElementById('generateCoverButton');
  const resetCoverButton = document.getElementById('resetCoverButton');
  const coverPreview = document.getElementById('coverPreview');
  const coverScaleInput = document.getElementById('coverScaleInput');
  const coverOffsetXInput = document.getElementById('coverOffsetXInput');
  const coverOffsetYInput = document.getElementById('coverOffsetYInput');
  const coverSummaryText = document.getElementById('coverSummaryText');
  const coverPathText = document.getElementById('coverPathText');
  const demoStartInput = document.getElementById('demoStartInput');
  const demoDurationInput = document.getElementById('demoDurationInput');
  const demoRangeFill = document.getElementById('demoRangeFill');
  const demoTimelineStart = document.getElementById('demoTimelineStart');
  const demoTimelineEnd = document.getElementById('demoTimelineEnd');
  const demoRangeSummary = document.getElementById('demoRangeSummary');
  const useCurrentTimeForDemoButton = document.getElementById('useCurrentTimeForDemoButton');
  const previewDemoRangeButton = document.getElementById('previewDemoRangeButton');
  const generateDemoButton = document.getElementById('generateDemoButton');
  const demoPathText = document.getElementById('demoPathText');
  const demoAudioPlayer = document.getElementById('demoAudioPlayer');
  const exportMdmButton = document.getElementById('exportMdmButton');
  const coverPreviewContext = coverPreview.getContext('2d');
  let currentCoverImage = null;
  let currentCoverImagePath = '';
  let coverDragState = null;
  let demoPreviewTimeout = null;

  function formatPercentValue(value) {
    return `${Math.round(Number(value || 0) * 100)}%`;
  }

  function drawEmptyCoverPreview(message) {
    coverPreviewContext.clearRect(0, 0, coverPreview.width, coverPreview.height);
    coverPreviewContext.fillStyle = '#fff8f1';
    coverPreviewContext.fillRect(0, 0, coverPreview.width, coverPreview.height);
    coverPreviewContext.save();
    coverPreviewContext.beginPath();
    coverPreviewContext.arc(
      coverPreview.width / 2,
      coverPreview.height / 2,
      Math.min(coverPreview.width, coverPreview.height) / 2 - 6,
      0,
      Math.PI * 2
    );
    coverPreviewContext.closePath();
    coverPreviewContext.clip();
    coverPreviewContext.fillStyle = '#fff3e6';
    coverPreviewContext.fillRect(0, 0, coverPreview.width, coverPreview.height);
    coverPreviewContext.restore();
    coverPreviewContext.strokeStyle = 'rgba(148, 163, 184, 0.35)';
    coverPreviewContext.lineWidth = 2;
    coverPreviewContext.beginPath();
    coverPreviewContext.arc(
      coverPreview.width / 2,
      coverPreview.height / 2,
      Math.min(coverPreview.width, coverPreview.height) / 2 - 6,
      0,
      Math.PI * 2
    );
    coverPreviewContext.stroke();
    coverPreviewContext.fillStyle = '#7c6f64';
    coverPreviewContext.font = '600 18px "Segoe UI"';
    coverPreviewContext.textAlign = 'center';
    coverPreviewContext.textBaseline = 'middle';
    coverPreviewContext.fillText(message, coverPreview.width / 2, coverPreview.height / 2);
  }

  function computeCoverCrop(image, exportSettings) {
    const safeScale = Math.min(2.5, Math.max(1, Number(exportSettings.coverScale) || 1));
    const sourceSize = Math.min(image.width, image.height) / safeScale;
    const maxOffsetX = Math.max(0, image.width - sourceSize);
    const maxOffsetY = Math.max(0, image.height - sourceSize);
    const offsetXRatio = (Math.min(1, Math.max(-1, Number(exportSettings.coverOffsetX) || 0)) + 1) / 2;
    const offsetYRatio = (Math.min(1, Math.max(-1, Number(exportSettings.coverOffsetY) || 0)) + 1) / 2;

    return {
      sx: maxOffsetX * offsetXRatio,
      sy: maxOffsetY * offsetYRatio,
      size: sourceSize
    };
  }

  async function loadCoverPreviewImage(filePath) {
    if (!filePath) {
      currentCoverImage = null;
      currentCoverImagePath = '';
      drawEmptyCoverPreview('No Cover');
      return;
    }

    if (currentCoverImage && currentCoverImagePath === filePath) {
      drawCoverPreview();
      return;
    }

    const image = new Image();
    const imageLoaded = new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = reject;
    });
    image.src = pathToFileURL(filePath).href;
    await imageLoaded;
    currentCoverImage = image;
    currentCoverImagePath = filePath;
    drawCoverPreview();
  }

  function drawCoverPreview() {
    const exportSettings = ensureExportSettings();
    if (!exportSettings || !currentCoverImage) {
      drawEmptyCoverPreview('No Cover');
      return;
    }

    const crop = computeCoverCrop(currentCoverImage, exportSettings);
    coverPreviewContext.clearRect(0, 0, coverPreview.width, coverPreview.height);
    coverPreviewContext.save();
    coverPreviewContext.beginPath();
    coverPreviewContext.arc(
      coverPreview.width / 2,
      coverPreview.height / 2,
      Math.min(coverPreview.width, coverPreview.height) / 2 - 6,
      0,
      Math.PI * 2
    );
    coverPreviewContext.closePath();
    coverPreviewContext.clip();
    coverPreviewContext.drawImage(
      currentCoverImage,
      crop.sx,
      crop.sy,
      crop.size,
      crop.size,
      0,
      0,
      coverPreview.width,
      coverPreview.height
    );
    coverPreviewContext.restore();
  }

  function resetCoverFraming() {
    const exportSettings = ensureExportSettings();
    if (!exportSettings) {
      return;
    }

    exportSettings.coverScale = 1;
    exportSettings.coverOffsetX = 0;
    exportSettings.coverOffsetY = 0;
    coverScaleInput.value = '1';
    coverOffsetXInput.value = '0';
    coverOffsetYInput.value = '0';
    drawCoverPreview();
    void syncExportControls();
  }

  function formatDemoTime(seconds) {
    if (!Number.isFinite(seconds)) {
      return '00:00.000';
    }

    const safeSeconds = Math.max(0, seconds);
    const minutes = Math.floor(safeSeconds / 60);
    const secs = Math.floor(safeSeconds % 60);
    const millis = Math.floor((safeSeconds % 1) * 1000);
    return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
  }

  function stopDemoPreviewTimer() {
    if (demoPreviewTimeout) {
      window.clearTimeout(demoPreviewTimeout);
      demoPreviewTimeout = null;
    }
  }

  function syncDemoRangeSummary(exportSettings) {
    if (!exportSettings) {
      demoRangeSummary.textContent = 'Current clip: 00:00.000 - 00:07.000 (7s)';
      demoStartInput.max = '0';
      demoStartInput.value = '0';
      demoDurationInput.value = '7';
      demoRangeFill.style.left = '0%';
      demoRangeFill.style.width = '100%';
      demoTimelineStart.textContent = '00:00.000';
      demoTimelineEnd.textContent = '00:00.000';
      return;
    }

    const duration = Math.min(10, Math.max(5, Number(exportSettings.demoDuration) || 7));
    const totalDuration = Number(audioPlayer.duration || state.duration || 0);
    const maxStart = Math.max(0, totalDuration - duration);
    const start = Math.min(maxStart, Math.max(0, Number(exportSettings.demoStart) || 0));
    const end = start + duration;

    exportSettings.demoStart = Number(start.toFixed(3));
    exportSettings.demoDuration = duration;
    demoStartInput.max = String(maxStart);
    demoStartInput.value = String(exportSettings.demoStart);
    demoDurationInput.value = String(duration);
    const fillLeft = totalDuration > 0 ? (start / totalDuration) * 100 : 0;
    const fillWidth = totalDuration > 0 ? Math.max(2, (duration / totalDuration) * 100) : 100;
    demoRangeFill.style.left = `${fillLeft}%`;
    demoRangeFill.style.width = `${fillWidth}%`;
    demoTimelineStart.textContent = formatDemoTime(0);
    demoTimelineEnd.textContent = formatDemoTime(totalDuration);
    demoRangeSummary.textContent = `Current clip: ${formatDemoTime(start)} - ${formatDemoTime(end)} (${duration}s)`;
  }

  function ensureExportSettings() {
    if (!state.chart) {
      return null;
    }

    const metadata = state.chart.metadata || (state.chart.metadata = {});
    const current = metadata.export || (metadata.export = {});
    current.coverSourcePath = typeof current.coverSourcePath === 'string' ? current.coverSourcePath : '';
    current.coverPngPath = typeof current.coverPngPath === 'string' ? current.coverPngPath : '';
    current.coverScale = Number.isFinite(Number(current.coverScale)) ? Number(current.coverScale) : 1;
    current.coverOffsetX = Number.isFinite(Number(current.coverOffsetX)) ? Number(current.coverOffsetX) : 0;
    current.coverOffsetY = Number.isFinite(Number(current.coverOffsetY)) ? Number(current.coverOffsetY) : 0;
    current.demoOggPath = typeof current.demoOggPath === 'string' ? current.demoOggPath : '';
    current.demoStart = Number.isFinite(Number(current.demoStart)) ? Number(current.demoStart) : 0;
    current.demoDuration = Number.isFinite(Number(current.demoDuration)) ? Number(current.demoDuration) : 7;
    current.scene = String(current.scene || 'scene_01');
    current.levelDesigner = String(current.levelDesigner || metadata.artist || 'Chart Lab');
    current.difficultyName = String(current.difficultyName || '1');
    current.searchTags = String(current.searchTags || 'custom');

    return current;
  }

  function updateExportSettingsFromInputs() {
    const exportSettings = ensureExportSettings();
    if (!exportSettings) {
      return;
    }

    exportSettings.scene = sceneInput.value || 'scene_01';
    exportSettings.levelDesigner = levelDesignerInput.value.trim() || state.chart.metadata.artist || 'Chart Lab';
    exportSettings.difficultyName = difficultyNameInput.value || '1';
    exportSettings.searchTags = searchTagsInput.value.trim() || 'custom';
    exportSettings.coverScale = Math.min(2.5, Math.max(1, Number(coverScaleInput.value) || 1));
    exportSettings.coverOffsetX = Math.min(1, Math.max(-1, Number(coverOffsetXInput.value) || 0));
    exportSettings.coverOffsetY = Math.min(1, Math.max(-1, Number(coverOffsetYInput.value) || 0));
    exportSettings.demoStart = Math.max(0, Number(demoStartInput.value) || 0);
    exportSettings.demoDuration = Math.min(10, Math.max(5, Number(demoDurationInput.value) || 7));
    drawCoverPreview();
    syncDemoRangeSummary(exportSettings);
  }

  async function syncExportControls() {
    const exportSettings = ensureExportSettings();
    const hasChart = Boolean(state.chart);
    exportButton.disabled = !hasChart;
    selectCoverButton.disabled = !hasChart;
    generateCoverButton.disabled = !hasChart;
    resetCoverButton.disabled = !hasChart;
    generateDemoButton.disabled = !hasChart;
    exportMdmButton.disabled = !hasChart;

    if (!hasChart || !exportSettings) {
      coverPathText.textContent = 'No cover selected.';
      demoPathText.textContent = 'No demo generated.';
      coverSummaryText.textContent = 'Pick an image, then adjust the framing until the square preview looks right. You can also drag directly on the preview.';
      coverScaleInput.value = '1';
      coverOffsetXInput.value = '0';
      coverOffsetYInput.value = '0';
      currentCoverImage = null;
      currentCoverImagePath = '';
      drawEmptyCoverPreview('No Cover');
      demoAudioPlayer.removeAttribute('src');
      sceneInput.value = '';
      levelDesignerInput.value = '';
      difficultyNameInput.value = '';
      searchTagsInput.value = '';
      syncDemoRangeSummary(null);
      return;
    }

    sceneInput.value = exportSettings.scene;
    levelDesignerInput.value = exportSettings.levelDesigner;
    difficultyNameInput.value = exportSettings.difficultyName;
    searchTagsInput.value = exportSettings.searchTags;
    coverScaleInput.value = String(exportSettings.coverScale);
    coverOffsetXInput.value = String(exportSettings.coverOffsetX);
    coverOffsetYInput.value = String(exportSettings.coverOffsetY);
    syncDemoRangeSummary(exportSettings);
    coverPathText.textContent = exportSettings.coverPngPath || exportSettings.coverSourcePath || 'No cover selected.';
    demoPathText.textContent = exportSettings.demoOggPath || 'No demo generated.';
    coverSummaryText.textContent = exportSettings.coverPngPath
      ? `Ready to export. Zoom ${formatPercentValue(exportSettings.coverScale - 1)} | X ${formatPercentValue(exportSettings.coverOffsetX)} | Y ${formatPercentValue(exportSettings.coverOffsetY)}`
      : exportSettings.coverSourcePath
        ? `Previewing source image. Zoom ${formatPercentValue(exportSettings.coverScale - 1)} | X ${formatPercentValue(exportSettings.coverOffsetX)} | Y ${formatPercentValue(exportSettings.coverOffsetY)}`
        : 'Pick an image, then adjust the framing until the square preview looks right. You can also drag directly on the preview.';

    try {
      await loadCoverPreviewImage(exportSettings.coverSourcePath || exportSettings.coverPngPath || '');
    } catch (error) {
      currentCoverImage = null;
      currentCoverImagePath = '';
      drawEmptyCoverPreview('Cover Error');
      coverSummaryText.textContent = `Unable to preview cover: ${error.message}`;
    }

    if (exportSettings.demoOggPath) {
      demoAudioPlayer.src = pathToFileURL(exportSettings.demoOggPath).href;
    } else {
      demoAudioPlayer.removeAttribute('src');
    }
  }

  function openExportPanel() {
    if (!state.chart) {
      return;
    }

    ensureExportSettings();
    syncExportControls();
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closeExportPanel() {
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
  }

  async function generateDemoFromInputs() {
    if (!state.chart?.metadata?.oggPath) {
      setStatus('Import audio before generating a demo clip.', 'warn');
      return;
    }

    updateExportSettingsFromInputs();
    const exportSettings = ensureExportSettings();
    generateDemoButton.disabled = true;
    setStatus('Generating demo.ogg with fade in/out...', 'warn');

    try {
      const result = await ipcRenderer.invoke('chart:generate-demo', {
        oggPath: state.chart.metadata.oggPath,
        title: state.chart.metadata.title,
        startTime: exportSettings.demoStart,
        duration: exportSettings.demoDuration
      });

      exportSettings.demoOggPath = result.demoPath;
      exportSettings.demoStart = result.demoStart;
      exportSettings.demoDuration = result.demoDuration;
      syncExportControls();
      setStatus(`Demo generated.\n${result.demoPath}`, 'ok');
    } catch (error) {
      setStatus(`Demo generation failed.\n${error.message}`, 'warn');
    } finally {
      generateDemoButton.disabled = false;
    }
  }

  async function exportCurrentChartAsMdm() {
    if (!state.chart) {
      return;
    }

    updateMetadataFromInputs();
    updateExportSettingsFromInputs();
    exportMdmButton.disabled = true;
    setStatus('Packaging current chart as MDM...', 'warn');

    try {
      if (state.chartPath) {
        await ipcRenderer.invoke('chart:save', {
          chartPath: state.chartPath,
          chart: state.chart
        });
      }

      const result = await ipcRenderer.invoke('chart:export-mdm', {
        chart: state.chart
      });

      if (result.canceled) {
        setStatus('MDM export canceled.', 'warn');
        return;
      }

      setStatus(`MDM exported successfully.\n${result.outputPath}`, 'ok');
      closeExportPanel();
    } catch (error) {
      setStatus(`MDM export failed.\n${error.message}`, 'warn');
    } finally {
      exportMdmButton.disabled = false;
    }
  }

  const originalRenderAll = renderAll;
  renderAll = function () {
    originalRenderAll();
    void syncExportControls();
  };

  saveButton.addEventListener('click', updateExportSettingsFromInputs, true);
  exportButton.addEventListener('click', openExportPanel);
  closeExportButton.addEventListener('click', closeExportPanel);

  overlay.addEventListener('click', (event) => {
    if (event.target === overlay) {
      closeExportPanel();
    }
  });

  [sceneInput, levelDesignerInput, difficultyNameInput, searchTagsInput, demoStartInput, demoDurationInput].forEach((input) => {
    input.addEventListener('input', updateExportSettingsFromInputs);
  });

  selectCoverButton.addEventListener('click', async () => {
    if (!state.chart) {
      return;
    }

    selectCoverButton.disabled = true;
    setStatus('Selecting and converting cover image...', 'warn');

    try {
      const result = await ipcRenderer.invoke('chart:select-cover', {
        title: state.chart.metadata.title
      });

      if (result.canceled) {
        setStatus('Cover selection canceled.', 'warn');
        return;
      }

      const exportSettings = ensureExportSettings();
      exportSettings.coverSourcePath = result.sourcePath;
      exportSettings.coverPngPath = '';
      exportSettings.coverScale = 1;
      exportSettings.coverOffsetX = 0;
      exportSettings.coverOffsetY = 0;
      await syncExportControls();
      setStatus(`Cover source ready.\n${result.sourcePath}`, 'ok');
    } catch (error) {
      setStatus(`Cover selection failed.\n${error.message}`, 'warn');
    } finally {
      selectCoverButton.disabled = false;
    }
  });

  generateCoverButton.addEventListener('click', async () => {
    const exportSettings = ensureExportSettings();
    if (!exportSettings?.coverSourcePath) {
      setStatus('Choose a cover image before generating cover.png.', 'warn');
      return;
    }

    updateExportSettingsFromInputs();
    generateCoverButton.disabled = true;
    setStatus('Generating cover.png from the current preview...', 'warn');

    try {
      drawCoverPreview();
      const pngBase64 = coverPreview.toDataURL('image/png').split(',')[1];
      const result = await ipcRenderer.invoke('chart:save-cover', {
        title: state.chart.metadata.title,
        pngBase64
      });
      exportSettings.coverPngPath = result.coverPath;
      await syncExportControls();
      setStatus(`Cover generated.\n${result.coverPath}`, 'ok');
    } catch (error) {
      setStatus(`Cover generation failed.\n${error.message}`, 'warn');
    } finally {
      generateCoverButton.disabled = false;
    }
  });

  resetCoverButton.addEventListener('click', () => {
    resetCoverFraming();
    setStatus('Cover framing reset.', 'ok');
  });

  useCurrentTimeForDemoButton.addEventListener('click', () => {
    const exportSettings = ensureExportSettings();
    if (!exportSettings) {
      return;
    }

    exportSettings.demoStart = Math.max(0, Number(audioPlayer.currentTime || 0));
    demoStartInput.value = String(Number(exportSettings.demoStart.toFixed(3)));
    syncDemoRangeSummary(exportSettings);
  });

  previewDemoRangeButton.addEventListener('click', async () => {
    const exportSettings = ensureExportSettings();
    if (!exportSettings || !state.chart?.metadata?.oggPath) {
      setStatus('Import audio before previewing a demo clip.', 'warn');
      return;
    }

    updateExportSettingsFromInputs();
    stopDemoPreviewTimer();
    audioPlayer.currentTime = exportSettings.demoStart;
    await audioPlayer.play();
    setStatus(`Previewing demo clip.\n${demoRangeSummary.textContent.replace('Current clip: ', '')}`, 'ok');
    demoPreviewTimeout = window.setTimeout(() => {
      audioPlayer.pause();
      stopDemoPreviewTimer();
    }, exportSettings.demoDuration * 1000);
  });

  generateDemoButton.addEventListener('click', generateDemoFromInputs);
  exportMdmButton.addEventListener('click', exportCurrentChartAsMdm);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && overlay.classList.contains('open')) {
      event.preventDefault();
      closeExportPanel();
    }
  });

  audioPlayer.addEventListener('pause', stopDemoPreviewTimer);

  [coverScaleInput, coverOffsetXInput, coverOffsetYInput].forEach((input) => {
    input.addEventListener('input', updateExportSettingsFromInputs);
  });

  coverPreview.addEventListener('pointerdown', (event) => {
    const exportSettings = ensureExportSettings();
    if (!exportSettings || !currentCoverImage) {
      return;
    }

    const crop = computeCoverCrop(currentCoverImage, exportSettings);
    const maxOffsetX = Math.max(0, currentCoverImage.width - crop.size);
    const maxOffsetY = Math.max(0, currentCoverImage.height - crop.size);
    coverDragState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startOffsetX: exportSettings.coverOffsetX,
      startOffsetY: exportSettings.coverOffsetY,
      maxOffsetX,
      maxOffsetY,
      cropSize: crop.size
    };
    coverPreview.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  coverPreview.addEventListener('pointermove', (event) => {
    if (!coverDragState || coverDragState.pointerId !== event.pointerId) {
      return;
    }

    const exportSettings = ensureExportSettings();
    if (!exportSettings) {
      return;
    }

    const deltaPreviewX = event.clientX - coverDragState.startX;
    const deltaPreviewY = event.clientY - coverDragState.startY;
    const deltaSourceX = (deltaPreviewX / coverPreview.clientWidth) * coverDragState.cropSize;
    const deltaSourceY = (deltaPreviewY / coverPreview.clientHeight) * coverDragState.cropSize;

    const offsetXDelta = coverDragState.maxOffsetX > 0 ? (-2 * deltaSourceX) / coverDragState.maxOffsetX : 0;
    const offsetYDelta = coverDragState.maxOffsetY > 0 ? (-2 * deltaSourceY) / coverDragState.maxOffsetY : 0;

    exportSettings.coverOffsetX = Math.min(1, Math.max(-1, coverDragState.startOffsetX + offsetXDelta));
    exportSettings.coverOffsetY = Math.min(1, Math.max(-1, coverDragState.startOffsetY + offsetYDelta));
    coverOffsetXInput.value = String(exportSettings.coverOffsetX);
    coverOffsetYInput.value = String(exportSettings.coverOffsetY);
    drawCoverPreview();
    coverSummaryText.textContent = exportSettings.coverPngPath
      ? `Ready to export. Zoom ${formatPercentValue(exportSettings.coverScale - 1)} | X ${formatPercentValue(exportSettings.coverOffsetX)} | Y ${formatPercentValue(exportSettings.coverOffsetY)}`
      : `Previewing source image. Zoom ${formatPercentValue(exportSettings.coverScale - 1)} | X ${formatPercentValue(exportSettings.coverOffsetX)} | Y ${formatPercentValue(exportSettings.coverOffsetY)}`;
    event.preventDefault();
  });

  function endCoverDrag(event) {
    if (!coverDragState || coverDragState.pointerId !== event.pointerId) {
      return;
    }

    if (coverPreview.hasPointerCapture(event.pointerId)) {
      coverPreview.releasePointerCapture(event.pointerId);
    }
    coverDragState = null;
  }

  coverPreview.addEventListener('pointerup', endCoverDrag);
  coverPreview.addEventListener('pointercancel', endCoverDrag);

  drawEmptyCoverPreview('No Cover');
  void syncExportControls();
})();
