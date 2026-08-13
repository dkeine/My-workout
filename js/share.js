/* ---------------- SHARE A PLAN AS A LINK (IL-06) ----------------
   The plan is serialized, deflated (native CompressionStream), and
   carried entirely in the URL fragment. No server, no signup —
   the link IS the distribution system. */

function b64urlEncode(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlDecode(str) {
  const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function pipeStream(bytes, StreamCtor, kind) {
  const stream = new Blob([bytes]).stream().pipeThrough(new StreamCtor(kind));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

async function encodePlanPayload(plan) {
  const wire = { n: plan.name, d: plan.days };
  const json = new TextEncoder().encode(JSON.stringify(wire));
  if (typeof CompressionStream !== 'undefined') {
    return '1.' + b64urlEncode(await pipeStream(json, CompressionStream, 'deflate-raw'));
  }
  return '0.' + b64urlEncode(json);
}

async function decodePlanPayload(payload) {
  try {
    const dot = payload.indexOf('.');
    const scheme = payload.slice(0, dot);
    let bytes = b64urlDecode(payload.slice(dot + 1));
    if (scheme === '1') {
      if (typeof DecompressionStream === 'undefined') return null;
      bytes = await pipeStream(bytes, DecompressionStream, 'deflate-raw');
    }
    const wire = JSON.parse(new TextDecoder().decode(bytes));
    return normalizePlan({ id: newPlanId(), name: wire.n, days: wire.d });
  } catch (e) {
    return null;
  }
}

function appBaseUrl() {
  return location.origin + location.pathname;
}

async function planLink(plan) {
  return appBaseUrl() + '#p=' + await encodePlanPayload(plan);
}

async function sharePlan(plan) {
  const url = await planLink(plan);
  const title = t('plan.shareTitle', { name: plan.name });
  if (navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (e) {
      if (e && e.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast(t('plan.linkCopied'), t('plan.linkCopiedSub'));
  } catch (e) {
    prompt(t('plan.shareTitle', { name: plan.name }), url);
  }
}

function incomingPlanPayload() {
  const m = location.hash.match(/^#p=(.+)$/);
  return m ? m[1] : null;
}

function clearIncomingPlan() {
  history.replaceState(null, '', location.pathname + location.search);
}
