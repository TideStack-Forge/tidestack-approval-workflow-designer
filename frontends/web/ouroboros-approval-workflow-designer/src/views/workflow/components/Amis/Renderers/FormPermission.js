import { t } from '../../../../../i18n.js'
import { FormItem } from 'ouroboros-sdk'
import React from 'react'
import { isEqual } from 'lodash'
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
  componentDidUpdate(previousProps) {
    if (
      !isEqual(previousProps.options, this.props.options) ||
      !isEqual(previousProps.value, this.props.value)
    ) {
      this.fetchPermissionList()
    }
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
    const fieldNames = new Set(
      (this.props.options || []).map(resolveWorkflowFormPermissionFieldKey)
    )
    const missingFields = normalizeWorkflowFormPermissionValues(this.props.value).filter(
      (item) => !fieldNames.has(item.name)
    )
    const node = (
      <div>
        {missingFields.length > 0 ? (
          <div role="alert" className={cx('Alert', 'Alert--warning')}>
            {t('以下字段已不在当前表单中：')}
            {missingFields.map((item) => item.name).join('、')}
            {!this.props.static ? (
              <button
                type="button"
                className={cx('Button', 'Button--link')}
                onClick={() =>
                  this.props.onChange?.(
                    normalizeWorkflowFormPermissionValues(this.props.value).filter(
                      (item) => fieldNames.has(item.name)
                    )
                  )
                }
              >
                {t('移除失效配置')}
              </button>
            ) : null}
          </div>
        ) : null}
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
