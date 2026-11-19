const hasOwn = (target, key) => Object.prototype.hasOwnProperty.call(target, key)

const isSuccessCode = (value) => value === 0 || value === '0'

const isHttpSuccessStatus = (value) =>
  Number.isInteger(value) && value >= 200 && value < 300

const isSuccessEnvelope = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  return (
    isSuccessCode(value.status) ||
    isSuccessCode(value.code) ||
    isSuccessCode(value.responseStatus)
  )
}

const isExplicitFailureEnvelope = (value) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  if (hasOwn(value, 'code')) {
    return !isSuccessCode(value.code)
  }

  if (hasOwn(value, 'responseStatus')) {
    return !isSuccessCode(value.responseStatus)
  }

  if (hasOwn(value, 'status')) {
    return !isSuccessCode(value.status) && !isHttpSuccessStatus(value.status)
  }

  return false
}

const unwrapSuccessEnvelopePayload = (value) => {
  if (!isSuccessEnvelope(value)) {
    return value
  }

  if (hasOwn(value, 'data')) {
    return unwrapSuccessEnvelopePayload(value.data)
  }

  if (hasOwn(value, 'responseData')) {
    return unwrapSuccessEnvelopePayload(value.responseData)
  }

  return null
}

export const unwrapFetcherResultData = (result, { throwOnFailure = false } = {}) => {
  if (throwOnFailure) {
    let envelope = result
    while (envelope && typeof envelope === 'object') {
      if (isExplicitFailureEnvelope(envelope)) {
        throw new Error(envelope.msg || envelope.message || '数据来源加载失败')
      }
      envelope = envelope.data ?? envelope.responseData
    }
  }
  if (result == null) {
    return null
  }

  if (typeof result !== 'object') {
    return result
  }

  if (isSuccessEnvelope(result)) {
    return unwrapSuccessEnvelopePayload(result)
  }

  if (isHttpSuccessStatus(result.status)) {
    if (isExplicitFailureEnvelope(result.data)) {
      return null
    }

    return unwrapSuccessEnvelopePayload(result.data)
  }

  if (hasOwn(result, 'data')) {
    if (isExplicitFailureEnvelope(result.data)) {
      return null
    }

    return unwrapSuccessEnvelopePayload(result.data)
  }

  return result
}
