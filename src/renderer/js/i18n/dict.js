// Словари UI. UMD: window.DICT в браузере, require в node.
(function (root, factory) {
  const dict = factory()
  if (typeof module !== 'undefined' && module.exports) module.exports = dict
  else root.DICT = dict
})(typeof self !== 'undefined' ? self : this, function () {
  const ru = {
    // Меню/шапка
    menu_settings: 'Настройки',
    menu_about: 'О программе',
    sync_title: 'Синхронизация',
    sync_btn: 'Sync',
    // Таймер/категории
    timer_start: 'Start',
    timer_stop: 'Stop',
    reset_title: 'Сбросить',
    calendar_btn: 'Календарь',
    no_category_hint: '← Выбери категорию',
    // Диалог сохранения
    save_dialog_title: 'Сохранить сессию?',
    btn_cancel: 'Отмена',
    btn_save: 'Сохранить',
    // Настройки: вкладки
    tab_general: 'Общие',
    tab_user: 'Пользователь',
    tab_limit: 'Лимит & Период',
    tab_categories: 'Категории',
    tab_hours: 'Правка часов',
    tab_sync: 'Синхронизация',
    // Общие
    general_language: 'Язык',
    // Пользователь
    user_name: 'Имя',
    btn_edit: 'Изменить',
    user_avatar: 'Аватар',
    // Лимит
    limit_hours: 'Лимит (ч)',
    period_from: 'Период с',
    period_to: 'Период по',
    // Категории
    cat_subtab_active: 'Активные',
    cat_subtab_deleted: 'Удалённые',
    cat_add: '+ Добавить',
    cat_deleted_empty: 'Нет удалённых категорий',
    cat_name_placeholder: 'Название категории',
    cat_pick_color: 'Выбрать цвет',
    cat_delete_title: 'Удалить категорию?',
    cat_delete_hint: 'Часы по ней перестанут учитываться.',
    btn_delete: 'Удалить',
    btn_restore: 'Восстановить',
    // Правка часов
    hours_date: 'Дата',
    hours_empty: 'Нет записей за этот день',
    confirm_delete_q: 'Удалить?',
    btn_yes: 'Да',
    btn_no: 'Нет',
    // Синхронизация
    sync_interval: 'Интервал',
    sync_last: 'Последняя синхронизация',
    sync_min: 'мин',
    // О программе
    about_version: 'Версия',
    btn_close: 'Закрыть',
    // Календарь / время
    today_at: 'Сегодня в',
    unit_h: 'ч',
    unit_m: 'м',
    unit_s: 'с',
    months: ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'],
    months_short: ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'],
    weekdays: ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  }

  const en = {
    menu_settings: 'Settings',
    menu_about: 'About',
    sync_title: 'Synchronization',
    sync_btn: 'Sync',
    timer_start: 'Start',
    timer_stop: 'Stop',
    reset_title: 'Reset',
    calendar_btn: 'Calendar',
    no_category_hint: '← Pick a category',
    save_dialog_title: 'Save session?',
    btn_cancel: 'Cancel',
    btn_save: 'Save',
    tab_general: 'General',
    tab_user: 'User',
    tab_limit: 'Limit & Period',
    tab_categories: 'Categories',
    tab_hours: 'Edit hours',
    tab_sync: 'Synchronization',
    general_language: 'Language',
    user_name: 'Name',
    btn_edit: 'Edit',
    user_avatar: 'Avatar',
    limit_hours: 'Limit (h)',
    period_from: 'Period from',
    period_to: 'Period to',
    cat_subtab_active: 'Active',
    cat_subtab_deleted: 'Deleted',
    cat_add: '+ Add',
    cat_deleted_empty: 'No deleted categories',
    cat_name_placeholder: 'Category name',
    cat_pick_color: 'Pick color',
    cat_delete_title: 'Delete category?',
    cat_delete_hint: 'Its hours will stop being counted.',
    btn_delete: 'Delete',
    btn_restore: 'Restore',
    hours_date: 'Date',
    hours_empty: 'No entries for this day',
    confirm_delete_q: 'Delete?',
    btn_yes: 'Yes',
    btn_no: 'No',
    sync_interval: 'Interval',
    sync_last: 'Last sync',
    sync_min: 'min',
    about_version: 'Version',
    btn_close: 'Close',
    today_at: 'Today at',
    unit_h: 'h',
    unit_m: 'm',
    unit_s: 's',
    months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    months_short: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    weekdays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  }

  return { ru, en }
})
