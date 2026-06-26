const TEMPLATE = {
  width: 1400,
  height: 460,
  markerCenters: [
    { x: 18, y: 18 },
    { x: 1382, y: 18 },
    { x: 1382, y: 442 },
    { x: 18, y: 442 }
  ],
  markerSize: 22,
  choices: ["A", "B", "C", "D", "E"]
};

const state = {
  count: 50,
  gradedCount: 25,
  key: Array(25).fill(null),
  image: null,
  imageCanvas: null,
  corners: [],
  markerConfidence: 0,
  manualMode: false,
  dragCorner: null,
  answers: [],
  lastResult: null
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const els = {
  questionCount: $("#questionCount"),
  gradedCount: $("#gradedCount"),
  pointPerQuestion: $("#pointPerQuestion"),
  passingScore: $("#passingScore"),
  passingOutput: $("#passingOutput"),
  answerGrid: $("#answerGrid"),
  keyProgress: $("#keyProgress"),
  keyHint: $("#keyHint"),
  goScan: $("#goScan"),
  scanSection: $("#scanSection"),
  imageInput: $("#imageInput"),
  uploadCard: $("#uploadCard"),
  uploadIdle: $("#uploadIdle"),
  scanPreview: $("#scanPreview"),
  scanCanvas: $("#scanCanvas"),
  scanStatus: $("#scanStatus"),
  analyzeButton: $("#analyzeButton"),
  manualCorners: $("#manualCorners"),
  replaceImage: $("#replaceImage"),
  cornerInstruction: $("#cornerInstruction"),
  cornerName: $("#cornerName"),
  resultSection: $("#resultSection")
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
}

function sanitizeCount() {
  const next = clamp(Math.round(Number(els.questionCount.value) || 5), 5, 50);
  els.questionCount.value = next;
  els.gradedCount.max = next;
  if (next !== state.count) {
    const old = state.key;
    state.count = next;
    state.key = Array.from({ length: next }, (_, index) => old[index] ?? null);
    sanitizeGradedCount(false);
  }
  renderAnswerGrid();
}

function sanitizeGradedCount(render = true) {
  const next = clamp(Math.round(Number(els.gradedCount.value) || 1), 1, state.count);
  els.gradedCount.value = next;
  state.gradedCount = next;
  for (let index = next; index < state.key.length; index++) state.key[index] = null;
  state.lastResult = null;
  els.resultSection.classList.add("hidden");
  if (render) renderAnswerGrid();
}

function renderAnswerGrid() {
  els.answerGrid.innerHTML = "";
  const fragment = document.createDocumentFragment();
  for (let index = 0; index < state.count; index++) {
    const row = document.createElement("div");
    const ignored = index >= state.gradedCount;
    row.className = `answer-row${ignored ? " ignored" : ""}`;
    row.innerHTML = `<b>${String(index + 1).padStart(2, "0")}</b>`;
    TEMPLATE.choices.forEach((choice) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `bubble${state.key[index] === choice ? " selected" : ""}`;
      button.textContent = choice;
      button.disabled = ignored;
      button.setAttribute("aria-label", `Soal ${index + 1}, jawaban ${choice}`);
      button.addEventListener("click", () => {
        state.key[index] = choice;
        renderAnswerGrid();
      });
      row.append(button);
    });
    fragment.append(row);
  }
  els.answerGrid.append(fragment);
  updateKeyProgress();
}

function updateKeyProgress() {
  const filled = state.key.slice(0, state.gradedCount).filter(Boolean).length;
  const remaining = state.gradedCount - filled;
  els.keyProgress.textContent = `${filled} / ${state.gradedCount}`;
  els.goScan.disabled = remaining > 0;
  if (remaining) {
    els.keyHint.innerHTML = `<strong>Isi kunci jawaban yang dinilai</strong><br><span>Masih ada ${remaining} soal yang belum diisi</span>`;
  } else {
    const ignored = state.count - state.gradedCount;
    els.keyHint.innerHTML = `<strong>Kunci jawaban siap</strong><br><span style="color:#087f65">${ignored ? `${ignored} nomor terakhir tidak dihitung` : "Semua nomor akan dihitung"}</span>`;
  }
}

function getQuestionLayout(count) {
  const perColumn = 10;
  const columns = Math.ceil(count / perColumn);
  const columnWidth = 272;
  const totalWidth = columns * columnWidth;
  const startX = (TEMPLATE.width - totalWidth) / 2;
  const startY = 82;
  const rowGap = 35;
  const points = [];
  for (let i = 0; i < count; i++) {
    const column = Math.floor(i / perColumn);
    const row = i % perColumn;
    const baseX = startX + column * columnWidth;
    const y = startY + row * rowGap + (row >= 5 ? 14 : 0);
    points.push({
      numberX: baseX,
      y,
      bubbles: TEMPLATE.choices.map((choice, c) => ({
        choice,
        x: baseX + 65 + c * 39,
        y
      }))
    });
  }
  return points;
}

