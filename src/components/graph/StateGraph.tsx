"use client";

import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  MarkerType,
  type NodeTypes,
  type ReactFlowInstance,
  type Viewport,
  useOnViewportChange,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GraphNode } from "./GraphNode";
import { NodeEditModal } from "./NodeEditModal";

interface GoalData {
  id: string;
  title: string;
  status: string;
  prerequisites: { id: string; title: string; status: string; evidence: { id: string; title: string }[] }[];
  actions: { id: string; title: string; status: string }[];
}

interface StakeholderData {
  id: string;
  name: string;
  organization: string | null;
}

interface RelationshipData {
  id: string;
  fromType: string;
  fromId: string;
  toType: string;
  toId: string;
  label: string | null;
}

const nodeTypes: NodeTypes = {
  graphNode: GraphNode,
};

const typeColors: Record<string, string> = {
  GOAL: "#10b981",
  PREREQUISITE: "#f59e0b",
  EVIDENCE: "#3b82f6",
  ACTION: "#8b5cf6",
  STAKEHOLDER: "#ec4899",
};

const STAKEHOLDER_COLS = 4;
const STAKEHOLDER_COL_W = 210;
const STAKEHOLDER_ROW_H = 90;
const STAKEHOLDER_COMPACT_THRESHOLD = 6;

const VIEWPORT_STORAGE_KEY = "goalos-graph-viewport";
const NODE_POSITIONS_STORAGE_KEY = "goalos-graph-node-positions";

type NodePositions = Record<string, { x: number; y: number }>;

function saveNodePositions(positions: NodePositions) {
  try {
    sessionStorage.setItem(NODE_POSITIONS_STORAGE_KEY, JSON.stringify(positions));
  } catch {
    // sessionStorage unavailable
  }
}

