const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  getSetting:       (key)          => ipcRenderer.invoke('db:get-setting', key),
  setSetting:       (key, value)   => ipcRenderer.invoke('db:set-setting', key, value),
  getCategories:    ()             => ipcRenderer.invoke('db:get-categories'),
  saveSession:      (session)      => ipcRenderer.invoke('db:save-session', session),
  getPeriodSettings:()             => ipcRenderer.invoke('db:get-period-settings'),
  getMonthlyStats:  (user)         => ipcRenderer.invoke('db:get-monthly-stats', user),
  getSharedTotal:   ()             => ipcRenderer.invoke('db:get-shared-total'),
  addCategory:        (name, color)              => ipcRenderer.invoke('db:add-category', name, color),
  updateCategory:     (id, name, color)          => ipcRenderer.invoke('db:update-category', id, name, color),
  getSessionsByDate:  (user, isoDate)            => ipcRenderer.invoke('db:get-sessions-by-date', user, isoDate),
  updateSession:      (id, categoryId, durSecs)  => ipcRenderer.invoke('db:update-session', id, categoryId, durSecs),
  deleteSession:      (id)                       => ipcRenderer.invoke('db:delete-session', id),
  getUserAvatars:     ()                         => ipcRenderer.invoke('db:get-user-avatars'),
  getCalendarMonth:   (year, month)              => ipcRenderer.invoke('db:get-calendar-month', { year, month }),
})
