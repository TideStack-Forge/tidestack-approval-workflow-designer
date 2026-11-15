function throttle(fn, delay) {
  let timer = null
  return function () {
    if (timer) return
    timer = setTimeout(() => {
      fn.apply(this, arguments)
      timer = null
    }, delay)
  }
}

function debounce(fn, delay) {
  let timer = null
  return function () {
    clearTimeout(timer)
    timer = setTimeout(() => {
      fn.apply(this, arguments)
    }, delay)
  }
}

async function normalizeElePromise(promise) {
  if (promise instanceof Function) return normalizeElePromise(await promise())
  try {
    return await promise
  } catch (err) {
    return err
  }
}

export { throttle, debounce, normalizeElePromise }
