import crypto from 'node:crypto';

export const mediaReference = /^\/api\/media\/[a-f0-9-]{36}$/;
export function mediaValues(profile) {
  return [profile?.photo,profile?.logo,profile?.cover,
    ...(profile?.links || []).map(item => item.thumbnail),
    ...(profile?.gallery || []).map(item => item.image),
    ...(profile?.videos || []).map(item => item.thumbnail),
    ...(profile?.files || []).map(item => item.data)].filter(Boolean);
}
export function clientSession(req,store) {
  const token = req.headers.cookie?.match(/(?:^|;\s*)client_session=([a-f0-9]{64})(?:;|$)/)?.[1];
  const session = token && store.get().sessions?.client?.[crypto.createHash('sha256').update(token).digest('hex')];
  return session?.expires > Date.now() && store.get().clients?.some(account => account.id === session.accountId) ? session : null;
}
export function uploadPrincipal(req,store,adminAuth) {
  const client = clientSession(req,store);
  // An owner who also has an admin cookie still creates owner-bound assets.
  if (client && store.get().cards.some(card => card.ownerId === client.accountId)) return `client:${client.accountId}`;
  return adminAuth(req) ? 'admin' : null;
}

// Legacy assets already attached to this card remain editable. Knowing an asset
// reference from another card never grants permission to attach it here.
export function profileMediaAllowed(profile,{store,card,principal,cloud=false}) {
  const existing = new Set([...mediaValues(card?.draft),...mediaValues(card?.published)]);
  return mediaValues(profile).every(reference => {
    if (mediaReference.test(reference)) {
      const asset = store.get().mediaAssets?.[reference.split('/').pop()];
      if (asset && asset.status !== 'ready') return false;
      return existing.has(reference) || Boolean(asset && asset.status === 'ready' && (principal === 'admin' || asset.principal === principal));
    }
    return !cloud || existing.has(reference);
  });
}
