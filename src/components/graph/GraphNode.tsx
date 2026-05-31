"use client";

import { Handle, Position, type NodeProps } from "@xyflow/react";

interface GraphNodeData {
  label: string;
  nodeType: string;
  status?: string;
  subtitle?: string;
  color: string;
  isSummary?: boolean;
  [key: string]: unknown;
}

export function GraphNode({ data }: NodeProps) {
  const nodeData = data as GraphNodeData;
  const isSummary = nodeData.isSummary === true;

  return (
    <div
      className={`rounded-lg border-2 bg-white px-3 py-2 shadow-sm min-w-[120px] max-w-[200px] cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md hover:ring-1 hover:ring-zinc-300 ${isSummary ? "border-dashed opacity-70" : ""}`}
      style={{ borderColor: nodeData.color }}
    >
      <Handle type="target" position={Position.Left} className="!bg-zinc-400" />
      <div className="flex items-center gap-1.5 mb-0.5">
        <div
          className="h-2 w-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: nodeData.color }}
        />
        <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">
          {nodeData.nodeType}
        </span>
        {!isSummary && (
          <svg className="ml-auto h-3 w-3 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        )}
        {isSummary && (
          <svg className="ml-auto h-3 w-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
      <p className={`text-xs font-medium leading-tight truncate ${isSummary ? "text-zinc-500 italic" : "text-zinc-900"}`}>
        {nodeData.label}
      </p>
      {nodeData.subtitle && (
        <p className="text-[10px] text-zinc-500 truncate">{nodeData.subtitle}</p>
      )}
      {nodeData.status && (
        <span className="mt-1 inline-block rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">
          {String(nodeData.status).replace(/_/g, " ")}
        </span>
      )}
      <Handle type="source" position={Position.Right} className="!bg-zinc-400" />
    </div>
  );
}
