import type { OrbitalEdge } from "./orbitalTypes"

interface Props {
  edges: OrbitalEdge[]
  highlightedEdgeIds?: Set<string>
}

export function OrbitalEdges({ edges, highlightedEdgeIds }: Props) {
  return (
    <g className="orbital-edges" pointerEvents="none">
      {edges.map((e) => {
        const isHighlighted = highlightedEdgeIds?.has(e.id) ?? false
        return (
          <path
            key={e.id}
            d={e.path}
            fill="none"
            stroke="currentColor"
            strokeOpacity={isHighlighted ? 0.9 : e.type === "ancestor" ? 0.5 : 0.4}
            strokeWidth={isHighlighted ? 2 : 1}
          />
        )
      })}
    </g>
  )
}
