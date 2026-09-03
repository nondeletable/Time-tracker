// Чистая логика группы — без DOM/сети. UMD: node (require) + браузер (window.GROUP).
(function (root, factory) {
  const api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.GROUP = api
})(typeof self !== 'undefined' ? self : this, function () {
  const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const CODE_LEN = 6

  function generateCode(rng) {
    const rand = rng || Math.random
    let out = ''
    for (let i = 0; i < CODE_LEN; i++) {
      out += ALPHABET[Math.floor(rand() * ALPHABET.length)]
    }
    return out
  }

  function normalizeCode(s) {
    return String(s == null ? '' : s).trim().toUpperCase()
  }

  function validateHandshake(localCode, msg) {
    return !!(msg && msg.code && localCode && msg.code === localCode)
  }

  function isSelf(payload, myInstallId) {
    return !!(payload && myInstallId && payload.installId === myInstallId)
  }

  function shouldApplyLimit(receiverRole, senderRole) {
    return receiverRole === 'member' && senderRole === 'owner'
  }

  return { ALPHABET, CODE_LEN, generateCode, normalizeCode, validateHandshake, isSelf, shouldApplyLimit }
})
