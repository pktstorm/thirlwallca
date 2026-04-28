import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ReactFlow,
  Background,
  MiniMap,
  useReactFlow,
  useNodesState,
  useEdgesState,
  type NodeMouseHandler,
  BackgroundVariant,
  ReactFlowProvider,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import { useNavigate } from "@tanstack/react-router"
import { useTreeStore } from "../../stores/treeStore"
import { useUiStore } from "../../stores/uiStore"
import { CoupleNodeMemo } from "./CoupleNode"
import { ParentChildEdge } from "./PersonEdge"
import { TreeControls } from "./TreeControls"
import {
  COUPLE_NODE_HEIGHT,
  PERSON_WIDTH,
  PERSON_NODE_HEIGHT,
  buildFamilyUnits,
  layoutFamilyUnits,
  buildReactFlowNodes,
  buildReactFlowEdges,
  computeDirectLinePersonIds,
  personIdsToUnitIds,
  type CoupleNode,
  type TreeEdge,
  type FamilyUnit,
  type UnitPosition,
} from "./layoutUtils"
import { layoutByLanes } from "./layoutSugiyama"
import { routeEdges, type EdgeRouteInput, type ObstacleBox } from "./edgeRouter"
import { classifyBranchSides } from "./branchSide"

// --- Types ---

export interface TreeNodeData extends Record<string, unknown> {
  id: string
  first_name: string
  middle_name?: string | null
  last_name: string
  gender: "male" | "female" | "other" | "unknown"
  birth_date: string | null
  death_date: string | null
  is_living: boolean
  profile_photo_url: string | null
  occupation: string | null
  isDirectLine?: boolean
  isFocused?: boolean
}

export interface ApiTreeNode {
  id: string
  label: string
  data: TreeNodeData
}

export interface ApiTreeEdge {
  id: string
  source: string
  target: string
  type: "parent_child" | "spouse"
}

interface FamilyTreeCanvasProps {
  nodes: ApiTreeNode[]
  edges: ApiTreeEdge[]
  focusPersonId?: string
  onExpand?: (personId: string, direction: "up" | "down" | "both") => void
  isExpanding?: boolean
}

// --- Generation label node component ---

function GenerationLabelNode({ data }: { data: { label: string } }) {
  return (
    <div className="text-sage-300/60 dark:text-dark-text-muted/30 text-[10px] font-bold uppercase tracking-[0.2em] select-none pointer-events-none whitespace-nowrap">
      {data.label}
    </div>
  )
}

// --- Node & Edge type registrations ---

const nodeTypes = {
  coupleNode: CoupleNodeMemo,
  generationLabel: GenerationLabelNode,
}

const edgeTypes = {
  parentChild: ParentChildEdge,
}

// --- Layout pipeline ---

interface LayoutResult {
  nodes: CoupleNode[]
  edges: TreeEdge[]
  generationMap: Map<string, number>
  units: FamilyUnit[]
  personToUnit: Map<string, string>
}