function drawTemplateLegacy(canvas, forPrint = false) {
  canvas.width = TEMPLATE.width;
  canvas.height = TEMPLATE.height;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111";

  TEMPLATE.markerCenters.forEach(({ x, y }) => {
    const s = TEMPLATE.markerSize;
    ctx.fillRect(x - s / 2, y - s / 2, s, s);
  });

  ctx.strokeStyle = "#111";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(28, 28, TEMPLATE.width - 56, TEMPLATE.height - 56);

  ctx.textAlign = "center";
  ctx.fillStyle = "#102a2a";
  ctx.font = "bold 25px Arial";
  ctx.fillText("LEMBAR JAWABAN PILIHAN GANDA", TEMPLATE.width / 2, 82);
  ctx.font = "11px Arial";
  ctx.fillText(`LEMBAR JAWABAN KOMPUTER • ${state.count} SOAL • PILIHAN A–E`, TEMPLATE.width / 2, 103);

  ctx.textAlign = "left";
  ctx.font = "12px Arial";
  ctx.fillText("Nama", 70, 142);
  ctx.fillText("Kelas", 70, 178);
  ctx.fillText("No. Peserta", 430, 142);
  ctx.fillText("Tanggal", 430, 178);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(112, 145); ctx.lineTo(380, 145);
  ctx.moveTo(112, 181); ctx.lineTo(380, 181);
  ctx.moveTo(510, 145); ctx.lineTo(720, 145);
  ctx.moveTo(482, 181); ctx.lineTo(720, 181);
  ctx.stroke();

  ctx.fillStyle = "#eef3ef";
  roundRect(ctx, 70, 207, 654, 43, 5, true);
  ctx.fillStyle = "#293c39";
  ctx.font = "bold 10px Arial";
  ctx.fillText("PETUNJUK:", 84, 225);
  ctx.font = "10px Arial";
  ctx.fillText("Hitamkan satu lingkaran dengan penuh. Jangan melipat, mencoret, atau merusak penanda sudut.", 145, 225);
  ctx.fillText("Gunakan pensil 2B atau pena hitam. Contoh benar:  ●", 84, 240);

  const layout = getQuestionLayout(state.count);
  const columns = Math.ceil(state.count / 25);
  ctx.font = "bold 9px Arial";
  ctx.textAlign = "center";
  for (let col = 0; col < columns; col++) {
    const item = layout[col * 25];
    if (!item) continue;
    TEMPLATE.choices.forEach((choice, c) => {
      ctx.fillText(choice, item.bubbles[c].x, 266);
    });
  }

  layout.forEach((item, index) => {
    ctx.textAlign = "right";
    ctx.fillStyle = "#1c2927";
    ctx.font = "bold 10px Arial";
    ctx.fillText(String(index + 1), item.numberX + 25, item.y + 3);
    item.bubbles.forEach((bubble) => {
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, 7.4, 0, Math.PI * 2);
      ctx.strokeStyle = "#222";
      ctx.lineWidth = 1.2;
      ctx.stroke();
    });
  });

  ctx.textAlign = "center";
  ctx.fillStyle = "#52625f";
  ctx.font = "9px Arial";
  ctx.fillText("KoreksiLJK • Jangan memotong area di dalam bingkai • Pastikan empat kotak hitam terlihat saat difoto", TEMPLATE.width / 2, 1054);
  ctx.fillStyle = "#102a2a";
  ctx.font = "bold 8px Arial";
  ctx.fillText(`FORM-${state.count}-AE`, TEMPLATE.width / 2, 1078);

  if (forPrint) return canvas.toDataURL("image/png");
}

