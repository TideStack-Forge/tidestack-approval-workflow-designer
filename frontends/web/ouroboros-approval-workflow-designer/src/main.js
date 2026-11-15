import { initAmisComponentLib } from 'ouroboros-sdk'
import './registerComponent'
import './views/workflow/components/Amis/Renderers'

// --------- sdk导出生命周期------------ //
const {
  bootstrap: sdkBootstrap,
  mount: sdkMount,
  update: sdkUpdate,
  unmount,
} = initAmisComponentLib({})

const bootstrap = (props) => {
  return sdkBootstrap(props)
}

const mount = (props) => {
  return sdkMount(props)
}

const update = (props) => {
  return sdkUpdate(props)
}

export { bootstrap, mount, update, unmount }
