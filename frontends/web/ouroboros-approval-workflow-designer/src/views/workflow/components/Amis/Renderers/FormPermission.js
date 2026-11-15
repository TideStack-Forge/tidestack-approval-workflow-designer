import { t } from '../../../../../i18n.js'
import { FormItem } from 'ouroboros-sdk'
import React from 'react'
import {
  mergeWorkflowFormPermissionRows,
  normalizeWorkflowFormPermissionItem,
  normalizeWorkflowFormPermissionValues,
  resolveWorkflowFormPermissionFieldKey,
} from '../../../../../editor-core/workflowFormPermissionDefaults.js'

class FormPermission extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      formList: [], // 表单项
    }
  }

  componentDidMount() {
    this.fetchPermissionList()
  }
  async fetchPermissionList() {
    const { value } = this.props
    const formList = mergeWorkflowFormPermissionRows(this.props.options, value)
    this.setState({ formList })
  }

  getValues(item) {
    const mergedArray = Object.values(
      [
        ...normalizeWorkflowFormPermissionValues(this.state.formList),
        ...normalizeWorkflowFormPermissionValues(this.props.value),
        item,
      ].reduce((acc, obj) => {
        const name = resolveWorkflowFormPermissionFieldKey(obj)
        if (!name) {
          return acc
        }
        acc[name] = { ...acc[name], ...normalizeWorkflowFormPermissionItem(obj) }
        return acc
      }, {})
    )
    return mergedArray
  }
  handleCheckboxChange(key, checked, item) {
    item[key] = checked
    const values = this.getValues(item)
    this.props.onChange?.(values)
  }
  renderItem(item) {
    const { visible = true, writable = false, required = false } = item
    const { static: formStatic } = this.props
    const itemNode = (
      <tr key={item.name}>
        <td>{t(item.label)}</td>
        <td>
          <input
            type="checkbox"
            name="visible"
            checked={visible}
            disabled={formStatic}
            className="w-full block"
            onChange={(e) => this.handleCheckboxChange('visible', e.target.checked, item)}
          />
        </td>
        <td>
          <input
            type="checkbox"
            name="writable"
            checked={writable && visible}
            disabled={formStatic || !visible}
            className="w-full block"
            onChange={(e) =>
              this.handleCheckboxChange('writable', e.target.checked, item)
            }
          />
        </td>
        <td>
          <input
            type="checkbox"
            name="required"
            checked={required && visible && writable}
            disabled={formStatic || !writable || !visible}
            className="w-full block"
            onChange={(e) =>
              this.handleCheckboxChange('required', e.target.checked, item)
            }
          />
        </td>
      </tr>
    )
    return itemNode
  }
  render() {
    const { classnames: cx } = this.props
    const { formList = [] } = this.state
    const node = (
      <div>
        <table className={cx('Table-table')}>
          <thead>
            <tr>
              <th>{t('字段')}</th>
              <th>{t('可见')}</th>
              <th>{t('可写')}</th>
              <th>{t('必填')}</th>
            </tr>
          </thead>
          <tbody>
            {formList.length > 0
              ? formList.map((item, index) => this.renderItem(item, index))
              : null}
          </tbody>
        </table>
      </div>
    )

    return node
  }
}

FormItem({
  type: 'form-permission',
  autoVar: true,
})(FormPermission)

export default FormPermission
