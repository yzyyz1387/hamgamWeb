import { fetchPublicProfileByUid, resolvePublicUserUid } from '@/lib/publicProfiles'

export async function findPublicProfileUid({ userId = null, callsign = '', uploaderId = null } = {}) {
  return resolvePublicUserUid({
    userId: userId || uploaderId || null,
    callsign,
  })
}

export async function getPublicProfileByUid(uid) {
  return fetchPublicProfileByUid(uid)
}
