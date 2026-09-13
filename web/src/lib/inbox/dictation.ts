import { Capacitor } from '@capacitor/core'

type SpeechRec = {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult:
    | ((event: {
        resultIndex: number
        results: ArrayLike<{ isFinal?: boolean } & ArrayLike<{ transcript: string }>>
      }) => void)
    | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

export type DictationHandle = {
  stop: () => Promise<void> | void
}

export type DictationCallbacks = {
  onPartial: (transcript: string) => void
  onFinal?: (transcript: string) => void
  onError: (message: string) => void
  onEnd: () => void
}

function resolveLanguage(preferred?: string): string {
  const candidate = (preferred || (typeof navigator !== 'undefined' ? navigator.language : '') || 'ar-AE').trim()
  if (!candidate) return 'en-US'
  return candidate
}

function webSpeechCtor(): (new () => SpeechRec) | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: new () => SpeechRec
    webkitSpeechRecognition?: new () => SpeechRec
  }
  return w.SpeechRecognition || w.webkitSpeechRecognition || null
}

export async function isSpeechAvailable(): Promise<boolean> {
  if (Capacitor.isNativePlatform()) return true
  return Boolean(webSpeechCtor())
}

export async function startDictation(
  language: string | undefined,
  callbacks: DictationCallbacks,
): Promise<DictationHandle> {
  const lang = resolveLanguage(language)

  if (Capacitor.isNativePlatform()) {
    const { SpeechRecognition } = await import('@capacitor-community/speech-recognition')
    try {
      const permission = await SpeechRecognition.checkPermissions()
      if (permission.speechRecognition !== 'granted') {
        const requested = await SpeechRecognition.requestPermissions()
        if (requested.speechRecognition !== 'granted') {
          callbacks.onError('Microphone access needed for voice dictation.')
          callbacks.onEnd()
          return { stop: async () => undefined }
        }
      }
    } catch {
      callbacks.onError('Microphone access needed for voice dictation.')
      callbacks.onEnd()
      return { stop: async () => undefined }
    }

    let lastPartial = ''
    const listener = await SpeechRecognition.addListener('partialResults', (event) => {
      const matches = Array.isArray(event.matches) ? event.matches : []
      const transcript = matches.filter(Boolean).join(' ').trim()
      if (!transcript) return
      lastPartial = transcript
      callbacks.onPartial(transcript)
    })

    try {
      await SpeechRecognition.start({
        language: lang || 'ar-AE',
        partialResults: true,
        popup: false,
      })
    } catch {
      try {
        await SpeechRecognition.start({
          language: 'en-US',
          partialResults: true,
          popup: false,
        })
      } catch {
        callbacks.onError('Voice dictation could not start.')
        callbacks.onEnd()
        return { stop: async () => undefined }
      }
    }

    return {
      stop: async () => {
        try {
          await listener.remove()
        } catch {
          // ignore
        }
        try {
          await SpeechRecognition.stop()
        } catch {
          // ignore
        }
        if (lastPartial) callbacks.onFinal?.(lastPartial)
        callbacks.onEnd()
      },
    }
  }

  const Ctor = webSpeechCtor()
  if (!Ctor) {
    callbacks.onError('Voice dictation is not available in this browser.')
    callbacks.onEnd()
    return { stop: () => undefined }
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    callbacks.onError('Voice dictation needs an internet connection.')
    callbacks.onEnd()
    return { stop: () => undefined }
  }

  const rec = new Ctor()
  rec.continuous = true
  rec.interimResults = true
  rec.lang = lang || 'en-US'
  let finalTranscript = ''

  rec.onresult = (event) => {
    let interim = ''
    let finals = ''
    for (let i = event.resultIndex; i < event.results.length; i += 1) {
      const result = event.results[i]
      const piece = result[0]?.transcript || ''
      if (result.isFinal) finals += piece
      else interim += piece
    }
    if (interim) callbacks.onPartial(interim)
    if (finals) {
      finalTranscript = `${finalTranscript}${finals}`.trim()
      callbacks.onFinal?.(finals.trim())
      callbacks.onPartial(finalTranscript)
    }
  }
  rec.onerror = (event) => {
    if (event.error === 'not-allowed') {
      callbacks.onError('Microphone access needed for voice dictation.')
    } else {
      callbacks.onError('Voice dictation stopped.')
    }
    callbacks.onEnd()
  }
  rec.onend = () => callbacks.onEnd()
  rec.start()

  return {
    stop: () => {
      rec.stop()
      if (finalTranscript) callbacks.onFinal?.(finalTranscript)
      callbacks.onEnd()
    },
  }
}
