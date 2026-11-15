import { v1 } from 'uuid'

// 根据时间戳和 MAC 地址生成 UUID
export default function getUUID(prefix = 'flow') {
  const uuid = v1()
  const uuidArr = uuid.split('-')
  return (prefix || '') + uuidArr.join('')
}
