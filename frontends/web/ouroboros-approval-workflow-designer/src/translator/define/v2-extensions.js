/**
 * Persisted V2 editor metadata helpers.
 * Only nodePositions belongs to the stable definition metadata.
 */

/**
 * Add persisted editor layout metadata to a V2 definition.
 * @param {Object} v2Definition - V2 flow definition
 * @param {Object} editorLayout - Layout metadata { nodePositions }
 * @returns {Object} V2 definition with persisted editor layout
 */
export function addEditorLayoutToV2(v2Definition, editorLayout) {
  if (!v2Definition) {
    throw new Error('v2Definition is required')
  }

  if (editorLayout) {
    v2Definition.editorLayout = {
      nodePositions: editorLayout.nodePositions || {},
    }
  }

  return v2Definition
}

/**
 * Extract persisted editor layout from a V2 definition.
 * Legacy definitions may still carry viewport; keep it as session state only.
 * @param {Object} v2Definition - V2 flow definition
 * @returns {Object|null} Editor layout metadata or null if not present
 */
export function extractEditorLayoutFromV2(v2Definition) {
  if (!v2Definition || !v2Definition.editorLayout) {
    return null
  }

  return {
    nodePositions: v2Definition.editorLayout.nodePositions || {},
    viewport: v2Definition.editorLayout.viewport || { x: 0, y: 0, zoom: 1 },
  }
}

/**
 * Generate deterministic initial positions for nodes without layout metadata
 * @param {Array} nodes - V2 nodes array
 * @returns {Object} nodePositions map { [nodeId]: { x, y } }
 */
export function generateInitialPositions(nodes) {
  const positions = {}
  const HORIZONTAL_SPACING = 200
  const VERTICAL_SPACING = 100
  const START_X = 100
  const START_Y = 100

  nodes.forEach((node, index) => {
    positions[node.id] = {
      x: START_X + (index % 3) * HORIZONTAL_SPACING,
      y: START_Y + Math.floor(index / 3) * VERTICAL_SPACING,
    }
  })

  return positions
}
