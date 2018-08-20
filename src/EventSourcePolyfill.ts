enum Fields {
  EVENT = 'event',
  DATA = 'data',
  ID = 'id',
  RETRY = 'retry'
}

interface MessagePayload {
  field: Fields,
  value: string
}

// removes leading BOM, etc
const decodeUTF8 = (str: string) => decodeURIComponent(escape(str))
const normalizeToLF = (str: string) => str.replace(/\r\n|\r/g, '\n')

class EventSourcePolyfill extends EventTarget implements EventSource {
  readonly CONNECTING: 0 = 0
  readonly OPEN: 1 = 1
  readonly CLOSED: 2 = 2
  readonly url: string
  readonly withCredentials: boolean
  private lastEventId: string = ''
  private reconnectionTime: number = 2000
  private responseTextCursor: number = 0
  private eventTypeBuffer: string = ''
  private idBuffer: string = ''
  private dataBuffer: string = ''
  private canReconnect: boolean = true
  // casted to ! because lib.dom is wrong
  onerror!: (evt: Event) => any
  onmessage!: (evt: MessageEvent) => any
  onopen!: (evt: Event) => any
  readyState!: number
  xhr: XMLHttpRequest | undefined

  constructor (url: string, config?: EventSourceInit) {
    super()
    this.url = url
    this.withCredentials = Boolean(config && config.withCredentials)
    this.addEventListener('error', (e: Event) => {
      if (this.onerror) this.onerror(e)
    })
    this.addEventListener('message', (e: Event) => {
      // listener set as Event & later casted because lib.dom is wrong
      if (this.onmessage) this.onmessage(e as MessageEvent)
    })
    this.addEventListener('open', (e: Event) => {
      if (this.onopen) this.onopen(e)
    })
    this.connect()
  }

  private announceConnection () {
    this.readyState = this.OPEN
    this.dispatchEvent(new Event('open'))
    this.responseTextCursor = 0
  }

  private connect (url: string = this.url) {
    this.readyState = this.CONNECTING
    const xhr = this.xhr = new XMLHttpRequest()
    xhr.open('GET', url, true)
    xhr.withCredentials = this.withCredentials
    xhr.setRequestHeader('Accept', 'text/event-stream')
    xhr.setRequestHeader('Cache-Control', 'no-cache')
    if (this.lastEventId) {
      xhr.setRequestHeader('Last-Event-ID', this.lastEventId)
    }
    xhr.onreadystatechange = () => {
      if (xhr.readyState <= 1 || this.readyState === this.CLOSED) return
      if (xhr.readyState === 4) {
        // is done
        this.reestablishConnection()
        return
      }
      switch (xhr.status) {
        case 200:
          this.handleConnection(xhr)
          this.interpretStream(xhr)
          break
        case 204:
          this.canReconnect = false
          break
        case 301:
        case 307:
          const redirectUrl = xhr.getResponseHeader('Location')
          this.failConnection(xhr, true)
          if (redirectUrl) {
            this.connect(redirectUrl)
          }
          break
        default:
          this.failConnection(xhr)
      }
    }
    xhr.send()
  }

  private dispatchMessageEvent (origin?: string) {
    this.lastEventId = this.idBuffer
    if (this.dataBuffer === '') {
      this.eventTypeBuffer = ''
      return
    }
    if (this.dataBuffer[this.dataBuffer.length - 1] === '\n') {
      this.dataBuffer = this.dataBuffer.slice(0, -1)
    }
    const eventType = this.eventTypeBuffer || 'message'
    const event = new MessageEvent(eventType, {data: this.dataBuffer, origin, lastEventId: this.lastEventId})
    this.eventTypeBuffer = ''
    this.dataBuffer = ''
    this.dispatchEvent(event)
  }

  private handleConnection (xhr: XMLHttpRequest) {
    if (this.readyState === this.CONNECTING) {
      const contentType = xhr.getResponseHeader('Content-Type')
      if (contentType && contentType.toLowerCase() === 'text/event-stream') {
        this.announceConnection()
      } else {
        this.failConnection(xhr)
      }
    }
  }

  private failConnection (xhr: XMLHttpRequest, isSilent: boolean = false) {
    this.readyState = this.CLOSED
    if (!isSilent) {
      this.dispatchEvent(new Event('error'))
    }
    this.canReconnect = false
    xhr.abort()
  }

  private interpretStream (xhr: XMLHttpRequest) {
    if (this.readyState !== this.OPEN) return

    let responseText = ''
    try {
      responseText = xhr.responseText
    } catch {
      return
    }

    const rawChunk = responseText.substring(this.responseTextCursor)
    this.responseTextCursor = responseText.length

    const chunk = normalizeToLF(decodeUTF8(rawChunk))

    const lines = chunk.split('\n')
    for (let ii = 0; ii < lines.length; ii++) {
      const line = lines[ii]
      if (line === '') {
        this.dispatchMessageEvent(xhr.responseURL)
      } else {
        const firstColonIdx = line.indexOf(':')
        if (firstColonIdx === 0) {
          // ignore comment line
        } else if (firstColonIdx !== -1) {
          const field = line.substring(0, firstColonIdx) as Fields
          const untrimmedVal = line.substring(firstColonIdx + 1)
          const value = untrimmedVal.indexOf(' ') === 0 ? untrimmedVal.slice(1) : untrimmedVal
          this.processField({field, value})
        } else {
          this.processField({field: line as Fields, value: ''})
        }
      }
    }

  }

  private processField (payload: MessagePayload) {
    switch (payload.field) {
      case Fields.EVENT:
        this.eventTypeBuffer = payload.value
        break
      case Fields.DATA:
        this.dataBuffer += `${payload.value}\n`
        break
      case Fields.ID:
        if (payload.value.indexOf('\u0000') === -1) {
          this.idBuffer = payload.value
        }
        break
      case Fields.RETRY:
        const interval = +payload.value
        if (Number.isInteger(interval)) {
          this.reconnectionTime = interval
        }
    }
  }

  private reestablishConnection () {
    if (this.readyState === this.CLOSED || !this.canReconnect) return
    this.readyState = this.CONNECTING
    this.dispatchEvent(new Event('error'))
    setTimeout(() => {
      if (this.readyState !== this.CONNECTING) return
      this.connect()
    }, this.reconnectionTime)
  }

  close () {
    this.readyState = this.CLOSED
    this.xhr && this.xhr.abort()
  }
}

export default EventSourcePolyfill
