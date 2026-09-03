// Чистая логика ролей группы — без DOM. UMD: работает и в node (require), и в браузере (window.ROLES).
// Роли: 'solo' (дефолт), 'owner' (создал группу), 'member' (присоединился по коду).
(function (root, factory) {
  const api = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = api
  else root.ROLES = api
})(typeof self !== 'undefined' ? self : this, function () {
  // Лимит/период редактируют solo и owner; member получает их от owner (read-only).
  function canEditLimit(role) {
    return role !== 'member'
  }

  // В группе (owner/member) активна синхронизация; solo — офлайн.
  function isGrouped(role) {
    return role === 'owner' || role === 'member'
  }

  return { canEditLimit, isGrouped }
})
