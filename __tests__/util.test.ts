import nock from 'nock'
import * as tc from '@actions/tool-cache'
import * as core from '@actions/core'

import {download, getLatestVersion} from '../src/util'

jest.mock('os', () => ({
  ...jest.requireActual('os'),
  arch: jest.fn(),
  type: jest.fn()
}))
jest.mock('@actions/tool-cache')
jest.mock('@actions/core')

// eslint-disable-next-line @typescript-eslint/no-require-imports
const os = require('os')
const mockedTc = jest.mocked(tc)
const mockedCore = jest.mocked(core)

describe('download', () => {
  beforeEach(() => {
    jest.resetAllMocks()
  })

  it('should return cached path if tool is already cached', async () => {
    mockedTc.find.mockReturnValue('/cached/path')

    const result = await download('gator', 'v3.7.1')

    expect(result).toBe('/cached/path')
    expect(mockedTc.find).toHaveBeenCalledWith('gator', 'v3.7.1')
    expect(mockedTc.downloadTool).not.toHaveBeenCalled()
    expect(mockedCore.info).toHaveBeenCalledWith('Found in cache /cached/path')
  })

  it('should download, extract and cache on Darwin x64', async () => {
    os.arch.mockReturnValue('x64')
    os.type.mockReturnValue('Darwin')
    mockedTc.find.mockReturnValue('')
    mockedTc.downloadTool.mockResolvedValue('/tmp/download')
    mockedTc.extractTar.mockResolvedValue('/tmp/extracted')
    mockedTc.cacheDir.mockResolvedValue('/cached/gator')

    const result = await download('gator', 'v3.7.1')

    expect(result).toBe('/cached/gator')
    expect(mockedTc.downloadTool).toHaveBeenCalledWith(
      'https://github.com/open-policy-agent/gatekeeper/releases/download/v3.7.1/gator-v3.7.1-darwin-amd64.tar.gz'
    )
    expect(mockedTc.extractTar).toHaveBeenCalledWith('/tmp/download')
    expect(mockedTc.cacheDir).toHaveBeenCalledWith(
      '/tmp/extracted',
      'gator',
      'v3.7.1'
    )
  })

  it('should download on Linux arm64', async () => {
    os.arch.mockReturnValue('arm64')
    os.type.mockReturnValue('Linux')
    mockedTc.find.mockReturnValue('')
    mockedTc.downloadTool.mockResolvedValue('/tmp/download')
    mockedTc.extractTar.mockResolvedValue('/tmp/extracted')
    mockedTc.cacheDir.mockResolvedValue('/cached/gator')

    const result = await download('gator', 'v3.7.1')

    expect(result).toBe('/cached/gator')
    expect(mockedTc.downloadTool).toHaveBeenCalledWith(
      'https://github.com/open-policy-agent/gatekeeper/releases/download/v3.7.1/gator-v3.7.1-linux-arm64.tar.gz'
    )
  })

  it('should throw on unsupported architecture', async () => {
    os.arch.mockReturnValue('s390x')
    os.type.mockReturnValue('Linux')
    mockedTc.find.mockReturnValue('')

    await expect(download('gator', 'v3.7.1')).rejects.toThrow(
      'Unsupported architecture: s390x'
    )
  })

  it('should throw on unsupported OS', async () => {
    os.arch.mockReturnValue('x64')
    os.type.mockReturnValue('Windows_NT')
    mockedTc.find.mockReturnValue('')

    await expect(download('gator', 'v3.7.1')).rejects.toThrow(
      'Unsupported OS: Windows_NT'
    )
  })
})

describe('get the latest version', () => {
  let mock: nock.Interceptor

  beforeEach(() => {
    mock = nock('https://api.github.com').get(
      '/repos/open-policy-agent/gatekeeper/releases/latest'
    )
  })

  it('should be ok', async () => {
    mock.reply(200, {
      tag_name: 'v3.7.1'
    })

    const version = await getLatestVersion()

    expect(version).toBe('v3.7.1')
  })

  it('should throw an error if github response invalid json', async () => {
    mock.reply(200, 'invalid-json')

    await expect(getLatestVersion()).rejects.toThrow(
      'Failed to parse latest version'
    )
  })

  it('should throw an error if github response invalid version', async () => {
    mock.reply(200, {tag_name: 'invalid-version'})

    await expect(getLatestVersion()).rejects.toThrow(
      'Latest version is not a valid version'
    )
  })

  it('should throw an error if github response 404', async () => {
    mock.reply(404, {})

    await expect(getLatestVersion()).rejects.toThrow(
      'Failed to get latest version'
    )
  })
})