function drawTemplate(canvas, forPrint = false) {
  canvas.width = TEMPLATE.width;
  canvas.height = TEMPLATE.height;
  const ctx = canvas.getContext("2d");
  const blue = "#000000";

  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.strokeStyle = blue;
  ctx.lineWidth = 3;
  ctx.strokeRect(18, 18, TEMPLATE.width - 36, TEMPLATE.height - 36);
  ctx.beginPath();
  ctx.moveTo(18, 62);
  ctx.lineTo(TEMPLATE.width - 18, 62);
  ctx.stroke();

  ctx.fillStyle = "#111";
  TEMPLATE.markerCenters.forEach(({ x, y }) => {
    const size = TEMPLATE.markerSize;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  });

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = "bold 21px Arial";
  ctx.fillText("J A W A B A N", TEMPLATE.width / 2 - 90, 48);
  ctx.fillStyle = blue;
  ctx.font = "italic 16px Arial";
  ctx.fillText("(Hitamkanlah salah satu pilihan yang benar)", TEMPLATE.width / 2 + 205, 48);

  const layout = getQuestionLayout(state.count);
  layout.forEach((item, index) => {
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillStyle = "#222";
    ctx.font = "bold 17px Arial";
    ctx.fillText(`${index + 1}.`, item.numberX + 43, item.y + 6);

    item.bubbles.forEach((bubble) => {
      ctx.beginPath();
      ctx.arc(bubble.x, bubble.y, 14, 0, Math.PI * 2);
      ctx.strokeStyle = blue;
      ctx.lineWidth = 2.4;
      ctx.stroke();
      ctx.fillStyle = blue;
      ctx.font = "bold 15px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bubble.choice, bubble.x, bubble.y + .5);
    });
  });

  if (forPrint) return canvas.toDataURL("image/png");
}

function roundRect(ctx, x, y, width, height, radius, fill) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) ctx.fill();
}

function createTemplateCanvas() {
  const canvas = document.createElement("canvas");
  drawTemplate(canvas);
  return canvas;
}

function printTemplate() {
  sanitizeCount();
  const dataUrl = drawTemplate(document.createElement("canvas"), true);
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    showToast("Izinkan pop-up agar template dapat dicetak.");
    return;
  }
  printWindow.document.write(`<!doctype html><html><head><title>Template LJK ${state.count} Soal</title>
    <style>@page{size:A4 landscape;margin:10mm}html,body{margin:0}body{height:190mm;display:flex;align-items:center;justify-content:center}img{display:block;width:277mm;height:auto}</style>
    </head><body><img src="${dataUrl}" onload="setTimeout(()=>window.print(),200)"></body></html>`);
  printWindow.document.close();
}

