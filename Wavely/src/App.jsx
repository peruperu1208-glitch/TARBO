import { useState, useEffect, useCallback, useMemo } from 'react'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import TaskList from './components/tasks/TaskList'
import GanttChart from './components/gantt/GanttChart'
import TaskModal from './components/tasks/TaskModal'
import ProjectModal from './components/projects/ProjectModal'

export default function App() {
  const [projects, setProjects] = useState([])
  const [tasks, setTasks] = useState([])
  const [selectedProjectId, setSelectedProjectId] = useState(null)
  const [view, setView] = useState('gantt')
  const [taskModal, setTaskModal] = useState({ open: false, task: null, defaultStatus: 'todo' })
  const [projectModal, setProjectModal] = useState({ open: false, project: null })
  const [theme, setTheme] = useState(() => localStorage.getItem('turbo-theme') || 'light')

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('turbo-theme', theme)
  }, [theme])

  const toggleTheme = () => setTheme(t => t === 'light' ? 'dark' : 'light')

  const loadProjects = useCallback(async () => {
    const data = await window.electronAPI.getProjects()
    setProjects(data)
  }, [])

  const loadTasks = useCallback(async () => {
    const data = await window.electronAPI.getTasks(selectedProjectId)
    setTasks(data)
  }, [selectedProjectId])

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

  const handleTaskDatesChange = async (task, start_date, end_date) => {
    await window.electronAPI.updateTask({ ...task, start_date, end_date })
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

  const rootTasks = useMemo(() => tasks.filter(t => !t.parent_id), [tasks])

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
        selectedProjectId={selectedProjectId}
        onSelectProject={setSelectedProjectId}
        onNewProject={() => setProjectModal({ open: true, project: null })}
        onEditProject={(p) => setProjectModal({ open: true, project: p })}
        onDeleteProject={handleDeleteProject}
        completedProjectIds={completedProjectIds}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          view={view}
          onViewChange={setView}
          selectedProject={selectedProject}
          taskCount={tasks.length}
        />

        <main className="flex-1 overflow-hidden p-6 flex flex-col" style={{ position: 'relative' }}>
          {view === 'list' ? (
            <TaskList
              tasks={rootTasks}
              allTasks={tasks}
              projects={projects}
              onSave={handleUpdateTask}
              onDelete={handleDeleteTask}
              onStatusChange={handleStatusChange}
              onNewTask={(status) => setTaskModal({ open: true, task: null, defaultStatus: status })}
              onEdit={(task) => setTaskModal({ open: true, task })}
              onSubtaskCreate={handleSubtaskCreate}
            />
          ) : (
            <GanttChart
              tasks={rootTasks}
              allTasks={tasks}
              projects={projects}
              onEdit={(task) => setTaskModal({ open: true, task })}
              onDatesChange={handleTaskDatesChange}
              onNewTask={() => setTaskModal({ open: true, task: null })}
              onSubtaskCreate={handleSubtaskCreate}
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

      {projectModal.open && (
        <ProjectModal
          project={projectModal.project}
          onSave={projectModal.project ? handleUpdateProject : handleCreateProject}
          onClose={() => setProjectModal({ open: false, project: null })}
        />
      )}
    </div>
  )
}