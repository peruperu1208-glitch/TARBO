import { useState, useMemo, useRef, useEffect } from 'react'
import {
  format, addDays, eachDayOfInterval,
  differenceInDays, parseISO, isValid, isBefore, isAfter,
} from 'date-fns'
import { ja } from 'date-fns/locale'

const CELL_W  = 36
const ROW_H   = 44
const LABEL_W = 200
const HANDLE_W = 10

const STATUS_COLOR = {
  todo: '#9ca3af',
  in_progress: '#6366f1',
  done: '#10b981',
}

export default function GanttChart({ tasks, projects, onEdit, onDatesChange, onNewTask, groupByProject = false }) {
  const today = useMemo(() => new Date(), [])

  const [viewStart, setViewStart] = useState(() => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    d.setDate(d.getDate() - 7)
    return d
  })
  const [daysToShow, setDaysToShow] = useState(60)
  const [zoom, setZoom] = useState(100)
  const ZOOM_LEVELS = [50, 75, 100, 125, 150]
  const zoomIdx = ZOOM_LEVELS.indexOf(zoom)
  const zoomDown = () => { if (zoomIdx > 0) setZoom(ZOOM_LEVELS[zoomIdx - 1]) }
  const zoomUp   = () => { if (zoomIdx < ZOOM_LEVELS.length - 1) setZoom(ZOOM_LEVELS[zoomIdx + 1]) }
  const zoomReset = () => setZoom(100)

  // ---- スケール計算 ----
  const scale = zoom / 100
  const cw  = Math.round(CELL_W  * scale)
  const rh  = Math.round(ROW_H   * scale)
  const [labelBaseW, setLabelBaseW] = useState(LABEL_W)
  const lw  = Math.max(80, Math.round(labelBaseW * scale))
  const fSm  = Math.max(10, Math.round(14 * scale))
  const fXs  = Math.max(9,  Math.round(12 * scale))
  const fXxs = Math.max(8,  Math.round(10 * scale))

  const viewEnd   = addDays(viewStart, daysToShow - 1)
  const days      = useMemo(() => eachDayOfInterval({ start: viewStart, end: viewEnd }), [viewStart, viewEnd])
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

  // ---- ドラッグ状態 ----
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

  useEffect(() => { viewStartRef.current    = viewStart    }, [viewStart])
  useEffect(() => { viewEndRef.current      = viewEnd      }, [viewEnd])
  useEffect(() => { onDatesChangeRef.current = onDatesChange }, [onDatesChange])
  useEffect(() => { onEditRef.current       = onEdit       }, [onEdit])
  useEffect(() => { cwRef.current           = cw           }, [cw])
  useEffect(() => { scaleRef.current        = scale        }, [scale])

  // プロジェクト名に合わせてラベル列幅を自動調整
  useEffect(() => {
    if (!projects.length) return
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    ctx.font = 'bold 14px sans-serif' // scale=1 時の fSm
    const maxNameW = Math.max(...projects.map(p => ctx.measureText(p.name).width))
    // オーバーヘッド: paddingLeft(12) + 折りたたみBtn(14) + gap×3(24) + dot(10) + badge(30) + paddingRight(16) + バッファ(20)
    const needed = Math.ceil(maxNameW) + 126
    const newBaseW = Math.max(LABEL_W, needed)
    setLabelBaseW(newBaseW)
    labelBaseWRef.current = newBaseW
  }, [projects])

  const [dragOverlay, setDragOverlay] = useState(null)
  const [collapsedProjects, setCollapsedProjects] = useState(new Set())
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
    if (!task.start_date || !task.end_date) return null
    const start = parseISO(task.start_date)
    const end   = parseISO(task.end_date)
    if (!isValid(start) || !isValid(end)) return null
    if (isAfter(start, viewEnd) || isBefore(end, viewStart)) return null
    const cs = isBefore(start, viewStart) ? viewStart : start
    const ce = isAfter(end, viewEnd)      ? viewEnd   : end
    return {
      left:  differenceInDays(cs, viewStart) * cw,
      width: Math.max((differenceInDays(ce, cs) + 1) * cw, cw / 2),
      isDragging: false,
    }
  }

  // プロジェクト別グループ（全タスク表示時のみ）
  const projectGroups = useMemo(() => {
    if (!groupByProject) return null
    const projectIds = new Set(projects.map(p => p.id))
    const groups = projects
      .map(project => ({
        project,
        dated:   tasks.filter(t => t.project_id === project.id && t.start_date && t.end_date),
        undated: tasks.filter(t => t.project_id === project.id && (!t.start_date || !t.end_date)),
      }))
      .filter(g => g.dated.length + g.undated.length > 0)
    const orphans = tasks.filter(t => !projectIds.has(t.project_id))
    if (orphans.length > 0) {
      groups.push({
        project: { id: null, name: '未分類', color: '#9ca3af' },
        dated:   orphans.filter(t => t.start_date && t.end_date),
        undated: orphans.filter(t => !t.start_date || !t.end_date),
      })
    }
    return groups
  }, [tasks, projects, groupByProject])

  const navigate = (delta) => setViewStart(d => addDays(d, delta))
  const goToday = () => {
    const d = new Date(today.getFullYear(), today.getMonth(), 1)
    d.setDate(d.getDate() - 7)
    setViewStart(d)
  }

  // ---- 行レンダラー ----
  const renderCellBg = () =>
    days.map((day, idx) => (
      <div
        key={idx}
        className="absolute top-0 bottom-0"
        style={{
          left: idx * cw, width: cw,
          background: format(day, 'yyyy-MM-dd') === todayStr
            ? 'rgba(99,102,241,0.05)'
            : (day.getDay() === 0 || day.getDay() === 6) ? 'rgba(163,177,198,0.05)' : 'transparent',
          borderRight: '1px solid rgba(163,177,198,0.12)',
        }}
      />
    ))

  const renderTodayLine = () =>
    todayIdx >= 0 && (
      <div
        className="absolute top-0 bottom-0 z-10"
        style={{ left: todayIdx * cw + cw / 2, width: 2, background: 'rgba(99,102,241,0.5)', borderRadius: 1, boxShadow: '0 0 6px rgba(99,102,241,0.4)' }}
      />
    )

  const barPad = Math.max(4, Math.round(8 * scale))

  const renderTaskRow = (task) => {
    const bar = getBarDisplay(task)
    const isDraggingThis = dragOverlay?.taskId === task.id
    const project = projects.find(p => p.id === task.project_id)
    return (
      <div key={task.id} className="flex items-center" style={{ height: rh, borderBottom: '1px solid rgba(163,177,198,0.15)' }}>
        <div
          className="flex items-center gap-2 px-4 h-full cursor-pointer flex-shrink-0"
          style={{ width: lw, minWidth: lw }}
          onClick={() => !isDraggingThis && onEdit(task)}
        >
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: project?.color || '#6366f1' }} />
          <span
            className="truncate flex-1 min-w-0"
            style={{
              fontSize: fSm,
              color: isDraggingThis ? 'var(--nm-accent)' : task.status === 'done' ? 'var(--nm-muted)' : (task.end_date && task.end_date < todayStr) ? '#f59e0b' : 'var(--nm-text)',
              fontWeight: isDraggingThis ? 600 : 400,
              textDecoration: task.status === 'done' && !isDraggingThis ? 'line-through' : 'none',
              transition: 'color 0.15s',
            }}
          >
            {isDraggingThis
              ? `${format(parseISO(dragOverlay.startStr), 'M/d')} 〜 ${format(parseISO(dragOverlay.endStr), 'M/d')}`
              : task.title}
          </span>
          {task.status === 'done' && !isDraggingThis && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M5 13l4 4L19 7" />
            </svg>
          )}
          {task.status !== 'done' && task.end_date && task.end_date < todayStr && !isDraggingThis && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <div className="relative flex-shrink-0" style={{ width: gridWidth, height: rh }}>
          {renderCellBg()}
          {renderTodayLine()}
          {bar && (
            <div
              className="absolute overflow-visible"
              style={{
                top: barPad, bottom: barPad,
                left: bar.left, width: bar.width,
                backgroundColor: STATUS_COLOR[task.status],
                borderRadius: 8,
                boxShadow: isDraggingThis
                  ? '6px 6px 16px var(--nm-dark), -2px -2px 8px var(--nm-light)'
                  : '3px 3px 6px var(--nm-dark), -1px -1px 4px var(--nm-light)',
                opacity: task.status === 'done' ? 0.75 : 1,
                cursor: isDraggingThis ? 'grabbing' : 'grab',
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
              {bar.width > 50 && (
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
    )
  }

  const renderUndatedRow = (task) => (
    <div key={task.id} className="flex items-center" style={{ height: rh, borderBottom: '1px solid rgba(163,177,198,0.15)' }}>
      <div
        className="flex items-center gap-2 px-4 h-full cursor-pointer flex-shrink-0"
        style={{ width: lw, minWidth: lw }}
        onClick={() => onEdit(task)}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--nm-muted)' }} />
        <span className="truncate" style={{ fontSize: fSm, color: 'var(--nm-muted)' }}>{task.title}</span>
      </div>
      <div className="flex-1 flex items-center px-4" style={{ fontSize: fXs, color: 'rgba(163,177,198,0.7)' }}>
        開始日と終了日を設定してください
      </div>
    </div>
  )

  // ---- 日付ヘッダー（sticky / 共通） ----
  const renderDateHeader = () => (
    <div className="sticky top-0 z-20" style={{ background: 'var(--nm-bg)' }}>
      <div className="flex" style={{ marginLeft: lw }}>
        {monthGroups.map(g => (
          <div
            key={g.key}
            className="font-bold px-2 py-1.5 truncate flex-shrink-0"
            style={{ fontSize: fXs, width: g.count * cw, color: 'var(--nm-accent)', borderRight: '1px solid rgba(163,177,198,0.3)' }}
          >
            {g.label}
          </div>
        ))}
      </div>
      <div className="flex" style={{ boxShadow: '0 4px 8px var(--nm-dark)' }}>
        <div
          className="relative flex items-center px-4 py-2 font-semibold flex-shrink-0"
          style={{ fontSize: fXs, width: lw, minWidth: lw, color: 'var(--nm-muted)' }}
        >
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
                background:  isToday ? 'rgba(99,102,241,0.08)' : isWeekend ? 'rgba(163,177,198,0.08)' : 'transparent',
                color:       isToday ? 'var(--nm-accent)' : 'var(--nm-muted)',
                fontWeight:  isToday ? 700 : 400,
                borderRight: '1px solid rgba(163,177,198,0.15)',
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

  // ---- プロジェクトブロック ----
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

  const renderProjectBlock = (group) => {
    const { project, dated, undated } = group
    const collapseKey = project.id ?? 'none'
    const isCollapsed = collapsedProjects.has(collapseKey)
    const totalCount  = dated.length + undated.length
    const headerH     = Math.max(28, Math.round(40 * scale))
    const allDone     = totalCount > 0 && [...dated, ...undated].every(t => t.status === 'done')

    // 折りたたみ時サマリーバー
    let summaryBar = null
    if (isCollapsed) {
      const range = getProjectDateRange(dated)
      if (range && !isAfter(range.start, viewEnd) && !isBefore(range.end, viewStart)) {
        const cs = isBefore(range.start, viewStart) ? viewStart : range.start
        const ce = isAfter(range.end, viewEnd)       ? viewEnd   : range.end
        summaryBar = {
          left:  differenceInDays(cs, viewStart) * cw,
          width: Math.max((differenceInDays(ce, cs) + 1) * cw, cw / 2),
        }
      }
    }

    return (
      <div
        key={collapseKey}
        className="nm-raised-sm"
        style={{ overflow: 'hidden', marginBottom: 16, borderRadius: 0 }}
      >
        {/* プロジェクトヘッダー */}
        <div
          className="flex items-center flex-shrink-0"
          style={{
            height: headerH,
            background: `${project.color}18`,
            borderBottom: isCollapsed ? 'none' : '1px solid rgba(163,177,198,0.25)',
          }}
        >
          {/* ラベル部分 */}
          <div
            className="flex items-center gap-2 flex-shrink-0"
            style={{ width: lw, minWidth: lw, paddingLeft: 12, paddingRight: 16 }}
          >
            {/* 折りたたみシェブロン */}
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

          {/* 折りたたみ時: グリッド + サマリーバー */}
          {isCollapsed && (
            <div className="relative flex-shrink-0" style={{ width: gridWidth, height: headerH }}>
              {renderCellBg()}
              {renderTodayLine()}
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

        {/* 展開時: タスク行 */}
        {!isCollapsed && (
          <>
            {dated.map(task => renderTaskRow(task))}
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
                {undated.map(task => renderUndatedRow(task))}
              </>
            )}
          </>
        )}
      </div>
    )
  }

  // ---- フラット行リスト（特定プロジェクト選択時） ----
  const flatRows = useMemo(() => {
    if (groupByProject) return null
    return {
      dated:   tasks.filter(t => t.start_date && t.end_date),
      undated: tasks.filter(t => !t.start_date || !t.end_date),
    }
  }, [tasks, groupByProject])

  const Divider = () => (
    <div style={{ width: 1, height: 16, background: 'rgba(163,177,198,0.35)' }} />
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* コントロールバー */}
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

        <div className="ml-auto flex items-center gap-4">
          {[['todo', '未着手'], ['in_progress', '進行中'], ['done', '完了']].map(([key, label]) => (
            <div key={key} className="flex items-center gap-1.5">
              <span style={{ width: 12, height: 12, borderRadius: 8, backgroundColor: STATUS_COLOR[key], boxShadow: '1px 1px 3px var(--nm-dark)', display: 'inline-block', flexShrink: 0 }} />
              <span className="text-xs" style={{ color: 'var(--nm-muted)' }}>{label}</span>
            </div>
          ))}

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
            onChange={(e) => setDaysToShow(Number(e.target.value))}
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
        <div className="overflow-auto" style={{ flex: 1, minHeight: 0 }}>
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