function loadNodePositions(): NodePositions {
  try {
    const raw = sessionStorage.getItem(NODE_POSITIONS_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as NodePositions;
  } catch {
    // ignore
  }
  return {};
}

function saveViewport(viewport: Viewport) {
  try {
    sessionStorage.setItem(VIEWPORT_STORAGE_KEY, JSON.stringify(viewport));
  } catch {
    // sessionStorage unavailable
  }
}

function loadViewport(): Viewport | null {
  try {
    const raw = sessionStorage.getItem(VIEWPORT_STORAGE_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Viewport;
    if (typeof v.x === "number" && typeof v.y === "number" && typeof v.zoom === "number") {
      return v;
    }
  } catch {
    // ignore
  }
  return null;
}

function ViewportPersistence() {
  useOnViewportChange({
    onChange: (viewport: Viewport) => {
      saveViewport(viewport);
    },
  });
  return null;
}

export function StateGraph() {
  const [goals, setGoals] = useState<GoalData[]>([]);
  const [stakeholders, setStakeholders] = useState<StakeholderData[]>([]);
  const [relationships, setRelationships] = useState<RelationshipData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllStakeholders, setShowAllStakeholders] = useState(false);
  const [editNode, setEditNode] = useState<{ id: string; type: string } | null>(null);
  const hasRestoredViewport = useRef(false);
  const [nodePositions, setNodePositions] = useState<NodePositions>({});
  const hasCustomLayout = Object.keys(nodePositions).length > 0;

  const handleInit = useCallback((instance: ReactFlowInstance) => {
    const saved = loadViewport();
    if (saved && !hasRestoredViewport.current) {
      instance.setViewport(saved);
      hasRestoredViewport.current = true;
    } else {
      instance.fitView();
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const [goalsRes, stakeholdersRes, relsRes] = await Promise.all([
        fetch("/api/goals"),
        fetch("/api/stakeholders"),
        fetch("/api/relationships"),
      ]);
      const [g, s, r] = await Promise.all([
        goalsRes.json(),
        stakeholdersRes.json(),
        relsRes.json(),
      ]);
      if (!cancelled) {
        setGoals(g);
        setStakeholders(s);
        setRelationships(r);
        setNodePositions(loadNodePositions());
        setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let yGoal = 0;

    for (const goal of goals) {
      const goalX = 0;
      const goalY = yGoal;

      nodes.push({
        id: goal.id,
        type: "graphNode",
        position: { x: goalX, y: goalY },
        data: {
          label: goal.title,
          nodeType: "GOAL",
          status: goal.status,
          color: typeColors.GOAL,
        },
      });

      let prereqY = goalY - (goal.prerequisites.length * 80) / 2;
      for (const prereq of goal.prerequisites) {
        nodes.push({
          id: prereq.id,
          type: "graphNode",
          position: { x: goalX + 300, y: prereqY },
          data: {
            label: prereq.title,
            nodeType: "PREREQUISITE",
            status: prereq.status,
            color: typeColors.PREREQUISITE,
          },
        });
        edges.push({
          id: `${goal.id}-${prereq.id}`,
          source: goal.id,
          target: prereq.id,
          label: "requires",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: typeColors.PREREQUISITE },
        });

        let evY = prereqY - (prereq.evidence.length * 60) / 2;
        for (const ev of prereq.evidence) {
          nodes.push({
            id: ev.id,
            type: "graphNode",
            position: { x: goalX + 600, y: evY },
            data: {
              label: ev.title,
              nodeType: "EVIDENCE",
              color: typeColors.EVIDENCE,
            },
          });
          edges.push({
            id: `${prereq.id}-${ev.id}`,
            source: prereq.id,
            target: ev.id,
            label: "evidenced by",
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: typeColors.EVIDENCE },
          });
          evY += 70;
        }
        prereqY += 90;
      }

      let actionY = goalY;
      for (const action of goal.actions) {
        nodes.push({
          id: action.id,
          type: "graphNode",
          position: { x: goalX - 300, y: actionY },
          data: {
            label: action.title,
            nodeType: "ACTION",
            status: action.status,
            color: typeColors.ACTION,
          },
        });
        edges.push({
          id: `${goal.id}-${action.id}`,
          source: goal.id,
          target: action.id,
          label: "action",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: typeColors.ACTION },
        });
        actionY += 80;
      }

      yGoal += Math.max(
        goal.prerequisites.length * 90,
        goal.actions.length * 80,
        200
      );
    }

    // Determine which stakeholders have graph relationships
    const connectedStakeholderIds = new Set(
      relationships
        .filter((r) => r.fromType === "STAKEHOLDER" || r.toType === "STAKEHOLDER")
        .flatMap((r) => [r.fromId, r.toId])
    );
    const connectedStakeholders = stakeholders.filter((s) =>
      connectedStakeholderIds.has(s.id)
    );
    const unconnectedStakeholders = stakeholders.filter(
      (s) => !connectedStakeholderIds.has(s.id)
    );

    const useCompact = stakeholders.length > STAKEHOLDER_COMPACT_THRESHOLD;
    const visibleStakeholders =
      useCompact && !showAllStakeholders
        ? connectedStakeholders
        : stakeholders;

    // Grid layout for stakeholders
    for (let i = 0; i < visibleStakeholders.length; i++) {
      const col = i % STAKEHOLDER_COLS;
      const row = Math.floor(i / STAKEHOLDER_COLS);
      nodes.push({
        id: visibleStakeholders[i].id,
        type: "graphNode",
        position: {
          x: 900 + col * STAKEHOLDER_COL_W,
          y: row * STAKEHOLDER_ROW_H,
        },
        data: {
          label: visibleStakeholders[i].name,
          nodeType: "STAKEHOLDER",
          subtitle: visibleStakeholders[i].organization,
          color: typeColors.STAKEHOLDER,
        },
      });
    }

    // Summary node for hidden stakeholders
    if (useCompact && !showAllStakeholders && unconnectedStakeholders.length > 0) {
      const summaryRow = Math.ceil(connectedStakeholders.length / STAKEHOLDER_COLS);
      nodes.push({
        id: "__stakeholder_summary",
        type: "graphNode",
        position: { x: 900, y: summaryRow * STAKEHOLDER_ROW_H },
        data: {
          label: `+${unconnectedStakeholders.length} more stakeholder${unconnectedStakeholders.length !== 1 ? "s" : ""}`,
          nodeType: "STAKEHOLDER",
          color: typeColors.STAKEHOLDER,
          isSummary: true,
        },
      });
    }

    for (const rel of relationships) {
      const sourceExists = nodes.some((n) => n.id === rel.fromId);
      const targetExists = nodes.some((n) => n.id === rel.toId);
      if (sourceExists && targetExists) {
        edges.push({
          id: rel.id,
          source: rel.fromId,
          target: rel.toId,
          label: rel.label || undefined,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "#94a3b8", strokeDasharray: "4 2" },
        });
      }
    }

    const positionedNodes = nodes.map((n) =>
      nodePositions[n.id] ? { ...n, position: nodePositions[n.id] } : n
    );

    return { initialNodes: positionedNodes, initialEdges: edges };
  }, [goals, stakeholders, relationships, showAllStakeholders, nodePositions]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edgesState, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const handleNodeClick = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (node.id === "__stakeholder_summary") {
        setShowAllStakeholders(true);
        return;
      }
      const nodeType = (node.data as { nodeType?: string }).nodeType;
      if (nodeType) {
        setEditNode({ id: node.id, type: nodeType });
      }
    },
    []
  );

  const handleNodeDragStop = useCallback(
    (_event: React.MouseEvent, _node: Node, draggedNodes: Node[]) => {
      const next = { ...nodePositions };
      for (const n of draggedNodes) {
        next[n.id] = { x: n.position.x, y: n.position.y };
      }
      setNodePositions(next);
      saveNodePositions(next);
    },
    [nodePositions]
  );

  const handleResetLayout = useCallback(() => {
    saveNodePositions({});
    setNodePositions({});
  }, []);

  const reloadData = useCallback(async () => {
    const [goalsRes, stakeholdersRes, relsRes] = await Promise.all([
      fetch("/api/goals"),
      fetch("/api/stakeholders"),
      fetch("/api/relationships"),
    ]);
    const [g, s, r] = await Promise.all([
      goalsRes.json(),
      stakeholdersRes.json(),
      relsRes.json(),
    ]);
    setGoals(g);
    setStakeholders(s);
    setRelationships(r);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-200 border-t-zinc-800" />
      </div>
    );
  }

  if (goals.length === 0 && stakeholders.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-56px)]">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-zinc-700 mb-2">
            No data to visualize
          </h2>
          <p className="text-sm text-zinc-500">
            Create goals and stakeholders to see your state graph.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-56px)] relative">
      <ReactFlow
        nodes={nodes}
        edges={edgesState}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        nodeTypes={nodeTypes}
        onInit={handleInit}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e4e4e7" gap={20} />
        <Controls />
        <ViewportPersistence />
      </ReactFlow>

      <div className="absolute top-4 right-4 z-10 flex gap-2">
        {hasCustomLayout && (
          <button
            onClick={handleResetLayout}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm border border-zinc-200 hover:bg-zinc-50"
          >
            Reset layout
          </button>
        )}
        {stakeholders.length > STAKEHOLDER_COMPACT_THRESHOLD && (
          <button
            onClick={() => setShowAllStakeholders((v) => !v)}
            className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm border border-zinc-200 hover:bg-zinc-50"
          >
            {showAllStakeholders
              ? "Hide unlinked stakeholders"
              : `Show all ${stakeholders.length} stakeholders`}
          </button>
        )}
      </div>

      {editNode && (
        <NodeEditModal
          nodeId={editNode.id}
          nodeType={editNode.type as "GOAL" | "PREREQUISITE" | "ACTION" | "EVIDENCE" | "STAKEHOLDER"}
          onClose={() => setEditNode(null)}
          onSaved={reloadData}
        />
      )}

      <div className="absolute bottom-4 left-4 flex gap-2 rounded-lg bg-white/90 p-2 shadow-sm backdrop-blur-sm">
        {Object.entries(typeColors).map(([type, color]) => (
          <div key={type} className="flex items-center gap-1.5 text-xs text-zinc-600">
            <div
              className="h-3 w-3 rounded-full"
              style={{ backgroundColor: color }}
            />
            {type.charAt(0) + type.slice(1).toLowerCase()}
          </div>
        ))}
      </div>
    </div>
  );
}
