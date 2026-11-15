const React = require('react')
const ReactDOM = require('react-dom')

window.React = React
window.ReactDOM = ReactDOM

const { mountHarnessApp } = require('./App.js')

const container = document.getElementById('playwright-harness-root')

mountHarnessApp(container)
