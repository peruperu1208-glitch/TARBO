import { useState, useMemo, useRef, useEffect, useLayoutEffect } from 'react'
import {
  format, addDays, eachDayOfInterval, startOfDay,
  differenceInDays, parseISO, isValid, isBefore, isAfter,
} from 'date-fns'
import { ja } from 'date-fns/locale'

const CELL_W  = 32
const ROW_H   = 40
const LABEL_W = 180
const HANDLE_W = 10

const STATUS_COLOR = {
  todo: '#9ca3af',
  in_progress: '#6366f1',
  done: '#10b981',
}

export default function GanttChart({ tasks, allTasks = [], projects, onEdit, onDatesChange, onNewTask, onSubtaskCreate, onReorderTasks, groupByProject = false }) {
  const today = useMemo(() => startOfDay(new Date()), [])

  const [viewStart, setViewStart] = useState(() => addDays(today, -9))
  const [extraLeft, setExtraLeft] = useState(0)
  const [daysToShow, setDaysToShow] = useState(() => {
    const v = Number(localStorage.getItem('turbo-days'))
    return [30, 60, 90].includes(v) ? v : 60
  })
  const [zoom, setZoom] = useState(() => {
    const v = Number(localStorage.getItem('turbo-zoom'))
    return [50, 75, 100, 125, 150].includes(v) ? v : 100
  })
  const ZOOM_LEVELS = [50, 75, 100, 125, 150]
  const zoomIdx = ZOOM_LEVELS.indexOf(zoom)
  const zoomDown = () => { const z = ZOOM_LEVELS[zoomIdx - 1]; if (z) { setZoom(z); localStorage.setItem('turbo-zoom', z) } }
  const zoomUp   = () => { const z = ZOOM_LEVELS[zoomIdx + 1]; if (z) { setZoom(z); localStorage.setItem('turbo-zoom', z) } }
  const zoomReset = () => { setZoom(100); localStorage.setItem('turbo-zoom', 100) }

  const scale = zoom / 100
  const cw  = Math.round(CELL_W  * scale)
  const rh  = Math.round(ROW_H   * scale)
  const [labelBaseW, setLabelBaseW] = useState(LABEL_W)
  const lw  = Math.max(80, Math.round(labelBaseW * scale))
  const fSm  = Math.max(10, Math.round(14 * scale))
  const fXs  = Math.max(9,  Math.round(12 * scale))
  const fXxs = Math.max(8,  Math.round(10 * scale))

  const viewEnd      = addDays(viewStart, daysToShow - 1)
  // グリッドの実際の先頭（extraLeft分だけ過去に拡張）
  const displayStart = useMemo(() => addDays(viewStart, -extraLeft), [viewStart, extraLeft])
  const days         = useMemo(() => eachDayOfInterval({ start: displayStart, end: viewEnd }), [displayStart, viewEnd])
  const gridWidth = days.length * cw

  const monthGroups = useMemo(() => {
    const groups = []
    days.forEach(day => {
      const key = format(day, 'yyyy-MM')
      if (groups.length === 0 || groups[groups.length - 1].key !== key) {
        groups.push({ key, label: format(day, 'yyyy年M月', { locale: ja }), count: 1 })
      } else {
        groups[groups.length - 1].count++
      }
    })
    return groups
  }, [days])

  const todayStr = format(today, 'yyyy-MM-dd')
  const todayIdx = days.findIndex(d => format(d, 'yyyy-MM-dd') === todayStr)

  // サブタスクマップ
  const subtaskMap = useMemo(() => {
    const map = new Map()
    allTasks.filter(t => t.parent_id).forEach(sub => {
      if (!map.has(sub.parent_id)) map.set(sub.parent_id, [])
      map.get(sub.parent_id).push(sub)
    })
    return map
  }, [allTasks])

  // インラインサブタスク追加状態
  const [addingSubtaskId, setAddingSubtaskId] = useState(null)
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('')
  const [newSubtaskDates, setNewSubtaskDates] = useState({ start: '', end: '' })
  const [collapsedTaskIds, setCollapsedTaskIds] = useState(new Set())
  const toggleTaskCollapse = (taskId) => {
    setCollapsedTaskIds(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) next.delete(taskId)
      else next.add(taskId)
      return next
    })
  }

  // ドラッグ状態
  const dragInfo        = useRef(null)
  const didDragRef      = useRef(false)
  const viewStartRef    = useRef(viewStart)
  const viewEndRef      = useRef(viewEnd)
  const onDatesChangeRef = useRef(onDatesChange)
  const onEditRef       = useRef(onEdit)
  const cwRef           = useRef(cw)
  const resizeRef       = useRef(null)
  const labelBaseWRef   = useRef(LABEL_W)
  const scaleRef        = useRef(scale)
  const scrollContainerRef    = useRef(null)
  const panInfo               = useRef(null)
  const pendingScrollAdjust   = useRef(0)

  // displayStart が変化した直後（レイアウト確定後）にスクロール位置を補正
  useLayoutEffect(() => {
    if (pendingScrollAdjust.current === 0 || !scrollContainerRef.current) return
    scrollContainerRef.current.scrollLeft += pendingScrollAdjust.current
    pendingScrollAdjust.current = 0
    // 再レンダリング中のマウス移動分を次フレームでスキップしてジャンプを防ぐ
    if (panInfo.current) panInfo.current.skipNextDelta = true
  }, [displayStart])

  useEffect(() => { viewStartRef.current    = displayStart }, [displayStart])
  useEffect(() => { viewEndRef.current      = viewEnd      }, [viewEnd])
  useEffect(() => { onDatesChangeRef.current = onDatesChange }, [onDatesChange])
  useEffect(() => { onEditRef.current       = onEdit       }, [onEdit])
  useEffect(() => { cwRef.current           = cw           }, [cw])
  useEffect(() => { scaleRef.current        = scale        }, [scale])

  useEffect(() => {
    if (!projects.length) return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = 'bold 14px sans-serif'
    const maxNameW = Math.max(...projects.map(p => ctx.measureText(p.name).width))
    const needed = Math.ceil(maxNameW) + 126
    const newBaseW = Math.max(LABEL_W, needed)
    setLabelBaseW(newBaseW)
    labelBaseWRef.current = newBaseW
  }, [projects])

  const [dragOverlay, setDragOverlay] = useState(null)
  const [collapsedProjects, setCollapsedProjects] = useState(new Set())
  const [rowDragTaskId, setRowDragTaskId] = useState(null)
  const [rowDragOverId, setRowDragOverId] = useState(null)
  const [rowInsertAbove, setRowInsertAbove] = useState(true)
  const [statusFilter, setStatusFilter] = useState(new Set())
  const [todayFilter, setTodayFilter] = useState(false)

  const filteredTasks = useMemo(() => {
    let result = tasks
    if (todayFilter) {
      result = result.filter(t => t.start_date && t.end_date && t.start_date <= todayStr && t.end_date >= todayStr)
    }
    if (statusFilter.size > 0) {
      result = result.filter(t => statusFilter.has(t.status))
    }
    return result
  }, [tasks, statusFilter, todayFilter, todayStr])

  const toggleStatusFilter = (key) => setStatusFilter(prev => {
    const next = new Set(prev)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    return next
  })
  const toggleCollapse = (id) => {
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  useEffect(() => {
    const onMouseMove = (e) => {
      if (resizeRef.current) {
        const dx = e.clientX - resizeRef.current.startX
        const newBaseW = Math.max(80, resizeRef.current.startBaseW + dx / scaleRef.current)
        labelBaseWRef.current = newBaseW
        setLabelBaseW(newBaseW)
        return
      }
      if (panInfo.current) {
        // ボタンを離したまま（context menu 等でmouseupを取りこぼした場合）パン解除
        if (e.buttons === 0) {
          panInfo.current = null
          document.body.style.cursor = ''
          document.body.style.userSelect = ''
          return
        }
        const dx = e.clientX - panInfo.current.startX
        const dy = e.clientY - panInfo.current.startY
        if (!panInfo.current.active && (Math.abs(dx) >= 4 || Math.abs(dy) >= 4)) {
          panInfo.current.active = true
          document.body.style.cursor = 'grabbing'
          document.body.style.userSelect = 'none'
        }
        if (panInfo.current.active && scrollContainerRef.current) {
          const el = scrollContainerRef.current
          // 再レンダリング直後はprevXが古いためスキップしてジャンプを防ぐ
          if (panInfo.current.skipNextDelta) {
            panInfo.current.skipNextDelta = false
            panInfo.current.prevX = e.clientX
            panInfo.current.prevY = e.clientY
          } else {
            // 前フレームからの差分で動かすことで速度が常に1:1になる
            const ddx = e.clientX - panInfo.current.prevX
            const ddy = e.clientY - panInfo.current.prevY
            panInfo.current.prevX = e.clientX
            panInfo.current.prevY = e.clientY
            el.scrollLeft -= ddx
            el.scrollTop  -= ddy
            // 左端に近づいたら過去30日分をグリッドに追加
            if (el.scrollLeft < cwRef.current * 7 && pendingScrollAdjust.current === 0) {
              pendingScrollAdjust.current = 30 * cwRef.current
              setExtraLeft(prev => prev + 30)
            }
          }
        }
        return
      }
      if (!dragInfo.current) return
      const { task, type, startX, origStart, origEnd } = dragInfo.current
      const dx = e.clientX - startX
      if (Math.abs(dx) >= 3 && !didDragRef.current) {
        didDragRef.current = true
        document.body.style.userSelect = 'none'
        document.body.style.cursor = type === 'move' ? 'grabbing' : 'ew-resize'
      }
      if (!didDragRef.current) return
      const cell = cwRef.current
      const daysDelta = Math.round(dx / cell)
      let ns = origStart, ne = origEnd
      if (type === 'move')       { ns = addDays(origStart, daysDelta); ne = addDays(origEnd, daysDelta) }
      else if (type === 'left')  { ns = addDays(origStart, daysDelta); if (differenceInDays(ne, ns) < 1) ns = addDays(ne, -1) }
      else if (type === 'right') { ne = addDays(origEnd,   daysDelta); if (differenceInDays(ne, ns) < 1) ne = addDays(ns, 1) }
      const vs = viewStartRef.current, ve = viewEndRef.current
      const cs = isBefore(ns, vs) ? vs : ns
      const ce = isAfter(ne, ve)  ? ve : ne
      dragInfo.current.currentStart = ns
      dragInfo.current.currentEnd   = ne
      setDragOverlay({
        taskId: task.id,
        left:   Math.max(0, differenceInDays(cs, vs)) * cell,
        width:  Math.max(cell / 2, (differenceInDays(ce, cs) + 1) * cell),
        startStr: format(ns, 'yyyy-MM-dd'),
        endStr:   format(ne, 'yyyy-MM-dd'),
      })
    }
    const onMouseUp = () => {
      if (resizeRef.current) {
        resizeRef.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        return
      }
      if (panInfo.current) {
        panInfo.current = null
        document.body.style.cursor = ''
        document.body.style.userSelect = ''
        return
      }
      if (!dragInfo.current) return
      const { task, currentStart, currentEnd } = dragInfo.current
      if (didDragRef.current && currentStart && currentEnd) {
        onDatesChangeRef.current(task, format(currentStart, 'yyyy-MM-dd'), format(currentEnd, 'yyyy-MM-dd'))
      }
      dragInfo.current = null
      setDragOverlay(null)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup',   onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup',   onMouseUp)
    }
  }, [])

  // 設定モーダルからのズーム・表示日数変更をリアルタイムで反映
  useEffect(() => {
    const handler = (e) => {
      const { zoom: z, daysToShow: d } = e.detail
      if (z !== undefined) setZoom(z)
      if (d !== undefined) setDaysToShow(d)
    }
    window.addEventListener('turbo-gantt-settings', handler)
    return () => window.removeEventListener('turbo-gantt-settings', handler)
  }, [])

  const startDrag = (e, task, type) => {
    e.preventDefault()
    didDragRef.current = false
    dragInfo.current = {
      task, type, startX: e.clientX,
      origStart: parseISO(task.start_date),
      origEnd:   parseISO(task.end_date),
      currentStart: null, currentEnd: null,
    }
  }

  const getBarDisplay = (task) => {
    if (dragOverlay?.taskId === task.id) {
      return { left: dragOverlay.left, width: dragOverlay.width, isDragging: true }
    }
    // 親タスクを移動中はサブタスクのバーも追従
    if (task.parent_id && dragOverlay?.taskId === task.parent_id && dragInfo.current?.type === 'move') {
      const parentTask = tasks.find(t => t.id === task.parent_id)
      if (parentTask?.start_date && dragOverlay.startStr && task.start_date && task.end_date) {
        const delta = differenceInDays(parseISO(dragOverlay.startStr), parseISO(parentTask.start_date))
        if (delta !== 0) {
          const ns = addDays(parseISO(task.start_date), delta)
          const ne = addDays(parseISO(task.end_date),   delta)
          if (isAfter(ns, viewEnd) || isBefore(ne, displayStart)) return null
          const cs = isBefore(ns, displayStart) ? displayStart : ns
          const ce = isAfter(ne, viewEnd)        ? viewEnd      : ne
          return {
            left:  differenceInDays(cs, displayStart) * cw,
            width: Math.max((differenceInDays(ce, cs) + 1) * cw, cw / 2),
            isDragging: true,
          }
        }
      }
    }
    if (!task.start_date || !task.end_date) return null
    const start = parseISO(task.start_date)
    const end   = parseISO(task.end_date)
    if (!isValid(start) || !isValid(end)) return null
    if (isAfter(start, viewEnd) || isBefore(end, displayStart)) return null
    const cs = isBefore(start, displayStart) ? displayStart : start
    const ce = isAfter(end, viewEnd)         ? viewEnd      : end
    return {
      left:  differenceInDays(cs, displayStart) * cw,
      width: Math.max((differenceInDays(ce, cs) + 1) * cw, cw / 2),
      isDragging: false,
    }
  }

  const projectGroups = useMemo(() => {
    if (!groupByProject) return null
    const projectIds = new Set(projects.map(p => p.id))
    const groups = projects
      .map(project => ({
        project,
        dated:   filteredTasks.filter(t => t.project_id === project.id && t.start_date && t.end_date),
        undated: filteredTasks.filter(t => t.project_id === project.id && (!t.start_date || !t.end_date)),
      }))
      .filter(g => g.dated.length + g.undated.length > 0)
    const orphans = filteredTasks.filter(t => !projectIds.has(t.project_id))
    if (orphans.length > 0) {
      groups.push({
        project: { id: null, name: '未分類', color: '#9ca3af' },
        dated:   orphans.filter(t => t.start_date && t.end_date),
        undated: orphans.filter(t => !t.start_date || !t.end_date),
      })
    }
    return groups
  }, [filteredTasks, projects, groupByProject])

  const navigate = (delta) => setViewStart(d => addDays(d, delta))
  const goToday = () => {
    setViewStart(addDays(today, -9))
    setExtraLeft(0)
    if (scrollContainerRef.current) scrollContainerRef.current.scrollLeft = 0
  }

  const renderCellBg = () =>
    days.map((day, idx) => {
      const isToday = format(day, 'yyyy-MM-dd') === todayStr
      const isWeekend = day.getDay() === 0 || day.getDay() === 6
      return (
        <div
          key={idx}
          className="absolute top-0 bottom-0"
          style={{
            left: idx * cw, width: cw,
            background: isToday
              ? 'rgba(14,165,233,0.25)'
              : isWeekend ? 'rgba(163,177,198,0.05)' : 'transparent',
            borderRight: '1px solid var(--nm-line)',
          }}
        />
      )
    })

  const barPad = Math.max(4, Math.round(8 * scale))

  const PlusButton = ({ taskId }) => (
    <button
      onClick={(e) => {
        e.stopPropagation()
        const todayFmt = format(today, 'yyyy-MM-dd')
        const threeFmt = format(addDays(today, 3), 'yyyy-MM-dd')
        setAddingSubtaskId(taskId)
        setNewSubtaskTitle('')
        setNewSubtaskDates({ start: todayFmt, end: threeFmt })
        setCollapsedTaskIds(prev => { const next = new Set(prev); next.delete(taskId); return next })
      }}
      style={{
        flexShrink: 0,
        width: 20, height: 20, borderRadius: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--nm-muted)', opacity: 0.75,
        background: 'var(--nm-bg)',
        boxShadow: '2px 2px 4px var(--nm-dark), -1px -1px 3px var(--nm-light)',
        border: 'none', cursor: 'pointer', padding: 0,
      }}
      title="サブタスクを追加"
    >
      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
      </svg>
    </button>
  )

  const renderTaskRow = (task, isSubtask = false) => {
    const bar = getBarDisplay(task)
    const isDraggingThis = dragOverlay?.taskId === task.id
    const project = projects.find(p => p.id === task.project_id)
    const rowH = isSubtask ? Math.round(rh * 0.82) : rh
    const subBarPad = isSubtask ? Math.max(5, Math.round(11 * scale)) : barPad
    const indentL = isSubtask ? Math.max(36, Math.round(50 * scale)) : 12
    const taskSubs = !isSubtask ? (subtaskMap.get(task.id) || []) : []
    const hasSubtasks = taskSubs.length > 0
    const isTaskCollapsed = !isSubtask && collapsedTaskIds.has(task.id)
    const isRowDragTarget = !isSubtask && rowDragOverId === task.id && rowDragTaskId && rowDragTaskId !== task.id
    const isRowDragging = !isSubtask && rowDragTaskId === task.id

    return (
      <div
        key={task.id}
        style={{ position: 'relative' }}
        onDragOver={!isSubtask ? (e) => {
          if (!rowDragTaskId) return
          e.preventDefault()
          const dragged = tasks.find(t => t.id === rowDragTaskId)
          if (groupByProject && dragged?.project_id !== task.project_id) return
          const rect = e.currentTarget.getBoundingClientRect()
          setRowDragOverId(task.id)
          setRowInsertAbove(e.clientY < rect.top + rect.height / 2)
        } : undefined}
        onDragLeave={!isSubtask ? (e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setRowDragOverId(null)
        } : undefined}
        onDrop={!isSubtask ? (e) => {
          e.preventDefault()
          if (rowDragTaskId && rowDragTaskId !== task.id) {
            const dragged = tasks.find(t => t.id === rowDragTaskId)
            if (!groupByProject || dragged?.project_id === task.project_id) {
              onReorderTasks(rowDragTaskId, task.id, rowInsertAbove)
            }
          }
          setRowDragTaskId(null)
          setRowDragOverId(null)
        } : undefined}
      >
        {isRowDragTarget && rowInsertAbove && (
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, borderRadius: 999, background: 'var(--nm-accent)', zIndex: 50, pointerEvents: 'none' }} />
        )}
        <div className="flex items-center" style={{
          height: rowH,
          borderBottom: '1px solid var(--nm-line)',
          background: isSubtask ? 'rgba(163,177,198,0.025)' : 'transparent',
          opacity: isRowDragging ? 0.4 : 1,
        }}>
          <div
            className="flex items-center gap-2 h-full flex-shrink-0"
            style={{ width: lw, minWidth: lw, paddingLeft: indentL, paddingRight: 8, cursor: 'pointer', position: 'sticky', left: 0, zIndex: 15, background: 'var(--nm-bg)' }}
            onClick={() => !isDraggingThis && onEdit(task)}
          >
            {!isSubtask && onReorderTasks && (
              <div
                draggable
                onDragStart={(e) => { e.stopPropagation(); e.dataTransfer.effectAllowed = 'move'; setRowDragTaskId(task.id) }}
                onDragEnd={() => { setRowDragTaskId(null); setRowDragOverId(null) }}
                onClick={(e) => e.stopPropagation()}
                style={{ flexShrink: 0, width: 12, cursor: 'grab', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0.3 }}
                title="ドラッグして並び替え"
              >
                <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor" style={{ color: 'var(--nm-muted)' }}>
                  <circle cx="2" cy="2" r="1.2" /><circle cx="6" cy="2" r="1.2" />
                  <circle cx="2" cy="6" r="1.2" /><circle cx="6" cy="6" r="1.2" />
                  <circle cx="2" cy="10" r="1.2" /><circle cx="6" cy="10" r="1.2" />
                </svg>
              </div>
            )}
            {!isSubtask && (
              <div style={{ width: 14, height: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {hasSubtasks && (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleTaskCollapse(task.id) }}
                    style={{ width: 14, height: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--nm-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={isTaskCollapsed ? '展開' : '折りたたむ'}
                  >
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                      style={{ transform: isTaskCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}
                    >
                      <path d="M5 7L1 3h8z" />
                    </svg>
                  </button>
                )}
              </div>
            )}
            {isSubtask ? (
              <span style={{ color: 'var(--nm-muted)', fontSize: fXxs, flexShrink: 0, opacity: 0.6 }}>└</span>
            ) : (
              <span className="rounded-full flex-shrink-0" style={{ width: 8, height: 8, backgroundColor: project?.color || '#6366f1' }} />
            )}
            <span
              className="truncate flex-1 min-w-0"
              style={{
                fontSize: isSubtask ? Math.max(10, Math.round(13 * scale)) : fSm,
                color: isDraggingThis ? 'var(--nm-accent)'
                  : task.status === 'done' ? 'var(--nm-muted)'
                  : (task.end_date && task.end_date < todayStr) ? '#f43f5e'
                  : 'var(--nm-text)',
                fontWeight: isDraggingThis ? 600 : 400,
                textDecoration: task.status === 'done' && !isDraggingThis ? 'line-through' : 'none',
                transition: 'color 0.15s',
              }}
            >
              {isDraggingThis
                ? `${format(parseISO(dragOverlay.startStr), 'M/d')} 〜 ${format(parseISO(dragOverlay.endStr), 'M/d')}`
                : task.title}
            </span>
            {!isSubtask && onSubtaskCreate && <PlusButton taskId={task.id} />}
            <div style={{ width: 18, height: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {task.status === 'done' && !isDraggingThis && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              )}
              {task.status !== 'done' && task.end_date && task.end_date < todayStr && !isDraggingThis && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#f43f5e" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
          </div>

          <div className="relative flex-shrink-0" style={{ width: gridWidth, height: rowH }}>
            {renderCellBg()}

            {bar && (
              <div
                className="absolute overflow-visible"
                style={{
                  top: subBarPad, bottom: subBarPad,
                  left: bar.left, width: bar.width,
                  backgroundColor: STATUS_COLOR[task.status],
                  borderRadius: isSubtask ? 6 : 8,
                  boxShadow: isDraggingThis
                    ? '6px 6px 16px var(--nm-dark), -2px -2px 8px var(--nm-light)'
                    : '3px 3px 6px var(--nm-dark), -1px -1px 4px var(--nm-light)',
                  opacity: task.status === 'done' ? 0.75 : 0.85,
                  cursor: isDraggingThis ? 'grabbing' : 'pointer',
                  transform: isDraggingThis ? 'scaleY(1.12)' : 'scaleY(1)',
                  transition: isDraggingThis ? 'none' : 'box-shadow 0.15s ease, transform 0.15s ease',
                  zIndex: isDraggingThis ? 20 : 1,
                  userSelect: 'none',
                }}
                onMouseDown={(e) => startDrag(e, task, 'move')}
                onClick={() => { if (!didDragRef.current) onEdit(task) }}
              >
                {task.progress > 0 && task.status !== 'done' && (
                  <div className="absolute top-0 left-0 bottom-0 rounded-l" style={{ width: `${task.progress}%`, background: 'rgba(255,255,255,0.28)', pointerEvents: 'none' }} />
                )}
                {!isSubtask && bar.width > 50 && (
                  <span
                    className="absolute inset-0 flex items-center px-3 text-white font-medium truncate pointer-events-none"
                    style={{ fontSize: fXs, borderRadius: 8 }}
                  >
                    {task.title}
                  </span>
                )}
                <div
                  className="absolute left-0 top-0 bottom-0 z-10 flex items-center justify-center opacity-0 hover:opacity-100"
                  style={{ width: HANDLE_W + 4, cursor: 'ew-resize', transition: 'opacity 0.15s' }}
                  onMouseDown={(e) => { e.stopPropagation(); startDrag(e, task, 'left') }}
                >
                  <div style={{ width: 2, height: '60%', background: 'rgba(255,255,255,0.8)', borderRadius: 1 }} />
                  <div style={{ width: 2, height: '40%', background: 'rgba(255,255,255,0.8)', borderRadius: 1, marginLeft: 2 }} />
                </div>
                <div
                  className="absolute right-0 top-0 bottom-0 z-10 flex items-center justify-center opacity-0 hover:opacity-100"
                  style={{ width: HANDLE_W + 4, cursor: 'ew-resize', transition: 'opacity 0.15s' }}
                  onMouseDown={(e) => { e.stopPropagation(); startDrag(e, task, 'right') }}
                >
                  <div style={{ width: 2, height: '40%', background: 'rgba(255,255,255,0.8)', borderRadius: 1, marginRight: 2 }} />
                  <div style={{ width: 2, height: '60%', background: 'rgba(255,255,255,0.8)', borderRadius: 1 }} />
                </div>
              </div>
            )}
          </div>
        </div>
        {isRowDragTarget && !rowInsertAbove && (
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, borderRadius: 999, background: 'var(--nm-accent)', zIndex: 50, pointerEvents: 'none' }} />
        )}
      </div>
    )
  }

  const renderUndatedRow = (task) => {
    const taskSubs = subtaskMap.get(task.id) || []
    const hasSubtasks = taskSubs.length > 0
    const isTaskCollapsed = collapsedTaskIds.has(task.id)
    return (
      <div key={task.id} className="flex items-center" style={{ height: rh, borderBottom: '1px solid var(--nm-line)' }}>
        <div
          className="flex items-center gap-2 h-full cursor-pointer flex-shrink-0"
          style={{ width: lw, minWidth: lw, paddingLeft: 12, paddingRight: 8, position: 'sticky', left: 0, zIndex: 15, background: 'var(--nm-bg)' }}
          onClick={() => onEdit(task)}
        >
          <div style={{ width: 14, height: 14, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {hasSubtasks && (
              <button
                onClick={(e) => { e.stopPropagation(); toggleTaskCollapse(task.id) }}
                style={{ width: 14, height: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 0, color: 'var(--nm-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                title={isTaskCollapsed ? '展開' : '折りたたむ'}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                  style={{ transform: isTaskCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}
                >
                  <path d="M5 7L1 3h8z" />
                </svg>
              </button>
            )}
          </div>
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--nm-muted)' }} />
          <span className="truncate flex-1" style={{ fontSize: fSm, color: 'var(--nm-muted)' }}>{task.title}</span>
          {onSubtaskCreate && <PlusButton taskId={task.id} />}
        </div>
        <div className="flex-1 flex items-center px-4" style={{ fontSize: fXs, color: 'rgba(163,177,198,0.7)' }}>
          開始日と終了日を設定してください
        </div>
      </div>
    )
  }

  const renderSubtaskAddRow = (parentId) => {
    const titleH  = Math.round(rh * 0.65)
    const dateH   = Math.round(rh * 0.56)
    const rowH    = titleH + dateH + Math.round(rh * 0.24)
    const indentL = Math.max(36, Math.round(50 * scale))

    const handleSubmit = () => {
      if (!newSubtaskTitle.trim()) return
      onSubtaskCreate(parentId, newSubtaskTitle.trim(), newSubtaskDates.start || null, newSubtaskDates.end || null)
      setNewSubtaskTitle('')
      setNewSubtaskDates({ start: '', end: '' })
      setAddingSubtaskId(null)
    }
    const handleCancel = () => {
      setAddingSubtaskId(null)
      setNewSubtaskTitle('')
      setNewSubtaskDates({ start: '', end: '' })
    }

    return (
      <div key={`add-sub-${parentId}`} style={{
        height: rowH,
        display: 'flex',
        borderBottom: '1px solid var(--nm-line)',
        background: 'rgba(99,102,241,0.03)',
      }}>
        <div style={{
          flexShrink: 0,
          width: lw, minWidth: lw,
          paddingLeft: indentL, paddingRight: 8,
          paddingTop: Math.round(rh * 0.06), paddingBottom: Math.round(rh * 0.06),
          display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 4,
          position: 'sticky', left: 0, zIndex: 15, background: 'var(--nm-bg)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: 'var(--nm-accent)', fontSize: fXxs, flexShrink: 0, opacity: 0.8 }}>└</span>
            <input
              autoFocus
              value={newSubtaskTitle}
              onChange={e => setNewSubtaskTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') handleCancel()
              }}
              placeholder="サブタスク名を入力..."
              className="nm-input px-2 flex-1"
              style={{ borderRadius: 6, height: titleH, fontSize: Math.max(10, Math.round(13 * scale)) }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: Math.round(fXxs + 8) }}>
            <input
              type="date"
              value={newSubtaskDates.start}
              onChange={e => setNewSubtaskDates(d => ({ ...d, start: e.target.value }))}
              className="nm-input px-1 flex-1"
              style={{ borderRadius: 6, height: dateH, fontSize: fXs }}
            />
            <span style={{ fontSize: fXs, color: 'var(--nm-muted)', flexShrink: 0 }}>〜</span>
            <input
              type="date"
              value={newSubtaskDates.end}
              onChange={e => setNewSubtaskDates(d => ({ ...d, end: e.target.value }))}
              onKeyDown={e => {
                if (e.key === 'Enter') handleSubmit()
                if (e.key === 'Escape') handleCancel()
              }}
              className="nm-input px-1 flex-1"
              style={{ borderRadius: 6, height: dateH, fontSize: fXs }}
            />
          </div>
        </div>
        <div className="relative flex-shrink-0" style={{ width: gridWidth, height: rowH }}>
          {renderCellBg()}

        </div>
      </div>
    )
  }

  const renderDateHeader = () => {
    const projectKeys = projects.map(p => p.id ?? 'none')
    const twsList = tasks.filter(t => !t.parent_id && subtaskMap.has(t.id))
    const isAllCollapsed = (projectKeys.length + twsList.length) > 0 &&
      projectKeys.every(k => collapsedProjects.has(k)) &&
      twsList.every(t => collapsedTaskIds.has(t.id))
    return (
    <div className="sticky top-0 z-20" style={{ background: 'var(--nm-bg)' }}>
      <div className="flex">
        <div style={{ position: 'sticky', left: 0, zIndex: 22, width: lw, minWidth: lw, flexShrink: 0, background: 'var(--nm-bg)' }} />
        {monthGroups.map(g => (
          <div
            key={g.key}
            className="font-bold px-2 py-1.5 truncate flex-shrink-0"
            style={{ fontSize: fXs, width: g.count * cw, color: 'var(--nm-accent)', borderRight: '1px solid var(--nm-line)' }}
          >
            {g.label}
          </div>
        ))}
      </div>
      <div className="flex" style={{ boxShadow: '0 4px 8px var(--nm-dark)' }}>
        <div
          className="relative flex items-center gap-2 py-2 font-semibold flex-shrink-0"
          style={{ fontSize: fXs, width: lw, minWidth: lw, paddingLeft: 12, paddingRight: 16, color: 'var(--nm-muted)', position: 'sticky', left: 0, zIndex: 21, background: 'var(--nm-bg)' }}
        >
          <button
            onClick={isAllCollapsed ? expandAll : collapseAll}
            className="flex items-center justify-center flex-shrink-0"
            style={{
              width: 14, height: 14,
              background: 'none', border: 'none', padding: 0, cursor: 'pointer',
              color: 'var(--nm-muted)',
            }}
            title={isAllCollapsed ? 'すべて展開' : 'すべて折りたたむ'}
          >
            <svg
              width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
              style={{ transform: isAllCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}
            >
              <path d="M5 7L1 3h8z" />
            </svg>
          </button>
          タスク名
          <div
            className="absolute right-0 top-0 bottom-0 flex items-center justify-center"
            style={{ width: 8, cursor: 'col-resize', zIndex: 30 }}
            onMouseDown={(e) => {
              e.preventDefault()
              resizeRef.current = { startX: e.clientX, startBaseW: labelBaseWRef.current }
              document.body.style.cursor = 'col-resize'
              document.body.style.userSelect = 'none'
            }}
          >
            <div style={{ width: 2, height: '50%', background: 'rgba(163,177,198,0.5)', borderRadius: 1 }} />
          </div>
        </div>
        {days.map((day, idx) => {
          const isToday   = format(day, 'yyyy-MM-dd') === todayStr
          const isWeekend = day.getDay() === 0 || day.getDay() === 6
          return (
            <div
              key={idx}
              className="flex flex-col items-center justify-center py-1 flex-shrink-0"
              style={{
                width: cw,
                background:  isToday ? 'rgba(14,165,233,0.20)' : isWeekend ? 'rgba(163,177,198,0.08)' : 'transparent',
                color:       isToday ? '#0ea5e9' : 'var(--nm-muted)',
                fontWeight:  isToday ? 700 : 400,
                borderRight: '1px solid var(--nm-line)',
              }}
            >
              <span style={{ fontSize: fXs  }}>{format(day, 'd')}</span>
              <span style={{ fontSize: fXxs }}>{format(day, 'E', { locale: ja })}</span>
            </div>
          )
        })}
      </div>
    </div>
    )
  }

  const getProjectDateRange = (dated) => {
    const valid = dated.filter(t => t.start_date && t.end_date)
    if (!valid.length) return null
    const starts = valid.map(t => parseISO(t.start_date)).filter(isValid)
    const ends   = valid.map(t => parseISO(t.end_date)).filter(isValid)
    if (!starts.length) return null
    return {
      start: starts.reduce((a, b) => isBefore(a, b) ? a : b),
      end:   ends.reduce((a, b)   => isAfter(a, b)  ? a : b),
    }
  }

  const renderTaskWithSubs = (task, renderFn) => {
    const subs = subtaskMap.get(task.id) || []
    const isCollapsed = collapsedTaskIds.has(task.id)
    return [
      renderFn(task),
      ...(isCollapsed ? [] : [
        ...subs.map(sub => renderTaskRow(sub, true)),
        addingSubtaskId === task.id ? renderSubtaskAddRow(task.id) : null,
      ]),
    ].filter(Boolean)
  }

  const renderProjectBlock = (group) => {
    const { project, dated, undated } = group
    const collapseKey = project.id ?? 'none'
    const isCollapsed = collapsedProjects.has(collapseKey)
    const totalCount  = dated.length + undated.length
    const headerH     = Math.max(28, Math.round(40 * scale))
    const allDone     = totalCount > 0 && [...dated, ...undated].every(t => t.status === 'done')

    let summaryBar = null
    if (isCollapsed) {
      const range = getProjectDateRange(dated)
      if (range && !isAfter(range.start, viewEnd) && !isBefore(range.end, displayStart)) {
        const cs = isBefore(range.start, displayStart) ? displayStart : range.start
        const ce = isAfter(range.end, viewEnd)          ? viewEnd      : range.end
        summaryBar = {
          left:  differenceInDays(cs, displayStart) * cw,
          width: Math.max((differenceInDays(ce, cs) + 1) * cw, cw / 2),
        }
      }
    }

    return (
      <div
        key={collapseKey}
        className="nm-raised-sm"
        style={{ marginBottom: 16, borderRadius: 0 }}
      >
        <div
          className="flex items-center flex-shrink-0"
          style={{
            height: headerH,
            background: `${project.color}18`,
            borderBottom: isCollapsed ? 'none' : '1px solid var(--nm-line)',
          }}
        >
          <div
            className="flex items-center gap-2 flex-shrink-0"
            style={{ width: lw, minWidth: lw, paddingLeft: 12, paddingRight: 16, position: 'sticky', left: 0, zIndex: 15, backgroundColor: 'var(--nm-bg)', backgroundImage: `linear-gradient(${project.color}18, ${project.color}18)` }}
          >
            <button
              onClick={() => toggleCollapse(collapseKey)}
              className="flex items-center justify-center flex-shrink-0"
              style={{ width: 14, height: 14, color: 'var(--nm-muted)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
              title={isCollapsed ? '展開' : '折りたたむ'}
            >
              <svg
                width="10" height="10" viewBox="0 0 10 10" fill="currentColor"
                style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.18s ease' }}
              >
                <path d="M5 7L1 3h8z" />
              </svg>
            </button>
            <span
              className="flex-shrink-0"
              style={{
                width: 10, height: 10, borderRadius: '50%',
                backgroundColor: project.color,
                boxShadow: '2px 2px 4px var(--nm-dark), -1px -1px 3px var(--nm-light)',
              }}
            />
            <span className="font-bold truncate" style={{ fontSize: fSm, color: 'var(--nm-text)' }}>
              {project.name}
            </span>
            <span
              className="nm-pressed-xs font-semibold flex-shrink-0"
              style={{ fontSize: fXs, color: 'var(--nm-muted)', padding: '1px 7px' }}
            >
              {totalCount}
            </span>
            {allDone && (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginLeft: 'auto' }}>
                <path d="M5 13l4 4L19 7" />
              </svg>
            )}
          </div>

          {isCollapsed && (
            <div className="relative flex-shrink-0" style={{ width: gridWidth, height: headerH }}>
              {renderCellBg()}
    
              {summaryBar && (
                <div
                  className="absolute"
                  style={{
                    top: barPad, bottom: barPad,
                    left: summaryBar.left, width: summaryBar.width,
                    backgroundColor: project.color,
                    borderRadius: 8,
                    opacity: 0.72,
                    boxShadow: '3px 3px 6px var(--nm-dark), -1px -1px 4px var(--nm-light)',
                  }}
                />
              )}
            </div>
          )}
        </div>

        {!isCollapsed && (
          <>
            {dated.flatMap(task => renderTaskWithSubs(task, t => renderTaskRow(t, false)))}
            {undated.length > 0 && (
              <>
                <div
                  className="flex items-center"
                  style={{ height: 26, background: 'rgba(163,177,198,0.06)', borderTop: '1px solid rgba(163,177,198,0.2)' }}
                >
                  <span className="px-4 font-semibold" style={{ fontSize: fXs, color: 'var(--nm-muted)', width: lw }}>
                    日程未設定
                  </span>
                </div>
                {undated.flatMap(task => renderTaskWithSubs(task, renderUndatedRow))}
              </>
            )}
          </>
        )}
      </div>
    )
  }

  const flatRows = useMemo(() => {
    if (groupByProject) return null
    return {
      dated:   filteredTasks.filter(t => t.start_date && t.end_date),
      undated: filteredTasks.filter(t => !t.start_date || !t.end_date),
    }
  }, [filteredTasks, groupByProject])

  const collapseAll = () => {
    setCollapsedProjects(new Set([...projects.map(p => p.id), 'none']))
    setCollapsedTaskIds(new Set(
      tasks.filter(t => !t.parent_id && subtaskMap.has(t.id)).map(t => t.id)
    ))
  }
  const expandAll = () => {
    setCollapsedProjects(new Set())
    setCollapsedTaskIds(new Set())
  }

  const Divider = () => (
    <div style={{ width: 1, height: 16, background: 'rgba(163,177,198,0.35)' }} />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="flex items-center gap-3 pl-0 py-4" style={{ paddingRight: 10 }}>
        <button
          onClick={onNewTask}
          className="nm-btn flex items-center justify-center flex-shrink-0"
          style={{ width: 28, height: 28, color: 'var(--nm-muted)' }}
          title="新規タスク"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
        <button onClick={() => navigate(-14)} className="nm-btn px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--nm-muted)' }}>
          ← 前へ
        </button>
        <button onClick={goToday} className="nm-btn px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--nm-accent)' }}>
          今月
        </button>
        <button onClick={() => navigate(14)} className="nm-btn px-3 py-1.5 text-xs font-medium" style={{ color: 'var(--nm-muted)' }}>
          次へ →
        </button>
        <span className="text-xs ml-1" style={{ color: 'var(--nm-muted)' }}>
          {format(viewStart, 'yyyy年M月d日', { locale: ja })} 〜 {format(viewEnd, 'M月d日', { locale: ja })}
        </span>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => setTodayFilter(v => !v)}
            className={`flex items-center gap-1.5 px-2.5 py-1 ${todayFilter ? 'nm-pressed-xs' : 'nm-btn'}`}
            style={{ borderRadius: 8 }}
            title={todayFilter ? '今日フィルターを解除' : '今日が期間内のタスクのみ表示'}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" style={{ color: todayFilter ? 'var(--nm-accent)' : 'var(--nm-muted)', flexShrink: 0 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
              <circle cx="12" cy="16" r="2" fill="currentColor" stroke="none" />
            </svg>
            <span className="text-xs font-medium" style={{ color: todayFilter ? 'var(--nm-accent)' : 'var(--nm-muted)' }}>今日</span>
          </button>

          <Divider />

          {[['todo', '未着手'], ['in_progress', '進行中'], ['done', '完了']].map(([key, label]) => {
            const isActive = statusFilter.has(key)
            const isDimmed = statusFilter.size > 0 && !isActive
            return (
              <button
                key={key}
                onClick={() => toggleStatusFilter(key)}
                className={`flex items-center gap-1.5 px-2.5 py-1 ${isActive ? 'nm-pressed-xs' : 'nm-btn'}`}
                style={{
                  borderRadius: 8,
                  opacity: isDimmed ? 0.4 : 1,
                  transition: 'opacity 0.15s',
                }}
                title={isActive ? 'フィルターを解除' : `${label}を絞り込む`}
              >
                <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: STATUS_COLOR[key], display: 'inline-block', flexShrink: 0 }} />
                <span className="text-xs font-medium" style={{ color: isActive ? STATUS_COLOR[key] : 'var(--nm-muted)' }}>{label}</span>
              </button>
            )
          })}

          <Divider />

          <div className="flex items-center gap-1">
            <button
              onClick={zoomDown}
              disabled={zoomIdx <= 0}
              className="nm-btn flex items-center justify-center text-sm font-bold"
              style={{ width: 26, height: 26, color: zoomIdx <= 0 ? 'var(--nm-muted)' : 'var(--nm-text)', opacity: zoomIdx <= 0 ? 0.4 : 1 }}
            >−</button>
            <button
              onClick={zoomReset}
              className={`nm-btn px-2 py-1 text-xs font-semibold ${zoom === 100 ? '' : 'nm-pressed-xs'}`}
              style={{ minWidth: 46, color: zoom === 100 ? 'var(--nm-muted)' : 'var(--nm-accent)' }}
              title="100%に戻す"
            >{zoom}%</button>
            <button
              onClick={zoomUp}
              disabled={zoomIdx >= ZOOM_LEVELS.length - 1}
              className="nm-btn flex items-center justify-center text-sm font-bold"
              style={{ width: 26, height: 26, color: zoomIdx >= ZOOM_LEVELS.length - 1 ? 'var(--nm-muted)' : 'var(--nm-text)', opacity: zoomIdx >= ZOOM_LEVELS.length - 1 ? 0.4 : 1 }}
            >＋</button>
          </div>

          <Divider />

          <span className="text-xs" style={{ color: 'var(--nm-muted)' }}>表示日数</span>
          <select
            value={daysToShow}
            onChange={(e) => { const v = Number(e.target.value); setDaysToShow(v); localStorage.setItem('turbo-days', v) }}
            className="nm-select px-3 py-1.5 text-xs"
            style={{ width: 80 }}
          >
            <option value={30}>30日</option>
            <option value={60}>60日</option>
            <option value={90}>90日</option>
          </select>
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--nm-muted)' }}>
          <div className="nm-raised p-5 mb-3">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ opacity: 0.4 }}>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <p className="text-sm">タスクがありません</p>
        </div>
      ) : (
        <div
          ref={scrollContainerRef}
          className="overflow-auto"
          style={{ flex: 1, minHeight: 0, cursor: 'grab' }}
          onMouseDown={(e) => {
            if (e.button !== 0) return
            if (dragInfo.current) return
            if (e.target.closest('button, input, select')) return
            panInfo.current = {
              startX: e.clientX,
              startY: e.clientY,
              prevX: e.clientX,
              prevY: e.clientY,
              active: false,
            }
          }}
        >
          <div style={{ minWidth: lw + gridWidth }}>
            {renderDateHeader()}
            {groupByProject && projectGroups ? (
              <div style={{ padding: '12px 0 4px' }}>
                {projectGroups.map(group => renderProjectBlock(group))}
              </div>
            ) : flatRows && (
              <div style={{ padding: '12px 0 4px' }}>
                {renderProjectBlock({
                  project: projects.find(p => p.id === tasks[0]?.project_id)
                    || { id: null, name: tasks[0]?.project_name || '未分類', color: tasks[0]?.project_color || '#9ca3af' },
                  dated: flatRows.dated,
                  undated: flatRows.undated,
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
