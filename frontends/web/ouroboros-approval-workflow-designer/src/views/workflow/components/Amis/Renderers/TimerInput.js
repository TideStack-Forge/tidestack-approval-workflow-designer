import { FormItem } from 'ouroboros-sdk'
import React from 'react'

class TimerInput extends React.Component {
  constructor(props) {
    super(props)
    this.days = 0
    this.hours = 0
    this.minutes = 0
  }
  validate() {
    if (!this.days && !this.hours && !this.minutes) {
      return '请输入时间期限'
    }
  }
  handleChange(key, val) {
    this[key] = val
    const value = this.convertTimeToISO8601()
    this.props.onChange?.(value)
  }
  convertTimeToISO8601() {
    const { days, hours, minutes } = this
    let iso8601 = 'P'
    if (days > 0) {
      iso8601 += days + 'D'
    }
    if (hours > 0 || minutes > 0) {
      iso8601 += 'T'
      if (hours > 0) {
        iso8601 += hours + 'H'
      }
      if (minutes > 0) {
        iso8601 += minutes + 'M'
      }
    }
    return iso8601
  }
  convertISO8601ToTime(iso8601) {
    let result = {
      days: 0,
      hours: 0,
      minutes: 0,
    }
    // 检查 ISO 8601 时间间隔格式是否有效
    if (!/^P(?:\d+D)?(?:T(?:\d+H)?(?:\d+M)?)?$/.test(iso8601)) {
      return result
    }

    const daysRegex = /(\d+)D/i
    const daysMatch = daysRegex.exec(iso8601)
    result.days = daysMatch ? parseInt(daysMatch[1]) : 0

    const hoursRegex = /(\d+)H/i
    const hoursMatch = hoursRegex.exec(iso8601)
    result.hours = hoursMatch ? parseInt(hoursMatch[1]) : 0

    const minutesRegex = /(\d+)M/i
    const minutesMatch = minutesRegex.exec(iso8601)
    result.minutes = minutesMatch ? parseInt(minutesMatch[1]) : 0

    this.days = result.days
    this.hours = result.hours
    this.minutes = result.minutes
    return result
  }
  render() {
    const { render, value } = this.props
    const time = this.convertISO8601ToTime(value)
    const node = render('timer-input', [
      {
        type: 'input-group',
        label: '时间期限',
        body: [
          {
            type: 'input-number',
            label: false,
            placeholder: '天',
            suffix: '天',
            name: 'days',
            precision: 0,
            min: 0,
            clearable: true,
            value: time.days,
            onChange: this.handleChange.bind(this, 'days'),
          },
          {
            type: 'input-number',
            label: false,
            placeholder: '时间间隔',
            suffix: '小时',
            name: 'hours',
            max: 24,
            min: 0,
            precision: 0,
            clearable: true,
            value: time.hours,
            onChange: this.handleChange.bind(this, 'hours'),
          },
          {
            type: 'input-number',
            label: false,
            placeholder: '时间间隔',
            suffix: '分钟',
            max: 60,
            min: 0,
            precision: 0,
            name: 'minutes',
            value: time.minutes,
            clearable: true,
            onChange: this.handleChange.bind(this, 'minutes'),
          },
        ],
      },
    ])
    return node
  }
}
FormItem({
  type: 'timer-input',
  autoVar: true,
})(TimerInput)
export default TimerInput