function computeLayout(
  apiNodes: ApiTreeNode[],
  apiEdges: ApiTreeEdge[],
  options: { focusPersonId: string | null; useLanes: boolean },
): LayoutResult {
  const useLegacy = (() => {
    try {
      return localStorage.getItem("useLegacyLayout") === "true"
    } catch {
      return false
    }
  })()

  const { units, personToUnit, generationMap } = buildFamilyUnits(apiNodes, apiEdges)

  if (useLegacy) {
    const positions = layoutFamilyUnits(units, personToUnit)
    const nodes = buildReactFlowNodes(units, positions, apiNodes)
    const edges = buildReactFlowEdges(units, personToUnit)
    return { nodes, edges, generationMap, units, personToUnit }
  }

  // New pipeline.
  const branchSides = classifyBranchSides(apiEdges, options.focusPersonId, {
    getGender: (id) => {
      const node = apiNodes.find((n) => n.id === id)
      return node?.data.gender ?? null
    },
  })
  const { positions: layoutPositions } = layoutByLanes(units, personToUnit, {
    branchSides,
    useLanes: options.useLanes,
  })

  // Convert LayoutPosition map to UnitPosition map shape that buildReactFlowNodes accepts.
  const unitPositions = new Map<string, UnitPosition>()
  for (const u of units) {
    const p = layoutPositions.get(u.id)
    if (!p) continue
    unitPositions.set(u.id, {
      unitId: u.id,
      x: p.x,
      y: p.y,
      width: p.width,
      compact: p.compact,
    })
  }

  const nodes = buildReactFlowNodes(units, unitPositions, apiNodes)
  const baseEdges = buildReactFlowEdges(units, personToUnit)

  // Build obstacle boxes from positions + widths.
  const obstacles: ObstacleBox[] = []
  for (const u of units) {
    const p = unitPositions.get(u.id)
    if (!p) continue
    const w = p.width
    const h = u.spouseId ? COUPLE_NODE_HEIGHT : PERSON_NODE_HEIGHT
    obstacles.push({ unitId: u.id, x: p.x - w / 2, y: p.y - h / 2, width: w, height: h })
  }

  // Build EdgeRouteInputs from React Flow edges.
  const routerInputs: EdgeRouteInput[] = baseEdges
    .map((e) => {
      const sourceUnit = unitPositions.get(e.source)
      const targetUnit = unitPositions.get(e.target)
      if (!sourceUnit || !targetUnit) return null
      const sourceUnitData = units.find((u) => u.id === e.source)
      const targetUnitData = units.find((u) => u.id === e.target)
      const sourceH = sourceUnitData?.spouseId ? COUPLE_NODE_HEIGHT : PERSON_NODE_HEIGHT
      const targetH = targetUnitData?.spouseId ? COUPLE_NODE_HEIGHT : PERSON_NODE_HEIGHT
      return {
        id: e.id,
        sourceUnitId: e.source,
        targetUnitId: e.target,
        // Source: bottom-center of source unit. Target: top-center of target unit.
        source: { x: sourceUnit.x, y: sourceUnit.y + sourceH / 2 },
        target: { x: targetUnit.x, y: targetUnit.y - targetH / 2 },
      }
    })
    .filter((x): x is EdgeRouteInput => x !== null)

  const routedPaths = routeEdges(routerInputs, obstacles)
  // Attach paths to edges' data.
  const edges = baseEdges.map((e) => ({
    ...e,
    data: {
      isDirectLine: e.data?.isDirectLine,
      childNodeIds: e.data?.childNodeIds ?? [],
      parentNodeId: e.data?.parentNodeId ?? "",
      path: routedPaths.get(e.id) ?? undefined,
    },
  }))

  return { nodes, edges, generationMap, units, personToUnit }
}

// --- Inner canvas (needs ReactFlowProvider context) ---

