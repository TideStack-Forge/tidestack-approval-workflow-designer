import { renderAmisSchema } from 'ouroboros-sdk'

export default async function toast(args) {
  const container = document.createElement('div')
  container.setAttribute('id', 'toastWrapper')

  const toastContainer = document.createElement('div')
  container.appendChild(toastContainer)

  container.style.display = 'none'
  document.body.appendChild(container)

  try {
    const toastScope = await renderAmisSchema(toastContainer)
    if (typeof toastScope?.doAction !== 'function') {
      return false
    }

    toastScope.doAction({
      actionType: 'toast',
      args: {
        ...args,
      },
    })
    return true
  } catch {
    return false
  }
}
