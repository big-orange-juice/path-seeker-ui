export interface PostcardTemplate {
  id: string
  name: string
  mode: 'html' | 'ai'
  html: string
  prompt: string
  width: number
  height: number
  enabled: boolean
  version: number
}

export interface NodeMedia {
  id: string
  afterSegmentNo: number
  kind: 'audio' | 'video'
  title: string
  attachmentId: string
  order: number
}

export interface NodeExperience {
  stageId: string
  enabled: boolean
  mode: 'html' | 'ai'
  templateIds: string[]
  media: NodeMedia[]
  version: number
}
