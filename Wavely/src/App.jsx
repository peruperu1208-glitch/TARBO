import { useState, useEffect, useCallback, useMemo } from 'react'
import { differenceInDays, addDays, parseISO, format } from 'date-fns'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import TaskList from './components/tasks/TaskList'
import GanttChart from './components/gantt/GanttChart'
import TaskModal from './components/tasks/TaskModal'
import ProjectModal from './components/projects/ProjectModal'
import SettingsModal from './components/settings/SettingsModal'
import SplashScreen from './components/SplashScreen'

export default function App() {
  const [showSplash, setShowSplash] = useState(true)
  const [projects, setProjects] = useState([])
  const [archivedProjects, setArchivedProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [view, setView] = useState('gantt')
  const [taskModal, setTaskModal] = useState({ open: false, task: null, defaultStatus: 'todo' })
  const [projectModal, setProjectModal] = useState({ open: false, project: null })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [theme, setTheme] = useState(() => localStorage.getItem('turbo-theme') || 'light')
  const [projectSearch, setProjectSearch] = useState('')
  const [showArchived, setShowArchived] = useState(false)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('turbo-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  const loadProjects = useCallback(async () => {
    const [data, archived] = await Promise.all([
      window.electronAPI.getProjects(),
      window.electronAPI.getArchivedProjects(),
    ])
    setProjects(data)
    setArchivedProjects(archived)
  }, [])

  const loadTasks = useCallback(async () => {
    const data = await window.electronAPI.getTasks(selectedProjectId, showArchived && !selectedProjectId)
    setTasks(data)
  }, [selectedProjectId, showArchived])

  useEffect(() => { loadProjects() }, [loadProjects])
  useEffect(() => { loadTasks() }, [loadTasks])

  const handleCreateTask = async (taskData) => {
    const projectId = taskData.project_id || selectedProjectId || projects[0]?.id
    await window.electronAPI.createTask({ ...taskData, project_id: projectId })
    loadTasks()
    setTaskModal({ open: false, task: null })
  }

  const handleUpdateTask = async (taskData) => {
    await window.electronAPI.updateTask(taskData)
    if (taskData.parent_id) {
      const parent = tasks.find(t => t.id === taskData.parent_id)
      if (parent) {
        // 開始日の自動繰り上げ
        if (taskData.start_date && (parent.start_date || '') > taskData.start_date) {
          const siblingStarts = tasks
            .filter(t => t.parent_id === taskData.parent_id && t.id !== taskData.id && t.start_date)
            .map(t => t.start_date)
          const minStart = [taskData.start_date, ...siblingStarts].reduce((a, b) => a < b ? a : b)
          await window.electronAPI.updateTask({ ...parent, start_date: minStart })
        }
        // 終了日の自動延長
        if (taskData.end_date && taskData.end_date > (parent.end_date || '')) {
          const siblingEnds = tasks
            .filter(t => t.parent_id === taskData.parent_id && t.id !== taskData.id && t.end_date)
            .map(t => t.end_date)
          const maxEnd = [taskData.end_date, ...siblingEnds].reduce((a, b) => a > b ? a : b)
          await window.electronAPI.updateTask({ ...parent, end_date: maxEnd })
        }
        // 全サブタスク完了時に親も完了
        if (parent.status !== 'done') {
          const siblings = tasks.filter(t => t.parent_id === taskData.parent_id)
          const allDone = siblings.length > 0 && siblings.every(
            t => (t.id === taskData.id ? taskData.status : t.status) === 'done'
          )
          if (allDone) await window.electronAPI.updateTask({ ...parent, status: 'done', progress: 100 })
        }
      }
    }
    loadTasks()
    setTaskModal({ open: false, task: null })
  }

  const handleDeleteTask = async (id) => {
    await window.electronAPI.deleteTask(id)
    loadTasks()
    setTaskModal({ open: false, task: null })
  }

  const handleSubtaskCreate = async (parentId, title, startDate, endDate) => {
    const parent = tasks.find(t => t.id === parentId)
    await window.electronAPI.createTask({
      title,
      parent_id: parentId,
      project_id: parent?.project_id,
      status: 'todo',
      priority: 'medium',
      progress: 0,
      description: '',
      comment: '',
      start_date: startDate || null,
      end_date: endDate || null,
    })
    if (startDate && parent && (parent.start_date || '') > startDate) {
      const siblingStarts = tasks
        .filter(t => t.parent_id === parentId && t.start_date)
        .map(t => t.start_date)
      const minStart = [startDate, ...siblingStarts].reduce((a, b) => a < b ? a : b)
      await window.electronAPI.updateTask({ ...parent, start_date: minStart })
    }
    if (endDate && parent && endDate > (parent.end_date || '')) {
      const siblingEnds = tasks
        .filter(t => t.parent_id === parentId && t.end_date)
        .map(t => t.end_date)
      const maxEnd = [endDate, ...siblingEnds].reduce((a, b) => a > b ? a : b)
      await window.electronAPI.updateTask({ ...parent, end_date: maxEnd })
    }
    loadTasks()
  }

  const handleSubtaskToggle = async (subtaskId, isDone) => {
    const sub = tasks.find(t => t.id === subtaskId)
    if (!sub) return
    await window.electronAPI.updateTask({ ...sub, status: isDone ? 'done' : 'todo', progress: isDone ? 100 : 0 })
    loadTasks()
  }

  const handleSubtaskDelete = async (subtaskId) => {
    await window.electronAPI.deleteTask(subtaskId)
    loadTasks()
  }

  const handleStatusChange = async (task, status) => {
    const update = { ...task, status }
    if (status === 'done') update.progress = 100
    await window.electronAPI.updateTask(update)
    // 全サブタスク完了時に親も完了
    if (task.parent_id) {
      const parent = tasks.find(t => t.id === task.parent_id)
      if (parent && parent.status !== 'done') {
        const siblings = tasks.filter(t => t.parent_id === task.parent_id)
        const allDone = siblings.length > 0 && siblings.every(
          t => (t.id === task.id ? status : t.status) === 'done'
        )
        if (allDone) await window.electronAPI.updateTask({ ...parent, status: 'done', progress: 100 })
      }
    }
    loadTasks()
  }

  const handleCreateProject = async (projectData) => {
    const created = await window.electronAPI.createProject(projectData)
    await loadProjects()
    setSelectedProjectId(created.id)
    setProjectModal({ open: false, project: null })
  }

  const handleUpdateProject = async (projectData) => {
    await window.electronAPI.updateProject(projectData)
    loadProjects()
    setProjectModal({ open: false, project: null })
  }

  const handleDeleteProject = async (id) => {
    await window.electronAPI.deleteProject(id)
    if (selectedProjectId === id) setSelectedProjectId(null)
    loadProjects()
    loadTasks()
  }

  const handleArchiveProject = async (id) => {
    await window.electronAPI.archiveProject(id)
    if (selectedProjectId === id) setSelectedProjectId(null)
    loadProjects()
    loadTasks()
  }

  const handleUnarchiveProject = async (id) => {
    await window.electronAPI.unarchiveProject(id)
    loadProjects()
  }

  const handleReorderProjects = async (draggedId, targetId, insertAbove) => {
    const list = [...projects]
    const fromIdx = list.findIndex(p => p.id === draggedId)
    const [item] = list.splice(fromIdx, 1)
    let toIdx = list.findIndex(p => p.id === targetId)
    if (!insertAbove) toIdx++
    list.splice(toIdx, 0, item)
    await window.electronAPI.reorderProjects(list.map(p => p.id))
    loadProjects()
  }

  const handleReorderTasks = async (draggedId, targetId, insertAbove) => {
    const list = [...tasks]
    const fromIdx = list.findIndex(t => t.id === draggedId)
    const [item] = list.splice(fromIdx, 1)
    let toIdx = list.findIndex(t => t.id === targetId)
    if (!insertAbove) toIdx++
    list.splice(toIdx, 0, item)
    await window.electronAPI.reorderTasks(list.map(t => t.id))
    loadTasks()
  }

  const handleTaskDatesChange = async (task, start_date, end_date) => {
    await window.electronAPI.updateTask({ ...task, start_date, end_date })
    // 親タスク移動（期間が変わらない）ならサブタスクも同じ日数だけ移動
    if (!task.parent_id && task.start_date && task.end_date && start_date && end_date) {
      const delta = differenceInDays(parseISO(start_date), parseISO(task.start_date))
      if (delta !== 0 && delta === differenceInDays(parseISO(end_date), parseISO(task.end_date))) {
        const subtasks = tasks.filter(t => t.parent_id === task.id && t.start_date && t.end_date)
        for (const sub of subtasks) {
          await window.electronAPI.updateTask({
            ...sub,
            start_date: format(addDays(parseISO(sub.start_date), delta), 'yyyy-MM-dd'),
            end_date:   format(addDays(parseISO(sub.end_date),   delta), 'yyyy-MM-dd'),
          })
        }
      }
    }
    if (task.parent_id) {
      const parent = tasks.find(t => t.id === task.parent_id)
      if (parent) {
        if (start_date && (parent.start_date || '') > start_date) {
          const siblingStarts = tasks
            .filter(t => t.parent_id === task.parent_id && t.id !== task.id && t.start_date)
            .map(t => t.start_date)
          const minStart = [start_date, ...siblingStarts].reduce((a, b) => a < b ? a : b)
          await window.electronAPI.updateTask({ ...parent, start_date: minStart })
        }
        if (end_date && end_date > (parent.end_date || '')) {
          const siblingEnds = tasks
            .filter(t => t.parent_id === task.parent_id && t.id !== task.id && t.end_date)
            .map(t => t.end_date)
          const maxEnd = [end_date, ...siblingEnds].reduce((a, b) => a > b ? a : b)
          await window.electronAPI.updateTask({ ...parent, end_date: maxEnd })
        }
      }
    }
    loadTasks()
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null

  // アーカイブ表示ON時はアーカイブ済みプロジェクトのみ、OFF時は通常プロジェクトのみ
  const displayProjects = useMemo(() => {
    const base = (showArchived && !selectedProjectId)
      ? archivedProjects
      : projects
    if (!projectSearch.trim()) return base
    const q = projectSearch.toLowerCase()
    return base.filter(p => p.name.toLowerCase().includes(q))
  }, [projects, archivedProjects, projectSearch, selectedProjectId, showArchived])

  const rootTasks = useMemo(() => tasks.filter(t => !t.parent_id), [tasks])

  // アーカイブ表示ON時・検索時はdisplayProjectsでタスクを絞り込む
  const displayRootTasks = useMemo(() => {
    if (selectedProjectId) return rootTasks
    if (!showArchived && !projectSearch.trim()) return rootTasks
    const ids = new Set(displayProjects.map(p => p.id))
    return rootTasks.filter(t => ids.has(t.project_id))
  }, [rootTasks, selectedProjectId, projectSearch, displayProjects, showArchived])

  const completedProjectIds = useMemo(() => {
    const ids = new Set()
    projects.forEach(p => {
      const pt = rootTasks.filter(t => t.project_id === p.id)
      if (pt.length > 0 && pt.every(t => t.status === 'done')) ids.add(p.id)
    })
    return ids
  }, [projects, rootTasks])

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--nm-bg)' }}>
      <Sidebar
        projects={projects}
        archivedProjects={archivedProjects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => { setSelectedProjectId(id) }}
        onNewProject={() => setProjectModal({ open: true, project: null })}
        onEditProject={(p) => setProjectModal({ open: true, project: p })}
        onDeleteProject={handleDeleteProject}
        onArchiveProject={handleArchiveProject}
        onUnarchiveProject={handleUnarchiveProject}
        onReorderProjects={handleReorderProjects}
        completedProjectIds={completedProjectIds}
        projectSearch={projectSearch}
        onProjectSearch={setProjectSearch}
        showArchived={showArchived}
        onToggleShowArchived={() => setShowArchived(v => !v)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          view={view}
          onViewChange={setView}
          selectedProject={selectedProject}
          taskCount={tasks.length}
          onOpenSettings={() => setSettingsOpen(true)}
        />

        <main className="flex-1 overflow-hidden p-6 flex flex-col" style={{ position: 'relative' }}>
          {view === 'list' ? (
            <TaskList
              tasks={displayRootTasks}
              allTasks={tasks}
              projects={projects}
              onSave={handleUpdateTask}
              onDelete={handleDeleteTask}
              onStatusChange={handleStatusChange}
              onReorderTasks={handleReorderTasks}
              onNewTask={(status) => setTaskModal({ open: true, task: null, defaultStatus: status })}
              onEdit={(task) => setTaskModal({ open: true, task })}
              onSubtaskCreate={handleSubtaskCreate}
            />
          ) : (
            <GanttChart
              tasks={displayRootTasks}
              allTasks={tasks}
              projects={displayProjects}
              onEdit={(task) => setTaskModal({ open: true, task })}
              onDatesChange={handleTaskDatesChange}
              onNewTask={() => setTaskModal({ open: true, task: null })}
              onSubtaskCreate={handleSubtaskCreate}
              onReorderTasks={handleReorderTasks}
              groupByProject={!selectedProjectId}
            />
          )}

          {taskModal.open && (
            <TaskModal
              task={taskModal.task}
              tasks={rootTasks}
              projects={projects}
              defaultProjectId={selectedProjectId || projects[0]?.id}
              defaultStatus={taskModal.defaultStatus}
              onSave={taskModal.task ? handleUpdateTask : handleCreateTask}
              onDelete={handleDeleteTask}
              onClose={() => setTaskModal({ open: false, task: null, defaultStatus: 'todo' })}
            />
          )}
        </main>
      </div>

      {settingsOpen && (
        <SettingsModal
          theme={theme}
          onThemeChange={setTheme}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {projectModal.open && (
        <ProjectModal
          project={projectModal.project}
          onSave={projectModal.project ? handleUpdateProject : handleCreateProject}
          onClose={() => setProjectModal({ open: false, project: null })}
        />
      )}

      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
    </div>
  )
}