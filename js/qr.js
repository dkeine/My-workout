/* ---------------- QR ENCODER (IL-16) ----------------
   Self-contained byte-mode QR generator, EC level M, versions 1-6
   (up to 106 chars), fixed mask pattern 0. No dependencies. */

const QR_VERSIONS = [
  // [version, dataCodewords, ecPerBlock, blocks]
  [1, 16, 10, 1],
  [2, 28, 16, 1],
  [3, 44, 26, 1],
  [4, 64, 18, 2],
  [5, 86, 24, 2],
  [6, 108, 16, 4],
];

const QR_ALIGN = { 2: 18, 3: 22, 4: 26, 5: 30, 6: 34 };
const QR_FORMAT_M0 = '101010000010010'; // format bits for (EC M, mask 0)

const QR_GF = (() => {
  const exp = new Array(512), log = new Array(256);
  let x = 1;
  for (let i = 0; i < 255; i++) {
    exp[i] = x;
    log[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) exp[i] = exp[i - 255];
  return { exp, log };
})();

function qrGenPoly(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= g[j] ? QR_GF.exp[(QR_GF.log[g[j]] + i) % 255] : 0;
    }
    g = next;
  }
  return g;
}

function qrEcc(data, n) {
  const gen = qrGenPoly(n);
  const rem = data.concat(new Array(n).fill(0));
  for (let i = 0; i < data.length; i++) {
    const coef = rem[i];
    if (coef === 0) continue;
    const lc = QR_GF.log[coef];
    for (let j = 0; j < gen.length; j++) {
      rem[i + j] ^= QR_GF.exp[(lc + QR_GF.log[gen[j]]) % 255];
    }
  }
  return rem.slice(data.length);
}

function qrMatrix(text) {
  const bytes = Array.from(new TextEncoder().encode(text));
  const spec = QR_VERSIONS.find(v => bytes.length <= v[1] - 2);
  if (!spec) return null;
  const [version, dataCW, ecPerBlock, blockCount] = spec;

  // --- bitstream: mode 0100 + 8-bit count + data + terminator + padding
  const bits = [];
  const pushBits = (val, len) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >> i) & 1);
  };
  pushBits(0b0100, 4);
  pushBits(bytes.length, 8);
  bytes.forEach(b => pushBits(b, 8));
  const capBits = dataCW * 8;
  pushBits(0, Math.min(4, capBits - bits.length));
  while (bits.length % 8) bits.push(0);
  const cw = [];
  for (let i = 0; i < bits.length; i += 8) {
    cw.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  }
  const pads = [0xec, 0x11];
  for (let i = 0; cw.length < dataCW; i++) cw.push(pads[i % 2]);

  // --- split into equal blocks, compute ECC, interleave
  const per = dataCW / blockCount;
  const blocks = [], eccs = [];
  for (let b = 0; b < blockCount; b++) {
    const chunk = cw.slice(b * per, (b + 1) * per);
    blocks.push(chunk);
    eccs.push(qrEcc(chunk, ecPerBlock));
  }
  const stream = [];
  for (let i = 0; i < per; i++) for (let b = 0; b < blockCount; b++) stream.push(blocks[b][i]);
  for (let i = 0; i < ecPerBlock; i++) for (let b = 0; b < blockCount; b++) stream.push(eccs[b][i]);
  const dataBits = [];
  stream.forEach(byte => { for (let i = 7; i >= 0; i--) dataBits.push((byte >> i) & 1); });

  // --- matrix scaffolding
  const size = 17 + 4 * version;
  const m = Array.from({ length: size }, () => new Array(size).fill(0));
  const fn = Array.from({ length: size }, () => new Array(size).fill(false));

  const setFn = (r, c, v) => {
    if (r < 0 || c < 0 || r >= size || c >= size) return;
    m[r][c] = v;
    fn[r][c] = true;
  };

  const finder = (r0, c0) => {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const inside = r >= 0 && r <= 6 && c >= 0 && c <= 6;
        const dark = inside && (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4));
        setFn(r0 + r, c0 + c, dark ? 1 : 0);
      }
    }
  };
  finder(0, 0);
  finder(0, size - 7);
  finder(size - 7, 0);

  for (let i = 8; i < size - 8; i++) {
    setFn(6, i, i % 2 === 0 ? 1 : 0);
    setFn(i, 6, i % 2 === 0 ? 1 : 0);
  }

  if (QR_ALIGN[version]) {
    const a = QR_ALIGN[version];
    for (let r = -2; r <= 2; r++) {
      for (let c = -2; c <= 2; c++) {
        const dark = Math.max(Math.abs(r), Math.abs(c)) !== 1;
        setFn(a + r, a + c, dark ? 1 : 0);
      }
    }
  }

  setFn(size - 8, 8, 1); // dark module

  // reserve format areas (filled after data placement)
  for (let i = 0; i <= 8; i++) {
    if (i !== 6) {
      if (!fn[8][i]) setFn(8, i, 0);
      if (!fn[i][8]) setFn(i, 8, 0);
    }
  }
  for (let c = size - 8; c < size; c++) if (!fn[8][c]) setFn(8, c, 0);
  for (let r = size - 7; r < size; r++) if (!fn[r][8]) setFn(r, 8, 0);

  // --- zigzag data placement with mask 0
  let idx = 0;
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let i = 0; i < size; i++) {
      const r = upward ? size - 1 - i : i;
      for (const c of [col, col - 1]) {
        if (fn[r][c]) continue;
        let bit = idx < dataBits.length ? dataBits[idx] : 0;
        idx++;
        if ((r + c) % 2 === 0) bit ^= 1;
        m[r][c] = bit;
      }
    }
    upward = !upward;
  }

  // --- format info, both copies
  const f1 = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]];
  const f2 = [];
  for (let r = size - 1; r >= size - 7; r--) f2.push([r, 8]);
  for (let c = size - 8; c < size; c++) f2.push([8, c]);
  f1.forEach(([r, c], i) => { m[r][c] = +QR_FORMAT_M0[i]; });
  f2.forEach(([r, c], i) => { m[r][c] = +QR_FORMAT_M0[i]; });

  return m;
}

function qrToCanvas(canvas, text, scale = 8, quiet = 4) {
  const m = qrMatrix(text);
  if (!m) return false;
  const size = m.length;
  const full = (size + quiet * 2) * scale;
  canvas.width = full;
  canvas.height = full;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, full, full);
  ctx.fillStyle = '#000000';
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (m[r][c]) ctx.fillRect((c + quiet) * scale, (r + quiet) * scale, scale, scale);
    }
  }
  return true;
}
