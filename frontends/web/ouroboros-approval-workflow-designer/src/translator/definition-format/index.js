import { xinpaiToMiddleTranslator } from '../xinpai-middle/translator.js'
import { middleToDefinitionV2 as middleToV2Translator } from '../middle-v2/translator.js'
import { v2ToMiddleTranslator } from '../v2-middle/translator.js'
import { extractEditorLayoutFromV2 } from '../define/v2-extensions.js'
import { canonicalizePersistedDefinitionNodeTypes } from '../define/persistedNodeTypes.js'

export const DEFINITION_FORMAT_APPROVAL_METADATA = 'approval-workflow-metadata'

const buildFallbackEditorLayout = (definition) => {
  const nodePositions = (definition?.nodes || []).reduce((accumulator, node, index) => {
    accumulator[node.id] = {
      x: 0,
      y: index * 200,
    }
    return accumulator
  }, {})

  return {
    viewport: {
      x: 0,
      y: 0,
      zoom: 1,
    },
    nodePositions,
  }
}

export function detectDefinitionFormat(definition) {
  if (isApprovalWorkflowMetadata(definition)) {
    return DEFINITION_FORMAT_APPROVAL_METADATA
  }

  const rawFormatVersion = definition && definition.formatVersion
  const formatVersion =
    typeof rawFormatVersion === 'string' ? rawFormatVersion.trim() : rawFormatVersion

  if (formatVersion === undefined || formatVersion === null || formatVersion === '') {
    return 1
  }

  if (Number(formatVersion) === 1) {
    return 1
  }

  if (Number(formatVersion) === 2) {
    return 2
  }

  throw new Error(`Unsupported definition formatVersion: ${formatVersion}`)
}

export function isApprovalWorkflowMetadata(definition) {
  if (!definition || typeof definition !== 'object' || Array.isArray(definition)) {
    return false
  }

  const rawFormatVersion = definition.formatVersion
  const formatVersion =
    typeof rawFormatVersion === 'string' ? rawFormatVersion.trim() : rawFormatVersion

  if (Number(formatVersion) !== 1) {
    return false
  }

  return !!(
    definition.form && typeof definition.form === 'object' && !Array.isArray(definition.form)
  ) || Object.prototype.hasOwnProperty.call(definition, 'title')
}

const readMetadataFormId = (metadata) => {
  const form = metadata?.form || {}
  return Object.prototype.hasOwnProperty.call(form, 'formId')
    ? form.formId
    : form.formKey
}

export function metadataToDefinitionV2(metadata = {}) {
  return canonicalizePersistedDefinitionNodeTypes({
    formatVersion: 2,
    id: metadata.name,
    name: metadata.title,
    description: metadata.description || '',
    formType: metadata.form?.formType,
    formKey: readMetadataFormId(metadata),
    notification: metadata.notification,
    editorLayout: metadata.editorLayout,
    nodes: metadata.nodes || [],
    edges: metadata.edges || [],
  })
}

export function definitionV2ToMetadata(definition = {}, template = {}) {
  const formType = definition.formType ?? template.form?.formType ?? ''
  const formId = Object.prototype.hasOwnProperty.call(definition, 'formKey')
    ? definition.formKey
    : readMetadataFormId(template) ?? ''
  const metadata = {
    formatVersion: 1,
    name: definition.id || template.name || '',
    title: definition.name || template.title || definition.id || template.name || '',
    description: definition.description || template.description || '',
    version: template.version || definition.version || 1,
    enabled: Object.prototype.hasOwnProperty.call(template, 'enabled')
      ? template.enabled
      : Object.prototype.hasOwnProperty.call(definition, 'enabled')
        ? definition.enabled
        : true,
    form: {
      formType,
      formId,
    },
    nodes: definition.nodes || [],
    edges: definition.edges || [],
  }

  if (definition.notification || template.notification) {
    metadata.notification = definition.notification || template.notification
  }
  if (definition.editorLayout || template.editorLayout) {
    metadata.editorLayout = definition.editorLayout || template.editorLayout
  }

  return metadata
}

export function createDefinitionRequestSource(source) {
  if (!source) {
    return source
  }

  if (typeof source === 'string') {
    return source
  }

  if (!source.url) {
    return source
  }

  return {
    ...source,
    data: source.data ? { ...source.data } : source.data,
  }
}

const restoreLegacyEdgeNamesForTranslation = (originalDefinition, normalizedDefinition) => {
  if (!normalizedDefinition?.edges?.length || !originalDefinition?.edges?.length) {
    return normalizedDefinition
  }

  const originalEdgeNameById = new Map(
    originalDefinition.edges
      .filter((edge) => edge?.id && edge?.name)
      .map((edge) => [edge.id, edge.name])
  )

  if (!originalEdgeNameById.size) {
    return normalizedDefinition
  }

  return {
    ...normalizedDefinition,
    edges: normalizedDefinition.edges.map((edge) => ({
      ...edge,
      name: originalEdgeNameById.get(edge.id),
    })),
  }
}

export function definitionToMiddle(definition) {
  const sourceFormatVersion = detectDefinitionFormat(definition)
  const editorDefinition =
    sourceFormatVersion === DEFINITION_FORMAT_APPROVAL_METADATA
      ? metadataToDefinitionV2(definition)
      : definition
  const canonicalizedDefinition =
    sourceFormatVersion === 2 || sourceFormatVersion === DEFINITION_FORMAT_APPROVAL_METADATA
      ? canonicalizePersistedDefinitionNodeTypes(editorDefinition)
      : editorDefinition
  const normalizedDefinition =
    sourceFormatVersion === 2 || sourceFormatVersion === DEFINITION_FORMAT_APPROVAL_METADATA
      ? restoreLegacyEdgeNamesForTranslation(editorDefinition, canonicalizedDefinition)
      : canonicalizedDefinition
  const translated =
    sourceFormatVersion === 2 || sourceFormatVersion === DEFINITION_FORMAT_APPROVAL_METADATA
      ? v2ToMiddleTranslator(normalizedDefinition)
      : xinpaiToMiddleTranslator(normalizedDefinition)

  if (translated?.middleWorkflowGraph) {
    translated.middleWorkflowGraph.formType = normalizedDefinition?.formType
    translated.middleWorkflowGraph.editorLayout =
      extractEditorLayoutFromV2(normalizedDefinition) || buildFallbackEditorLayout(normalizedDefinition)
  }

  return {
    ...translated,
    sourceFormatVersion,
    editorDefinition: normalizedDefinition,
  }
}

export function middleToDefinitionV2(middleWorkflowGraph) {
  return middleToV2Translator(middleWorkflowGraph)
}

export function shouldNotifyV1Upgrade(definition, isReadonly) {
  return !isReadonly && detectDefinitionFormat(definition) === 1
}
