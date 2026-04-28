// Compression tiers (Issue 3): thresholds for sibling-count-driven spacing
export const SIBLING_TIER_NORMAL_MAX = 6
export const SIBLING_TIER_TIGHT_MAX = 11
// Gaps per tier
export const MIN_SIBLING_GAP_NORMAL = 60
export const MIN_SIBLING_GAP_TIGHT = 20
export const MIN_SIBLING_GAP_COMPACT = 16
// Compact tile dimensions
export const PERSON_WIDTH_COMPACT = 120
export const COUPLE_NODE_WIDTH_COMPACT = 240

// Spouse generation offset (Issue 1): visual Y-shift per generation difference
export const SPOUSE_GEN_OFFSET_PX = 14
export const SPOUSE_GEN_OFFSET_CLAMP = 3

// Edge router (Issue 4)
export const EDGE_OBSTACLE_MARGIN = 8
export const EDGE_CORNER_RADIUS = 8
export const EDGE_Y_SCAN_STEP = 4

// Branch lanes (Issue 2): center column reserved for self + descendants
export const LANE_CENTER_HALF_WIDTH = 80   // canonical-coord half-width of the center column
