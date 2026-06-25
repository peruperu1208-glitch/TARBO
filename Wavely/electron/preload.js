const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  getProjects: () => ipcRenderer.invoke('get-projects'),
  createProject: (project) => ipcRenderer.invoke('create-project', project),
  updateProject: (project) => ipcRenderer.invoke('update-project', project),
  deleteProject: (id) => ipcRenderer.invoke('delete-project', id),

  getTasks: (projectId, includeArchived) => ipcRenderer.invoke('get-tasks', projectId, includeArchived),
  createTask: (task) => ipcRenderer.invoke('create-task', task),
  updateTask: (task) => ipcRenderer.invoke('update-task', task),
  deleteTask: (id) => ipcRenderer.invoke('delete-task', id),

  reorderProjects: (ids) => ipcRenderer.invoke('reorder-projects', ids),
  reorderTasks: (ids) => ipcRenderer.invoke('reorder-tasks', ids),

  getArchivedProjects: () => ipcRenderer.invoke('get-archived-projects'),
  archiveProject: (id) => ipcRenderer.invoke('archive-project', id),
  unarchiveProject: (id) => ipcRenderer.invoke('unarchive-project', id),

  getDbPath: () => ipcRenderer.invoke('get-db-path'),
  chooseDbFolder: () => ipcRenderer.invoke('choose-db-folder'),
})