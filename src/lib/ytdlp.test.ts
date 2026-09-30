import assert from 'node:assert/strict'
import test from 'node:test'
import {buildChoices, type VideoInfo} from './ytdlp.js'

const audio = {format_id: 'a', ext: 'm4a', vcodec: 'none', acodec: 'mp4a', abr: 128, filesize: 3_000_000}

test('video sizes prefer formats that report one', () => {
  const info: VideoInfo = {
    title: 't',
    duration: 200,
    formats: [
      audio,
      {format_id: 'hls', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 1080, tbr: 4000},
      {format_id: 'dash', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 1080, tbr: 3000, filesize: 80_000_000},
    ],
  }
  const [video] = buildChoices(info)
  assert.equal(video!.label, '1080p · mp4 · ~79 MB')
})

test('video sizes fall back to bitrate × duration', () => {
  const info: VideoInfo = {
    title: 't',
    duration: 100,
    formats: [audio, {format_id: 'hls', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 720, tbr: 1000}],
  }
  const [video] = buildChoices(info)
  // 1000 kbps × 100 s = 12.5 MB, plus 3 MB audio
  assert.equal(video!.label, '720p · mp4 · ~15 MB')
})

test('an unknown video size never shows just the audio size', () => {
  const info: VideoInfo = {
    title: 't',
    formats: [audio, {format_id: 'v', ext: 'mp4', vcodec: 'avc1', acodec: 'none', height: 480}],
  }
  const [video, audioChoice] = buildChoices(info)
  assert.equal(video!.label, '480p · mp4')
  assert.equal(audioChoice!.label, 'audio only · mp3 · ~2.9 MB')
})