function downloadTemplate() {
  sanitizeCount();
  const canvas = createTemplateCanvas();
  const link = document.createElement("a");
  link.download = `template-ljk-${state.count}-soal.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();
  showToast("Template PNG berhasil dibuat.");
}

async function loadImage(file) {
  if (!file || !file.type.startsWith("image/")) {
    showToast("Pilih file gambar JPG atau PNG.");
    return;
  }
  const bitmap = await createImageBitmap(file);
  const maxSide = 1800;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d", { willReadFrequently: true }).drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  state.imageCanvas = canvas;
  state.image = file;
  const detection = detectCornerMarkers(canvas);
  state.corners = detection.confidence >= .64 ? detection.corners : getFullImageCorners(canvas);
  state.markerConfidence = detection.confidence;
  state.manualMode = true;
  els.uploadIdle.classList.add("hidden");
  els.scanPreview.classList.remove("hidden");
  els.replaceImage.disabled = false;
  els.manualCorners.classList.remove("hidden");
  els.cornerInstruction.classList.remove("hidden");
  drawScanPreview();

  if (state.markerConfidence >= .64) {
    setScanStatus("ready", "✓", "Penanda sudut ditemukan", `Keyakinan ${Math.round(state.markerConfidence * 100)}%. Batas dapat digeser jika perlu.`);
  } else {
    setScanStatus("warning", "!", "Sesuaikan batas kotak jawaban", "Seret empat titik dari sudut foto ke tengah kotak hitam.");
  }
  els.analyzeButton.disabled = false;
}

function getFullImageCorners(canvas) {
  const insetX = Math.max(14, canvas.width * .025);
  const insetY = Math.max(14, canvas.height * .025);
  return [
    { x: insetX, y: insetY },
    { x: canvas.width - insetX, y: insetY },
    { x: canvas.width - insetX, y: canvas.height - insetY },
    { x: insetX, y: canvas.height - insetY }
  ];
}

function detectCornerMarkers(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const integral = buildDarknessIntegral(data, width, height);
  const candidates = [];
  const minSize = Math.max(3, Math.round(width * .006));
  const maxSize = Math.max(minSize + 2, Math.round(width * .025));

  for (let size = minSize; size <= maxSize; size += Math.max(2, Math.round(minSize / 2))) {
    const half = Math.round(size / 2);
    const outer = Math.round(size * 1.8);
    const step = Math.max(2, Math.round(size / 3));
    for (let y = outer; y < height - outer; y += step) {
      for (let x = outer; x < width - outer; x += step) {
        const innerDark = rectAverage(integral, width, x - half, y - half, x + half, y + half);
        if (innerDark < 150) continue;
        const outerDark = rectAverage(integral, width, x - outer, y - outer, x + outer, y + outer);
        const score = innerDark - outerDark * .58;
        if (score > 72) candidates.push({ x, y, score, size });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const distinct = [];
  for (const candidate of candidates) {
    const overlaps = distinct.some((point) =>
      Math.hypot(point.x - candidate.x, point.y - candidate.y) < Math.max(point.size, candidate.size) * 1.8
    );
    if (!overlaps) distinct.push(candidate);
    if (distinct.length >= 90) break;
  }

  return selectMarkerRectangle(distinct, width, height, integral)
    || { corners: [], confidence: 0 };
}

function buildDarknessIntegral(data, width, height) {
  const stride = width + 1;
  const integral = new Float64Array(stride * (height + 1));
  for (let y = 1; y <= height; y++) {
    let rowTotal = 0;
    for (let x = 1; x <= width; x++) {
      const p = ((y - 1) * width + x - 1) * 4;
      const luminance = data[p] * .299 + data[p + 1] * .587 + data[p + 2] * .114;
      rowTotal += 255 - luminance;
      integral[y * stride + x] = integral[(y - 1) * stride + x] + rowTotal;
    }
  }
  return integral;
}

function rectAverage(integral, width, x0, y0, x1, y1) {
  const stride = width + 1;
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const right = Math.min(width, Math.ceil(x1));
  const bottom = Math.min((integral.length / stride) - 1, Math.ceil(y1));
  const area = Math.max(1, (right - left) * (bottom - top));
  const sum = integral[bottom * stride + right] - integral[top * stride + right]
    - integral[bottom * stride + left] + integral[top * stride + left];
  return sum / area;
}

function selectMarkerRectangle(points, width, height, integral) {
  const horizontalPairs = [];
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      const left = points[i].x < points[j].x ? points[i] : points[j];
      const right = left === points[i] ? points[j] : points[i];
      const pairWidth = right.x - left.x;
      if (pairWidth < width * .48) continue;
      if (Math.abs(right.y - left.y) > height * .045) continue;
      horizontalPairs.push({ left, right, y: (left.y + right.y) / 2, width: pairWidth });
    }
  }

  let best = null;
  const expectedRatio =
    (TEMPLATE.markerCenters[1].x - TEMPLATE.markerCenters[0].x)
    / (TEMPLATE.markerCenters[3].y - TEMPLATE.markerCenters[0].y);
  for (let i = 0; i < horizontalPairs.length; i++) {
    for (let j = i + 1; j < horizontalPairs.length; j++) {
      const top = horizontalPairs[i].y < horizontalPairs[j].y ? horizontalPairs[i] : horizontalPairs[j];
      const bottom = top === horizontalPairs[i] ? horizontalPairs[j] : horizontalPairs[i];
      const boxHeight = bottom.y - top.y;
      if (boxHeight < height * .09 || boxHeight > height * .55) continue;
      const averageWidth = (top.width + bottom.width) / 2;
      const ratio = averageWidth / boxHeight;
      if (ratio < 2.2 || ratio > 4.3) continue;

      const xError = (Math.abs(top.left.x - bottom.left.x) + Math.abs(top.right.x - bottom.right.x)) / width;
      const widthError = Math.abs(top.width - bottom.width) / averageWidth;
      if (xError > .13 || widthError > .18) continue;

      const ratioError = Math.abs(Math.log(ratio / expectedRatio));
      const markerScore = top.left.score + top.right.score + bottom.left.score + bottom.right.score;
      const corners = [
        { x: top.left.x, y: top.left.y },
        { x: top.right.x, y: top.right.y },
        { x: bottom.right.x, y: bottom.right.y },
        { x: bottom.left.x, y: bottom.left.y }
      ];
      const borderSupport = (
        measureLineSupport(integral, width, corners[0], corners[1])
        + measureLineSupport(integral, width, corners[1], corners[2])
        + measureLineSupport(integral, width, corners[2], corners[3])
        + measureLineSupport(integral, width, corners[3], corners[0])
      ) / 4;
      const geometryConfidence = Math.exp(-ratioError * 5)
        * Math.exp(-xError * 12)
        * Math.exp(-widthError * 8);
      const markerConfidence = clamp((markerScore / 4 - 65) / 100, 0, 1);
      const confidence = markerConfidence * .35 + geometryConfidence * .35 + borderSupport * .30;
      const score = confidence * 1000 + markerScore;
      if (!best || score > best.score) {
        best = {
          score,
          confidence,
          corners
        };
      }
    }
  }
  return best ? { corners: best.corners, confidence: best.confidence } : null;
}

function measureLineSupport(integral, width, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!length) return 0;
  const nx = -dy / length;
  const ny = dx / length;
  const samples = 60;
  let supported = 0;
  for (let i = 2; i < samples - 2; i++) {
    const t = i / (samples - 1);
    const x = start.x + dx * t;
    const y = start.y + dy * t;
    let darkest = 0;
    for (let offset = -4; offset <= 4; offset += 2) {
      darkest = Math.max(
        darkest,
        rectAverage(
          integral,
          width,
          x + nx * offset - 1.5,
          y + ny * offset - 1.5,
          x + nx * offset + 1.5,
          y + ny * offset + 1.5
        )
      );
    }
    if (darkest > 38) supported++;
  }
  return supported / (samples - 4);
}

function drawScanPreview() {
  if (!state.imageCanvas) return;
  const source = state.imageCanvas;
  const canvas = els.scanCanvas;
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(source, 0, 0);
  const radius = Math.max(8, Math.min(canvas.width, canvas.height) * .012);
  if (state.corners.length === 4) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, canvas.width, canvas.height);
    ctx.moveTo(state.corners[0].x, state.corners[0].y);
    state.corners.slice(1).forEach((point) => ctx.lineTo(point.x, point.y));
    ctx.closePath();
    ctx.fillStyle = "rgba(8, 25, 23, .28)";
    ctx.fill("evenodd");
    ctx.restore();
  }
  state.corners.forEach((point, index) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = index === state.dragCorner ? "rgba(242,112,63,.58)" : "rgba(217,239,104,.48)";
    ctx.fill();
    ctx.strokeStyle = index === state.dragCorner ? "#f2703f" : "#d9ef68";
    ctx.lineWidth = Math.max(3, radius * .25);
    ctx.stroke();
    ctx.fillStyle = "#102a2a";
    ctx.font = `bold ${Math.round(radius)}px Arial`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(index + 1), point.x, point.y);
  });
  if (state.corners.length === 4) {
    ctx.beginPath();
    ctx.moveTo(state.corners[0].x, state.corners[0].y);
    state.corners.slice(1).forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    ctx.strokeStyle = "rgba(217,239,104,.8)";
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

function startManualCorners() {
  if (!state.imageCanvas) return;
  state.corners = getFullImageCorners(state.imageCanvas);
  state.markerConfidence = 1;
  state.manualMode = true;
  els.cornerInstruction.classList.remove("hidden");
  els.cornerName.textContent = "1–4";
  els.analyzeButton.disabled = false;
  setScanStatus("warning", "↔", "Batas direset", "Seret setiap titik ke tengah kotak hitam yang sesuai.");
  drawScanPreview();
}

function canvasPoint(event) {
  const rect = els.scanCanvas.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) * (els.scanCanvas.width / rect.width),
    y: (event.clientY - rect.top) * (els.scanCanvas.height / rect.height)
  };
}

function handleCornerPointerDown(event) {
  if (!state.imageCanvas || state.corners.length !== 4) return;
  const point = canvasPoint(event);
  const rect = els.scanCanvas.getBoundingClientRect();
  const hitRadius = Math.max(18, els.scanCanvas.width * 22 / rect.width);
  let nearest = -1;
  let nearestDistance = Infinity;
  state.corners.forEach((corner, index) => {
    const distance = Math.hypot(corner.x - point.x, corner.y - point.y);
    if (distance < nearestDistance) {
      nearest = index;
      nearestDistance = distance;
    }
  });
  if (nearestDistance > hitRadius) return;
  state.dragCorner = nearest;
  state.manualMode = true;
  els.scanCanvas.classList.add("dragging-corner");
  els.scanCanvas.setPointerCapture(event.pointerId);
  event.preventDefault();
  drawScanPreview();
}

function handleCornerPointerMove(event) {
  if (state.dragCorner === null || !state.imageCanvas) return;
  const point = canvasPoint(event);
  state.corners[state.dragCorner] = {
    x: clamp(point.x, 0, els.scanCanvas.width),
    y: clamp(point.y, 0, els.scanCanvas.height)
  };
  state.markerConfidence = 1;
  setScanStatus("ready", "↔", "Batas disesuaikan", "Lepaskan titik saat tepat di tengah kotak hitam.");
  event.preventDefault();
  drawScanPreview();
}

function handleCornerPointerUp(event) {
  if (state.dragCorner === null) return;
  state.dragCorner = null;
  els.scanCanvas.classList.remove("dragging-corner");
  if (els.scanCanvas.hasPointerCapture(event.pointerId)) els.scanCanvas.releasePointerCapture(event.pointerId);
  setScanStatus("ready", "✓", "Batas siap", "Pastikan garis hijau tepat mengelilingi area jawaban.");
  drawScanPreview();
}

function setScanStatus(type, icon, title, detail) {
  els.scanStatus.className = `status-box${type ? ` ${type}` : ""}`;
  els.scanStatus.innerHTML = `<i>${icon}</i><div><strong>${title}</strong><span>${detail}</span></div>`;
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const divisor = a[col][col];
    if (Math.abs(divisor) < 1e-10) throw new Error("Transformasi sudut tidak valid.");
    for (let j = col; j <= n; j++) a[col][j] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}

function getHomography(source, target) {
  const A = [], b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = source[i];
    const u = target[i].x, v = target[i].y;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
  }
  const h = solveLinearSystem(A, b);
  return [...h, 1];
}

function transformPoint(h, x, y) {
  const d = h[6] * x + h[7] * y + h[8];
  return {
    x: (h[0] * x + h[1] * y + h[2]) / d,
    y: (h[3] * x + h[4] * y + h[5]) / d
  };
}

function sampleBubble(imageData, width, height, h, bubble) {
  const center = transformPoint(h, bubble.x, bubble.y);
  const edgeX = transformPoint(h, bubble.x + 14, bubble.y);
  const edgeY = transformPoint(h, bubble.x, bubble.y + 14);
  const bubbleRx = Math.max(4, Math.hypot(edgeX.x - center.x, edgeX.y - center.y));
  const bubbleRy = Math.max(4, Math.hypot(edgeY.x - center.x, edgeY.y - center.y));
  const innerLuminance = [];
  const backgroundLuminance = [];
  const minX = Math.floor(center.x - bubbleRx * 1.35), maxX = Math.ceil(center.x + bubbleRx * 1.35);
  const minY = Math.floor(center.y - bubbleRy * 1.35), maxY = Math.ceil(center.y + bubbleRy * 1.35);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      if (x < 0 || y < 0 || x >= width || y >= height) continue;
      const nx = (x - center.x) / bubbleRx, ny = (y - center.y) / bubbleRy;
      const distance = Math.sqrt(nx * nx + ny * ny);
      const p = (y * width + x) * 4;
      const lum = imageData[p] * .299 + imageData[p + 1] * .587 + imageData[p + 2] * .114;
      // Cincin bagian dalam menghindari huruf di tengah dan garis luar lingkaran.
      if (distance >= .30 && distance <= .78) innerLuminance.push(lum);
      // Area luar dipakai untuk menyesuaikan bayangan dan pencahayaan lokal.
      if (distance >= 1.08 && distance <= 1.32) backgroundLuminance.push(lum);
    }
  }
  innerLuminance.sort((a, b) => a - b);
  backgroundLuminance.sort((a, b) => a - b);
  const background = percentile(backgroundLuminance, .72) || 240;
  const darkThreshold = Math.max(55, background - 72);
  const dark = innerLuminance.filter((lum) => lum < darkThreshold).length;
  const normalizedDarkness = innerLuminance.reduce(
    (sum, lum) => sum + clamp((background - lum) / Math.max(80, background), 0, 1),
    0
  );
  return {
    ratio: innerLuminance.length ? dark / innerLuminance.length : 0,
    darkness: innerLuminance.length ? normalizedDarkness / innerLuminance.length : 0,
    center
  };
}

function percentile(values, position) {
  if (!values.length) return 0;
  return values[Math.min(values.length - 1, Math.max(0, Math.floor((values.length - 1) * position)))];
}

function analyzeAnswers() {
  if (!state.imageCanvas || state.corners.length !== 4) return;
  try {
    const boundaryArea = polygonArea(state.corners);
    const imageArea = state.imageCanvas.width * state.imageCanvas.height;
    if (boundaryArea < imageArea * .035) {
      throw new Error("Batas kotak jawaban terlalu kecil atau titik sudut saling menyilang.");
    }
    setScanStatus("", "…", "Menganalisis jawaban", "Membaca setiap area isian.");
    const ctx = state.imageCanvas.getContext("2d", { willReadFrequently: true });
    const { width, height } = state.imageCanvas;
    const pixels = ctx.getImageData(0, 0, width, height).data;
    const homography = getHomography(TEMPLATE.markerCenters, state.corners);
    const layout = getQuestionLayout(state.count);
    const answers = [];

    layout.forEach((item) => {
      const samples = item.bubbles.map((bubble) => sampleBubble(pixels, width, height, homography, bubble));
      const ranked = samples
        .map((sample, index) => ({ ...sample, index }))
        .sort((a, b) => b.darkness - a.darkness);
      const top = ranked[0];
      const second = ranked[1];
      const baselineDarkness = ranked.slice(2).reduce((sum, sample) => sum + sample.darkness, 0) / 3;
      const baselineRatio = ranked.slice(2).reduce((sum, sample) => sum + sample.ratio, 0) / 3;
      const darknessThreshold = Math.max(.065, baselineDarkness * .32);
      const ratioThreshold = Math.max(.11, baselineRatio * .45);
      const marked = ranked.filter((sample) =>
        sample.darkness - baselineDarkness > darknessThreshold
        || sample.ratio - baselineRatio > ratioThreshold
      );
      let choice = null;
      let status = "blank";
      if (marked.length > 1) {
        status = "multiple";
      } else if (marked.length === 1) {
        choice = TEMPLATE.choices[top.index];
        status = "read";
      } else if (
        top.darkness - second.darkness > .085
        || top.ratio - second.ratio > .14
      ) {
        choice = TEMPLATE.choices[top.index];
        status = "read";
      }
      answers.push({ choice, status, samples });
    });

    state.answers = answers;
    state.lastResult = buildResult(answers);
    renderResult(state.lastResult);
    drawAnalyzedPreview(homography, answers);
    setScanStatus("ready", "✓", "Analisis selesai", `${state.lastResult.correct} jawaban benar terbaca.`);
    els.resultSection.classList.remove("hidden");
    els.resultSection.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    console.error(error);
    setScanStatus("warning", "!", "Analisis gagal", "Periksa urutan titik sudut dan coba lagi.");
    showToast(error.message || "Gambar belum dapat dianalisis.");
  }
}

function polygonArea(points) {
  let area = 0;
  for (let index = 0; index < points.length; index++) {
    const next = points[(index + 1) % points.length];
    area += points[index].x * next.y - next.x * points[index].y;
  }
  return Math.abs(area) / 2;
}

function drawAnalyzedPreview(h, answers) {
  drawScanPreview();
  const ctx = els.scanCanvas.getContext("2d");
  const layout = getQuestionLayout(state.count);
  answers.forEach((answer, index) => {
    if (!answer.choice || index >= state.gradedCount) return;
    const bubble = layout[index].bubbles[TEMPLATE.choices.indexOf(answer.choice)];
    const point = transformPoint(h, bubble.x, bubble.y);
    const correct = answer.choice === state.key[index];
    ctx.beginPath();
    ctx.arc(point.x, point.y, Math.max(5, els.scanCanvas.width * .006), 0, Math.PI * 2);
    ctx.strokeStyle = correct ? "#18d39b" : "#ff6159";
    ctx.lineWidth = Math.max(2, els.scanCanvas.width * .002);
    ctx.stroke();
  });
}

function buildResult(answers) {
  let correct = 0, wrong = 0, review = 0, ignored = 0;
  const rows = answers.map((answer, index) => {
    let result;
    if (index >= state.gradedCount) {
      result = "ignored";
      ignored++;
    } else if (!answer.choice) {
      result = "review";
      review++;
    } else if (answer.choice === state.key[index]) {
      result = "correct";
      correct++;
    } else {
      result = "wrong";
      wrong++;
    }
    return { number: index + 1, answer: answer.choice, key: state.key[index], status: answer.status, result };
  });
  const pointPerQuestion = clamp(Number(els.pointPerQuestion.value) || 1, .01, 1000);
  els.pointPerQuestion.value = pointPerQuestion;
  const score = Math.round(correct * pointPerQuestion * 100) / 100;
  const maxScore = Math.round(state.gradedCount * pointPerQuestion * 100) / 100;
  const percentage = state.gradedCount ? (correct / state.gradedCount) * 100 : 0;
  return { correct, wrong, review, ignored, rows, score, percentage, maxScore, pointPerQuestion };
}

function renderResult(result) {
  $("#finalScore").textContent = Number.isInteger(result.score) ? result.score : result.score.toFixed(2);
  $("#correctTotal").textContent = result.correct;
  $("#resultTotal").textContent = state.gradedCount;
  $("#maxPossibleScore").textContent = Number.isInteger(result.maxScore) ? result.maxScore : result.maxScore.toFixed(2);
  $("#summaryCorrect").textContent = result.correct;
  $("#summaryWrong").textContent = result.wrong;
  $("#summaryReview").textContent = result.review;
  $("#summaryIgnored").textContent = result.ignored;
  const passed = result.percentage >= Number(els.passingScore.value);
  const badge = $("#passBadge");
  badge.textContent = passed ? "LULUS" : "BELUM LULUS";
  badge.classList.toggle("fail", !passed);
  $("#resultGrid").innerHTML = result.rows.map((row) => `
    <div class="result-item ${row.result}">
      <b>${row.number}</b>
      <strong>${row.answer || "-"} / ${row.key || "-"}</strong>
      <span>${row.result === "correct" ? "Benar" : row.result === "wrong" ? "Salah" : row.result === "ignored" ? "Tidak dinilai" : row.status === "multiple" ? "Jawaban ganda" : "Kosong"}</span>
    </div>`).join("");
}

function exportCsv() {
  if (!state.lastResult) return;
  const result = state.lastResult;
  const rows = [
    ["Judul", "LJK Pilihan Ganda"],
    ["Jumlah soal pada LJK", state.count],
    ["Jumlah jawaban dinilai", state.gradedCount],
    ["Poin per soal", result.pointPerQuestion],
    ["Nilai maksimal", result.maxScore],
    ["Nilai", result.score],
    ["Benar", result.correct],
    ["Salah", result.wrong],
    ["Kosong/Ganda", result.review],
    ["Tidak dinilai", result.ignored],
    [],
    ["No", "Jawaban Siswa", "Kunci", "Status"],
    ...result.rows.map((row) => [row.number, row.answer || "", row.key, row.result])
  ];
  const csv = rows.map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const blob = new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `hasil-ljk-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function resetImage() {
  state.image = null;
  state.imageCanvas = null;
  state.corners = [];
  state.markerConfidence = 0;
  state.dragCorner = null;
  state.manualMode = false;
  els.imageInput.value = "";
  els.uploadIdle.classList.remove("hidden");
  els.scanPreview.classList.add("hidden");
  els.cornerInstruction.classList.add("hidden");
  els.analyzeButton.disabled = true;
  els.manualCorners.classList.add("hidden");
  els.replaceImage.disabled = true;
  setScanStatus("", "○", "Belum ada lembar", "Unggah foto untuk mulai membaca");
}

$$(".number-control button").forEach((button) => {
  button.addEventListener("click", () => {
    els.questionCount.value = clamp(Number(els.questionCount.value) + Number(button.dataset.step), 5, 50);
    sanitizeCount();
  });
});
els.questionCount.addEventListener("change", sanitizeCount);
els.gradedCount.addEventListener("change", () => sanitizeGradedCount());
els.pointPerQuestion.addEventListener("change", () => {
  const point = clamp(Number(els.pointPerQuestion.value) || 1, .01, 1000);
  els.pointPerQuestion.value = point;
  state.lastResult = null;
  els.resultSection.classList.add("hidden");
});
els.passingScore.addEventListener("input", () => { els.passingOutput.textContent = els.passingScore.value; });
$("#clearKey").addEventListener("click", () => { state.key.fill(null); renderAnswerGrid(); });
$("#printTemplate").addEventListener("click", printTemplate);
$("#downloadTemplate").addEventListener("click", downloadTemplate);
els.goScan.addEventListener("click", () => els.scanSection.scrollIntoView({ behavior: "smooth", block: "start" }));
$("#chooseImage").addEventListener("click", () => els.imageInput.click());
els.replaceImage.addEventListener("click", () => els.imageInput.click());
els.imageInput.addEventListener("change", (event) => loadImage(event.target.files[0]));
els.manualCorners.addEventListener("click", startManualCorners);
els.scanCanvas.addEventListener("pointerdown", handleCornerPointerDown);
els.scanCanvas.addEventListener("pointermove", handleCornerPointerMove);
els.scanCanvas.addEventListener("pointerup", handleCornerPointerUp);
els.scanCanvas.addEventListener("pointercancel", handleCornerPointerUp);
els.analyzeButton.addEventListener("click", analyzeAnswers);
$("#exportCsv").addEventListener("click", exportCsv);

["dragenter", "dragover"].forEach((eventName) => els.uploadCard.addEventListener(eventName, (event) => {
  event.preventDefault();
  els.uploadCard.classList.add("dragging");
}));
["dragleave", "drop"].forEach((eventName) => els.uploadCard.addEventListener(eventName, (event) => {
  event.preventDefault();
  els.uploadCard.classList.remove("dragging");
}));
els.uploadCard.addEventListener("drop", (event) => loadImage(event.dataTransfer.files[0]));

const helpDialog = $("#helpDialog");
$("#helpButton").addEventListener("click", () => helpDialog.showModal());
$("#closeHelp").addEventListener("click", () => helpDialog.close());
helpDialog.addEventListener("click", (event) => {
  if (event.target === helpDialog) helpDialog.close();
});

renderAnswerGrid();
