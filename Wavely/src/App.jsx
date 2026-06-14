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
    loadTasks()
    setTaskModal({ open: false, task: null })
  }

  const handleDeleteTask = async (id) => {
    await window.electronAPI.deleteTask(id)
    loadTasks()
    setTaskModal({ open: false, task: null })
  }

  const handleStatusChange = async (task, status) => {
    const update = { ...task, status }
    if (status === 'done') update.progress = 100
    await window.electronAPI.updateTask(update)
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
    loadTasks()
  }

  const selectedProject = projects.find(p => p.id === selectedProjectId) || null

  const completedProjectIds = useMemo(() => {
    const ids = new Set()
    projects.forEach(p => {
      const pt = tasks.filter(t => t.project_id === p.id)
      if (pt.length > 0 && pt.every(t => t.status === 'done')) ids.add(p.id)
    })
    return ids
  }, [projects, tasks])

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
              tasks={tasks}
              projects={projects}
              onSave={handleUpdateTask}
              onDelete={handleDeleteTask}
              onStatusChange={handleStatusChange}
              onNewTask={(status) => setTaskModal({ open: true, task: null, defaultStatus: status })}
            />
          ) : (
            <GanttChart
              tasks={tasks}
              projects={projects}
              onEdit={(task) => setTaskModal({ open: true, task })}
              onDatesChange={handleTaskDatesChange}
              onNewTask={() => setTaskModal({ open: true, task: null })}
              groupByProject={!selectedProjectId}
            />
          )}

          {taskModal.open && (
            <TaskModal
              task={taskModal.task}
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