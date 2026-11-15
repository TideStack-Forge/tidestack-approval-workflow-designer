export function createMockEnv(callbacks = {}) {
  const notifications = []
  const fetcherCalls = []
  const savedDefinitions = []
  const dialogResponses = []
  const drawerResponses = []
  const drawerRequests = []
  const confirmResponses = []

  const { onNotify, onFetcher, onSave, onDrawer, fetcherResponses = {} } = callbacks
  let activeFetcherResponses = fetcherResponses

  const resolveResponse = (request) => {
    const requestUrl = request?.url || request
    if (!requestUrl) {
      return null
    }
    const response = activeFetcherResponses[requestUrl]
    if (typeof response === 'function') {
      return response(request)
    }
    return response || null
  }

  return {
    notifications,
    fetcherCalls,
    savedDefinitions,
    dialogResponses,
    drawerResponses,
    drawerRequests,
    confirmResponses,
    recordDrawerRequest(request) {
      drawerRequests.push(request)
      onDrawer?.(drawerRequests)
    },
    reset(nextConfig = {}) {
      notifications.length = 0
      fetcherCalls.length = 0
      savedDefinitions.length = 0
      dialogResponses.length = 0
      drawerResponses.length = 0
      drawerRequests.length = 0
      confirmResponses.length = 0
      activeFetcherResponses = nextConfig.fetcherResponses || {}
      onNotify?.(notifications)
      onFetcher?.(fetcherCalls)
      onSave?.(savedDefinitions)
      onDrawer?.(drawerRequests)
    },
    env: {
      async fetcher(request) {
        fetcherCalls.push(request)
        onFetcher?.(fetcherCalls)
        const response = await resolveResponse(request)
        if (response) {
          return response
        }
        return {
          status: 0,
          data: [],
        }
      },
      notify(type, message) {
        notifications.push({
          type,
          message,
        })
        onNotify?.(notifications)
      },
    },
    onSave(definition) {
      savedDefinitions.push(definition)
      onSave?.(savedDefinitions)
    },
    onValidate() {
      return true
    },
  }
}
