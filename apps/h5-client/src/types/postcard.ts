export interface PostcardTemplate {
  id: string
  name: string
  mode: 'html' | 'ai'
  width: number
  height: number
}

export interface NodeMedia {
  id: string
  afterSegmentNo: number
  kind: 'audio' | 'video'
  title: string
  order: number
  url: string | null
}

export interface NodeExperience {
  stageId: string
  enabled: boolean
  mode: 'html' | 'ai'
  templates: PostcardTemplate[]
  media: NodeMedia[]
}

export interface Postcard {
  id: string
  routeId: string
  stageId: string
  visitId: string
  templateId: string
  routeTitle: string
  stageTitle: string
  caption: string
  mode: 'html' | 'ai'
  locale: string
  status: 'pending' | 'rendering' | 'completed' | 'failed'
  error: string | null
  createdAt: string
  imagePath: string | null
}
