const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)

// Mirrors the "@/*" -> "src/*" path mapping declared in tsconfig.json.
config.resolver.extraNodeModules = {
  '@': path.resolve(__dirname, 'src'),
}

module.exports = config
