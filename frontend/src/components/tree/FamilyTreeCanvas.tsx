import { useCallback, useEffect, useState } from "react"
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
import ELK from "elkjs/lib/elk.bundled.js"
import { useNavigate } from "@tanstack/react-router"
import { useTreeStore } from "../../stores/treeStore"
import { useUiStore } from "../../stores/uiStore"
import { PersonNode } from "./PersonNode"
import { ParentChildEdge, SpouseEdge } from "./PersonEdge"
import { TreeControls } from "./TreeControls"
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  TIER_HEIGHT,
  MIN_SIBLING_GAP,
  ELK_LAYOUT_OPTIONS,
  partitionEdges,
  computeGenerations,
  positionSpouses,
  snapToGrid,
  resolveOverlaps,
  centerTree,
  buildReactFlowNodes,
  buildReactFlowEdges,
  type PersonNode as PersonNodeType,
  type TreeEdge,
} from "./layoutUtils"

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
}

// --- ELK layout pipeline ---

const elk = new ELK()

async function getLayoutedElements(
  apiNodes: ApiTreeNode[],
  apiEdges: ApiTreeEdge[],
): Promise<{ nodes: PersonNodeType[]; edges: TreeEdge[] }> {
  const { parentChildEdges, spouseEdges } = partitionEdges(apiEdges)

  const generationMap = computeGenerations(apiNodes, parentChildEdges, spouseEdges)

  const graph = {
    id: "root",
    layoutOptions: {
      ...ELK_LAYOUT_OPTIONS,
      "elk.partitioning.activate": "true",
    },
    children: apiNodes.map((n) => ({
      id: n.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
      layoutOptions: {
        "elk.partitioning.partition": String(generationMap.get(n.id) ?? 0),
      },
    })),
    edges: parentChildEdges.map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    })),
  }

  console.log("[tree] running ELK layout...")
  const layout = await elk.layout(graph)

  let layoutNodes = (layout.children ?? []).map((child) => ({
    id: child.id,
    x: child.x ?? 0,
    y: child.y ?? 0,
  }))

  layoutNodes = positionSpouses(layoutNodes, spouseEdges, parentChildEdges)
  layoutNodes = snapToGrid(layoutNodes, TIER_HEIGHT)
  layoutNodes = resolveOverlaps(layoutNodes, NODE_WIDTH, MIN_SIBLING_GAP)
  layoutNodes = centerTree(layoutNodes)

  const nodes = buildReactFlowNodes(layoutNodes, apiNodes)
  const edges = buildReactFlowEdges(apiEdges)

  console.log("[tree] layout done, nodes:", nodes.length, "first:", JSON.stringify(nodes[0]))
  console.log("[tree] edges:", edges.length, "first:", JSON.stringify(edges[0]))

  return { nodes, edges }
}

// --- Node & Edge type registrations ---

const nodeTypes = {
  personNode: PersonNode,
}

const edgeTypes = {
  parentChild: ParentChildEdge,
  spouse: SpouseEdge,
}

// --- Inner canvas (needs ReactFlowProvider context) ---

function FamilyTreeCanvasInner({
  nodes: apiNodes,
  edges: apiEdges,
  focusPersonId,
}: FamilyTreeCanvasProps) {
  const navigate = useNavigate()
  const { fitView, setCenter } = useReactFlow()
  const setFocusedPerson = useTreeStore((s) => s.setFocusedPerson)
  const setViewport = useTreeStore((s) => s.setViewport)
  const toggleDetailPanel = useUiStore((s) => s.toggleDetailPanel)
  const detailPanelOpen = useUiStore((s) => s.detailPanelOpen)
  const setCenterOnPerson = useTreeStore((s) => s.setCenterOnPerson)

  const [nodes, setNodes, onNodesChange] = useNodesState<PersonNodeType>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState<TreeEdge>([])
  const [layoutReady, setLayoutReady] = useState(false)

  // Compute layout when API data changes
  useEffect(() => {
    if (apiNodes.length === 0) return

    let cancelled = false

    getLayoutedElements(apiNodes, apiEdges)
      .then((result) => {
        if (cancelled) return
        console.log("[tree] calling setNodes with", result.nodes.length, "nodes")
        setNodes(result.nodes)
        setEdges(result.edges)
        setLayoutReady(true)
        console.log("[tree] setNodes/setEdges done, layoutReady=true")
      })
      .catch((err) => {
        console.error("Layout failed:", err)
      })

    return () => {
      cancelled = true
    }
  }, [apiNodes, apiEdges, setNodes, setEdges])

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
      const node = nodes.find((n) => n.id === personId)
      if (node) {
        setCenter(
          node.position.x + NODE_WIDTH / 2,
          node.position.y + NODE_HEIGHT / 2,
          { zoom: 1.2, duration: 600 },
        )
      }
    })
    return () => setCenterOnPerson(null)
  }, [layoutReady, nodes, setCenter, setCenterOnPerson])

  // Fit view once layout is ready
  useEffect(() => {
    if (!layoutReady || nodes.length === 0) return

    const timeout = setTimeout(() => {
      if (focusPersonId) {
        const focusNode = nodes.find((n) => n.id === focusPersonId)
        if (focusNode) {
          setCenter(
            focusNode.position.x + NODE_WIDTH / 2,
            focusNode.position.y + NODE_HEIGHT / 2,
            { zoom: 1.2, duration: 600 },
          )
          return
        }
      }
      fitView({ duration: 600, padding: 0.2 })
    }, 100)

    return () => clearTimeout(timeout)
  }, [layoutReady, nodes, focusPersonId, fitView, setCenter])

  const onNodeClick: NodeMouseHandler<PersonNodeType> = useCallback(
    (_event, node) => {
      setFocusedPerson(node.id)
      if (!detailPanelOpen) {
        toggleDetailPanel()
      }
      setCenter(
        node.position.x + NODE_WIDTH / 2,
        node.position.y + NODE_HEIGHT / 2,
        { zoom: 1.2, duration: 400 },
      )
    },
    [setFocusedPerson, detailPanelOpen, toggleDetailPanel, setCenter],
  )

  const onNodeDoubleClick: NodeMouseHandler<PersonNodeType> = useCallback(
    (_event, node) => {
      navigate({
        to: "/person/$personId",
        params: { personId: node.id },
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

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      onNodeDoubleClick={onNodeDoubleClick}
      onMoveEnd={onMoveEnd}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      fitView
      fitViewOptions={{ padding: 0.2 }}
      minZoom={0.1}
      maxZoom={2}
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
