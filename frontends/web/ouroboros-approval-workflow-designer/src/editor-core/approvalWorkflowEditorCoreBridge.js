import React, { createContext, useContext } from 'react'
import {
  createReadonlyCoreCapabilities,
  normalizeApprovalWorkflowEditorCoreCapabilities,
} from './coreContract'

export const ApprovalWorkflowEditorCoreBridgeContext = createContext({
  fetcher: null,
  flowKey: null,
  nodeConfig: {},
  toolbarSurface: {
    baseInfoEntry: null,
  },
  candidateSource: {
    revisionToken: '__empty__',
    items: [],
  },
  formPermissionFieldSource: {
    revisionToken: '__empty__',
    fields: [],
  },
  candidateFieldSource: {
    revisionToken: '__empty__',
    fields: [],
  },
  formType: null,
  readonly: false,
  coreCapabilities: createReadonlyCoreCapabilities(),
})

export const ApprovalWorkflowEditorCoreBridgeProvider = ({ value, children }) => {
  return (
    <ApprovalWorkflowEditorCoreBridgeContext.Provider value={value}>
      {children}
    </ApprovalWorkflowEditorCoreBridgeContext.Provider>
  )
}

export const useApprovalWorkflowEditorCoreBridge = () => {
  return useContext(ApprovalWorkflowEditorCoreBridgeContext)
}

export const normalizeApprovalWorkflowEditorCoreBridgeContext = ({
  data,
  env,
  nodeConfig = {},
  readonly,
  coreCapabilities,
}) => {
  const normalizedCoreCapabilities = readonly
    ? createReadonlyCoreCapabilities()
    : normalizeApprovalWorkflowEditorCoreCapabilities(coreCapabilities, readonly)

  return {
    fetcher: env?.fetcher,
    flowKey: data?.flowKey,
    nodeConfig,
    candidateSource: data?.candidateSource || {
      revisionToken: '__empty__',
      items: [],
    },
    formPermissionFieldSource: data?.formPermissionFieldSource || {
      revisionToken: '__empty__',
      fields: [],
    },
    candidateFieldSource: data?.candidateFieldSource || {
      revisionToken: '__empty__',
      fields: [],
    },
    formType: data?.formType ?? data?.flowDefinition?.formType ?? null,
    readonly,
    coreCapabilities: normalizedCoreCapabilities,
  }
}