function FamilyTreeCanvasInner({
  nodes: apiNodes,
  edges: apiEdges,
  focusPersonId,
  onExpand: _onExpand,
  isExpanding: _isExpanding,
}: FamilyTreeCanvasProps) {
  const navigate = useNavigate()
  const { fitView, setCenter } = useReactFlow()
  const setFocusedPerson = useTreeStore((s) => s.setFocusedPerson)
  const focusedPersonId = useTreeStore((s) => s.focusedPersonId)
  const setViewport = useTreeStore((s) => s.setViewport)
  const toggleDetailPanel = useUiStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUiStore((s) => s.detailPanelOpen)
  const setCenterOnPerson = useTreeStore((s) => s.setCenterOnPerson)
  const timeFilter = useTreeStore((s) => s.timeFilter)
  const pendingCenterPersonId = useTreeStore((s) => s.pendingCenterPersonId)
  const setPendingCenterPersonId = useTreeStore((s) => s.setPendingCenterPersonId)
  const treeViewMode = useTreeStore((s) => s.treeViewMode)

  const [nodes, setNodes, onNodesChange] = useNodesState<CoupleNode>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<TreeEdge>([])
  const [layoutReady, setLayoutReady] = useState(false)
  const [generationMap, setGenerationMap] = useState<Map<string, number>>(new Map())
  const [personToUnit, setPersonToUnit] = useState<Map<string, string>>(new Map())
  const [units, setUnits] = useState<FamilyUnit[]>([])
  const paneClickTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const skipNextFitView = useRef(false)

  // --- Compute visibility sets ---

  const timeVisiblePersonIds = useMemo<Set<string> | null>(() => {
    if (!timeFilter) return null
    const ids = new Set<string>()
    for (const n of apiNodes) {
      if (!n.data.birth_date) {
        ids.add(n.id)
        continue
      }
      const year = new Date(n.data.birth_date).getFullYear()
      if (year >= timeFilter.from && year <= timeFilter.to) {
        ids.add(n.id)
      }
    }
    return ids
  }, [apiNodes, timeFilter])

  const directLinePersonIds = useMemo<Set<string> | null>(() => {
    if (!focusedPersonId) return null
    return computeDirectLinePersonIds(focusedPersonId, apiEdges)
  }, [focusedPersonId, apiEdges])

  // Combined visibility at person level, then convert to unit IDs
  const visibleUnitIds = useMemo<Set<string> | null>(() => {
    let visiblePersonIds: Set<string> | null = null

    if (timeVisiblePersonIds && directLinePersonIds) {
      visiblePersonIds = new Set<string>()
      for (const id of timeVisiblePersonIds) {
        if (directLinePersonIds.has(id)) visiblePersonIds.add(id)
      }
    } else {
      visiblePersonIds = timeVisiblePersonIds ?? directLinePersonIds
    }

    if (!visiblePersonIds) return null
    return personIdsToUnitIds(visiblePersonIds, personToUnit)
  }, [timeVisiblePersonIds, directLinePersonIds, personToUnit])

  // Compute layout when API data changes
  useEffect(() => {
    if (apiNodes.length === 0) return

    setLayoutReady(false)

    const result = computeLayout(apiNodes, apiEdges, {
      focusPersonId: focusPersonId ?? null,
      useLanes: treeViewMode === "branch",
    })
    setNodes(result.nodes)
    setEdges(result.edges)
    setGenerationMap(result.generationMap)
    setPersonToUnit(result.personToUnit)
    setUnits(result.units)
    setLayoutReady(true)
  }, [apiNodes, apiEdges, focusPersonId, treeViewMode, setNodes, setEdges])

  // Build generation label nodes
  const generationLabelNodes = useMemo(() => {
    if (!layoutReady || nodes.length === 0 || generationMap.size === 0) return []

    let minX = Infinity
    const tierYs = new Set<number>()
    const tierToGen = new Map<number, number>()

    for (const node of nodes) {
      if (node.type !== "coupleNode") continue
      if (node.position.x < minX) minX = node.position.x
      tierYs.add(node.position.y)

      // Get generation from the primary person of the unit
      const unit = units.find((u) => u.id === node.id)
      if (unit) {
        const gen = generationMap.get(unit.primaryId)
        if (gen !== undefined) {
          tierToGen.set(node.position.y, gen)
        }
      }
    }

    const sortedTiers = [...tierYs].sort((a, b) => a - b)
    const nodeHeight = COUPLE_NODE_HEIGHT

    return sortedTiers.map((tierY) => {
      const gen = tierToGen.get(tierY) ?? 0
      return {
        id: `gen-label-${tierY}`,
        type: "generationLabel" as const,
        position: { x: minX - 100, y: tierY + nodeHeight / 2 - 8 },
        data: { label: `Gen ${gen + 1}` },
        selectable: false,
        draggable: false,
        connectable: false,
        style: { width: 80, height: 16, zIndex: -1 },
      }
    })
  }, [layoutReady, nodes, generationMap, units])

  // Combine person nodes + generation labels
  const allNodes = useMemo(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return [...nodes, ...generationLabelNodes] as any[]
  }, [nodes, generationLabelNodes])

  // Apply visibility + direct-line flags whenever filters change
  useEffect(() => {
    if (!layoutReady) return

    setNodes((prev) =>
      prev.map((n) => {
        const unit = units.find((u) => u.id === n.id)
        const primaryDirect = directLinePersonIds ? directLinePersonIds.has(unit?.primaryId ?? "") : false
        const spouseDirect = directLinePersonIds && unit?.spouseId ? directLinePersonIds.has(unit.spouseId) : false

        return {
          ...n,
          hidden: visibleUnitIds ? !visibleUnitIds.has(n.id) : false,
          data: {
            ...n.data,
            primaryIsDirectLine: primaryDirect,
            spouseIsDirectLine: spouseDirect,
            primaryIsFocused: focusedPersonId === unit?.primaryId,
            spouseIsFocused: focusedPersonId === unit?.spouseId,
          },
        }
      }),
    )

    setEdges((prev) =>
      prev.map((e) => {
        const sourceUnit = units.find((u) => u.id === e.source)
        const targetUnit = units.find((u) => u.id === e.target)
        const isDirectLine = directLinePersonIds
          ? (() => {
              if (!sourceUnit || !targetUnit) return false
              const sourceHasDirect = directLinePersonIds.has(sourceUnit.primaryId) || (sourceUnit.spouseId ? directLinePersonIds.has(sourceUnit.spouseId) : false)
              const targetHasDirect = directLinePersonIds.has(targetUnit.primaryId) || (targetUnit.spouseId ? directLinePersonIds.has(targetUnit.spouseId) : false)
              return sourceHasDirect && targetHasDirect
            })()
          : false

        return {
          ...e,
          hidden: visibleUnitIds
            ? !visibleUnitIds.has(e.source) || !visibleUnitIds.has(e.target)
            : false,
          data: {
            isDirectLine,
            childNodeIds: e.data?.childNodeIds ?? [],
            parentNodeId: e.data?.parentNodeId ?? "",
          },
        }
      }),
    )

    if (skipNextFitView.current) {
      skipNextFitView.current = false
      return
    }

    const timeout = setTimeout(() => {
      if (visibleUnitIds) {
        const visibleRfNodes = Array.from(visibleUnitIds).map((id) => ({ id }))
        fitView({ nodes: visibleRfNodes, duration: 800, padding: 0.2 })
      } else {
        fitView({ duration: 800, padding: 0.2 })
      }
    }, 50)

    return () => clearTimeout(timeout)
  }, [layoutReady, visibleUnitIds, directLinePersonIds, focusedPersonId, setNodes, setEdges, fitView, units])

  // Set focused person from prop
  useEffect(() => {
    if (focusPersonId) {
      setFocusedPerson(focusPersonId)
    }
  }, [focusPersonId, setFocusedPerson])

  // Register centerOnPerson callback
  useEffect(() => {
    if (!layoutReady) return
    setCenterOnPerson((personId: string) => {
      const unitId = personToUnit.get(personId)
      if (!unitId) return
      const node = nodes.find((n) => n.id === unitId)
      if (node) {
        const w = node.style?.width as number ?? PERSON_WIDTH
        const h = node.style?.height as number ?? PERSON_NODE_HEIGHT
        setCenter(
          node.position.x + w / 2,
          node.position.y + h / 2,
          { zoom: 1.2, duration: 600 },
        )
      }
    })
    return () => setCenterOnPerson(null)
  }, [layoutReady, nodes, personToUnit, setCenter, setCenterOnPerson])

  // Consume pendingCenterPersonId after layout
  useEffect(() => {
    if (!layoutReady || !pendingCenterPersonId) return
    const unitId = personToUnit.get(pendingCenterPersonId)
    if (!unitId) { setPendingCenterPersonId(null); return }
    const node = nodes.find((n) => n.id === unitId)
    if (node) {
      const timeout = setTimeout(() => {
        const w = node.style?.width as number ?? PERSON_WIDTH
        const h = node.style?.height as number ?? PERSON_NODE_HEIGHT
        setCenter(
          node.position.x + w / 2,
          node.position.y + h / 2,
          { zoom: 1.2, duration: 600 },
        )
        setFocusedPerson(pendingCenterPersonId)
        if (!detailPanelOpen) toggleDetailPanel()
      }, 200)
      setPendingCenterPersonId(null)
      return () => clearTimeout(timeout)
    }
    setPendingCenterPersonId(null)
  }, [layoutReady, pendingCenterPersonId, nodes, personToUnit, setCenter, setFocusedPerson, detailPanelOpen, toggleDetailPanel, setPendingCenterPersonId])

  // Fit view once layout is ready — center on focusPersonId if provided
  useEffect(() => {
    if (!layoutReady || nodes.length === 0) return

    const timeout = setTimeout(() => {
      if (focusPersonId) {
        const unitId = personToUnit.get(focusPersonId)
        if (unitId) {
          const focusNode = nodes.find((n) => n.id === unitId)
          if (focusNode) {
            const w = focusNode.style?.width as number ?? PERSON_WIDTH
            const h = focusNode.style?.height as number ?? PERSON_NODE_HEIGHT
            // Prevent the visibility effect from overriding this center
            skipNextFitView.current = true
            setCenter(
              focusNode.position.x + w / 2,
              focusNode.position.y + h / 2,
              { zoom: 1.0, duration: 800 },
            )
            return
          }
        }
      }
      fitView({ duration: 800, padding: 0.2 })
    }, 100)

    return () => clearTimeout(timeout)
  }, [layoutReady, nodes, focusPersonId, personToUnit, fitView, setCenter])

  // Click on a couple node: figure out which person was clicked
  const onNodeClick: NodeMouseHandler<CoupleNode> = useCallback(
    (event, node) => {
      if (paneClickTimer.current) {
        clearTimeout(paneClickTimer.current)
        paneClickTimer.current = null
      }
      skipNextFitView.current = true

      // Determine which person in the couple was clicked
      const nodeData = node.data
      let clickedPersonId = nodeData.primaryId

      if (nodeData.isCouple && nodeData.spouseId) {
        // Get click position relative to node
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        const clickX = event.clientX - rect.left
        const halfWidth = rect.width / 2

        if (clickX > halfWidth) {
          clickedPersonId = nodeData.spouseId
        }
      }

      setFocusedPerson(clickedPersonId)
      if (!detailPanelOpen) {
        toggleDetailPanel()
      }

      const w = node.style?.width as number ?? PERSON_WIDTH
      const h = node.style?.height as number ?? PERSON_NODE_HEIGHT
      setCenter(
        node.position.x + w / 2,
        node.position.y + h / 2,
        { zoom: 1.4, duration: 400 },
      )
    },
    [setFocusedPerson, detailPanelOpen, toggleDetailPanel, setCenter],
  )

  const onNodeDoubleClick: NodeMouseHandler<CoupleNode> = useCallback(
    (event, node) => {
      const nodeData = node.data
      let clickedPersonId = nodeData.primaryId

      if (nodeData.isCouple && nodeData.spouseId) {
        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
        const clickX = event.clientX - rect.left
        if (clickX > rect.width / 2) {
          clickedPersonId = nodeData.spouseId
        }
      }

      navigate({
        to: "/person/$personId",
        params: { personId: clickedPersonId },
      } as never)
    },
    [navigate],
  )

  const onMoveEnd = useCallback(
    (_event: unknown, viewport: { x: number; y: number; zoom: number }) => {
      setViewport(viewport)
    },
    [setViewport],
  )

  const onPaneClick = useCallback(() => {
    if (paneClickTimer.current) {
      clearTimeout(paneClickTimer.current)
    }
    paneClickTimer.current = setTimeout(() => {
      setFocusedPerson(null)
      if (detailPanelOpen) {
        toggleDetailPanel()
      }
      paneClickTimer.current = null
    }, 150)
  }, [setFocusedPerson, detailPanelOpen, toggleDetailPanel])

  return (
    <div className={`h-full w-full transition-opacity duration-300 ${layoutReady ? "opacity-100" : "opacity-50"}`}>
    <ReactFlow
      nodes={allNodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onPaneClick={onPaneClick}
      onMoveEnd={onMoveEnd}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.15}
      maxZoom={1.8}
      proOptions={{ hideAttribution: true }}
      className="family-tree-canvas"
    >
      <Background
        variant={BackgroundVariant.Dots}
        gap={24}
        size={1.5}
        color="var(--bg-dot-color, #c5d6cb)"
        className="[.dark_&]:[--bg-dot-color:rgba(48,232,110,0.15)]"
      />
      <MiniMap
        position="bottom-right"
        className="!bg-white/90 !rounded-xl !border !border-sage-200 dark:!bg-dark-surface/90 dark:!border-dark-border"
        style={{
          borderRadius: 12,
          marginBottom: 16,
          marginRight: 16,
        }}
        maskColor="rgba(48, 232, 110, 0.1)"
        nodeColor="#30e86e"
        pannable
        zoomable
      />
      <TreeControls />
    </ReactFlow>
    </div>
  )
}

// --- Exported component wraps with provider ---

export function FamilyTreeCanvas(props: FamilyTreeCanvasProps) {
  return (
    <ReactFlowProvider>
      <FamilyTreeCanvasInner {...props} />
    </ReactFlowProvider>
  )
}
