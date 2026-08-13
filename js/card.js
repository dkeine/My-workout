/* ---------------- THE FLEX CARD (IL-12) ----------------
   Renders the streak as a shareable image, entirely on-device. */

async function drawFlexCard() {
  const s = computeStats();
  const W = 1080, H = 1350;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  try {
    await document.fonts.load('400 120px "Bebas Neue"');
    await document.fonts.load('700 40px "Manrope"');
  } catch (e) {}

  // background
  ctx.fillStyle = '#0a0a0a';
  ctx.fillRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, H, W, 0);
  grad.addColorStop(0, 'rgba(255,75,10,0)');
  grad.addColorStop(1, 'rgba(255,75,10,.22)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // decorative plate rings
  ctx.strokeStyle = 'rgba(255,255,255,.06)';
  ctx.lineWidth = 60;
  ctx.beginPath(); ctx.arc(W - 120, 180, 260, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 34;
  ctx.beginPath(); ctx.arc(120, H - 140, 200, 0, Math.PI * 2); ctx.stroke();

  // brand
  ctx.fillStyle = '#ff4b0a';
  ctx.font = '400 72px "Bebas Neue", sans-serif';
  ctx.textBaseline = 'top';
  ctx.fillText('IRON LOG', 80, 88);
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  ctx.font = '700 30px "Manrope", sans-serif';
  ctx.fillText(new Date().toLocaleDateString(getLang(), { day: 'numeric', month: 'short', year: 'numeric' }), 80, 178);

  // the number
  ctx.fillStyle = '#ffffff';
  ctx.font = '400 560px "Bebas Neue", sans-serif';
  const streakStr = String(s.streak);
  ctx.fillText(streakStr, 74, 300);
  const numW = ctx.measureText(streakStr).width;
  ctx.fillStyle = '#ff4b0a';
  ctx.font = '400 76px "Bebas Neue", sans-serif';
  ctx.fillText(t('card.dayStreak'), 90 + numW + 36, 726);

  // week dots
  const dotY = 960, dotR = 34, gap = (W - 160 - 14 * dotR) / 6;
  s.grid.forEach((g, i) => {
    const x = 80 + dotR + i * (dotR * 2 + gap);
    ctx.beginPath();
    ctx.arc(x, dotY, dotR, 0, Math.PI * 2);
    if (g.done && g.scheduled) {
      ctx.fillStyle = '#ff4b0a';
      ctx.fill();
      ctx.strokeStyle = '#0a0a0a'; ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(x - 14, dotY + 1); ctx.lineTo(x - 3, dotY + 12); ctx.lineTo(x + 15, dotY - 11);
      ctx.stroke();
    } else {
      ctx.strokeStyle = g.scheduled ? 'rgba(255,255,255,.45)' : 'rgba(255,255,255,.14)';
      ctx.lineWidth = 5;
      ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.font = '800 26px "Manrope", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(dayShort(i), x, dotY + dotR + 26);
    ctx.textAlign = 'left';
  });

  // stats line
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  ctx.font = '800 40px "Manrope", sans-serif';
  ctx.fillText(`${t('card.thisWeek')}  ${s.weekDone}/${s.weekTotal}     ${t('card.sessions')}  ${s.total}`, 80, 1120);

  // footer bar
  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, '#ff4b0a');
  bar.addColorStop(1, '#ffb347');
  ctx.fillStyle = bar;
  ctx.fillRect(0, H - 24, W, 24);

  return canvas;
}

async function shareFlexCard() {
  const canvas = await drawFlexCard();
  const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
  const file = new File([blob], 'ironlog-streak.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'ironlog-streak.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  toast(t('card.ready'), t('card.readySub'));
}
