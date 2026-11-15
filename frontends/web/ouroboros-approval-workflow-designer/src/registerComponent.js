import { FormItem } from 'ouroboros-sdk'
import { ApprovalWorkFlowEditor } from './editor-core/ApprovalWorkFlowEditor'

FormItem({
  type: 'workflow-editor',
  autoVar: true,
})(ApprovalWorkFlowEditor)

export { ApprovalWorkFlowEditor }
